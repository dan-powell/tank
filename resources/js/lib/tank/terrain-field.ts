import { Vector3 } from 'three';
import type { GridCell, TankGrid } from '@/types';
import { DECOR_VOXEL, TANK } from './space';
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

/**
 * Everything solid in the tank (substrate and decorations) and where the
 * water ends, on the decoration grid. Steering asks it what is underfoot and
 * what lies ahead, so creatures neither sink into the gravel nor swim
 * through rocks, and land-dwellers can later use the same field above water.
 */
export class TerrainField {
    readonly width: number;

    readonly height: number;

    readonly depth: number;

    readonly waterLevel: number;

    private readonly cells: Uint8Array;

    /** Which placement fills each cell: its index + 1 (0 = none). Decorations per tank are capped well below 255. */
    private readonly owners: Uint8Array;

    private readonly placements: Placement[] = [];

    constructor(grid: TankGrid, substrate: number[], placements: Placement[]) {
        this.width = grid.width;
        this.height = grid.height;
        this.depth = grid.depth;
        this.waterLevel = grid.water_level;
        this.cells = new Uint8Array(this.width * this.height * this.depth);
        this.owners = new Uint8Array(this.cells.length);

        const columns = Math.ceil(this.width / grid.substrate_column);

        for (let z = 0; z < this.depth; z++) {
            for (let x = 0; x < this.width; x++) {
                const column =
                    Math.floor(z / grid.substrate_column) * columns +
                    Math.floor(x / grid.substrate_column);
                const ground = substrate[column] ?? 0;

                for (let y = 0; y < this.height; y++) {
                    this.cells[this.index(x, y, z)] =
                        y < ground
                            ? Cell.Substrate
                            : y < this.waterLevel
                              ? Cell.Water
                              : Cell.Air;
                }
            }
        }

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

        return this.cells[this.index(x, y, z)] as CellType;
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
        const solid = (row: number) => this.cellAt(x, row, z) >= Cell.Substrate;

        if (solid(y)) {
            const limit = y + Math.ceil(maxClimb / DECOR_VOXEL);

            for (let row = y + 1; row <= limit; row++) {
                if (!solid(row)) {
                    return row * DECOR_VOXEL;
                }
            }

            return null;
        }

        for (let row = y - 1; row >= 0; row--) {
            if (solid(row)) {
                return (row + 1) * DECOR_VOXEL;
            }
        }

        return 0;
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
                point.y = (row + 0.5) * DECOR_VOXEL;

                return;
            }
        }

        for (let radius = 1; radius < 24; radius++) {
            for (let dz = -radius; dz <= radius; dz++) {
                for (let dx = -radius; dx <= radius; dx++) {
                    if (Math.max(Math.abs(dx), Math.abs(dz)) !== radius) {
                        continue;
                    }

                    if (this.cellAt(x + dx, y, z + dz) === wanted) {
                        point.x = (x + dx + 0.5) * DECOR_VOXEL - TANK.width / 2;
                        point.z = (z + dz + 0.5) * DECOR_VOXEL - TANK.depth / 2;

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

        for (let radius = 0; radius < 40; radius++) {
            for (let dz = -radius; dz <= radius; dz++) {
                for (let dx = -radius; dx <= radius; dx++) {
                    if (Math.max(Math.abs(dx), Math.abs(dz)) !== radius) {
                        continue;
                    }

                    const top = this.topSurface(x + dx, z + dz);

                    if (top !== null && top >= this.waterLevel) {
                        point.set(
                            (x + dx + 0.5) * DECOR_VOXEL - TANK.width / 2,
                            top * DECOR_VOXEL,
                            (z + dz + 0.5) * DECOR_VOXEL - TANK.depth / 2,
                        );

                        return true;
                    }
                }
            }
        }

        return false;
    }

    /** The row just above the highest solid cell of a column, or null outside the tank. */
    private topSurface(x: number, z: number): number | null {
        if (x < 0 || z < 0 || x >= this.width || z >= this.depth) {
            return null;
        }

        for (let row = this.height - 1; row >= 0; row--) {
            if (this.cells[this.index(x, row, z)] >= Cell.Substrate) {
                return row + 1;
            }
        }

        return 0;
    }

    private toCell(point: Vector3): GridCell {
        return [
            Math.floor((point.x + TANK.width / 2) / DECOR_VOXEL),
            Math.floor(point.y / DECOR_VOXEL),
            Math.floor((point.z + TANK.depth / 2) / DECOR_VOXEL),
        ];
    }

    private index(x: number, y: number, z: number): number {
        return (y * this.depth + z) * this.width + x;
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
        let rest = 0;

        for (let z = 0; z < depth; z++) {
            for (let x = 0; x < width; x++) {
                let lowest = -1;

                for (let y = 0; y < height && lowest < 0; y++) {
                    if (voxelAt(volume, x, y, z) !== 0) {
                        lowest = y;
                    }
                }

                if (lowest < 0) {
                    continue;
                }

                for (
                    let row = Math.min(this.height, py + height) - 1;
                    row >= 0;
                    row--
                ) {
                    const index = this.index(px + x, row, pz + z);

                    if (
                        this.cells[index] >= Cell.Substrate &&
                        this.owners[index] !== owner
                    ) {
                        rest = Math.max(rest, row + 1 - lowest);
                        break;
                    }
                }
            }
        }

        return Math.min(rest, this.height - height);
    }

    private stamp(
        { volume, position: [px, py, pz] }: Placement,
        owner: number,
    ): void {
        const [width, height, depth] = volume.size;

        for (let y = 0; y < height; y++) {
            for (let z = 0; z < depth; z++) {
                for (let x = 0; x < width; x++) {
                    const tx = px + x;
                    const ty = py + y;
                    const tz = pz + z;

                    if (
                        voxelAt(volume, x, y, z) !== 0 &&
                        tx >= 0 &&
                        ty >= 0 &&
                        tz >= 0 &&
                        tx < this.width &&
                        ty < this.height &&
                        tz < this.depth
                    ) {
                        this.cells[this.index(tx, ty, tz)] = Cell.Decor;
                        this.owners[this.index(tx, ty, tz)] = owner;
                    }
                }
            }
        }
    }
}

/** The substrate's surface height (world units) beneath a world-space x/z. */
export function substrateHeightAt(
    grid: TankGrid,
    substrate: number[],
    worldX: number,
    worldZ: number,
): number {
    const columns = Math.ceil(grid.width / grid.substrate_column);
    const rows = Math.ceil(grid.depth / grid.substrate_column);
    const column = Math.min(
        columns - 1,
        Math.max(
            0,
            Math.floor(
                (worldX + TANK.width / 2) / DECOR_VOXEL / grid.substrate_column,
            ),
        ),
    );
    const row = Math.min(
        rows - 1,
        Math.max(
            0,
            Math.floor(
                (worldZ + TANK.depth / 2) / DECOR_VOXEL / grid.substrate_column,
            ),
        ),
    );

    return (substrate[row * columns + column] ?? 0) * DECOR_VOXEL;
}
