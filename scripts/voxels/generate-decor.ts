/**
 * Generate decoration models at the tank's 0.2 cm voxel size.
 *
 *     node scripts/voxels/generate-decor.ts [--force] [slug...]
 *
 * Writes resources/models/decor/{slug}.vox. Each model's size and plant
 * anchors must match app/Simulation/DecorationCatalogue.php (checked by
 * DecorationCatalogueTest): every anchor is an empty cell with solid rock
 * directly beneath it. Like the species script, a file whose contents no
 * longer match what this script last wrote (generated.json) has been edited
 * by hand and is left alone unless --force.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { writeVox } from '../../resources/js/lib/tank/vox-file.ts';
import { Grid, hash, mix, Palette } from './voxel-tools.ts';

const OUTPUT = 'resources/models/decor';
const MANIFEST = 'scripts/voxels/generated.json';

// ---------------------------------------------------------------- noise

const smooth = (t: number) => t * t * (3 - 2 * t);

/** Smooth 3D value noise in 0..1. */
function noise(x: number, y: number, z: number, seed = 0): number {
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
function fbm(x: number, y: number, z: number, seed = 0): number {
    return (
        noise(x, y, z, seed) * 0.57 +
        noise(x * 2.1, y * 2.1, z * 2.1, seed + 1) * 0.29 +
        noise(x * 4.3, y * 4.3, z * 4.3, seed + 2) * 0.14
    );
}

/** A deterministic random sequence (mulberry32). */
function sequence(seed: number): () => number {
    let state = seed >>> 0;

    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = Math.imul(state ^ (state >>> 15), 1 | state);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;

        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** Linear interpolation through (x, value) control points sorted by x. */
function profile(points: [number, number][], x: number): number {
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

// ---------------------------------------------------------------- coral wall

/**
 * A tall rocky backdrop that leans on the back glass: three craggy masses
 * (a lower pillar between two peaks) in tilted, cracked strata, with a cave
 * at the foot, four ledges for plants, and corals growing over it: branching
 * staghorn, grooved brain coral, sea fans, tube clusters and polyps.
 */
function coralWall(): Grid {
    const [width, height, depth] = [120, 90, 30];
    const grid = new Grid(width, height, depth);
    const solid = new Uint8Array(width * height * depth);
    const at = (x: number, y: number, z: number) =>
        x >= 0 && y >= 0 && z >= 0 && x < width && y < height && z < depth
            ? solid[(y * depth + z) * width + x]
            : 0;
    const put = (x: number, y: number, z: number, value: number) => {
        if (
            x >= 0 &&
            y >= 0 &&
            z >= 0 &&
            x < width &&
            y < height &&
            z < depth
        ) {
            solid[(y * depth + z) * width + x] = value;
        }
    };

    /** Plant spots (must match the catalogue), and the room kept clear above each. */
    const anchors: [number, number, number][] = [
        [21, 30, 21],
        [61, 50, 18],
        [98, 38, 21],
        [61, 58, 6],
    ];
    const reserved = (x: number, y: number, z: number) =>
        anchors.some(
            ([ax, ay, az]) =>
                y >= ay - 1 && y <= ay + 16 && Math.hypot(x - ax, z - az) <= 6,
        );

    // The skyline: two peaks with a lower, flat-topped pillar between them.
    const skyline: [number, number][] = [
        [0, 77],
        [10, 79],
        [15, 73],
        [22, 81],
        [28, 84],
        [33, 78],
        [38, 69],
        [41, 57],
        [44, 51],
        [48, 49],
        [52, 53],
        [56, 58],
        [66, 58],
        [70, 53],
        [73, 49],
        [76, 57],
        [80, 77],
        [85, 86],
        [90, 84],
        [95, 77],
        [100, 75],
        [108, 76],
        [113, 72],
        [119, 61],
    ];
    const top = (x: number) => {
        const base = profile(skyline, x);

        // Keep the pillar's top flat where its plant spot sits.
        return x >= 56 && x <= 66
            ? base
            : base + (fbm(x / 7, 0, 3.7, 11) - 0.5) * 7;
    };

    // How far forward the rock reaches: deep at the foot, thin near the top.
    const footDepth = (x: number) => (x > 41 && x < 75 ? 21 : 29);

    for (let x = 0; x < width; x++) {
        const skylineHeight = top(x);

        for (let y = 0; y < height; y++) {
            if (y >= skylineHeight) {
                continue;
            }

            const rise = y / skylineHeight;
            const crag = (fbm(x / 6, y / 6, 1.3, 21) - 0.5) * 7;
            const front =
                5 + (footDepth(x) - 5) * Math.pow(1 - rise, 0.7) + crag;

            for (let z = 0; z < depth; z++) {
                if (z <= front) {
                    put(x, y, z, 1);
                }
            }
        }
    }

    // A cave at the foot of the left peak, and a smaller hollow on the right.
    const carve = (
        cx: number,
        cy: number,
        cz: number,
        rx: number,
        ry: number,
        rz: number,
    ) => {
        for (let y = 0; y < height; y++) {
            for (let z = 0; z < depth; z++) {
                for (let x = 0; x < width; x++) {
                    const wobble =
                        (noise(x / 3, y / 3, z / 3, 31) - 0.5) * 0.35;
                    const d =
                        ((x - cx) / rx) ** 2 +
                        ((y - cy) / ry) ** 2 +
                        ((z - cz) / rz) ** 2;

                    if (d < 1 + wobble) {
                        put(x, y, z, 0);
                    }
                }
            }
        }
    };
    carve(30, 6, 27, 10, 8, 10);
    carve(96, 19, 27, 6, 5, 7);

    // Ledges: a slab jutting out to each plant spot, with a tapering bracket beneath.
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
                    put(x, ay - below, z, 1);
                }
            }
        }

        for (let y = ay; y < Math.min(height, ay + 16); y++) {
            for (let z = 0; z < depth; z++) {
                for (let x = ax - 6; x <= ax + 6; x++) {
                    if (Math.hypot(x - ax, z - az) <= 4.5) {
                        put(x, y, z, 0);
                    }
                }
            }
        }
    }

    const isSurface = (x: number, y: number, z: number) =>
        at(x, y, z) === 1 &&
        (!at(x + 1, y, z) ||
            !at(x - 1, y, z) ||
            !at(x, y + 1, z) ||
            !at(x, y, z + 1) ||
            !at(x, y - 1, z));

    // Pits weathered into the exposed rock (never under a plant spot).
    for (let y = 1; y < height; y++) {
        for (let z = 0; z < depth; z++) {
            for (let x = 0; x < width; x++) {
                if (
                    isSurface(x, y, z) &&
                    hash(x, y, z, 41) < 0.07 &&
                    !reserved(x, y + 1, z)
                ) {
                    put(x, y, z, 0);
                }
            }
        }
    }

    for (const [ax, ay, az] of anchors) {
        put(ax, ay - 1, az, 1);
    }

    // Rock colours: tilted strata, fine grain, cracks, sunlit tops with pink coralline algae.
    const greys = [
        '#55514a',
        '#605c55',
        '#6c6860',
        '#78736a',
        '#847e73',
        '#908a7e',
        '#9c968a',
    ];
    const warm = '#8a7d68';

    for (let y = 0; y < height; y++) {
        for (let z = 0; z < depth; z++) {
            for (let x = 0; x < width; x++) {
                if (!at(x, y, z)) {
                    continue;
                }

                const strata =
                    (y +
                        x * 0.07 +
                        (noise(x / 14, y / 6, z / 14, 51) - 0.5) * 6) /
                    4.5;
                const band = [2, 4, 3, 5, 3][
                    ((Math.floor(strata) % 5) + 5) % 5
                ];
                const grain = Math.round(
                    (fbm(x / 2.5, y / 2.5, z / 2.5, 61) - 0.5) * 3,
                );
                const sunlit = !at(x, y + 1, z) ? 1 : 0;
                const shadowed = y < 10 ? -1 : 0;
                let colour =
                    greys[
                        Math.max(
                            0,
                            Math.min(
                                greys.length - 1,
                                band + grain + sunlit + shadowed,
                            ),
                        )
                    ];

                if (Math.floor(strata) % 7 === 3) {
                    colour = mix(colour, warm, 0.45);
                }

                if (Math.abs(noise(x / 10, y / 10, z / 10, 71) - 0.5) < 0.015) {
                    colour = '#433f39';
                } else if (sunlit && noise(x / 6, y / 6, z / 6, 81) > 0.63) {
                    colour = hash(x, y, z, 82) < 0.5 ? '#c98aa0' : '#b67a8e';
                }

                grid.set(x, y, z, colour);
            }
        }
    }

    // ------------------------------------------------ corals

    const random = sequence(2026);
    const grow = (x: number, y: number, z: number, colour: string) => {
        const [rx, ry, rz] = [Math.round(x), Math.round(y), Math.round(z)];

        if (!at(rx, ry, rz) && !reserved(rx, ry, rz)) {
            grid.fill(rx, ry, rz, colour);
        }
    };

    /** Places on the rock coral can grow from: open above, facing the viewer, clear of the plant spots. */
    const sites: [number, number, number][] = [];

    for (let y = 10; y < height - 4; y++) {
        for (let z = 8; z < depth; z++) {
            for (let x = 2; x < width - 2; x++) {
                if (
                    at(x, y, z) &&
                    !at(x, y + 1, z) &&
                    !at(x, y + 1, z + 1) &&
                    !reserved(x, y + 1, z)
                ) {
                    sites.push([x, y + 1, z]);
                }
            }
        }
    }

    const taken: [number, number, number][] = [];
    const pickSite = (spacing: number): [number, number, number] | null => {
        for (let attempt = 0; attempt < 200; attempt++) {
            const site = sites[Math.floor(random() * sites.length)];

            if (
                taken.every(
                    (other) =>
                        Math.hypot(
                            site[0] - other[0],
                            site[1] - other[1],
                            site[2] - other[2],
                        ) >= spacing,
                )
            ) {
                taken.push(site);

                return site;
            }
        }

        return null;
    };

    // Staghorn: forking orange branches reaching up and out, with pale tips.
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
                x,
                y,
                z,
                step >= length - 2
                    ? '#ffd2a2'
                    : step % 3 === 0
                      ? '#e8954a'
                      : '#f2a65a',
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

    for (let i = 0; i < 6; i++) {
        const site = pickSite(13);

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

    // Brain coral: grooved domes.
    for (let i = 0; i < 5; i++) {
        const site = pickSite(13);

        if (site === null) {
            continue;
        }

        const radius = 4 + Math.floor(random() * 3);
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
                        x,
                        y,
                        z,
                        groove > 0.3
                            ? '#a24a3c'
                            : d > 0.8 && y > cy
                              ? '#ef8f74'
                              : '#e0705a',
                    );
                }
            }
        }
    }

    // Sea fans: flat purple lattices facing the viewer.
    const fan = (
        x: number,
        y: number,
        z: number,
        angle: number,
        length: number,
        forks: number,
    ) => {
        for (let step = 0; step < length; step++) {
            x += Math.sin(angle);
            y += Math.cos(angle) * 0.9;
            grow(x, y, z, forks >= 3 ? '#7e3f7a' : '#b05fa8');

            if (forks > 0 && step === Math.floor(length / 2)) {
                fan(
                    x,
                    y,
                    z,
                    angle - 0.45 - random() * 0.2,
                    Math.round(length * 0.75),
                    forks - 1,
                );
                fan(
                    x,
                    y,
                    z,
                    angle + 0.45 + random() * 0.2,
                    Math.round(length * 0.75),
                    forks - 1,
                );

                return;
            }

            angle += (random() - 0.5) * 0.15;
        }
    };

    for (let i = 0; i < 3; i++) {
        const site = pickSite(16);

        if (site !== null) {
            fan(site[0], site[1] - 1, site[2], (random() - 0.5) * 0.3, 7, 3);
        }
    }

    // Tube coral: clusters of lilac tubes with pale mouths.
    for (let i = 0; i < 6; i++) {
        const site = pickSite(10);

        if (site === null) {
            continue;
        }

        for (let tube = 0; tube < 7; tube++) {
            const tx = site[0] + Math.round((random() - 0.5) * 6);
            const tz = site[2] + Math.round((random() - 0.5) * 4);
            const tall = 2 + Math.floor(random() * 5);

            // Stand on whatever is beneath the tube.
            let ty = site[1] + 3;

            while (ty > 0 && !at(tx, ty - 1, tz)) {
                ty--;
            }

            for (let y = 0; y < tall; y++) {
                grow(
                    tx,
                    ty + y,
                    tz,
                    y === tall - 1
                        ? '#f4d6c6'
                        : y % 2 === 0
                          ? '#c46fa2'
                          : '#d77fb0',
                );
            }
        }
    }

    // Polyps dotted over the sunlit rock.
    for (const [x, y, z] of sites) {
        if (hash(x, y, z, 91) < 0.025) {
            grow(x, y, z, hash(x, y, z, 92) < 0.5 ? '#f4d6c6' : '#f2b8a0');
        }
    }

    return grid;
}

// ---------------------------------------------------------------- main

const DECORATIONS: Record<string, () => Grid> = {
    'coral-wall': coralWall,
};

const args = process.argv.slice(2);
const force = args.includes('--force');
const only = args.filter((arg) => !arg.startsWith('--'));
const manifest: Record<string, string> = existsSync(MANIFEST)
    ? JSON.parse(readFileSync(MANIFEST, 'utf8'))
    : {};
const digest = (bytes: Uint8Array) =>
    createHash('sha256').update(bytes).digest('hex');

for (const [slug, build] of Object.entries(DECORATIONS)) {
    if (only.length > 0 && !only.includes(slug)) {
        continue;
    }

    const path = `${OUTPUT}/${slug}.vox`;
    const key = `decor/${slug}`;

    if (
        existsSync(path) &&
        !force &&
        manifest[key] !== digest(readFileSync(path))
    ) {
        console.log(
            `skip  ${path} (not written by this script; use --force to replace)`,
        );
        continue;
    }

    const palette = new Palette();
    const bytes = writeVox({
        models: [build().toModel(slug, palette)],
        palette: palette.toVox(),
    });
    writeFileSync(path, bytes);
    manifest[key] = digest(bytes);
    console.log(`wrote ${path}`);
}

writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 4)}\n`);
