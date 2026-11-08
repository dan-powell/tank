import { Vector3 } from 'three';
import type { GridCell, TankGrid } from '@/types';
import { VOXEL, TANK } from './space';
import { heightAt } from './substrate-heightmap';
import type { Heightmap } from './substrate-heightmap';
import type { VoxelVolume } from './voxel-volume';
import { voxelAt } from './voxel-volume';

/** What fills one cell of the tank. */
export const Cell = {
    Air: 0,
    Water: 1,
    Substrate: 2,
    Decor: 3,
} as const;

export type CellType = (typeof Cell)[keyof typeof Cell];

/** A decoration model in place: its rotated volume and minimum corner cell. */
export type Placement = {
    id: number;
    volume: VoxelVolume;
    position: GridCell;
};

/** Which cells a creature may occupy. */
export type Medium = 'water' | 'air';

/** How far (in cells) moveToFreeCell searches sideways: 12 cm. */
const FREE_SEARCH_RADIUS = 60;

/** How far (in cells) moveToLandNear searches: 20 cm. */
const LAND_SEARCH_RADIUS = 100;

/**
 * Everything solid in the tank (substrate and decorations) and where the
 * water ends, on the grid. Steering asks it what is underfoot and what lies
 * ahead, so creatures neither sink into the gravel nor swim through rocks.
 *
 * Each x/z column stores its substrate height plus a short list of solid
 * decoration spans, rather than one byte per cell: at 0.2 cm a large tank
 * has tens of millions of cells but only a few spans per column.
 */
export class TerrainField {
    readonly width: number;

    readonly height: number;

    readonly depth: number;

    readonly waterLevel: number;

    /** Substrate height (cells) per x/z column. */
    private readonly ground: Uint16Array;

    /** Decoration spans per x/z column, flattened as [start, end, owner, ...] with end exclusive. Owner is the placement index + 1. */
    private readonly spans: (number[] | undefined)[];

    private readonly placements: Placement[] = [];

    constructor(grid: TankGrid, substrate: Heightmap, placements: Placement[]) {
        this.width = grid.width;
        this.height = grid.height;
        this.depth = grid.depth;
        this.waterLevel = grid.water_level;
        this.ground = Uint16Array.from(substrate);
        this.spans = Array.from({ length: this.width * this.depth });

        placements.forEach((placement, index) => {
            this.placements.push(placement);
            this.stamp(placement, index + 1);
        });
    }

    /** The cell type at a grid cell; outside the tank counts as solid glass. */
    cellAt(x: number, y: number, z: number): CellType {
        if (
            x < 0 ||
            z < 0 ||
            x >= this.width ||
            z >= this.depth ||
            y < 0 ||
            y >= this.height
        ) {
            return y >= this.height ? Cell.Air : Cell.Substrate;
        }

        const column = this.column(x, z);

        if (y < this.ground[column]) {
            return Cell.Substrate;
        }

        if (this.ownerAt(column, y) !== 0) {
            return Cell.Decor;
        }

        return y < this.waterLevel ? Cell.Water : Cell.Air;
    }

    /** Whether a world-space point is inside the substrate or a decoration. */
    isSolid(point: Vector3): boolean {
        const [x, y, z] = this.toCell(point);

        return this.cellAt(x, y, z) >= Cell.Substrate;
    }

    /** Whether a world-space point is open water. */
    isWater(point: Vector3): boolean {
        const [x, y, z] = this.toCell(point);

        return this.cellAt(x, y, z) === Cell.Water;
    }

    /** Whether a creature living in `medium` may occupy a world-space point. */
    isFree(point: Vector3, medium: Medium = 'water'): boolean {
        const [x, y, z] = this.toCell(point);

        return (
            this.cellAt(x, y, z) ===
            (medium === 'water' ? Cell.Water : Cell.Air)
        );
    }

    /**
     * The world height of the surface something at `point` would stand on:
     * the top of whatever is beneath it or, when it is inside something, the
     * top of that within `maxClimb` world units. Null when the climb is taller
     * than that, i.e. the way is blocked.
     */
    surfaceBelow(point: Vector3, maxClimb = 0): number | null {
        const [x, y, z] = this.toCell(point);

        if (x < 0 || z < 0 || x >= this.width || z >= this.depth) {
            return this.cellAt(x, y, z) >= Cell.Substrate ? null : 0;
        }

        const column = this.column(x, z);

        if (this.cellAt(x, y, z) >= Cell.Substrate) {
            const top = this.solidTopFrom(column, y);

            return top <= y + Math.ceil(maxClimb / VOXEL) ? top * VOXEL : null;
        }

        return this.highestTopBelow(column, y) * VOXEL;
    }

    /**
     * The nearest point a creature living in `medium` may occupy, searching
     * upwards first (out of whatever buried it), then outwards. Writes into
     * `point`; leaves it unchanged if nothing is free nearby.
     */
    moveToFreeCell(point: Vector3, medium: Medium = 'water'): void {
        const [x, y, z] = this.toCell(point);
        const wanted = medium === 'water' ? Cell.Water : Cell.Air;

        for (let row = y + 1; row < this.height; row++) {
            if (this.cellAt(x, row, z) === wanted) {
                point.y = (row + 0.5) * VOXEL;

                return;
            }
        }

        for (let radius = 1; radius < FREE_SEARCH_RADIUS; radius++) {
            for (let dz = -radius; dz <= radius; dz++) {
                for (let dx = -radius; dx <= radius; dx++) {
                    if (Math.max(Math.abs(dx), Math.abs(dz)) !== radius) {
                        continue;
                    }

                    if (this.cellAt(x + dx, y, z + dz) === wanted) {
                        point.x = (x + dx + 0.5) * VOXEL - TANK.width / 2;
                        point.z = (z + dz + 0.5) * VOXEL - TANK.depth / 2;

                        return;
                    }
                }
            }
        }
    }

    /**
     * Put a point on the nearest dry surface above the water (the substrate
     * or a decoration), searching outwards in the horizontal plane. Returns
     * false, leaving the point unchanged, when there is no dry ground nearby.
     */
    moveToLandNear(point: Vector3): boolean {
        const [x, , z] = this.toCell(point);

        for (let radius = 0; radius < LAND_SEARCH_RADIUS; radius++) {
            for (let dz = -radius; dz <= radius; dz++) {
                for (let dx = -radius; dx <= radius; dx++) {
                    if (Math.max(Math.abs(dx), Math.abs(dz)) !== radius) {
                        continue;
                    }

                    const top = this.topSurface(x + dx, z + dz);

                    if (top !== null && top >= this.waterLevel) {
                        point.set(
                            (x + dx + 0.5) * VOXEL - TANK.width / 2,
                            top * VOXEL,
                            (z + dz + 0.5) * VOXEL - TANK.depth / 2,
                        );

                        return true;
                    }
                }
            }
        }

        return false;
    }

    /**
     * The y cell at which a decoration would rest on whatever lies beneath
     * it (the substrate or other decorations), or null if it is not placed.
     */
    restingCell(decorationId: number): number | null {
        const placementIndex = this.placements.findIndex(
            (placement) => placement.id === decorationId,
        );

        if (placementIndex < 0) {
            return null;
        }

        const placement = this.placements[placementIndex];
        const owner = placementIndex + 1;

        const { volume, position } = placement;
        const [width, height, depth] = volume.size;
        const [px, py, pz] = position;
        const limit = Math.min(this.height, py + height) - 1;
        let rest = 0;

        for (let z = 0; z < depth; z++) {
            for (let x = 0; x < width; x++) {
                const tx = px + x;
                const tz = pz + z;

                if (tx < 0 || tz < 0 || tx >= this.width || tz >= this.depth) {
                    continue;
                }

                let lowest = -1;

                for (let y = 0; y < height && lowest < 0; y++) {
                    if (voxelAt(volume, x, y, z) !== 0) {
                        lowest = y;
                    }
                }

                if (lowest < 0) {
                    continue;
                }

                const column = this.column(tx, tz);
                let highest = Math.min(this.ground[column], limit + 1) - 1;
                const spans = this.spans[column] ?? [];

                for (let i = 0; i < spans.length; i += 3) {
                    if (spans[i + 2] !== owner && spans[i] <= limit) {
                        highest = Math.max(
                            highest,
                            Math.min(spans[i + 1] - 1, limit),
                        );
                    }
                }

                if (highest >= 0) {
                    rest = Math.max(rest, highest + 1 - lowest);
                }
            }
        }

        return Math.min(rest, this.height - height);
    }

    /** The row just above the highest solid cell of a column, or null outside the tank. */
    private topSurface(x: number, z: number): number | null {
        if (x < 0 || z < 0 || x >= this.width || z >= this.depth) {
            return null;
        }

        const column = this.column(x, z);
        let top: number = this.ground[column];
        const spans = this.spans[column] ?? [];

        for (let i = 0; i < spans.length; i += 3) {
            top = Math.max(top, spans[i + 1]);
        }

        return top;
    }

    /** The first open row at or above a solid row, climbing through touching spans. */
    private solidTopFrom(column: number, row: number): number {
        const spans = this.spans[column] ?? [];
        let top = row;
        let moved = true;

        while (moved) {
            moved = false;

            if (top < this.ground[column]) {
                top = this.ground[column];
                moved = true;
            }

            for (let i = 0; i < spans.length; i += 3) {
                if (spans[i] <= top && top < spans[i + 1]) {
                    top = spans[i + 1];
                    moved = true;
                }
            }
        }

        return top;
    }

    /** The row just above the highest solid cell below an open row (0 on bare glass). */
    private highestTopBelow(column: number, row: number): number {
        let top = Math.min(this.ground[column], row);
        const spans = this.spans[column] ?? [];

        for (let i = 0; i < spans.length; i += 3) {
            if (spans[i + 1] <= row) {
                top = Math.max(top, spans[i + 1]);
            }
        }

        return top;
    }

    /** The placement filling a cell above the substrate (index + 1), or 0. */
    private ownerAt(column: number, y: number): number {
        const spans = this.spans[column];

        if (spans === undefined) {
            return 0;
        }

        for (let i = 0; i < spans.length; i += 3) {
            if (spans[i] <= y && y < spans[i + 1]) {
                return spans[i + 2];
            }
        }

        return 0;
    }

    private toCell(point: Vector3): GridCell {
        return [
            Math.floor((point.x + TANK.width / 2) / VOXEL),
            Math.floor(point.y / VOXEL),
            Math.floor((point.z + TANK.depth / 2) / VOXEL),
        ];
    }

    private column(x: number, z: number): number {
        return z * this.width + x;
    }

    /** Record each vertical run of a placement's solid voxels as a span in its tank column. */
    private stamp(
        { volume, position: [px, py, pz] }: Placement,
        owner: number,
    ): void {
        const [width, height, depth] = volume.size;

        for (let z = 0; z < depth; z++) {
            for (let x = 0; x < width; x++) {
                const tx = px + x;
                const tz = pz + z;

                if (tx < 0 || tz < 0 || tx >= this.width || tz >= this.depth) {
                    continue;
                }

                const column = this.column(tx, tz);
                let start = -1;

                for (let y = 0; y <= height; y++) {
                    const solid = y < height && voxelAt(volume, x, y, z) !== 0;

                    if (solid && start < 0) {
                        start = y;
                    } else if (!solid && start >= 0) {
                        const from = Math.max(0, py + start);
                        const to = Math.min(this.height, py + y);

                        if (from < to) {
                            (this.spans[column] ??= []).push(from, to, owner);
                        }

                        start = -1;
                    }
                }
            }
        }
    }
}

/** The substrate's surface height (world units) beneath a world-space x/z. */
export function substrateHeightAt(
    grid: TankGrid,
    substrate: Heightmap,
    worldX: number,
    worldZ: number,
): number {
    return (
        heightAt(
            grid,
            substrate,
            (worldX + TANK.width / 2) / VOXEL,
            (worldZ + TANK.depth / 2) / VOXEL,
        ) * VOXEL
    );
}
