import type { TankGrid } from '@/types';
import { DEFAULT_SUBSTRATE_CELLS } from './space';

/**
 * The substrate's surface height (in grid cells) at every x/z column of the
 * grid, row by row from the back glass (index = z * width + x). Saved shapes
 * are whole cells; a stroke in progress is fractional.
 */
export type Heightmap = ArrayLike<number>;

/** Decode the server's run-length [height, count, ...] pairs into a heightmap. */
export function decodeSubstrate(runs: number[], grid: TankGrid): Uint16Array {
    const heights = new Uint16Array(grid.width * grid.depth).fill(
        DEFAULT_SUBSTRATE_CELLS,
    );
    let index = 0;

    for (let run = 0; run + 1 < runs.length; run += 2) {
        const end = Math.min(heights.length, index + runs[run + 1]);
        heights.fill(runs[run], index, end);
        index = end;
    }

    return heights;
}

/** Run-length encode a heightmap as [height, count, ...] pairs for the server. */
export function encodeSubstrate(heights: Heightmap): number[] {
    const runs: number[] = [];

    for (let index = 0; index < heights.length; index++) {
        const height = heights[index];

        if (runs.length > 0 && runs[runs.length - 2] === height) {
            runs[runs.length - 1]++;
        } else {
            runs.push(height, 1);
        }
    }

    return runs;
}

/** The height of the grid column containing a (fractional) grid position. */
export function heightAt(
    grid: TankGrid,
    heights: Heightmap,
    cellX: number,
    cellZ: number,
): number {
    const x = Math.min(grid.width - 1, Math.max(0, Math.floor(cellX)));
    const z = Math.min(grid.depth - 1, Math.max(0, Math.floor(cellZ)));

    return heights[z * grid.width + x];
}
