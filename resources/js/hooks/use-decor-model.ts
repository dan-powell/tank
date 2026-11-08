import { use } from 'react';
import type { BufferGeometry } from 'three';
import {
    buildVolumeGeometry,
    generateRock,
    rotateVolume,
    volumeFromVox,
} from '@/lib/tank/voxel-volume';
import type { VoxelVolume } from '@/lib/tank/voxel-volume';
import type { DecorationDefinition, DecorationSnapshot } from '@/types';

/**
 * MagicaVoxel models keyed by file name, e.g. `coral-wall.vox`. Drop new
 * files into resources/models/decor and add them to DecorationCatalogue.
 */
const VOX_FILES: Record<string, string> = Object.fromEntries(
    Object.entries(
        import.meta.glob<string>('/resources/models/decor/*.vox', {
            eager: true,
            query: '?url',
            import: 'default',
        }),
    ).map(([path, url]) => [path.split('/').pop() as string, url]),
);

/** A decoration model turned to a placement's rotation, with its mesh. */
export type DecorModel = {
    volume: VoxelVolume;
    geometry: BufferGeometry;
};

const volumes = new Map<string, Promise<VoxelVolume>>();
const loadedVolumes = new Map<string, VoxelVolume>();
const batches = new Map<string, Promise<void>>();
const models = new Map<string, DecorModel>();

/**
 * The models for every placed decoration, keyed by decoration id. Suspends
 * while .vox files load; rocks are generated from each placement's seed, so
 * no two look alike. Decorations of unknown types are left out.
 */
export function useDecorModels(
    decorations: DecorationSnapshot[],
    catalogue: Map<string, DecorationDefinition>,
): Map<number, DecorModel> {
    const sources = new Map<string, DecorationDefinition & { seed: number }>();

    for (const decoration of decorations) {
        const definition = catalogue.get(decoration.type);

        if (definition !== undefined) {
            sources.set(sourceKey(definition, decoration.seed), {
                ...definition,
                seed: decoration.seed,
            });
        }
    }

    const missing = [...sources.keys()].filter(
        (key) => !loadedVolumes.has(key),
    );

    if (missing.length > 0) {
        const batchKey = missing.sort().join('|');
        let batch = batches.get(batchKey);

        if (batch === undefined) {
            batch = Promise.all(
                missing.map((key) => {
                    const source = sources.get(key)!;
                    let volume = volumes.get(key);

                    if (volume === undefined) {
                        volume = loadVolume(source, source.seed);
                        volumes.set(key, volume);
                    }

                    return volume.then((loaded) => {
                        loadedVolumes.set(key, loaded);
                    });
                }),
            ).then(() => undefined);
            batches.set(batchKey, batch);
        }

        use(batch);
    }

    const result = new Map<number, DecorModel>();

    for (const decoration of decorations) {
        const definition = catalogue.get(decoration.type);

        if (definition === undefined) {
            continue;
        }

        const key = sourceKey(definition, decoration.seed);
        const modelKey = `${key}:${decoration.rotation}`;
        let model = models.get(modelKey);

        if (model === undefined) {
            const rotated = rotateVolume(
                loadedVolumes.get(key)!,
                decoration.rotation,
            );
            model = { volume: rotated, geometry: buildVolumeGeometry(rotated) };
            models.set(modelKey, model);
        }

        result.set(decoration.id, model);
    }

    return result;
}

function sourceKey(definition: DecorationDefinition, seed: number): string {
    return definition.source === 'rock'
        ? `${definition.slug}:${seed}`
        : definition.slug;
}

async function loadVolume(
    definition: DecorationDefinition,
    seed: number,
): Promise<VoxelVolume> {
    if (definition.source === 'rock') {
        return generateRock(definition, seed);
    }

    const url = VOX_FILES[`${definition.slug}.vox`];

    try {
        if (url === undefined) {
            throw new Error('No model file.');
        }

        const response = await fetch(url);

        return volumeFromVox(await response.arrayBuffer());
    } catch (error) {
        console.error(`Could not load model for ${definition.slug}`, error);

        return generateRock(definition, seed);
    }
}
