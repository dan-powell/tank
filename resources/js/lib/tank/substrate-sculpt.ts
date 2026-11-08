import type { TankGrid } from '@/types';

export type SculptTool = 'raise' | 'lower' | 'smooth' | 'flatten';

/** The active sculpting brush. */
export type SculptBrush = {
    tool: SculptTool;
    /** Brush radius in centimetres. */
    radiusCm: number;
};

/** Grid cells per centimetre, and an unsculpted substrate's depth in cells (match TankGeometry). */
const CELLS_PER_CM = 2;
const DEFAULT_SUBSTRATE = 4;

/** How fast Raise and Lower change the gravel at the brush centre, in cells per second. */
const RAISE_RATE = 14;

/** How quickly Smooth and Flatten pull the gravel towards their target, per second. */
const BLEND_RATE = 5;

export function heightmapSize(grid: TankGrid): {
    columns: number;
    rows: number;
} {
    return {
        columns: Math.ceil(grid.width / grid.substrate_column),
        rows: Math.ceil(grid.depth / grid.substrate_column),
    };
}

/** The centre of a heightmap column, in (fractional) grid cells. */
function columnCentre(
    grid: TankGrid,
    column: number,
    row: number,
): { x: number; z: number } {
    const size = grid.substrate_column;

    return {
        x: column * size + Math.min(size, grid.width - column * size) / 2,
        z: row * size + Math.min(size, grid.depth - row * size) / 2,
    };
}

/** The heightmap value nearest a grid position. */
export function heightAt(
    grid: TankGrid,
    heights: ArrayLike<number>,
    cellX: number,
    cellZ: number,
): number {
    const { columns, rows } = heightmapSize(grid);
    const column = clamp(
        Math.floor(cellX / grid.substrate_column),
        0,
        columns - 1,
    );
    const row = clamp(Math.floor(cellZ / grid.substrate_column), 0, rows - 1);

    return heights[row * columns + column];
}

/**
 * Apply one dab of the brush centred on a grid position, over `seconds` of
 * holding it there. Heights are fractional while a stroke is in progress;
 * `target` is the height Flatten levels towards.
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
    const { columns, rows } = heightmapSize(grid);
    const radius = Math.max(
        brush.radiusCm * CELLS_PER_CM,
        grid.substrate_column * 0.75,
    );
    const source =
        brush.tool === 'smooth' ? Float32Array.from(heights) : heights;
    const blend = Math.min(1, BLEND_RATE * seconds);

    for (let row = 0; row < rows; row++) {
        for (let column = 0; column < columns; column++) {
            const centre = columnCentre(grid, column, row);
            const distance = Math.hypot(centre.x - cellX, centre.z - cellZ);

            if (distance >= radius) {
                continue;
            }

            const falloff = 0.5 * (1 + Math.cos((Math.PI * distance) / radius));
            const index = row * columns + column;
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
                        (neighbourAverage(source, columns, rows, column, row) -
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
): number[] {
    return Array.from(heights, (height) =>
        clamp(Math.round(height), 0, grid.max_water_level),
    );
}

function neighbourAverage(
    heights: Float32Array,
    columns: number,
    rows: number,
    column: number,
    row: number,
): number {
    let total = 0;
    let count = 0;

    for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
            const c = column + dx;
            const r = row + dz;

            if (c >= 0 && r >= 0 && c < columns && r < rows) {
                total += heights[r * columns + c];
                count++;
            }
        }
    }

    return total / count;
}

/** A ready-made substrate shape. */
export type SubstratePreset = {
    key: string;
    label: string;
    description: string;
    build: (grid: TankGrid) => number[];
};

/**
 * Build a heightmap from a shape function of normalised position (u from
 * left to right, v from back to front), returning 0 (flat) to 1 (land).
 */
function shaped(
    grid: TankGrid,
    shape: (u: number, v: number) => number,
): number[] {
    const { columns, rows } = heightmapSize(grid);
    const low = DEFAULT_SUBSTRATE;
    // Land stands a little proud of the water when the water is low enough.
    const high = Math.min(
        grid.max_water_level,
        Math.max(grid.water_level + 4, low + 12),
    );
    const heights: number[] = [];

    for (let row = 0; row < rows; row++) {
        for (let column = 0; column < columns; column++) {
            const centre = columnCentre(grid, column, row);
            const amount = clamp(
                shape(centre.x / grid.width, centre.z / grid.depth),
                0,
                1,
            );
            heights.push(Math.round(low + (high - low) * amount));
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
