import type { SpeciesModel } from '@/hooks/use-species-model';
import type { GridCell, Species } from '@/types';
import {
    createVolume,
    rotateCell,
    rotateVolume,
    setVoxel,
    voxelAt,
} from './voxel-volume';
import type { VoxelVolume } from './voxel-volume';

/**
 * A plant built from its model's parts, in voxels. `origin` is the cell the
 * plant is rooted in: the bottom of the root column, at its centre.
 */
export type AssembledPlant = {
    volume: VoxelVolume;
    origin: GridCell;
};

/** Spacing (voxels) between moss patches as a cushion spreads. */
export const MOSS_SPACING = 2;

type Placement = { volume: VoxelVolume; x: number; y: number; z: number };

/**
 * Build a plant from its parts: a `base`, then a chain of `stem` segments
 * per blade or stalk (one per growth segment), a `tip`, and `leaf` parts
 * along the way, depending on how the species grows. Every choice (which
 * variant, which way a stalk leans) is fixed per plant and per segment, so a
 * plant keeps its shape and only gains segments as it grows.
 */
export function assemblePlant(
    model: SpeciesModel,
    species: Species,
    segments: number,
    seed: number,
): AssembledPlant {
    const placements: Placement[] = [];
    const random = (...keys: number[]) => hash(seed, ...keys);
    const pick = (name: string, ...keys: number[]): VoxelVolume | undefined => {
        const variants = model.parts.get(name);

        return variants === undefined || variants.length === 0
            ? undefined
            : variants[Math.floor(random(...keys) * variants.length)].volume;
    };
    const place = (volume: VoxelVolume, x: number, y: number, z: number) =>
        placements.push({
            volume,
            x: x - Math.floor(volume.size[0] / 2),
            y,
            z: z - Math.floor(volume.size[2] / 2),
        });

    const base = pick('base', 0);
    const start = base?.size[1] ?? 0;

    if (base !== undefined) {
        place(base, 0, 0, 0);
    }

    /**
     * Stack a stalk of `length` segments from (x, z), leaning now and then,
     * mostly towards `lean` (x, z: -1, 0 or 1); returns its joints (the top
     * of each segment).
     */
    const stalk = (
        stalkIndex: number,
        x: number,
        z: number,
        length: number,
        lean: [number, number] = [0, 0],
    ): GridCell[] => {
        const joints: GridCell[] = [];
        const [startX, startZ] = [x, z];
        let y = start;

        for (let i = 0; i < length; i++) {
            const stem = pick('stem', stalkIndex, i, 1);

            if (stem === undefined) {
                break;
            }

            place(stem, x, y, z);
            y += stem.size[1];
            joints.push([x, y, z]);

            x = clamp(
                x + leanStep(stalkIndex, i, 2, lean[0]),
                startX - MAX_LEAN,
                startX + MAX_LEAN,
            );
            z = clamp(
                z + leanStep(stalkIndex, i, 4, lean[1]),
                startZ - MAX_LEAN,
                startZ + MAX_LEAN,
            );
        }

        const tip = pick('tip', stalkIndex, 6);

        if (tip !== undefined && joints.length > 0) {
            const [, top] = joints[joints.length - 1];
            place(tip, x, top, z);
        }

        return joints;
    };

    const length = Math.max(1, segments);

    switch (species.behaviour) {
        case 'whorl': {
            stalk(0, 0, 0, length).forEach(([x, y, z], i) => {
                const leaf = pick('leaf', 0, i, 7);

                if (leaf !== undefined) {
                    place(leaf, x, Math.max(start, y - 2), z);
                }
            });
            break;
        }

        case 'frond': {
            const stalks = length > 2 ? 2 : 1;

            for (let s = 0; s < stalks; s++) {
                stalk(s, s === 0 ? 0 : 1, s === 0 ? 0 : -1, length - s).forEach(
                    (joint, i) => placeLeaf(joint, s, i),
                );
            }
            break;
        }

        default: {
            // Ribbons: blades of different lengths fanning out from one crown.
            const blades = Math.max(1, species.render.blades ?? 3);

            for (let b = 0; b < blades; b++) {
                const [x, z] = BLADE_SPOTS[b % BLADE_SPOTS.length];
                stalk(b, x, z, Math.max(1, length - (b % 3)), [
                    Math.sign(x),
                    Math.sign(z),
                ]);
            }
        }
    }

    return compose(placements);

    /** How far a stalk moves sideways after a segment: now and then a step, usually towards `towards`. */
    function leanStep(
        stalkIndex: number,
        i: number,
        salt: number,
        towards: number,
    ): number {
        if (random(stalkIndex, i, salt) >= (towards === 0 ? 0.25 : 0.45)) {
            return 0;
        }

        const direction = towards === 0 ? 1 : towards;

        return random(stalkIndex, i, salt + 1) < (towards === 0 ? 0.5 : 0.8)
            ? direction
            : -direction;
    }

    /** A frond leaf growing out from a joint, turned a different way at each joint. */
    function placeLeaf([x, y, z]: GridCell, stalkIndex: number, i: number) {
        const leaf = pick('leaf', stalkIndex, i, 8);

        if (leaf === undefined) {
            return;
        }

        const turns = (i + Math.floor(random(stalkIndex, 9) * 4)) % 4;
        const rotated = rotateVolume(leaf, turns);
        // Leaves grow out along +x from their stalk end at x = 0, mid-depth.
        const [ax, , az] = rotateCell(
            [0, 0, Math.floor(leaf.size[2] / 2)],
            leaf.size,
            turns,
        );
        placements.push({
            volume: rotated,
            x: x - ax,
            y: Math.max(start, y - 1),
            z: z - az,
        });
    }
}

/** Where ribbon blades rise from, around the crown (x, z in voxels); each leans away from the middle. */
const BLADE_SPOTS: [number, number][] = [
    [0, 0],
    [-3, 1],
    [3, -1],
    [-1, -3],
    [2, 3],
];

/** Furthest (voxels) a stalk drifts sideways from where it rises. */
const MAX_LEAN = 4;

/**
 * A cushion of moss: `count` patches spreading outwards from the root in a
 * ragged ring, each sitting on the ground beneath it. `groundAt` gives the
 * ground's height (voxels, relative to the root) at an offset from the root.
 * Patch spots and variants are fixed per plant, so a growing cushion keeps
 * its patches and adds new ones at its edge.
 */
export function assembleMoss(
    model: SpeciesModel,
    count: number,
    seed: number,
    groundAt: (dx: number, dz: number) => number,
): AssembledPlant {
    const patches = model.parts.get('patch') ?? [];
    const placements: Placement[] = [];

    if (patches.length === 0 || count <= 0) {
        return compose(placements);
    }

    const reach = Math.ceil(Math.sqrt(count)) + 2;
    const spots: {
        x: number;
        z: number;
        key: number;
        gx: number;
        gz: number;
    }[] = [];

    for (let gz = -reach; gz <= reach; gz++) {
        for (let gx = -reach; gx <= reach; gx++) {
            const x =
                gx * MOSS_SPACING + Math.round(hash(seed, gx, gz, 1) - 0.5);
            const z =
                gz * MOSS_SPACING + Math.round(hash(seed, gx, gz, 2) - 0.5);
            spots.push({
                x,
                z,
                gx,
                gz,
                key: Math.hypot(gx, gz) + hash(seed, gx, gz, 3) * 1.5,
            });
        }
    }

    spots.sort((a, b) => a.key - b.key);

    for (const { x, z, gx, gz } of spots.slice(0, count)) {
        const volume =
            patches[Math.floor(hash(seed, gx, gz, 4) * patches.length)].volume;
        placements.push({
            volume,
            x: x - Math.floor(volume.size[0] / 2),
            y: Math.round(groundAt(x, z)),
            z: z - Math.floor(volume.size[2] / 2),
        });
    }

    return compose(placements);
}

/** Stamp placed parts into one volume; earlier parts win where they overlap. */
function compose(placements: Placement[]): AssembledPlant {
    if (placements.length === 0) {
        return {
            volume: createVolume([1, 1, 1], []),
            origin: [0, 0, 0],
        };
    }

    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];

    for (const { volume, x, y, z } of placements) {
        [x, y, z].forEach((value, axis) => {
            min[axis] = Math.min(min[axis], value);
            max[axis] = Math.max(max[axis], value + volume.size[axis]);
        });
    }

    const volume = createVolume(
        [max[0] - min[0], max[1] - min[1], max[2] - min[2]],
        placements[0].volume.palette,
    );

    for (const placement of placements) {
        const [width, height, depth] = placement.volume.size;

        for (let y = 0; y < height; y++) {
            for (let z = 0; z < depth; z++) {
                for (let x = 0; x < width; x++) {
                    const value = voxelAt(placement.volume, x, y, z);
                    const tx = placement.x + x - min[0];
                    const ty = placement.y + y - min[1];
                    const tz = placement.z + z - min[2];

                    if (value !== 0 && voxelAt(volume, tx, ty, tz) === 0) {
                        setVoxel(volume, tx, ty, tz, value);
                    }
                }
            }
        }
    }

    return { volume, origin: [-min[0], -min[1], -min[2]] };
}

/** A deterministic 0..1 value for a list of integers. */
function hash(...keys: number[]): number {
    let h = 2166136261;

    for (const key of keys) {
        h = Math.imul(h ^ (key | 0), 16777619);
        h = Math.imul(h ^ (h >>> 13), 0x5bd1e995);
    }

    h ^= h >>> 15;

    return (h >>> 0) / 4294967296;
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}
