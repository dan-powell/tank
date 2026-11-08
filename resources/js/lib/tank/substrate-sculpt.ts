import type { TankGrid } from '@/types';
import { CELLS_PER_CM, DEFAULT_SUBSTRATE_CELLS } from './space';

export type SculptTool = 'raise' | 'lower' | 'smooth' | 'flatten';

/** The active sculpting brush. */
export type SculptBrush = {
    tool: SculptTool;
    /** Brush radius in centimetres. */
    radiusCm: number;
};

/** How fast Raise and Lower change the gravel at the brush centre, in cells per second (7 cm). */
const RAISE_RATE = 7 * CELLS_PER_CM;

/** How quickly Smooth and Flatten pull the gravel towards their target, per second. */
const BLEND_RATE = 5;

/** How far Smooth averages the gravel around each column, in cells (1 cm). */
const SMOOTH_RADIUS = CELLS_PER_CM;

/**
 * Apply one dab of the brush centred on a grid position, over `seconds` of
 * holding it there. Heights are fractional while a stroke is in progress;
 * `target` is the height Flatten levels towards. Only the columns under the
 * brush are visited.
 */
export function applyBrush(
    grid: TankGrid,
    heights: Float32Array,
    brush: SculptBrush,
    cellX: number,
    cellZ: number,
    seconds: number,
    target: number,
): void {
    const radius = Math.max(brush.radiusCm * CELLS_PER_CM, 1);
    const box = {
        x0: clamp(Math.floor(cellX - radius), 0, grid.width - 1),
        x1: clamp(Math.ceil(cellX + radius), 0, grid.width - 1),
        z0: clamp(Math.floor(cellZ - radius), 0, grid.depth - 1),
        z1: clamp(Math.ceil(cellZ + radius), 0, grid.depth - 1),
    };
    const average =
        brush.tool === 'smooth' ? boxAverage(grid, heights, box) : null;
    const blend = Math.min(1, BLEND_RATE * seconds);
    const boxWidth = box.x1 - box.x0 + 1;

    for (let z = box.z0; z <= box.z1; z++) {
        for (let x = box.x0; x <= box.x1; x++) {
            const distance = Math.hypot(x + 0.5 - cellX, z + 0.5 - cellZ);

            if (distance >= radius) {
                continue;
            }

            const falloff = 0.5 * (1 + Math.cos((Math.PI * distance) / radius));
            const index = z * grid.width + x;
            let height = heights[index];

            switch (brush.tool) {
                case 'raise':
                    height += RAISE_RATE * seconds * falloff;
                    break;
                case 'lower':
                    height -= RAISE_RATE * seconds * falloff;
                    break;
                case 'flatten':
                    height += (target - height) * blend * falloff;
                    break;
                case 'smooth':
                    height +=
                        ((average?.[(z - box.z0) * boxWidth + (x - box.x0)] ??
                            height) -
                            height) *
                        blend *
                        falloff;
                    break;
            }

            heights[index] = clamp(height, 0, grid.max_water_level);
        }
    }
}

/** Whole-cell heights, ready to save. */
export function settleHeights(
    grid: TankGrid,
    heights: ArrayLike<number>,
): Uint16Array {
    return Uint16Array.from(heights, (height) =>
        clamp(Math.round(height), 0, grid.max_water_level),
    );
}

/**
 * The mean height within {@link SMOOTH_RADIUS} of each column in a box of the
 * grid (row by row within the box), as two separable passes.
 */
function boxAverage(
    grid: TankGrid,
    heights: ArrayLike<number>,
    box: { x0: number; x1: number; z0: number; z1: number },
): Float32Array {
    const z0 = Math.max(0, box.z0 - SMOOTH_RADIUS);
    const z1 = Math.min(grid.depth - 1, box.z1 + SMOOTH_RADIUS);
    const boxWidth = box.x1 - box.x0 + 1;
    const across = new Float32Array((z1 - z0 + 1) * boxWidth);

    for (let z = z0; z <= z1; z++) {
        for (let x = box.x0; x <= box.x1; x++) {
            const from = Math.max(0, x - SMOOTH_RADIUS);
            const to = Math.min(grid.width - 1, x + SMOOTH_RADIUS);
            let total = 0;

            for (let nx = from; nx <= to; nx++) {
                total += heights[z * grid.width + nx];
            }

            across[(z - z0) * boxWidth + (x - box.x0)] =
                total / (to - from + 1);
        }
    }

    const average = new Float32Array((box.z1 - box.z0 + 1) * boxWidth);

    for (let z = box.z0; z <= box.z1; z++) {
        const from = Math.max(z0, z - SMOOTH_RADIUS);
        const to = Math.min(z1, z + SMOOTH_RADIUS);

        for (let x = 0; x < boxWidth; x++) {
            let total = 0;

            for (let nz = from; nz <= to; nz++) {
                total += across[(nz - z0) * boxWidth + x];
            }

            average[(z - box.z0) * boxWidth + x] = total / (to - from + 1);
        }
    }

    return average;
}

/** A ready-made substrate shape. */
export type SubstratePreset = {
    key: string;
    label: string;
    description: string;
    build: (grid: TankGrid) => Uint16Array;
};

/**
 * Build a heightmap from a shape function of normalised position (u from
 * left to right, v from back to front), returning 0 (flat) to 1 (land).
 */
function shaped(
    grid: TankGrid,
    shape: (u: number, v: number) => number,
): Uint16Array {
    const low = DEFAULT_SUBSTRATE_CELLS;
    // Land stands a little proud (2 cm) of the water when the water is low enough.
    const high = Math.min(
        grid.max_water_level,
        Math.max(grid.water_level + 2 * CELLS_PER_CM, low + 6 * CELLS_PER_CM),
    );
    const heights = new Uint16Array(grid.width * grid.depth);

    for (let z = 0; z < grid.depth; z++) {
        for (let x = 0; x < grid.width; x++) {
            const amount = clamp(
                shape((x + 0.5) / grid.width, (z + 0.5) / grid.depth),
                0,
                1,
            );
            heights[z * grid.width + x] = Math.round(
                low + (high - low) * amount,
            );
        }
    }

    return heights;
}

const smoothstep = (edge0: number, edge1: number, x: number) => {
    const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);

    return t * t * (3 - 2 * t);
};

export const SUBSTRATE_PRESETS: SubstratePreset[] = [
    {
        key: 'flat',
        label: 'Flat',
        description: 'An even layer of gravel.',
        build: (grid) => shaped(grid, () => 0),
    },
    {
        key: 'slope',
        label: 'Slope',
        description: 'Rising towards the back glass.',
        build: (grid) => shaped(grid, (_, v) => (1 - v) * 0.6),
    },
    {
        key: 'beach-left',
        label: 'Beach on the left',
        description: 'Land on the left, shelving into the water.',
        build: (grid) => shaped(grid, (u) => 1 - smoothstep(0.28, 0.55, u)),
    },
    {
        key: 'beach-right',
        label: 'Beach on the right',
        description: 'Land on the right, shelving into the water.',
        build: (grid) => shaped(grid, (u) => smoothstep(0.45, 0.72, u)),
    },
    {
        key: 'island',
        label: 'Island',
        description: 'A mound in the middle with water all round.',
        build: (grid) =>
            shaped(grid, (u, v) => {
                const distance = Math.hypot((u - 0.5) / 0.26, (v - 0.5) / 0.38);

                return 1 - smoothstep(0.55, 1, distance);
            }),
    },
    {
        key: 'terraces',
        label: 'Terraces',
        description: 'Three steps down from the back to the front.',
        build: (grid) =>
            shaped(grid, (_, v) => (v < 0.33 ? 1 : v < 0.66 ? 0.5 : 0)),
    },
];

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}
