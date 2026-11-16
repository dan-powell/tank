/**
 * Shared building blocks for the decoration models: noise, random
 * sequences, profiles and a solid-occupancy volume with simple shapes.
 * Coordinates are game grid space: x right, y up, z towards the viewer.
 */
import { hash } from '../voxel-tools.ts';

export const smooth = (t: number) => t * t * (3 - 2 * t);

/** Smooth 3D value noise in 0..1. */
export function noise(x: number, y: number, z: number, seed = 0): number {
    const [x0, y0, z0] = [Math.floor(x), Math.floor(y), Math.floor(z)];
    const [tx, ty, tz] = [smooth(x - x0), smooth(y - y0), smooth(z - z0)];
    const corner = (dx: number, dy: number, dz: number) =>
        hash(x0 + dx, y0 + dy, z0 + dz, seed);
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    const plane = (dz: number) =>
        lerp(
            lerp(corner(0, 0, dz), corner(1, 0, dz), tx),
            lerp(corner(0, 1, dz), corner(1, 1, dz), tx),
            ty,
        );

    return lerp(plane(0), plane(1), tz);
}

/** Layered noise in roughly 0..1: broad shapes with finer detail on top. */
export function fbm(x: number, y: number, z: number, seed = 0): number {
    return (
        noise(x, y, z, seed) * 0.57 +
        noise(x * 2.1, y * 2.1, z * 2.1, seed + 1) * 0.29 +
        noise(x * 4.3, y * 4.3, z * 4.3, seed + 2) * 0.14
    );
}

/** A deterministic random sequence (mulberry32). */
export function sequence(seed: number): () => number {
    let state = seed >>> 0;

    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = Math.imul(state ^ (state >>> 15), 1 | state);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;

        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** Linear interpolation through (x, value) control points sorted by x. */
export function profile(points: [number, number][], x: number): number {
    for (let i = 1; i < points.length; i++) {
        const [x1, v1] = points[i];

        if (x <= x1) {
            const [x0, v0] = points[i - 1];
            const t = smooth((x - x0) / (x1 - x0));

            return v0 + (v1 - v0) * t;
        }
    }

    return points[points.length - 1][1];
}

// ---------------------------------------------------------------- volumes

export type Cell = [number, number, number];

/** A cell value per grid cell (0 is empty), for carving a shape before colouring it. */
export class Solid {
    readonly cells: Uint8Array;

    readonly width: number;

    readonly height: number;

    readonly depth: number;

    constructor(width: number, height: number, depth: number) {
        this.width = width;
        this.height = height;
        this.depth = depth;
        this.cells = new Uint8Array(width * height * depth);
    }

    inside(x: number, y: number, z: number): boolean {
        return (
            x >= 0 &&
            y >= 0 &&
            z >= 0 &&
            x < this.width &&
            y < this.height &&
            z < this.depth
        );
    }

    at(x: number, y: number, z: number): number {
        return this.inside(x, y, z)
            ? this.cells[(y * this.depth + z) * this.width + x]
            : 0;
    }

    put(x: number, y: number, z: number, value = 1): void {
        if (this.inside(x, y, z)) {
            this.cells[(y * this.depth + z) * this.width + x] = value;
        }
    }

    /** Solid with at least one open face (below excepted at the floor). */
    isSurface(x: number, y: number, z: number): boolean {
        return (
            this.at(x, y, z) !== 0 &&
            (!this.at(x + 1, y, z) ||
                !this.at(x - 1, y, z) ||
                !this.at(x, y + 1, z) ||
                !this.at(x, y, z + 1) ||
                !this.at(x, y, z - 1) ||
                (y > 0 && !this.at(x, y - 1, z)))
        );
    }

    /** Visit every solid cell. */
    each(
        visit: (x: number, y: number, z: number, value: number) => void,
    ): void {
        for (let y = 0; y < this.height; y++) {
            for (let z = 0; z < this.depth; z++) {
                for (let x = 0; x < this.width; x++) {
                    const value =
                        this.cells[(y * this.depth + z) * this.width + x];

                    if (value !== 0) {
                        visit(x, y, z, value);
                    }
                }
            }
        }
    }

    /** Clear every cell not joined (face to face) to something resting on the floor. */
    keepConnected(): void {
        const { width, height, depth } = this;
        const index = (x: number, y: number, z: number) =>
            (y * depth + z) * width + x;
        const reached = new Uint8Array(width * height * depth);
        const queue: number[] = [];

        for (let z = 0; z < depth; z++) {
            for (let x = 0; x < width; x++) {
                if (this.at(x, 0, z)) {
                    reached[index(x, 0, z)] = 1;
                    queue.push(index(x, 0, z));
                }
            }
        }

        while (queue.length > 0) {
            const cell = queue.pop() as number;
            const x = cell % width;
            const z = Math.floor(cell / width) % depth;
            const y = Math.floor(cell / (width * depth));

            for (const [dx, dy, dz] of [
                [1, 0, 0],
                [-1, 0, 0],
                [0, 1, 0],
                [0, -1, 0],
                [0, 0, 1],
                [0, 0, -1],
            ]) {
                const [nx, ny, nz] = [x + dx, y + dy, z + dz];

                if (this.at(nx, ny, nz) && !reached[index(nx, ny, nz)]) {
                    reached[index(nx, ny, nz)] = 1;
                    queue.push(index(nx, ny, nz));
                }
            }
        }

        this.each((x, y, z) => {
            if (!reached[index(x, y, z)]) {
                this.put(x, y, z, 0);
            }
        });
    }

    /** Set every cell in an axis-aligned box (inclusive corners). */
    box(from: Cell, to: Cell, value = 1): void {
        for (
            let y = Math.min(from[1], to[1]);
            y <= Math.max(from[1], to[1]);
            y++
        ) {
            for (
                let z = Math.min(from[2], to[2]);
                z <= Math.max(from[2], to[2]);
                z++
            ) {
                for (
                    let x = Math.min(from[0], to[0]);
                    x <= Math.max(from[0], to[0]);
                    x++
                ) {
                    this.put(x, y, z, value);
                }
            }
        }
    }

    /**
     * Set every cell inside an ellipsoid. `wobble(x, y, z)` (about -0.5..0.5)
     * roughens the edge.
     */
    ellipsoid(
        centre: Cell,
        radii: Cell,
        value = 1,
        wobble: (x: number, y: number, z: number) => number = () => 0,
    ): void {
        const [cx, cy, cz] = centre;
        const [rx, ry, rz] = radii;

        for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++) {
            for (let z = Math.floor(cz - rz - 1); z <= cz + rz + 1; z++) {
                for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++) {
                    const d =
                        ((x - cx) / rx) ** 2 +
                        ((y - cy) / ry) ** 2 +
                        ((z - cz) / rz) ** 2;

                    if (d < 1 + wobble(x, y, z)) {
                        this.put(x, y, z, value);
                    }
                }
            }
        }
    }

    /** Set every cell within a tube from a to b whose radius tapers from ra to rb. */
    tube(a: Cell, b: Cell, ra: number, rb = ra, value = 1): void {
        const [dx, dy, dz] = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
        const lengthSquared = dx * dx + dy * dy + dz * dz || 1;
        const r = Math.max(ra, rb) + 1;

        for (
            let y = Math.floor(Math.min(a[1], b[1]) - r);
            y <= Math.max(a[1], b[1]) + r;
            y++
        ) {
            for (
                let z = Math.floor(Math.min(a[2], b[2]) - r);
                z <= Math.max(a[2], b[2]) + r;
                z++
            ) {
                for (
                    let x = Math.floor(Math.min(a[0], b[0]) - r);
                    x <= Math.max(a[0], b[0]) + r;
                    x++
                ) {
                    const t = Math.max(
                        0,
                        Math.min(
                            1,
                            ((x - a[0]) * dx +
                                (y - a[1]) * dy +
                                (z - a[2]) * dz) /
                                lengthSquared,
                        ),
                    );
                    const distance = Math.hypot(
                        x - (a[0] + dx * t),
                        y - (a[1] + dy * t),
                        z - (a[2] + dz * t),
                    );

                    if (distance <= ra + (rb - ra) * t) {
                        this.put(x, y, z, value);
                    }
                }
            }
        }
    }
}
