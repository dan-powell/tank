import { BufferGeometry, Float32BufferAttribute } from 'three';
import type { TankGrid } from '@/types';
import { cellToWorld } from './space';

/**
 * The substrate as a mesh of flat-topped columns, one per heightmap entry,
 * in world units. Walls are emitted only where a column stands higher than
 * its neighbour (or the glass), so a flat substrate is a simple slab.
 */
export function buildSubstrateGeometry(
    grid: TankGrid,
    substrate: number[],
): BufferGeometry {
    const size = grid.substrate_column;
    const columns = Math.ceil(grid.width / size);
    const rows = Math.ceil(grid.depth / size);
    const heightAt = (column: number, row: number): number =>
        column < 0 || row < 0 || column >= columns || row >= rows
            ? 0
            : (substrate[row * columns + column] ?? 0);

    const positions: number[] = [];
    const normals: number[] = [];
    const corner = cellToWorld(0, 0, 0);
    const far = cellToWorld(0, 0, 0);

    const quad = (points: number[][], normal: number[]): void => {
        for (const index of [0, 1, 2, 0, 2, 3]) {
            positions.push(...points[index]);
            normals.push(...normal);
        }
    };

    for (let row = 0; row < rows; row++) {
        for (let column = 0; column < columns; column++) {
            const height = heightAt(column, row);

            if (height <= 0) {
                continue;
            }

            cellToWorld(column * size, height, row * size, corner);
            cellToWorld(
                Math.min(grid.width, (column + 1) * size),
                height,
                Math.min(grid.depth, (row + 1) * size),
                far,
            );
            const [x0, x1, z0, z1, top] = [
                corner.x,
                far.x,
                corner.z,
                far.z,
                corner.y,
            ];
            const floorOf = (neighbour: number) =>
                cellToWorld(0, neighbour, 0).y;

            quad(
                [
                    [x0, top, z1],
                    [x1, top, z1],
                    [x1, top, z0],
                    [x0, top, z0],
                ],
                [0, 1, 0],
            );

            const east = heightAt(column + 1, row);

            if (east < height) {
                const bottom = floorOf(east);
                quad(
                    [
                        [x1, bottom, z1],
                        [x1, bottom, z0],
                        [x1, top, z0],
                        [x1, top, z1],
                    ],
                    [1, 0, 0],
                );
            }

            const west = heightAt(column - 1, row);

            if (west < height) {
                const bottom = floorOf(west);
                quad(
                    [
                        [x0, bottom, z0],
                        [x0, bottom, z1],
                        [x0, top, z1],
                        [x0, top, z0],
                    ],
                    [-1, 0, 0],
                );
            }

            const south = heightAt(column, row + 1);

            if (south < height) {
                const bottom = floorOf(south);
                quad(
                    [
                        [x0, bottom, z1],
                        [x1, bottom, z1],
                        [x1, top, z1],
                        [x0, top, z1],
                    ],
                    [0, 0, 1],
                );
            }

            const north = heightAt(column, row - 1);

            if (north < height) {
                const bottom = floorOf(north);
                quad(
                    [
                        [x1, bottom, z0],
                        [x0, bottom, z0],
                        [x0, top, z0],
                        [x1, top, z0],
                    ],
                    [0, 0, -1],
                );
            }
        }
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
    geometry.computeBoundingSphere();

    return geometry;
}
