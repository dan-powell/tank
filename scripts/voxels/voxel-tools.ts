/**
 * Shared helpers for the model scripts: colours, a palette, and a voxel grid
 * in game space that writes MagicaVoxel models.
 */
import type { VoxModel } from '../../resources/js/lib/tank/vox-file.ts';

/** Palette index recoloured per individual in the game (e.g. guppy tails). */
export const TINT_INDEX = 255;
export const TINT = 'tint';

// ---------------------------------------------------------------- colours

export function channels(hex: string): [number, number, number] {
    return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [
        number,
        number,
        number,
    ];
}

export function toHex([r, g, b]: number[]): string {
    return `#${[r, g, b]
        .map((v) =>
            Math.max(0, Math.min(255, Math.round(v)))
                .toString(16)
                .padStart(2, '0'),
        )
        .join('')}`;
}

/** Scale a colour's brightness. */
export function shade(hex: string, factor: number): string {
    return toHex(channels(hex).map((v) => v * factor));
}

/** Blend two colours. */
export function mix(a: string, b: string, t: number): string {
    const [ca, cb] = [channels(a), channels(b)];

    return toHex(ca.map((v, i) => v + (cb[i] - v) * t));
}

/** A deterministic 0..1 value per cell, for speckles and spots. */
export function hash(x: number, y: number, z: number, salt = 0): number {
    const n =
        Math.sin(x * 127.1 + y * 311.7 + z * 74.7 + salt * 19.3) * 43758.5453;

    return n - Math.floor(n);
}

export class Palette {
    private readonly indices = new Map<string, number>();

    index(colour: string): number {
        if (colour === TINT) {
            return TINT_INDEX;
        }

        let index = this.indices.get(colour);

        if (index === undefined) {
            index = this.indices.size + 1;

            if (index >= TINT_INDEX) {
                throw new Error('Too many colours for one palette.');
            }

            this.indices.set(colour, index);
        }

        return index;
    }

    /** 256 entries as 0xAABBGGRR, where entry i - 1 is colour index i. */
    toVox(): number[] {
        const entries = Array.from({ length: 256 }, () => 0xff000000);
        const rgba = (hex: string) => {
            const [r, g, b] = channels(hex);

            return ((0xff << 24) | (b << 16) | (g << 8) | r) >>> 0;
        };

        for (const [colour, index] of this.indices) {
            entries[index - 1] = rgba(colour);
        }

        entries[TINT_INDEX - 1] = rgba('#ff00ff');

        return entries;
    }
}

// ---------------------------------------------------------------- volumes

/** A model being built, in game grid space: x right, y up, z towards the viewer. */
export class Grid {
    private readonly cells = new Map<number, string>();

    readonly width: number;

    readonly height: number;

    readonly depth: number;

    constructor(width: number, height: number, depth: number) {
        this.width = width;
        this.height = height;
        this.depth = depth;
    }

    set(x: number, y: number, z: number, colour: string): void {
        if (
            x >= 0 &&
            y >= 0 &&
            z >= 0 &&
            x < this.width &&
            y < this.height &&
            z < this.depth
        ) {
            this.cells.set(this.key(x, y, z), colour);
        }
    }

    get(x: number, y: number, z: number): string | undefined {
        return this.cells.get(this.key(x, y, z));
    }

    /** Set a cell only if it is empty. */
    fill(x: number, y: number, z: number, colour: string): void {
        if (this.get(x, y, z) === undefined) {
            this.set(x, y, z, colour);
        }
    }

    toModel(name: string, palette: Palette): VoxModel {
        const voxels: number[] = [];

        for (const [key, colour] of this.cells) {
            const x = key % this.width;
            const z = Math.floor(key / this.width) % this.depth;
            const y = Math.floor(key / (this.width * this.depth));
            // MagicaVoxel: x right, y away from the viewer, z up.
            voxels.push(x, this.depth - 1 - z, y, palette.index(colour));
        }

        return { name, size: [this.width, this.depth, this.height], voxels };
    }

    private key(x: number, y: number, z: number): number {
        return (y * this.depth + z) * this.width + x;
    }
}
