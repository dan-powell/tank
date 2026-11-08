import { use } from 'react';
import { Color } from 'three';
import type { BufferGeometry } from 'three';
import { CELLS_PER_CM } from '@/lib/tank/space';
import {
    buildVolumeGeometry,
    createVolume,
    setVoxel,
    TINT_INDEX,
    volumesFromVox,
} from '@/lib/tank/voxel-volume';
import type { VoxelVolume } from '@/lib/tank/voxel-volume';
import type { Species } from '@/types';

/**
 * Model file URLs keyed by species slug. Drop `{slug}.vox` files into
 * resources/models/species to add or replace a species' look.
 */
const FILES: Record<string, string> = Object.fromEntries(
    Object.entries(
        import.meta.glob<string>('/resources/models/species/*.vox', {
            eager: true,
            query: '?url',
            import: 'default',
        }),
    ).map(([path, url]) => [
        (path.split('/').pop() as string).replace(/\.vox$/, ''),
        url,
    ]),
);

/** One MagicaVoxel object as a mesh: centred on x/z with its base at y = 0, in voxels. */
export type ModelFrame = {
    geometry: BufferGeometry;
    /** Width, height and depth in voxels. */
    size: [number, number, number];
    /** The voxels themselves, for assembling plants from parts. */
    volume: VoxelVolume;
};

/**
 * A species' models. Animals have frames by growth stage and clip
 * (objects named `stage.clip.frame`); plants have named parts (`stem.0`,
 * `tip`, ...) with any numbered variants grouped under one name.
 */
export type SpeciesModel = {
    stages: Map<string, Map<string, ModelFrame[]>>;
    parts: Map<string, ModelFrame[]>;
};

const models = new Map<string, Promise<SpeciesModel>>();

/**
 * The models for a species, built once and shared by every individual.
 * Suspends while the file loads; a species without a file (or whose file
 * fails to load) gets a plain block in its catalogue colour.
 */
export function useSpeciesModel(species: Species): SpeciesModel {
    let model = models.get(species.slug);

    if (model === undefined) {
        model = loadModel(species);
        models.set(species.slug, model);
    }

    return use(model);
}

async function loadModel(species: Species): Promise<SpeciesModel> {
    const url = FILES[species.slug];

    if (url !== undefined) {
        try {
            const response = await fetch(url);

            return modelFromVolumes(
                volumesFromVox(await response.arrayBuffer()),
            );
        } catch (error) {
            console.error(`Could not load model for ${species.slug}`, error);
        }
    }

    return modelFromVolumes([
        { name: 'default.idle.0', volume: placeholderVolume(species) },
    ]);
}

function modelFromVolumes(
    volumes: { name: string; volume: VoxelVolume }[],
): SpeciesModel {
    const model: SpeciesModel = { stages: new Map(), parts: new Map() };

    for (const { name, volume } of volumes) {
        const [width, height, depth] = volume.size;
        const geometry = buildVolumeGeometry(volume, { tintIndex: TINT_INDEX });
        geometry.translate(-width / 2, 0, -depth / 2);
        const frame: ModelFrame = {
            geometry,
            size: [width, height, depth],
            volume,
        };
        const animation = /^([^.]+)\.([^.]+)\.(\d+)$/.exec(name);

        if (animation !== null) {
            const [, stage, clip, index] = animation;
            const clips = model.stages.get(stage) ?? new Map();
            const frames = clips.get(clip) ?? [];
            frames[Number(index)] = frame;
            clips.set(clip, frames);
            model.stages.set(stage, clips);
        } else if (name === '') {
            appendFrame(model, 'default', 'idle', frame);
        } else {
            const part = name.replace(/\.\d+$/, '');
            model.parts.set(part, [...(model.parts.get(part) ?? []), frame]);
        }
    }

    // Close any gaps left by frames numbered out of order.
    for (const clips of model.stages.values()) {
        for (const [clip, frames] of clips) {
            clips.set(clip, frames.filter(Boolean));
        }
    }

    return model;
}

function appendFrame(
    model: SpeciesModel,
    stage: string,
    clip: string,
    frame: ModelFrame,
): void {
    const clips = model.stages.get(stage) ?? new Map();
    clips.set(clip, [...(clips.get(clip) ?? []), frame]);
    model.stages.set(stage, clips);
}

/**
 * The growth stage a creature of this size shows: the last of the
 * catalogue's stages it has reached, among those its model has.
 */
export function stageFor(
    species: Species,
    model: SpeciesModel,
    size: number,
): string {
    const reached = Object.entries(species.render.stages ?? {})
        .filter(
            ([stage, minSize]) => size >= minSize && model.stages.has(stage),
        )
        .map(([stage]) => stage);

    return (
        reached.at(-1) ??
        (model.stages.keys().next().value as string | undefined) ??
        'default'
    );
}

/** The frames of a clip at a stage, falling back to `idle` and then any clip. */
export function framesFor(
    model: SpeciesModel,
    stage: string,
    clip: string,
): ModelFrame[] {
    const clips =
        model.stages.get(stage) ??
        (model.stages.values().next().value as
            | Map<string, ModelFrame[]>
            | undefined);

    if (clips === undefined) {
        return [];
    }

    return (
        clips.get(clip) ??
        clips.get('idle') ??
        (clips.values().next().value as ModelFrame[] | undefined) ??
        []
    );
}

/** A plain block the size of an adult, in the species' catalogue colour. */
function placeholderVolume(species: Species): VoxelVolume {
    const hex =
        species.render.color ??
        species.render.body ??
        species.render.shell ??
        '#9aa5b1';
    const length = Math.max(
        2,
        Math.round((species.adult_size ?? 1) * CELLS_PER_CM),
    );
    const height = Math.max(1, Math.round(length * 0.4));
    const depth = Math.max(1, Math.round(length * 0.3));
    const volume = createVolume(
        [length, height, depth],
        [new Color(), new Color(hex)],
    );

    for (let y = 0; y < height; y++) {
        for (let z = 0; z < depth; z++) {
            for (let x = 0; x < length; x++) {
                setVoxel(volume, x, y, z, 1);
            }
        }
    }

    return volume;
}
