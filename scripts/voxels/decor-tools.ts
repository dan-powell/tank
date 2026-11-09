/**
 * Building blocks for the decoration models (see generate-decor.ts): noise,
 * a solid/empty volume with carving and plant ledges, layered rock colouring,
 * and corals that grow over a finished rock.
 */
import { Grid, hash, mix } from './voxel-tools.ts';

// ---------------------------------------------------------------- noise

const smooth = (t: number) => t * t * (3 - 2 * t);

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

/** Smooth interpolation through (x, value) control points sorted by x. */
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

export function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

/** Pick from a list by a 0..1 value. */
export function pick<T>(items: T[], t: number): T {
    return items[clamp(Math.floor(t * items.length), 0, items.length - 1)];
}

// ---------------------------------------------------------------- volume

export type Cell = [number, number, number];

/**
 * Which cells of a model are solid, in game grid space (x right, y up, z
 * towards the viewer). Values above zero are solid; builders may use them
 * as material labels.
 */
export class Volume {
    readonly width: number;

    readonly height: number;

    readonly depth: number;

    private readonly cells: Uint8Array;

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

    put(x: number, y: number, z: number, value: number): void {
        if (this.inside(x, y, z)) {
            this.cells[(y * this.depth + z) * this.width + x] = value;
        }
    }

    /** A solid cell with open water beside, above, in front of or below it. */
    isSurface(x: number, y: number, z: number): boolean {
        return (
            this.at(x, y, z) > 0 &&
            (!this.at(x + 1, y, z) ||
                !this.at(x - 1, y, z) ||
                !this.at(x, y + 1, z) ||
                !this.at(x, y, z + 1) ||
                !this.at(x, y - 1, z))
        );
    }

    /** Visit every cell, y outermost (the order the models are painted in). */
    each(visit: (x: number, y: number, z: number) => void): void {
        for (let y = 0; y < this.height; y++) {
            for (let z = 0; z < this.depth; z++) {
                for (let x = 0; x < this.width; x++) {
                    visit(x, y, z);
                }
            }
        }
    }

    /** Fill (or, with 0, hollow out) a ball between two points with tapering radius. */
    capsule(
        a: [number, number, number],
        b: [number, number, number],
        radiusA: number,
        radiusB: number,
        value: number,
    ): void {
        const length = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
        const steps = Math.max(1, Math.ceil(length * 2));

        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const centre = [0, 1, 2].map((k) => a[k] + (b[k] - a[k]) * t);
            this.ball(centre as Cell, radiusA + (radiusB - radiusA) * t, value);
        }
    }

    ball(centre: Cell, radius: number, value: number): void {
        const [cx, cy, cz] = centre;
        const r = Math.ceil(radius);

        for (let y = Math.floor(cy) - r; y <= cy + r; y++) {
            for (let z = Math.floor(cz) - r; z <= cz + r; z++) {
                for (let x = Math.floor(cx) - r; x <= cx + r; x++) {
                    if (
                        Math.hypot(x + 0.5 - cx, y + 0.5 - cy, z + 0.5 - cz) <=
                        radius
                    ) {
                        this.put(x, y, z, value);
                    }
                }
            }
        }
    }

    /** Hollow out a wobbly ellipsoid (caves and hollows). */
    carve([cx, cy, cz]: Cell, [rx, ry, rz]: Cell, seed = 31): void {
        this.each((x, y, z) => {
            const wobble = (noise(x / 3, y / 3, z / 3, seed) - 0.5) * 0.35;
            const d =
                ((x - cx) / rx) ** 2 +
                ((y - cy) / ry) ** 2 +
                ((z - cz) / rz) ** 2;

            if (d < 1 + wobble) {
                this.put(x, y, z, 0);
            }
        });
    }
}

/**
 * Plant ledges: a slab jutting out to each anchor with a tapering bracket
 * beneath, and a clear shaft above it for the plant. Returns the test for
 * cells kept clear above the anchors.
 */
export function plantLedges(
    volume: Volume,
    anchors: Cell[],
    value = 1,
): (x: number, y: number, z: number) => boolean {
    for (const [ax, ay, az] of anchors) {
        for (let below = 1; below <= 8; below++) {
            const reach = az + 4 - Math.max(0, below - 3) * 2;
            const halfWidth = 6 - Math.max(0, below - 3) * 0.6;

            for (let z = 0; z <= reach; z++) {
                for (
                    let x = Math.ceil(ax - halfWidth);
                    x <= ax + halfWidth;
                    x++
                ) {
                    volume.put(x, ay - below, z, value);
                }
            }
        }

        clearShaft(volume, [ax, ay, az]);
    }

    return reservedAbove(anchors);
}

/** Clear the room a plant needs above an anchor. */
export function clearShaft(
    volume: Volume,
    [ax, ay, az]: Cell,
    radius = 4.5,
    height = 16,
): void {
    for (let y = ay; y < Math.min(volume.height, ay + height); y++) {
        for (let z = 0; z < volume.depth; z++) {
            for (let x = Math.floor(ax - radius); x <= ax + radius; x++) {
                if (Math.hypot(x - ax, z - az) <= radius) {
                    volume.put(x, y, z, 0);
                }
            }
        }
    }
}

/** Cells kept clear above the anchors, so nothing grows into a plant's way. */
export function reservedAbove(
    anchors: Cell[],
    radius = 6,
): (x: number, y: number, z: number) => boolean {
    return (x, y, z) =>
        anchors.some(
            ([ax, ay, az]) =>
                y >= ay - 1 &&
                y <= ay + 16 &&
                Math.hypot(x - ax, z - az) <= radius,
        );
}

/** Pits weathered into exposed rock (never under a plant spot). */
export function weather(
    volume: Volume,
    reserved: (x: number, y: number, z: number) => boolean,
    chance = 0.07,
    seed = 41,
): void {
    for (let y = 1; y < volume.height; y++) {
        for (let z = 0; z < volume.depth; z++) {
            for (let x = 0; x < volume.width; x++) {
                if (
                    volume.isSurface(x, y, z) &&
                    hash(x, y, z, seed) < chance &&
                    !reserved(x, y + 1, z)
                ) {
                    volume.put(x, y, z, 0);
                }
            }
        }
    }
}

// ---------------------------------------------------------------- rock colour

/** How a rock is coloured: banded strata, grain, cracks and algae on its sunlit tops. */
export type RockScheme = {
    /** Dark to light. */
    tones: string[];
    /** Tone index (into `tones`) of each stratum in turn. */
    bands: number[];
    /** A warmer stratum blended in every seventh band. */
    warm: string;
    crack: string;
    /** Coralline algae (or moss) on sunlit tops. */
    algae: [string, string];
    /** Noise level above which the algae grows (higher is sparser). */
    algaeAbove: number;
    /** Rows near the floor kept a shade darker. */
    shadowBelow: number;
    /** Stratum thickness in cells, and how much the strata tilt along x. */
    stratum: number;
    tilt: number;
    /** Offsets the noise seeds, so schemes don't share patterns. */
    seed: number;
};

/** Paint every solid cell of a rock (cells already painted are left alone). */
export function paintRock(
    volume: Volume,
    grid: Grid,
    scheme: RockScheme,
    only: (x: number, y: number, z: number) => boolean = () => true,
): void {
    const { tones, seed } = scheme;

    volume.each((x, y, z) => {
        if (!volume.at(x, y, z) || !only(x, y, z)) {
            return;
        }

        const strata =
            (y +
                x * scheme.tilt +
                (noise(x / 14, y / 6, z / 14, 51 + seed) - 0.5) * 6) /
            scheme.stratum;
        const band =
            scheme.bands[
                ((Math.floor(strata) % scheme.bands.length) +
                    scheme.bands.length) %
                    scheme.bands.length
            ];
        const grain = Math.round(
            (fbm(x / 2.5, y / 2.5, z / 2.5, 61 + seed) - 0.5) * 3,
        );
        const sunlit = !volume.at(x, y + 1, z) ? 1 : 0;
        const shadowed = y < scheme.shadowBelow ? -1 : 0;
        let colour =
            tones[clamp(band + grain + sunlit + shadowed, 0, tones.length - 1)];

        if (Math.floor(strata) % 7 === 3) {
            colour = mix(colour, scheme.warm, 0.45);
        }

        if (Math.abs(noise(x / 10, y / 10, z / 10, 71 + seed) - 0.5) < 0.015) {
            colour = scheme.crack;
        } else if (
            sunlit &&
            noise(x / 6, y / 6, z / 6, 81 + seed) > scheme.algaeAbove
        ) {
            colour =
                hash(x, y, z, 82 + seed) < 0.5
                    ? scheme.algae[0]
                    : scheme.algae[1];
        }

        grid.set(x, y, z, colour);
    });
}

// ---------------------------------------------------------------- corals

/** Where corals may grow, and the random sequence they grow from. */
export type Reef = {
    volume: Volume;
    grid: Grid;
    reserved: (x: number, y: number, z: number) => boolean;
    random: () => number;
    /** Open cells on top of the rock that corals may start from. */
    sites: Cell[];
    taken: Cell[];
};

/**
 * Collect the places on a rock that coral can grow from: open above (and in
 * front, so it shows), facing the viewer, clear of the plant spots.
 */
export function reef(
    volume: Volume,
    grid: Grid,
    reserved: (x: number, y: number, z: number) => boolean,
    seed: number,
    { minY = 10, minZ = 8 }: { minY?: number; minZ?: number } = {},
): Reef {
    const sites: Cell[] = [];

    for (let y = minY; y < volume.height - 4; y++) {
        for (let z = minZ; z < volume.depth; z++) {
            for (let x = 2; x < volume.width - 2; x++) {
                if (
                    volume.at(x, y, z) &&
                    !volume.at(x, y + 1, z) &&
                    !volume.at(x, y + 1, z + 1) &&
                    !reserved(x, y + 1, z)
                ) {
                    sites.push([x, y + 1, z]);
                }
            }
        }
    }

    return {
        volume,
        grid,
        reserved,
        random: sequence(seed),
        sites,
        taken: [],
    };
}

/** A free site at least `spacing` cells from every coral grown so far. */
export function pickSite(reef: Reef, spacing: number): Cell | null {
    for (let attempt = 0; attempt < 200; attempt++) {
        const site = reef.sites[Math.floor(reef.random() * reef.sites.length)];

        if (
            reef.taken.every(
                (other) =>
                    Math.hypot(
                        site[0] - other[0],
                        site[1] - other[1],
                        site[2] - other[2],
                    ) >= spacing,
            )
        ) {
            reef.taken.push(site);

            return site;
        }
    }

    return null;
}

function grow(
    reef: Reef,
    x: number,
    y: number,
    z: number,
    colour: string,
): void {
    const [rx, ry, rz] = [Math.round(x), Math.round(y), Math.round(z)];

    if (!reef.volume.at(rx, ry, rz) && !reef.reserved(rx, ry, rz)) {
        reef.grid.fill(rx, ry, rz, colour);
    }
}

export type StaghornColours = { tip: string; dark: string; body: string };

const ORANGE_STAGHORN: StaghornColours = {
    tip: '#ffd2a2',
    dark: '#e8954a',
    body: '#f2a65a',
};

/** Staghorn: forking branches reaching up and out, with pale tips. */
export function staghorn(
    reef: Reef,
    count: number,
    colours: StaghornColours = ORANGE_STAGHORN,
    spacing = 13,
): void {
    const { random } = reef;
    const branch = (
        x: number,
        y: number,
        z: number,
        dx: number,
        dy: number,
        dz: number,
        length: number,
        forks: number,
    ) => {
        for (let step = 0; step < length; step++) {
            x += dx;
            y += dy;
            z += dz;
            grow(
                reef,
                x,
                y,
                z,
                step >= length - 2
                    ? colours.tip
                    : step % 3 === 0
                      ? colours.dark
                      : colours.body,
            );

            if (forks > 0 && step > 1 && random() < 0.28) {
                const angle = random() * Math.PI * 2;
                branch(
                    x,
                    y,
                    z,
                    Math.cos(angle) * 0.7,
                    0.75,
                    Math.sin(angle) * 0.45,
                    Math.round(length * 0.65),
                    forks - 1,
                );
            }

            // Wander a little, but keep climbing.
            dx += (random() - 0.5) * 0.35;
            dz += (random() - 0.5) * 0.2;
            const norm = Math.hypot(dx, dy, dz);
            [dx, dy, dz] = [dx / norm, Math.max(0.45, dy / norm), dz / norm];
        }
    };

    for (let i = 0; i < count; i++) {
        const site = pickSite(reef, spacing);

        if (site !== null) {
            for (let stem = 0; stem < 3; stem++) {
                const angle = random() * Math.PI * 2;
                branch(
                    site[0],
                    site[1] - 1,
                    site[2],
                    Math.cos(angle) * 0.5,
                    0.85,
                    Math.sin(angle) * 0.3,
                    7 + Math.floor(random() * 5),
                    2,
                );
            }
        }
    }
}

export type BrainColours = { groove: string; rim: string; body: string };

const RED_BRAIN: BrainColours = {
    groove: '#a24a3c',
    rim: '#ef8f74',
    body: '#e0705a',
};

/** Brain coral: grooved domes. */
export function brainCoral(
    reef: Reef,
    count: number,
    colours: BrainColours = RED_BRAIN,
    spacing = 13,
): void {
    for (let i = 0; i < count; i++) {
        const site = pickSite(reef, spacing);

        if (site === null) {
            continue;
        }

        const radius = 4 + Math.floor(reef.random() * 3);
        const [cx, cy, cz] = site;

        for (let y = cy - 1; y <= cy + radius; y++) {
            for (let z = cz - radius; z <= cz + radius; z++) {
                for (let x = cx - radius; x <= cx + radius; x++) {
                    const d = Math.hypot(
                        (x - cx) / radius,
                        ((y - cy + 1) / radius) * 1.15,
                        (z - cz) / radius,
                    );

                    if (d > 1) {
                        continue;
                    }

                    const groove =
                        Math.sin(x * 1.4 + 2 * Math.sin(z * 0.8)) *
                        Math.sin(z * 1.3 + 2 * Math.sin(y * 0.9));
                    grow(
                        reef,
                        x,
                        y,
                        z,
                        groove > 0.3
                            ? colours.groove
                            : d > 0.8 && y > cy
                              ? colours.rim
                              : colours.body,
                    );
                }
            }
        }
    }
}

/** Sea fans: flat lattices facing the viewer. */
export function seaFans(
    reef: Reef,
    count: number,
    [stem, lattice]: [string, string] = ['#7e3f7a', '#b05fa8'],
    { spacing = 16, length = 7 }: { spacing?: number; length?: number } = {},
): void {
    const { random } = reef;
    const fan = (
        x: number,
        y: number,
        z: number,
        angle: number,
        reach: number,
        forks: number,
    ) => {
        for (let step = 0; step < reach; step++) {
            x += Math.sin(angle);
            y += Math.cos(angle) * 0.9;
            grow(reef, x, y, z, forks >= 3 ? stem : lattice);

            if (forks > 0 && step === Math.floor(reach / 2)) {
                fan(
                    x,
                    y,
                    z,
                    angle - 0.45 - random() * 0.2,
                    Math.round(reach * 0.75),
                    forks - 1,
                );
                fan(
                    x,
                    y,
                    z,
                    angle + 0.45 + random() * 0.2,
                    Math.round(reach * 0.75),
                    forks - 1,
                );

                return;
            }

            angle += (random() - 0.5) * 0.15;
        }
    };

    for (let i = 0; i < count; i++) {
        const site = pickSite(reef, spacing);

        if (site !== null) {
            fan(
                site[0],
                site[1] - 1,
                site[2],
                (random() - 0.5) * 0.3,
                length,
                3,
            );
        }
    }
}

/** Tube coral: clusters of tubes with pale mouths. */
export function tubeCoral(
    reef: Reef,
    count: number,
    [mouth, light, dark]: [string, string, string] = [
        '#f4d6c6',
        '#c46fa2',
        '#d77fb0',
    ],
    spacing = 10,
): void {
    const { random, volume } = reef;

    for (let i = 0; i < count; i++) {
        const site = pickSite(reef, spacing);

        if (site === null) {
            continue;
        }

        for (let tube = 0; tube < 7; tube++) {
            const tx = site[0] + Math.round((random() - 0.5) * 6);
            const tz = site[2] + Math.round((random() - 0.5) * 4);
            const tall = 2 + Math.floor(random() * 5);

            // Stand on whatever is beneath the tube.
            let ty = site[1] + 3;

            while (ty > 0 && !volume.at(tx, ty - 1, tz)) {
                ty--;
            }

            for (let y = 0; y < tall; y++) {
                grow(
                    reef,
                    tx,
                    ty + y,
                    tz,
                    y === tall - 1 ? mouth : y % 2 === 0 ? light : dark,
                );
            }
        }
    }
}

/** Table coral: a broad, flat plate on a short stalk. */
export function tableCoral(
    reef: Reef,
    count: number,
    [plate, edge, stalk]: [string, string, string] = [
        '#9cb87a',
        '#c9dca4',
        '#7d955f',
    ],
    spacing = 18,
): void {
    const { random } = reef;

    for (let i = 0; i < count; i++) {
        const site = pickSite(reef, spacing);

        if (site === null) {
            continue;
        }

        const [cx, cy, cz] = site;
        const tall = 3 + Math.floor(random() * 3);
        const radius = 5 + random() * 3;

        for (let y = 0; y < tall; y++) {
            grow(reef, cx, cy + y, cz, stalk);
            grow(reef, cx + 1, cy + y, cz, stalk);
        }

        for (let z = Math.floor(cz - radius); z <= cz + radius; z++) {
            for (let x = Math.floor(cx - radius); x <= cx + radius; x++) {
                const d = Math.hypot(x - cx, (z - cz) * 1.2);
                const ragged = radius - hash(x, 0, z, 97) * 1.6;

                if (d > ragged) {
                    continue;
                }

                // Plates dish up a little towards the rim.
                const lift = d > radius * 0.6 ? 1 : 0;
                grow(
                    reef,
                    x,
                    cy + tall + lift,
                    z,
                    d > ragged - 1 ? edge : plate,
                );
            }
        }
    }
}

/** Anemones: a soft column crowned with waving tentacles. */
export function anemones(
    reef: Reef,
    count: number,
    [column, tentacle, tip]: [string, string, string] = [
        '#d9663f',
        '#f08a5d',
        '#ffe0b8',
    ],
    spacing = 9,
): void {
    const { random } = reef;

    for (let i = 0; i < count; i++) {
        const site = pickSite(reef, spacing);

        if (site === null) {
            continue;
        }

        const [cx, cy, cz] = site;

        for (let y = 0; y < 2; y++) {
            for (let dz = -1; dz <= 1; dz++) {
                for (let dx = -1; dx <= 1; dx++) {
                    grow(reef, cx + dx, cy + y, cz + dz, column);
                }
            }
        }

        const arms = 8 + Math.floor(random() * 5);

        for (let arm = 0; arm < arms; arm++) {
            const angle = (arm / arms) * Math.PI * 2 + random() * 0.4;
            const reach = 3 + Math.floor(random() * 3);
            let [x, y, z] = [cx, cy + 2, cz];

            for (let step = 0; step < reach; step++) {
                x += Math.cos(angle) * 0.7;
                z += Math.sin(angle) * 0.5;
                y += step < 2 ? 1 : 0.4;
                grow(reef, x, y, z, step === reach - 1 ? tip : tentacle);
            }
        }
    }
}

/** Polyps dotted over the sunlit rock. */
export function polyps(
    reef: Reef,
    chance = 0.025,
    colours: [string, string] = ['#f4d6c6', '#f2b8a0'],
): void {
    for (const [x, y, z] of reef.sites) {
        if (hash(x, y, z, 91) < chance) {
            grow(
                reef,
                x,
                y,
                z,
                hash(x, y, z, 92) < 0.5 ? colours[0] : colours[1],
            );
        }
    }
}
