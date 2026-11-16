import { Grid, hash, mix } from '../voxel-tools.ts';
import { fbm, noise, sequence, Solid } from './shapes.ts';
import type { Cell } from './shapes.ts';

const [WIDTH, HEIGHT, DEPTH] = [110, 55, 65];

/** Plant spots (must match the catalogue): one on each shoulder of the mound. */
export const CORAL_REEF_ANCHORS: Cell[] = [
    [22, 28, 40],
    [86, 23, 24],
];

/** Fluorescent torch-coral tips (must match the catalogue's light points). */
export const CORAL_REEF_LIGHTS: Cell[] = [
    [40, 33, 22],
    [70, 27, 44],
    [92, 23, 40],
    [17, 29, 24],
];

/** Where the torch corals stand, as [x, z]; their tips become the light points. */
const TORCH_SITES: [number, number][] = [
    [40, 22],
    [70, 44],
    [92, 40],
    [17, 24],
];

/**
 * A free-standing reef mound for the mid-ground, finished on every side.
 * Two rocky lobes joined by a saddle with a swim-through tunnel beneath,
 * an undercut lip all round, and coralline crust and turf over the rock.
 * Corals crowd every open face: tabletop acropora on stalks, branching
 * staghorn, grooved brain domes, sea fans, vase and tube sponges, leather
 * and mushroom corals, bubble coral, anemones with waving tentacles, and
 * torch corals whose glowing tips carry the LEDs.
 */
export function coralReef(): Grid {
    const grid = new Grid(WIDTH, HEIGHT, DEPTH);
    const solid = new Solid(WIDTH, HEIGHT, DEPTH);
    const random = sequence(1987);
    const anchors = CORAL_REEF_ANCHORS;
    const reserved = (x: number, y: number, z: number) =>
        anchors.some(
            ([ax, ay, az]) =>
                y >= ay - 1 && y <= ay + 16 && Math.hypot(x - ax, z - az) <= 5,
        );

    // ------------------------------------------------ the rock mound

    const lumps: [number, number, number, number, number][] = [
        // x, z, height, radius x, radius z
        [30, 32, 36, 24, 22],
        [78, 32, 31, 22, 21],
        [55, 30, 27, 14, 16],
        [44, 46, 19, 14, 10],
        [92, 22, 21, 12, 10],
        [16, 18, 18, 10, 9],
        [66, 18, 20, 10, 8],
    ];
    const surface = (x: number, z: number) => {
        let height = 0;

        for (const [lx, lz, lh, rx, rz] of lumps) {
            const d = ((x - lx) / rx) ** 2 + ((z - lz) / rz) ** 2;
            height = Math.max(height, lh * Math.exp(-d * 1.4));
        }

        return height + (fbm(x / 9, z / 9, 0.5, 3) - 0.5) * 9;
    };
    const footprint = (x: number, z: number) =>
        Math.hypot((x - 55) / 52, (z - 32) / 30) +
        (noise(x / 8, z / 8, 0, 4) - 0.5) * 0.25;

    for (let z = 0; z < DEPTH; z++) {
        for (let x = 0; x < WIDTH; x++) {
            const top = surface(x, z);
            const edge = footprint(x, z);

            for (let y = 0; y < top && y < HEIGHT; y++) {
                // Narrower at the sand than a little above it: an undercut lip.
                const reach = y < 5 ? 0.86 + y * 0.025 : 0.98;
                const crag = (fbm(x / 5, y / 5, z / 5, 5) - 0.5) * 0.18;

                if (edge + crag < reach) {
                    solid.put(x, y, z, 1);
                }
            }
        }
    }

    // A swim-through tunnel under the saddle, front to back, and a cave in the right lobe.
    const wobble = (x: number, y: number, z: number) =>
        (noise(x / 3, y / 3, z / 3, 7) - 0.5) * 0.5;

    for (let z = -2; z < DEPTH + 2; z++) {
        const sway = Math.sin(z / 9) * 3;
        solid.ellipsoid([54 + sway, 5, z], [7, 7.5, 3], 0, wobble);
    }

    solid.ellipsoid([82, 5, 52], [7, 5, 8], 0, wobble);

    // Flat, clear spots for the plants.
    for (const [ax, ay, az] of anchors) {
        for (let z = az - 6; z <= az + 6; z++) {
            for (let x = ax - 6; x <= ax + 6; x++) {
                const d = Math.hypot(x - ax, z - az);

                if (d <= 3.5) {
                    for (let y = ay - 1; y >= 0 && !solid.at(x, y, z); y--) {
                        solid.put(x, y, z, 1);
                    }
                }

                if (d <= 5) {
                    for (let y = ay; y < HEIGHT; y++) {
                        solid.put(x, y, z, 0);
                    }
                }
            }
        }
    }

    // Pits and pockmarks in the reef rock.
    for (let y = 1; y < HEIGHT; y++) {
        for (let z = 0; z < DEPTH; z++) {
            for (let x = 0; x < WIDTH; x++) {
                if (
                    solid.isSurface(x, y, z) &&
                    hash(x, y, z, 9) < 0.06 &&
                    !reserved(x, y + 1, z) &&
                    !reserved(x, y, z)
                ) {
                    solid.put(x, y, z, 0);
                }
            }
        }
    }

    for (const [ax, ay, az] of anchors) {
        solid.put(ax, ay - 1, az, 1);
    }

    // ------------------------------------------------ rock colours

    const rock = Array.from({ length: 8 }, (_, level) =>
        mix('#4f4a44', '#a59c8a', level / 7),
    );
    const crust = ['#c47e93', '#b26b84', '#d796a6', '#9b5d7a'];
    const turf = ['#6f7a3e', '#5f6b36', '#82884a'];
    const encrusting = ['#d9542f', '#e8743c', '#b8452a'];

    solid.each((x, y, z) => {
        const open = !solid.at(x, y + 1, z);
        const level = Math.max(
            0,
            Math.min(
                7,
                Math.round(
                    3.5 +
                        (fbm(x / 2.2, y / 2.2, z / 2.2, 11) - 0.5) * 6 +
                        (open ? 1.5 : 0) -
                        (y < 4 ? 1.5 : 0),
                ),
            ),
        );
        let colour = rock[level];
        const patch = noise(x / 5, y / 5, z / 5, 12);

        if (open && reserved(x, y + 1, z)) {
            colour = turf[Math.floor(hash(x, y, z, 13) * turf.length)];
        } else if (patch > 0.64 && solid.isSurface(x, y, z)) {
            colour = crust[Math.floor(hash(x, y, z, 14) * crust.length)];
        } else if (open && patch < 0.33) {
            colour = turf[Math.floor(hash(x, y, z, 15) * turf.length)];
        } else if (
            !open &&
            solid.isSurface(x, y, z) &&
            noise(x / 3, y / 3, z / 3, 16) > 0.74
        ) {
            colour =
                encrusting[Math.floor(hash(x, y, z, 17) * encrusting.length)];
        }

        grid.set(x, y, z, colour);
    });

    // ------------------------------------------------ corals

    const occupied = (x: number, y: number, z: number) =>
        grid.get(Math.round(x), Math.round(y), Math.round(z)) !== undefined;
    const grow = (x: number, y: number, z: number, colour: string) => {
        const [rx, ry, rz] = [Math.round(x), Math.round(y), Math.round(z)];

        if (!reserved(rx, ry, rz) && ry >= 0) {
            grid.fill(rx, ry, rz, colour);
        }
    };
    /** The first empty cell above the rock at a column. */
    const groundAt = (x: number, z: number) => {
        let y = HEIGHT - 1;

        while (y > 0 && !solid.at(x, y - 1, z)) {
            y--;
        }

        return y;
    };

    // Torch corals first, at fixed spots: fleshy stalks ending in glowing tips.
    const lightPoints: Cell[] = [];

    for (const [tx, tz] of TORCH_SITES) {
        const base = groundAt(tx, tz);
        const stems: [number, number, number][] = [
            [0, 1, 0],
            [0.45, 0.85, 0.3],
            [-0.5, 0.8, -0.2],
            [0.1, 0.8, -0.55],
            [-0.2, 0.85, 0.5],
        ];

        stems.forEach(([dx, dy, dz], index) => {
            const length = index === 0 ? 8 : 5 + Math.floor(random() * 3);
            let [x, y, z] = [tx, base, tz];

            for (let step = 0; step < length; step++) {
                grow(x, y, z, step % 2 ? '#6d8a5a' : '#5f7d4f');
                x += dx * 0.9;
                y += dy;
                z += dz * 0.9;
            }

            // A bulbous, tentacled tip.
            for (let oy = 0; oy <= 1; oy++) {
                for (let oz = -1; oz <= 1; oz++) {
                    for (let ox = -1; ox <= 1; ox++) {
                        if (Math.abs(ox) + Math.abs(oz) + oy <= 2) {
                            grow(
                                x + ox,
                                y + oy,
                                z + oz,
                                oy === 1 ? '#e4ff8a' : '#a8e05a',
                            );
                        }
                    }
                }
            }

            grow(x, y + 2, z, '#f2ffc0');

            if (index === 0) {
                lightPoints.push([
                    Math.round(x),
                    Math.round(y + 2),
                    Math.round(z),
                ]);
            }
        });
    }

    if (JSON.stringify(lightPoints) !== JSON.stringify(CORAL_REEF_LIGHTS)) {
        throw new Error(
            `Coral reef torch tips moved to ${JSON.stringify(lightPoints)}.`,
        );
    }

    /** Places corals can settle: open rock tops clear of the plant spots and torches. */
    const sites: Cell[] = [];

    solid.each((x, y, z) => {
        if (
            y >= 3 &&
            !solid.at(x, y + 1, z) &&
            !reserved(x, y + 1, z) &&
            x > 3 &&
            x < WIDTH - 4 &&
            z > 3 &&
            z < DEPTH - 4
        ) {
            sites.push([x, y + 1, z]);
        }
    });

    const taken: Cell[] = TORCH_SITES.map(([x, z]) => [x, groundAt(x, z), z]);
    const pickSite = (spacing: number, minY = 3): Cell | null => {
        for (let attempt = 0; attempt < 300; attempt++) {
            const site = sites[Math.floor(random() * sites.length)];

            if (
                site[1] >= minY &&
                taken.every(
                    (other) =>
                        Math.hypot(
                            site[0] - other[0],
                            (site[1] - other[1]) * 0.6,
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

    // Table acropora: a stout stalk under a broad, slightly tilted plate.
    const tablePalettes = [
        ['#4e8f86', '#63a79c', '#b9e6d6', '#3c7069'],
        ['#8a7a4a', '#a39058', '#e6d7a0', '#6b5d38'],
        ['#6c7fb0', '#8396c6', '#d5ddf5', '#53628c'],
    ];

    for (let i = 0; i < 3; i++) {
        const site = pickSite(20, 12);

        if (site === null) {
            continue;
        }

        const [plate, upper, rim, stalk] =
            tablePalettes[i % tablePalettes.length];
        const [sx, sy, sz] = site;
        const stalkHeight = 4 + Math.floor(random() * 3);
        const radius = 7 + Math.floor(random() * 3);
        const tiltX = (random() - 0.5) * 0.25;
        const tiltZ = (random() - 0.5) * 0.25;

        for (let y = 0; y < stalkHeight; y++) {
            for (let oz = -1; oz <= 1; oz++) {
                for (let ox = -1; ox <= 1; ox++) {
                    grow(sx + ox, sy - 1 + y, sz + oz, stalk);
                }
            }
        }

        const plateY = sy - 1 + stalkHeight;

        for (let oz = -radius - 1; oz <= radius + 1; oz++) {
            for (let ox = -radius - 1; ox <= radius + 1; ox++) {
                const d =
                    Math.hypot(ox, oz) /
                    (radius + (noise(ox / 2, oz / 2, i, 21) - 0.5) * 3);

                if (d > 1) {
                    continue;
                }

                const y = plateY + ox * tiltX + oz * tiltZ + d * 1.2;
                grow(sx + ox, y, sz + oz, d > 0.86 ? rim : plate);

                if (d < 0.86) {
                    grow(
                        sx + ox,
                        y + 1,
                        sz + oz,
                        hash(ox, i, oz, 22) < 0.35 ? rim : upper,
                    );
                }

                // Little upright branchlets along the top.
                if (hash(ox, i, oz, 23) < 0.12 && d < 0.9) {
                    grow(sx + ox, y + 2, sz + oz, rim);
                }
            }
        }
    }

    // Staghorn: forking branches with pale tips, in blue-violet and yellow.
    const staghornPalettes = [
        ['#5b6fd1', '#7385e0', '#e3c6ff'],
        ['#d4b23a', '#e6c64e', '#fff1b0'],
        ['#c96a3b', '#de8250', '#ffd2a2'],
    ];
    const branch = (
        position: [number, number, number],
        direction: [number, number, number],
        length: number,
        forks: number,
        palette: string[],
    ) => {
        let [x, y, z] = position;
        let [dx, dy, dz] = direction;

        for (let step = 0; step < length; step++) {
            x += dx;
            y += dy;
            z += dz;
            const colour =
                step >= length - 2
                    ? palette[2]
                    : step % 3 === 0
                      ? palette[0]
                      : palette[1];
            grow(x, y, z, colour);

            if (length > 5 && step < length - 2) {
                grow(x + 1, y, z, colour);
            }

            if (forks > 0 && step > 1 && random() < 0.3) {
                const angle = random() * Math.PI * 2;
                branch(
                    [x, y, z],
                    [Math.cos(angle) * 0.7, 0.75, Math.sin(angle) * 0.7],
                    Math.round(length * 0.65),
                    forks - 1,
                    palette,
                );
            }

            dx += (random() - 0.5) * 0.35;
            dz += (random() - 0.5) * 0.35;
            const norm = Math.hypot(dx, dy, dz);
            [dx, dy, dz] = [dx / norm, Math.max(0.45, dy / norm), dz / norm];
        }
    };

    for (let i = 0; i < 8; i++) {
        const site = pickSite(12);

        if (site === null) {
            continue;
        }

        const palette = staghornPalettes[i % staghornPalettes.length];

        for (let stem = 0; stem < 4; stem++) {
            const angle = random() * Math.PI * 2;
            branch(
                [site[0], site[1] - 1, site[2]],
                [Math.cos(angle) * 0.5, 0.85, Math.sin(angle) * 0.5],
                7 + Math.floor(random() * 5),
                2,
                palette,
            );
        }
    }

    // Brain coral: grooved domes.
    const brainPalettes = [
        ['#5f7d3a', '#9fbf63', '#c6dd8e'],
        ['#a24a3c', '#e0705a', '#ef8f74'],
        ['#7a6a3c', '#c9ae63', '#e6d08f'],
    ];

    for (let i = 0; i < 6; i++) {
        const site = pickSite(11);

        if (site === null) {
            continue;
        }

        const [groove, body, crest] = brainPalettes[i % brainPalettes.length];
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

                    const ridges =
                        Math.sin(x * 1.4 + 2 * Math.sin(z * 0.8)) *
                        Math.sin(z * 1.3 + 2 * Math.sin(y * 0.9));
                    grow(
                        x,
                        y,
                        z,
                        ridges > 0.3
                            ? groove
                            : d > 0.8 && y > cy
                              ? crest
                              : body,
                    );
                }
            }
        }
    }

    // Sea fans: flat lattices, each turned its own way.
    const fanColours = [
        ['#7e3f7a', '#b05fa8'],
        ['#a8322f', '#d8504a'],
        ['#c99a2a', '#e8bd45'],
    ];
    const fan = (
        x: number,
        y: number,
        z: number,
        angle: number,
        facing: number,
        length: number,
        forks: number,
        colours: string[],
    ) => {
        for (let step = 0; step < length; step++) {
            x += Math.sin(angle) * Math.cos(facing);
            z += Math.sin(angle) * Math.sin(facing);
            y += Math.cos(angle) * 0.9;
            grow(x, y, z, forks >= 3 ? colours[0] : colours[1]);

            if (forks > 0 && step === Math.floor(length / 2)) {
                fan(
                    x,
                    y,
                    z,
                    angle - 0.45 - random() * 0.2,
                    facing,
                    Math.round(length * 0.75),
                    forks - 1,
                    colours,
                );
                fan(
                    x,
                    y,
                    z,
                    angle + 0.45 + random() * 0.2,
                    facing,
                    Math.round(length * 0.75),
                    forks - 1,
                    colours,
                );

                return;
            }

            angle += (random() - 0.5) * 0.15;
        }
    };

    for (let i = 0; i < 4; i++) {
        const site = pickSite(14, 10);

        if (site !== null) {
            fan(
                site[0],
                site[1] - 1,
                site[2],
                (random() - 0.5) * 0.3,
                random() * Math.PI,
                7,
                3,
                fanColours[i % fanColours.length],
            );
        }
    }

    // Vase sponges: hollow, flared cups with a rough rim.
    const spongeColours = [
        ['#d98a2b', '#f0a83e', '#b86d1c'],
        ['#7b4fa0', '#9666bd', '#5f3a80'],
    ];

    for (let i = 0; i < 2; i++) {
        const site = pickSite(14);

        if (site === null) {
            continue;
        }

        const [outer, rim, inner] = spongeColours[i];
        const tall = 9 + Math.floor(random() * 4);

        for (let y = 0; y < tall; y++) {
            const radius = 2 + y * 0.22;

            for (let oz = -5; oz <= 5; oz++) {
                for (let ox = -5; ox <= 5; ox++) {
                    const d = Math.hypot(ox, oz);

                    if (d <= radius + 0.5 && (d > radius - 1.2 || y === 0)) {
                        grow(
                            site[0] + ox,
                            site[1] - 1 + y,
                            site[2] + oz,
                            y >= tall - 1
                                ? rim
                                : hash(ox, y, oz, 31) < 0.25
                                  ? inner
                                  : outer,
                        );
                    }
                }
            }
        }
    }

    // Tube sponge clusters and orange cup corals.
    for (let i = 0; i < 9; i++) {
        const site = pickSite(8);

        if (site === null) {
            continue;
        }

        const orange = i % 2 === 0;

        for (let tube = 0; tube < 6; tube++) {
            const tx = site[0] + Math.round((random() - 0.5) * 6);
            const tz = site[2] + Math.round((random() - 0.5) * 6);
            const tall = orange
                ? 1 + Math.floor(random() * 2)
                : 3 + Math.floor(random() * 6);
            let ty = site[1] + 4;

            while (ty > 0 && !occupied(tx, ty - 1, tz)) {
                ty--;
            }

            // Off the edge of the rock: no tube here.
            if (ty === 0) {
                continue;
            }

            for (let y = 0; y < tall; y++) {
                const top = y === tall - 1;
                grow(
                    tx,
                    ty + y,
                    tz,
                    orange
                        ? top
                            ? '#ffd23f'
                            : '#ff8a1f'
                        : top
                          ? '#f4d6c6'
                          : y % 2 === 0
                            ? '#c46fa2'
                            : '#d77fb0',
                );
            }
        }
    }

    // Leather coral: a pale stalk under a wide, folded cap fuzzy with polyps.
    for (let i = 0; i < 2; i++) {
        const site = pickSite(15);

        if (site === null) {
            continue;
        }

        const [sx, sy, sz] = site;

        for (let y = 0; y < 4; y++) {
            for (let oz = -2; oz <= 2; oz++) {
                for (let ox = -2; ox <= 2; ox++) {
                    if (Math.hypot(ox, oz) <= 2) {
                        grow(sx + ox, sy - 1 + y, sz + oz, '#d8cfae');
                    }
                }
            }
        }

        for (let oz = -7; oz <= 7; oz++) {
            for (let ox = -7; ox <= 7; ox++) {
                const d = Math.hypot(ox, oz);

                if (d > 6.5) {
                    continue;
                }

                const fold = Math.sin(Math.atan2(oz, ox) * 5) * (d / 6.5) * 1.6;
                const y = sy + 3 + d * 0.25 + fold;
                grow(sx + ox, y, sz + oz, d > 5.6 ? '#c9b98a' : '#e8dcb5');

                if (hash(ox, i, oz, 41) < 0.3) {
                    grow(sx + ox, y + 1, sz + oz, '#a8c49a');
                }
            }
        }
    }

    // Mushroom corals: small discs on short stalks, in jewel colours.
    const mushrooms = [
        ['#2f9e8f', '#7fe0d0'],
        ['#c23a5b', '#ff8fae'],
        ['#3a5cc2', '#9fb4ff'],
        ['#5c9e2f', '#c6f07f'],
    ];

    for (let i = 0; i < 14; i++) {
        const site = pickSite(6);

        if (site === null) {
            continue;
        }

        const [disc, centre] = mushrooms[i % mushrooms.length];
        const radius = 2 + Math.floor(random() * 2);
        grow(site[0], site[1] - 1 + 0, site[2], disc);

        for (let oz = -radius; oz <= radius; oz++) {
            for (let ox = -radius; ox <= radius; ox++) {
                const d = Math.hypot(ox, oz);

                if (d <= radius + 0.3) {
                    grow(
                        site[0] + ox,
                        site[1] + 1 - (d > radius - 0.7 ? 1 : 0),
                        site[2] + oz,
                        d < 1 ? centre : disc,
                    );
                }
            }
        }
    }

    // Bubble coral: clusters of pale, grape-like vesicles.
    for (let i = 0; i < 3; i++) {
        const site = pickSite(9);

        if (site === null) {
            continue;
        }

        for (let bubble = 0; bubble < 9; bubble++) {
            const [bx, by, bz] = [
                site[0] + (random() - 0.5) * 6,
                site[1] + random() * 3,
                site[2] + (random() - 0.5) * 6,
            ];

            for (let oy = -2; oy <= 2; oy++) {
                for (let oz = -2; oz <= 2; oz++) {
                    for (let ox = -2; ox <= 2; ox++) {
                        if (Math.hypot(ox, oy, oz) <= 1.6) {
                            grow(
                                bx + ox,
                                by + oy,
                                bz + oz,
                                oy > 0 ? '#f3f0d8' : '#d6d9b8',
                            );
                        }
                    }
                }
            }
        }
    }

    // Anemones: a squat column crowned with waving, pink-tipped tentacles.
    for (let i = 0; i < 3; i++) {
        const site = pickSite(12);

        if (site === null) {
            continue;
        }

        const [sx, sy, sz] = site;

        for (let y = 0; y < 3; y++) {
            for (let oz = -3; oz <= 3; oz++) {
                for (let ox = -3; ox <= 3; ox++) {
                    if (Math.hypot(ox, oz) <= 3) {
                        grow(
                            sx + ox,
                            sy - 1 + y,
                            sz + oz,
                            ['#d2a77a', '#b4c46a', '#c98fb0'][i],
                        );
                    }
                }
            }
        }

        for (let tentacle = 0; tentacle < 22; tentacle++) {
            const angle = (tentacle / 22) * Math.PI * 2 + random() * 0.3;
            const spread = 0.3 + random() * 0.6;
            const length = 4 + Math.floor(random() * 4);
            let [x, y, z] = [
                sx + Math.cos(angle) * 1.5,
                sy + 2,
                sz + Math.sin(angle) * 1.5,
            ];

            for (let step = 0; step < length; step++) {
                x += Math.cos(angle) * spread;
                z += Math.sin(angle) * spread;
                y += 0.8;
                const bend = Math.sin(step * 0.9 + tentacle) * 0.4;
                grow(
                    x + bend,
                    y,
                    z,
                    step === length - 1
                        ? '#ff7fc8'
                        : ['#f0c69a', '#cfe08a', '#f2c6e0'][i],
                );
            }
        }
    }

    // Zoanthid polyps dotted over the open rock.
    for (const [x, y, z] of sites) {
        if (hash(x, y, z, 51) < 0.05) {
            grow(
                x,
                y,
                z,
                ['#ff6f3c', '#3fd0a0', '#ffd23f', '#d65fd0'][
                    Math.floor(hash(x, y, z, 52) * 4)
                ],
            );
        }
    }

    return connectedToFloor(grid);
}

/** A copy of the grid without any voxels left floating free of the piece. */
function connectedToFloor(grid: Grid): Grid {
    const kept = new Grid(grid.width, grid.height, grid.depth);
    const queue: Cell[] = [];

    for (let z = 0; z < grid.depth; z++) {
        for (let x = 0; x < grid.width; x++) {
            const colour = grid.get(x, 0, z);

            if (colour !== undefined) {
                kept.set(x, 0, z, colour);
                queue.push([x, 0, z]);
            }
        }
    }

    while (queue.length > 0) {
        const [x, y, z] = queue.pop() as Cell;

        for (let dy = -1; dy <= 1; dy++) {
            for (let dz = -1; dz <= 1; dz++) {
                for (let dx = -1; dx <= 1; dx++) {
                    const [nx, ny, nz] = [x + dx, y + dy, z + dz];
                    const colour = grid.get(nx, ny, nz);

                    if (
                        colour !== undefined &&
                        kept.get(nx, ny, nz) === undefined
                    ) {
                        kept.set(nx, ny, nz, colour);
                        queue.push([nx, ny, nz]);
                    }
                }
            }
        }
    }

    return kept;
}
