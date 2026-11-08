/**
 * Generate placeholder MagicaVoxel models for the species catalogue.
 *
 *     node scripts/voxels/generate-species.ts [--force] [slug...]
 *
 * Writes resources/models/species/{slug}.vox at 1 voxel = 0.2 cm, one object
 * per frame named `stage.clip.frame` (e.g. `adult.move.2`), matching the
 * `stages` and `animation` in app/Simulation/SpeciesCatalogue.php. Models
 * face +x (to the right), with z towards the viewer and y up.
 *
 * The placeholders are meant to be replaced in MagicaVoxel. A file whose
 * contents no longer match what this script last wrote (recorded in
 * generated.json) has been edited by hand and is left alone unless --force.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { writeVox } from '../../resources/js/lib/tank/vox-file.ts';
import type { VoxModel } from '../../resources/js/lib/tank/vox-file.ts';

const OUTPUT = 'resources/models/species';
const MANIFEST = 'scripts/voxels/generated.json';

/** Palette index recoloured per individual in the game (e.g. guppy tails). */
const TINT_INDEX = 255;
const TINT = 'tint';

// ---------------------------------------------------------------- colours

function channels(hex: string): [number, number, number] {
    return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [
        number,
        number,
        number,
    ];
}

function toHex([r, g, b]: number[]): string {
    return `#${[r, g, b]
        .map((v) =>
            Math.max(0, Math.min(255, Math.round(v)))
                .toString(16)
                .padStart(2, '0'),
        )
        .join('')}`;
}

/** Scale a colour's brightness. */
function shade(hex: string, factor: number): string {
    return toHex(channels(hex).map((v) => v * factor));
}

/** Blend two colours. */
function mix(a: string, b: string, t: number): string {
    const [ca, cb] = [channels(a), channels(b)];

    return toHex(ca.map((v, i) => v + (cb[i] - v) * t));
}

/** A deterministic 0..1 value per cell, for speckles and spots. */
function hash(x: number, y: number, z: number, salt = 0): number {
    const n =
        Math.sin(x * 127.1 + y * 311.7 + z * 74.7 + salt * 19.3) * 43758.5453;

    return n - Math.floor(n);
}

class Palette {
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
class Grid {
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

type Clips = Record<string, Grid[]>;

const odd = (n: number) => (n % 2 === 0 ? n + 1 : n);

// ---------------------------------------------------------------- fish

type FishStyle = {
    body: string;
    /** Tail and dorsal fin colour, or TINT to colour them per individual. */
    fin: string;
    height: number;
    width: number;
    dorsal: number;
    tailSpread: number;
    flatBelly?: boolean;
    spots?: string;
    barbels?: boolean;
    pectoral?: boolean;
};

function fish(
    length: number,
    style: FishStyle,
    wag: number,
    finOut: boolean,
): Grid {
    const tailLength = Math.max(1, Math.round(length * 0.28));
    const bodyLength = length - tailLength;
    const bodyHeight = Math.max(2, Math.round(length * style.height));
    const bodyWidth = odd(Math.max(1, Math.round(length * style.width)));
    const fin = Math.max(0, Math.round(length * style.dorsal));
    const grid = new Grid(length, bodyHeight + fin, bodyWidth + 2);
    const cy = (bodyHeight - 1) / 2;
    const cz = (grid.depth - 1) / 2;
    const cx = tailLength + (bodyLength - 1) / 2;

    for (let x = tailLength; x < length; x++) {
        for (let y = 0; y < bodyHeight; y++) {
            for (let z = 0; z < grid.depth; z++) {
                const nx = (x - cx) / (bodyLength / 2);
                let ny = (y - cy) / (bodyHeight / 2);
                const nz = (z - cz) / (bodyWidth / 2);

                if (style.flatBelly && ny < 0) {
                    ny *= 0.7;
                }

                if (nx * nx + ny * ny + nz * nz > 1.15) {
                    continue;
                }

                let colour =
                    ny < -0.35
                        ? mix(style.body, '#ffffff', 0.35)
                        : ny > 0.4
                          ? shade(style.body, 0.8)
                          : style.body;

                if (
                    style.spots !== undefined &&
                    ny > -0.3 &&
                    hash(x, y, z) < 0.2
                ) {
                    colour = style.spots;
                }

                grid.set(x, y, z, colour);
            }
        }
    }

    // Tail fan, swinging sideways with `wag` (-1..1), most at its tip.
    for (let x = 0; x < tailLength; x++) {
        const t = (tailLength - x) / tailLength;
        const half = 0.5 + t * bodyHeight * 0.5 * style.tailSpread;
        const z = Math.round(cz + wag * t * Math.max(1, bodyWidth / 2));

        for (let y = 0; y < grid.height; y++) {
            if (Math.abs(y - cy) <= half) {
                grid.set(x, y, z, style.fin);
            }
        }
    }

    // Dorsal fin, tallest towards the front.
    const finStart = tailLength + Math.floor(bodyLength * 0.3);
    const finEnd = tailLength + Math.ceil(bodyLength * 0.65);

    for (let x = finStart; x < finEnd; x++) {
        const rise = Math.round(
            fin * ((x - finStart + 1) / (finEnd - finStart)),
        );

        for (let y = bodyHeight; y < bodyHeight + rise; y++) {
            grid.set(x, y, Math.round(cz), style.fin);
        }
    }

    // Eyes on both flanks.
    const eyeX = length - 1 - Math.max(1, Math.round(bodyLength * 0.2));
    const eyeY = Math.min(bodyHeight - 1, Math.round(cy + bodyHeight * 0.15));

    for (const side of [1, -1]) {
        for (let step = 0; step < grid.depth; step++) {
            const z = side > 0 ? grid.depth - 1 - step : step;

            if (grid.get(eyeX, eyeY, z) !== undefined) {
                grid.set(eyeX, eyeY, z, '#141414');
                break;
            }
        }
    }

    if (style.barbels) {
        grid.fill(
            length - 1,
            0,
            Math.round(cz),
            mix(style.body, '#ffffff', 0.5),
        );
    }

    if (style.pectoral && finOut) {
        const x = length - 1 - Math.round(bodyLength * 0.4);
        const y = Math.max(0, Math.round(cy - bodyHeight * 0.25));
        grid.fill(x, y, 0, shade(style.body, 0.9));
        grid.fill(x, y, grid.depth - 1, shade(style.body, 0.9));
    }

    return grid;
}

function fishClips(length: number, style: FishStyle): Clips {
    return {
        move: [0, 1, 0, -1].map((wag, frame) =>
            fish(length, style, wag, frame % 2 === 0),
        ),
        idle: [0, 1].map((wag) => fish(length, style, wag * 0.5, true)),
    };
}

// ---------------------------------------------------------------- snails

type SnailStyle = { shell: string; stripe: string; foot: string };

function snail(length: number, style: SnailStyle, reach: number): Grid {
    const footWidth = odd(Math.max(1, Math.round(length * 0.45)));
    const footHeight = Math.max(1, Math.round(length * 0.15));
    const shellSize = Math.max(2, Math.round(length * 0.7));
    const antennae = length >= 5 ? 2 : length >= 3 ? 1 : 0;
    const grid = new Grid(
        length,
        footHeight + shellSize + antennae,
        Math.max(footWidth, shellSize),
    );
    const cz = (grid.depth - 1) / 2;
    const footEnd = length - (1 - reach);

    for (let x = 0; x < footEnd; x++) {
        for (let y = 0; y < footHeight; y++) {
            for (let z = 0; z < grid.depth; z++) {
                if (Math.abs(z - cz) <= footWidth / 2) {
                    grid.set(x, y, z, style.foot);
                }
            }
        }
    }

    // A round, banded shell sitting on the foot, a little behind its middle.
    const sx =
        Math.min(length - 1, length * 0.42) - 0.5 + (shellSize % 2) * 0.5;
    const sy = footHeight + (shellSize - 1) / 2;
    const radius = shellSize / 2;

    for (let x = 0; x < length; x++) {
        for (let y = footHeight; y < footHeight + shellSize; y++) {
            for (let z = 0; z < grid.depth; z++) {
                const dx = (x - sx) / radius;
                const dy = (y - sy) / (radius * 0.95);
                const dz = (z - cz) / (radius * 0.9);

                if (dx * dx + dy * dy + dz * dz > 1.1) {
                    continue;
                }

                const angle = Math.atan2(y - sy, x - sx) / (Math.PI * 2);
                const ring =
                    Math.hypot(x - sx, y - sy) / Math.max(1, radius * 0.5);
                const band = Math.floor(ring + angle * 2 + 8) % 2;
                grid.set(x, y, z, band === 0 ? style.shell : style.stripe);
            }
        }
    }

    // Head and feelers at the front of the foot.
    const head = footEnd - 1;
    grid.fill(head, footHeight, Math.round(cz), style.foot);

    for (let y = 1; y <= antennae; y++) {
        const spread = footWidth > 1 ? 1 : 0;
        grid.fill(
            head,
            footHeight + y,
            Math.round(cz) - spread,
            shade(style.foot, 0.8),
        );
        grid.fill(
            head,
            footHeight + y,
            Math.round(cz) + spread,
            shade(style.foot, 0.8),
        );
    }

    return grid;
}

function snailClips(length: number, style: SnailStyle): Clips {
    return {
        move: [0, 1, 1, 0].map((reach) => snail(length, style, reach)),
        idle: [snail(length, style, 1)],
    };
}

// ---------------------------------------------------------------- tiny walkers

function springtail(length: number, body: string, hop: number): Grid {
    const grid = new Grid(length, 2, 1);

    for (let x = 0; x < length; x++) {
        grid.set(
            x,
            hop,
            0,
            x === length - 1 && length > 1 ? shade(body, 0.7) : body,
        );
    }

    return grid;
}

function isopod(length: number, body: string, ripple: number): Grid {
    const width = Math.max(1, Math.round(length * 0.6));
    const grid = new Grid(length, 1, width);

    for (let x = 0; x < length; x++) {
        for (let z = 0; z < width; z++) {
            grid.set(
                x,
                0,
                z,
                (x + ripple) % 2 === 0 ? body : shade(body, 0.85),
            );
        }
    }

    return grid;
}

// ---------------------------------------------------------------- toad

type ToadStyle = { body: string; belly: string };

function toad(
    length: number,
    style: ToadStyle,
    lift: number,
    legsOut: boolean,
    throat: boolean,
): Grid {
    const bodyHeight = Math.max(2, Math.round(length * 0.26));
    const bodyWidth = odd(Math.max(2, Math.round(length * 0.55)));
    const grid = new Grid(length, bodyHeight + 2, bodyWidth + 2);
    const cx = (length - 1) / 2;
    const cy = lift + (bodyHeight - 1) / 2;
    const cz = (grid.depth - 1) / 2;

    for (let x = 0; x < length; x++) {
        for (let y = lift; y < lift + bodyHeight; y++) {
            for (let z = 1; z < grid.depth - 1; z++) {
                const nx = (x - cx) / (length * 0.42);
                const ny = (y - cy) / (bodyHeight / 2);
                const nz = (z - cz) / (bodyWidth / 2);

                if (nx * nx + ny * ny + nz * nz > 1.15) {
                    continue;
                }

                const colour =
                    y === lift
                        ? style.belly
                        : hash(x, y, z, 3) < 0.2
                          ? shade(style.body, 0.55)
                          : style.body;
                grid.set(x, y, z, colour);
            }
        }
    }

    // Eyes standing up near the front.
    const eyeX = Math.round(length * 0.75);
    const eyeY = lift + bodyHeight;
    const eyeSpread = Math.max(1, Math.round(bodyWidth * 0.3));

    for (const side of [-1, 1]) {
        grid.set(eyeX, eyeY, Math.round(cz) + side * eyeSpread, '#d8b84a');
    }

    // Legs: back legs folded at the flanks (or kicked out behind), front legs below the head.
    const legColour = shade(style.body, 0.85);
    const frontX = Math.round(length * 0.68);

    for (const z of [0, grid.depth - 1]) {
        if (legsOut) {
            for (let x = 0; x < Math.max(1, Math.round(length * 0.25)); x++) {
                grid.set(x, 0, z, legColour);
            }
        } else {
            for (
                let x = Math.round(length * 0.12);
                x <= Math.round(length * 0.35);
                x++
            ) {
                grid.set(x, lift, z, legColour);
            }
        }

        for (let y = 0; y <= lift; y++) {
            grid.set(frontX, y, z, legColour);
        }
    }

    if (throat) {
        grid.fill(
            length - 1,
            lift,
            Math.round(cz),
            mix(style.belly, '#ffffff', 0.3),
        );
    }

    return grid;
}

function toadClips(length: number, style: ToadStyle): Clips {
    return {
        move: [
            toad(length, style, 0, false, false),
            toad(length, style, 1, true, false),
            toad(length, style, 1, true, false),
            toad(length, style, 0, false, false),
        ],
        idle: [
            toad(length, style, 0, false, false),
            toad(length, style, 0, false, true),
        ],
    };
}

// ---------------------------------------------------------------- catalogue

type Species = {
    /** Model length in voxels per growth stage, in the catalogue's order. */
    stages: Record<string, number>;
    clips: (length: number) => Clips;
};

const guppy: FishStyle = {
    body: '#b8c2cc',
    fin: TINT,
    height: 0.3,
    width: 0.22,
    dorsal: 0.12,
    tailSpread: 1.3,
};
const corydoras: FishStyle = {
    body: '#c9b28f',
    fin: '#b49d7a',
    height: 0.36,
    width: 0.28,
    dorsal: 0.14,
    tailSpread: 0.9,
    flatBelly: true,
    spots: '#5a4a36',
    barbels: true,
    pectoral: true,
};

const SPECIES: Record<string, Species> = {
    guppy: {
        stages: { fry: 4, juvenile: 10, adult: 18 },
        clips: (length) => fishClips(length, guppy),
    },
    corydoras: {
        stages: { fry: 6, juvenile: 15, adult: 27 },
        clips: (length) => fishClips(length, corydoras),
    },
    'nerite-snail': {
        stages: { hatchling: 3, juvenile: 6, adult: 10 },
        clips: (length) =>
            snailClips(length, {
                shell: '#6b4f2a',
                stripe: '#e0b84a',
                foot: '#8c8478',
            }),
    },
    'glass-snail': {
        stages: { hatchling: 2, juvenile: 3, adult: 4 },
        clips: (length) =>
            snailClips(length, {
                shell: '#b8a17a',
                stripe: '#d9c79d',
                foot: '#5c5a57',
            }),
    },
    springtail: {
        stages: { young: 1, adult: 2 },
        clips: (length) => ({
            move: [0, 1].map((hop) => springtail(length, '#e8e4d8', hop)),
            idle: [springtail(length, '#e8e4d8', 0)],
        }),
    },
    'dwarf-white-isopod': {
        stages: { young: 2, adult: 3 },
        clips: (length) => ({
            move: [0, 1].map((ripple) => isopod(length, '#f0ece0', ripple)),
            idle: [isopod(length, '#f0ece0', 0)],
        }),
    },
    'fire-bellied-toad': {
        stages: { froglet: 8, juvenile: 15, adult: 25 },
        clips: (length) =>
            toadClips(length, { body: '#4a7a3a', belly: '#e0562b' }),
    },
};

function build(species: Species): Uint8Array {
    const palette = new Palette();
    const models: VoxModel[] = [];

    for (const [stage, length] of Object.entries(species.stages)) {
        for (const [clip, frames] of Object.entries(species.clips(length))) {
            frames.forEach((grid, frame) =>
                models.push(grid.toModel(`${stage}.${clip}.${frame}`, palette)),
            );
        }
    }

    return writeVox({ models, palette: palette.toVox() });
}

// ---------------------------------------------------------------- main

const args = process.argv.slice(2);
const force = args.includes('--force');
const only = args.filter((arg) => !arg.startsWith('--'));
const manifest: Record<string, string> = existsSync(MANIFEST)
    ? JSON.parse(readFileSync(MANIFEST, 'utf8'))
    : {};
const digest = (bytes: Uint8Array) =>
    createHash('sha256').update(bytes).digest('hex');

mkdirSync(OUTPUT, { recursive: true });

for (const [slug, species] of Object.entries(SPECIES)) {
    if (only.length > 0 && !only.includes(slug)) {
        continue;
    }

    const path = `${OUTPUT}/${slug}.vox`;

    if (
        existsSync(path) &&
        !force &&
        manifest[slug] !== digest(readFileSync(path))
    ) {
        console.log(`skip  ${path} (edited by hand; use --force to replace)`);
        continue;
    }

    const bytes = build(species);
    writeFileSync(path, bytes);
    manifest[slug] = digest(bytes);
    console.log(`wrote ${path}`);
}

writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 4)}\n`);
