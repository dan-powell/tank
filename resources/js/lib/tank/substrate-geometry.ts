import { BufferGeometry, Float32BufferAttribute } from 'three';
import type { TankGrid } from '@/types';
import { TANK, VOXEL } from './space';
import type { Heightmap } from './substrate-heightmap';

/** A face being grown along the grid: from `start` up to (not including) `end`. */
type Strip = { start: number; end: number };

/**
 * The substrate as a mesh of flat-topped grid columns, in world units, one
 * column per heightmap entry. Neighbouring faces that line up are merged
 * (tops of equal height into rectangles, walls of equal span into long
 * strips), so a flat substrate is a simple slab and a sculpted one stays
 * light however fine the grid. Walls are emitted only where a column stands
 * higher than its neighbour or the glass. Heights are rounded to whole
 * cells, so a stroke in progress also steps in 0.2 cm voxels.
 */
export function buildSubstrateGeometry(
    grid: TankGrid,
    heights: Heightmap,
): BufferGeometry {
    const { width, depth } = grid;
    const heightAt = (x: number, z: number): number =>
        x < 0 || z < 0 || x >= width || z >= depth
            ? 0
            : Math.round(heights[z * width + x] ?? 0);

    const wx = (x: number) => x * VOXEL - TANK.width / 2;
    const wy = (y: number) => y * VOXEL;
    const wz = (z: number) => z * VOXEL - TANK.depth / 2;

    const positions: number[] = [];
    const normals: number[] = [];

    const quad = (points: number[][], normal: number[]): void => {
        for (const index of [0, 1, 2, 0, 2, 3]) {
            positions.push(...points[index]);
            normals.push(...normal);
        }
    };

    /** Tops: each row's runs of equal height, grown backwards-to-front while they repeat. */
    const top = (x0: number, x1: number, h: number, strip: Strip): void => {
        const [a, b, y, z0, z1] = [
            wx(x0),
            wx(x1),
            wy(h),
            wz(strip.start),
            wz(strip.end),
        ];
        quad(
            [
                [a, y, z1],
                [b, y, z1],
                [b, y, z0],
                [a, y, z0],
            ],
            [0, 1, 0],
        );
    };

    /** Walls facing ±x at x = `x`, grown front to back while they repeat. */
    const sideX = (
        x: number,
        low: number,
        high: number,
        sign: number,
        strip: Strip,
    ): void => {
        const [px, y0, y1, z0, z1] = [
            wx(x),
            wy(low),
            wy(high),
            wz(strip.start),
            wz(strip.end),
        ];
        quad(
            sign > 0
                ? [
                      [px, y0, z1],
                      [px, y0, z0],
                      [px, y1, z0],
                      [px, y1, z1],
                  ]
                : [
                      [px, y0, z0],
                      [px, y0, z1],
                      [px, y1, z1],
                      [px, y1, z0],
                  ],
            [sign, 0, 0],
        );
    };

    /** Walls facing ±z at z = `z`, spanning x from `strip.start` to `strip.end`. */
    const sideZ = (
        z: number,
        low: number,
        high: number,
        sign: number,
        strip: Strip,
    ): void => {
        const [pz, y0, y1, x0, x1] = [
            wz(z),
            wy(low),
            wy(high),
            wx(strip.start),
            wx(strip.end),
        ];
        quad(
            sign > 0
                ? [
                      [x0, y0, pz],
                      [x1, y0, pz],
                      [x1, y1, pz],
                      [x0, y1, pz],
                  ]
                : [
                      [x1, y0, pz],
                      [x0, y0, pz],
                      [x0, y1, pz],
                      [x1, y1, pz],
                  ],
            [0, 0, sign],
        );
    };

    // Tops and ±x walls are grown along z: faces still open from the previous
    // row carry on if this row has the same face, and are drawn once they stop.
    let openTops = new Map<string, Strip & { emit: (strip: Strip) => void }>();
    let openWalls = new Map<string, Strip & { emit: (strip: Strip) => void }>();

    const carry = (
        open: Map<string, Strip & { emit: (strip: Strip) => void }>,
        next: Map<string, Strip & { emit: (strip: Strip) => void }>,
        key: string,
        z: number,
        emit: (strip: Strip) => void,
    ): void => {
        const face = open.get(key);

        if (face === undefined) {
            next.set(key, { start: z, end: z + 1, emit });
        } else {
            open.delete(key);
            face.end = z + 1;
            next.set(key, face);
        }
    };

    const close = (
        open: Map<string, Strip & { emit: (strip: Strip) => void }>,
    ) => open.forEach((face) => face.emit(face));

    for (let z = 0; z < depth; z++) {
        const nextTops = new Map<
            string,
            Strip & { emit: (strip: Strip) => void }
        >();
        const nextWalls = new Map<
            string,
            Strip & { emit: (strip: Strip) => void }
        >();

        for (let x = 0; x < width;) {
            const h = heightAt(x, z);
            let end = x + 1;

            while (end < width && heightAt(end, z) === h) {
                end++;
            }

            if (h > 0) {
                const [x0, x1] = [x, end];
                carry(openTops, nextTops, `${x0}:${x1}:${h}`, z, (strip) =>
                    top(x0, x1, h, strip),
                );
            }

            x = end;
        }

        for (let x = 0; x <= width; x++) {
            const left = heightAt(x - 1, z);
            const right = heightAt(x, z);

            if (left !== right) {
                const [low, high, sign] =
                    left > right ? [right, left, 1] : [left, right, -1];
                carry(
                    openWalls,
                    nextWalls,
                    `${x}:${low}:${high}:${sign}`,
                    z,
                    (strip) => sideX(x, low, high, sign, strip),
                );
            }
        }

        close(openTops);
        close(openWalls);
        openTops = nextTops;
        openWalls = nextWalls;
    }

    close(openTops);
    close(openWalls);

    // ±z walls lie between rows; runs along x with the same span are merged.
    for (let z = 0; z <= depth; z++) {
        let strip: {
            start: number;
            low: number;
            high: number;
            sign: number;
        } | null = null;

        for (let x = 0; x <= width; x++) {
            const back = x < width ? heightAt(x, z - 1) : 0;
            const front = x < width ? heightAt(x, z) : 0;
            const [low, high, sign] =
                back > front
                    ? [front, back, 1]
                    : back < front
                      ? [back, front, -1]
                      : [0, 0, 0];

            if (
                strip !== null &&
                (strip.low !== low ||
                    strip.high !== high ||
                    strip.sign !== sign)
            ) {
                sideZ(z, strip.low, strip.high, strip.sign, {
                    start: strip.start,
                    end: x,
                });
                strip = null;
            }

            if (strip === null && sign !== 0) {
                strip = { start: x, low, high, sign };
            }
        }
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
    geometry.computeBoundingSphere();

    return geometry;
}
