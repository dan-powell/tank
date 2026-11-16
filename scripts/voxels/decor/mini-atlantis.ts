import { Grid, hash, mix, shade } from '../voxel-tools.ts';
import type { Cell } from './shapes.ts';
import { fbm, noise, sequence, Solid } from './shapes.ts';

/** What each solid cell is made of, so it can be coloured afterwards. */
const PLINTH = 1;
const MARBLE = 2;
const DOME = 3;
const CRYSTAL = 4;
const ORB = 5;
const BRONZE = 6;
const RUBBLE = 7;

/**
 * A sunken temple-city on a stepped, eroded plinth: a domed round temple
 * whose ring of fluted columns holds up a carved entablature and a
 * verdigris dome (holed on one side, so fish can swim in), crowned with a
 * glowing orb. A ruined arch stands to the left, a broken colonnade to the
 * right with a fallen column in front of it, and clusters of glowing
 * crystals grow from the terraces. The marble is veined, patinated teal and
 * green, grimed low down and littered with rubble.
 */
export function miniAtlantis(): Grid {
    const [width, height, depth] = [130, 80, 70];
    const grid = new Grid(width, height, depth);
    const solid = new Solid(width, height, depth);
    const random = sequence(1717);

    /** Plant spots (must match the catalogue). */
    const anchors: Cell[] = [
        [13, 5, 22],
        [100, 10, 40],
        [121, 19, 22],
    ];
    const reserved = (x: number, y: number, z: number) =>
        anchors.some(
            ([ax, ay, az]) =>
                y >= ay && y <= ay + 16 && Math.hypot(x - ax, z - az) <= 4.5,
        );

    // ------------------------------------------------ the stepped plinth

    const centreX = 65;
    const tiers: {
        bottom: number;
        top: number;
        halfWidth: number;
        halfDepth: number;
    }[] = [
        { bottom: 0, top: 5, halfWidth: 62, halfDepth: 31 },
        { bottom: 5, top: 10, halfWidth: 46, halfDepth: 26 },
        { bottom: 10, top: 15, halfWidth: 26, halfDepth: 21 },
    ];
    const plinthZ = 36;

    tiers.forEach(({ bottom, top, halfWidth, halfDepth }, tier) => {
        for (let z = 0; z < depth; z++) {
            for (let x = 0; x < width; x++) {
                const shape =
                    Math.abs((x - centreX) / halfWidth) ** 4 +
                    Math.abs((z - plinthZ) / halfDepth) ** 4;
                const ragged = (fbm(x / 5, tier * 3, z / 5, 11) - 0.5) * 0.35;

                if (shape >= 1 + ragged) {
                    continue;
                }

                for (let y = bottom; y < top; y++) {
                    // The top course crumbles away near the edge.
                    if (
                        y === top - 1 &&
                        shape > 0.8 + noise(x / 3, y, z / 3, 12) * 0.3
                    ) {
                        continue;
                    }

                    solid.put(x, y, z, PLINTH);
                }
            }
        }
    });

    // Chunks broken out of the tier edges.
    for (let i = 0; i < 14; i++) {
        const angle = random() * Math.PI * 2;
        const tier = tiers[Math.floor(random() * 2)];
        const x = centreX + Math.cos(angle) * tier.halfWidth * 0.97;
        const z = plinthZ + Math.sin(angle) * tier.halfDepth * 0.97;
        solid.ellipsoid(
            [x, tier.top - 1, z],
            [3 + random() * 3, 2 + random() * 2, 2.5 + random() * 2],
            0,
            (cx, cy, cz) => (noise(cx / 2, cy / 2, cz / 2, 13) - 0.5) * 0.5,
        );
    }

    // A flight of steps up the front to the temple.
    for (let z = 52; z < 68; z++) {
        const top = Math.max(5, 15 - Math.floor((z - 52) / 1.5));

        for (let x = 57; x <= 73; x++) {
            if ((x === 57 || x === 73) && hash(x, z, 0, 14) < 0.4) {
                continue;
            }

            for (let y = 0; y < top; y++) {
                solid.put(x, y, z, PLINTH);
            }
        }
    }

    // ------------------------------------------------ columns

    /** A fluted column with a base and capital; `broken` snaps it off raggedly. */
    const column = (
        x: number,
        z: number,
        bottom: number,
        tall: number,
        radius = 3,
        broken = false,
    ) => {
        for (let y = bottom; y < bottom + tall; y++) {
            const fromTop = bottom + tall - 1 - y;
            const isBase = y - bottom < 2;
            const isCapital = !broken && fromTop < 3;
            const reach = isBase
                ? radius + 1.4
                : isCapital
                  ? radius + 1.6 - fromTop * 0.4
                  : radius;

            for (let dz = -6; dz <= 6; dz++) {
                for (let dx = -6; dx <= 6; dx++) {
                    const distance = Math.hypot(dx, dz);
                    const flute =
                        !isBase &&
                        !isCapital &&
                        Math.cos(Math.atan2(dz, dx) * 8) > 0.55
                            ? 0.75
                            : 0;
                    const snapped =
                        broken &&
                        fromTop < 4 &&
                        distance > 1.6 &&
                        noise((x + dx) / 2, 0, (z + dz) / 2, 15) * 4 <
                            4 - fromTop;

                    if (distance <= reach + 0.35 - flute && !snapped) {
                        solid.put(x + dx, y, z + dz, MARBLE);
                    }
                }
            }
        }
    };

    // ------------------------------------------------ the domed temple

    const templeZ = plinthZ;
    const ring = 16;
    const columnTop = 44;

    for (let i = 0; i < 10; i++) {
        const angle = (i / 10) * Math.PI * 2 + Math.PI / 10;
        column(
            Math.round(centreX + Math.cos(angle) * ring),
            Math.round(templeZ + Math.sin(angle) * ring),
            15,
            columnTop - 15,
        );
    }

    // The cella: a round inner wall with a doorway at the front.
    for (let y = 15; y < columnTop; y++) {
        for (let z = templeZ - 11; z <= templeZ + 11; z++) {
            for (let x = centreX - 11; x <= centreX + 11; x++) {
                const distance = Math.hypot(x - centreX, z - templeZ);
                const doorway =
                    Math.abs(x - centreX) <= 3 &&
                    z > templeZ &&
                    (y < 28 || Math.hypot(x - centreX, y - 28) <= 3.3);

                if (distance <= 10.3 && distance > 8 && !doorway) {
                    solid.put(x, y, z, MARBLE);
                }
            }
        }
    }

    // The entablature: architrave, a frieze, and a dentilled cornice.
    for (let y = columnTop; y < columnTop + 5; y++) {
        for (let z = templeZ - 22; z <= templeZ + 22; z++) {
            for (let x = centreX - 22; x <= centreX + 22; x++) {
                const distance = Math.hypot(x - centreX, z - templeZ);
                const outer =
                    y === columnTop + 4
                        ? 20.5
                        : y === columnTop + 3
                          ? 20
                          : 19.3;
                const dentil =
                    y === columnTop + 3 &&
                    distance > 19.3 &&
                    Math.floor(
                        (Math.atan2(z - templeZ, x - centreX) + Math.PI) * 20,
                    ) %
                        2 ===
                        0;

                if (distance <= outer && distance > 8 && !dentil) {
                    solid.put(x, y, z, MARBLE);
                }
            }
        }
    }

    // The dome: a ribbed shell, holed on its front right.
    const domeBase = columnTop + 5;

    for (let y = domeBase; y < domeBase + 18; y++) {
        for (let z = templeZ - 20; z <= templeZ + 20; z++) {
            for (let x = centreX - 20; x <= centreX + 20; x++) {
                const shape = Math.hypot(
                    (x - centreX) / 19,
                    (y - domeBase) / 15,
                    (z - templeZ) / 19,
                );

                if (shape <= 1 && shape > 0.84) {
                    solid.put(x, y, z, DOME);
                }
            }
        }
    }

    solid.ellipsoid(
        [centreX + 11, domeBase + 7, templeZ + 11],
        [8, 7, 8],
        0,
        (x, y, z) => (noise(x / 2, y / 2, z / 2, 16) - 0.5) * 0.8,
    );

    // A bronze finial and the glowing orb on top.
    const domeTop = domeBase + 15;
    solid.tube(
        [centreX, domeTop - 1, templeZ],
        [centreX, domeTop + 4, templeZ],
        1.6,
        0.8,
        BRONZE,
    );
    solid.ellipsoid([centreX, domeTop + 7, templeZ], [2.6, 2.6, 2.6], ORB);

    // ------------------------------------------------ the ruined arch

    const archX = 20;
    const archZ = 44;
    const springing = 32;

    for (let y = 5; y < springing + 16; y++) {
        for (let z = archZ - 3; z <= archZ + 3; z++) {
            for (let x = archX - 15; x <= archX + 15; x++) {
                const dx = x - archX;
                const pier =
                    y < springing && Math.abs(dx) >= 7 && Math.abs(dx) <= 13;
                const curve = Math.hypot(dx, y - springing);
                const vault = y >= springing && curve <= 13.3 && curve > 7;
                // The right side of the vault has fallen in.
                const fallen =
                    dx > 2 &&
                    y > springing + 3 + noise(x / 3, y / 3, z, 17) * 4;

                if ((pier || vault) && !fallen) {
                    solid.put(x, y, z, MARBLE);
                }
            }
        }
    }

    // Plinths and capitals on the piers.
    for (const side of [-10, 10]) {
        solid.box(
            [archX + side - 4, 5, archZ - 4],
            [archX + side + 4, 7, archZ + 4],
            MARBLE,
        );
        solid.box(
            [archX + side - 4, springing - 2, archZ - 4],
            [archX + side + 4, springing - 1, archZ + 4],
            MARBLE,
        );
    }

    // ------------------------------------------------ the broken colonnade

    column(92, 22, 5, 26, 3, true);
    column(103, 22, 5, 33);
    column(114, 22, 5, 33);
    column(121, 22, 5, 14, 3, true);
    solid.box([99, 38, 19], [118, 41, 25], MARBLE);
    // A missing corner on the architrave.
    solid.ellipsoid([118, 41, 25], [3, 2, 2.5], 0);

    // A fallen column lying in front, broken in two.
    for (const [from, to] of [
        [94, 104],
        [106, 118],
    ]) {
        for (let x = from; x <= to; x++) {
            for (let y = 5; y < 12; y++) {
                for (let z = 55; z <= 61; z++) {
                    const distance = Math.hypot(y - 8, z - 58);
                    const flute =
                        Math.cos(Math.atan2(z - 58, y - 8) * 8) > 0.55
                            ? 0.7
                            : 0;
                    const jagged =
                        (x === from || x === to) &&
                        noise(y / 1.5, z / 1.5, x, 18) > 0.5;

                    if (distance <= 3.3 - flute && !jagged) {
                        solid.put(x, y, z, MARBLE);
                    }
                }
            }
        }
    }

    // ------------------------------------------------ rubble

    const rubble = (x: number, y: number, z: number, size: number) => {
        let bottom = y;

        while (
            bottom > 0 &&
            !solid.at(Math.round(x), bottom - 1, Math.round(z))
        ) {
            bottom--;
        }

        solid.box(
            [Math.round(x - size), bottom, Math.round(z - size * 0.8)],
            [
                Math.round(x + size),
                bottom + Math.max(1, Math.round(size * 0.9)),
                Math.round(z + size * 0.8),
            ],
            RUBBLE,
        );
    };

    for (const [x, z, size] of [
        [31, 52, 2.4],
        [36, 56, 1.5],
        [28, 60, 1.6],
        [8, 58, 1.2],
        [86, 46, 2],
        [124, 40, 1.6],
        [46, 22, 1.3],
        [84, 60, 1.2],
        [117, 50, 1.5],
    ]) {
        rubble(x, 20, z, size);
    }

    // Fallen voussoirs from the arch.
    rubble(30, 20, 40, 2);
    rubble(27, 20, 50, 1.6);

    // ------------------------------------------------ crystals

    /** A cluster of glowing prisms; returns the tip of the tallest. */
    const crystals = (
        x: number,
        z: number,
        count: number,
        longest: number,
    ): Cell => {
        let y = 30;

        while (y > 0 && !solid.at(x, y - 1, z)) {
            y--;
        }

        let tip: Cell = [x, y, z];

        for (let i = 0; i < count; i++) {
            const lean = i === 0 ? 0 : 0.35 + random() * 0.5;
            const angle = random() * Math.PI * 2;
            const length =
                i === 0 ? longest : longest * (0.4 + random() * 0.45);
            const end: Cell = [
                Math.round(x + Math.cos(angle) * lean * length),
                Math.round(y + length * (1 - lean * 0.5)),
                Math.round(z + Math.sin(angle) * lean * length * 0.7),
            ];
            solid.tube([x, y - 1, z], end, i === 0 ? 2.6 : 1.7, 0.5, CRYSTAL);

            if (i === 0) {
                tip = [end[0], end[1] - 1, end[2]];
            }
        }

        return tip;
    };

    // The tips of the tallest crystals, (40, 26, 52), (88, 24, 55) and
    // (10, 13, 50), carry the catalogue's light points with the orb's front.
    crystals(40, 52, 7, 17);
    crystals(88, 55, 6, 15);
    crystals(10, 50, 5, 12);

    for (const [ax, ay, az] of anchors) {
        solid.put(ax, ay - 1, az, PLINTH);

        for (let y = ay; y <= ay + 16; y++) {
            for (let z = az - 5; z <= az + 5; z++) {
                for (let x = ax - 5; x <= ax + 5; x++) {
                    if (reserved(x, y, z)) {
                        solid.put(x, y, z, 0);
                    }
                }
            }
        }
    }

    solid.keepConnected();

    // ------------------------------------------------ colours

    const marble = ['#e9e4d6', '#ddd7c6', '#d2cbb8', '#c6bfab', '#f1ede2'];
    const patina = ['#6fae9b', '#5a9c8a', '#83c0aa', '#4c8a7b'];
    const algae = ['#41602f', '#4f7036', '#5f8240'];
    const verdigris = ['#4aa391', '#3d8e7f', '#5bb8a4', '#347a6e', '#6cc4ae'];

    solid.each((x, y, z, value) => {
        const open = !solid.at(x, y + 1, z);
        const exposure = fbm(x / 6, y / 6, z / 6, 21);
        let colour: string;

        if (value === CRYSTAL) {
            const glow = hash(x, y, z, 22);
            colour =
                glow < 0.2 ? '#b8fff4' : glow < 0.6 ? '#4fd8cb' : '#2bb0a8';

            if (!solid.isSurface(x, y, z)) {
                colour = '#1f7f7c';
            }
        } else if (value === ORB) {
            colour =
                y > solid.height - 12 && hash(x, y, z, 23) < 0.4
                    ? '#c8fff7'
                    : '#6ff0e2';
        } else if (value === BRONZE) {
            colour = hash(x, y, z, 24) < 0.5 ? '#b08a3e' : '#4a9c86';
        } else if (value === DOME) {
            const angle = Math.atan2(z - templeZ, x - centreX);
            const rib = Math.abs(Math.sin(angle * 6)) < 0.12;
            const band = (y - domeBase) % 5 === 0;
            colour = verdigris[Math.floor(exposure * 4.99)];

            if (rib || band) {
                colour = shade(colour, 0.78);
            }

            if (hash(x, y, z, 25) < 0.015) {
                colour = '#a98a4a';
            }
        } else {
            // Marble: blocks on the plinth, veins, grime low down, patina on top.
            colour = marble[Math.floor(fbm(x / 4, y / 4, z / 4, 26) * 4.99)];

            if (value === PLINTH) {
                const course = Math.floor(y / 5);
                const along = x + z * 0.6 + (course % 2) * 6;

                if (y % 5 === 4 || ((along % 12) + 12) % 12 < 1) {
                    colour = '#a8a090';
                } else {
                    colour = shade(
                        colour,
                        [0.9, 0.96, 1.02][
                            Math.floor(
                                hash(Math.floor(along / 12), course, 0, 27) * 3,
                            )
                        ],
                    );
                }
            } else if (value === RUBBLE) {
                colour = shade(colour, 0.88);
            }

            if (Math.abs(noise(x / 7, y / 9, z / 7, 28) - 0.5) < 0.018) {
                colour = '#9c978a';
            }

            if (open && noise(x / 4, y / 4, z / 4, 29) > 0.56) {
                colour = patina[Math.floor(hash(x, y, z, 30) * 4)];
            } else if (noise(x / 5, y / 5, z / 5, 31) > 0.74) {
                colour = mix(
                    colour,
                    patina[Math.floor(hash(x, y, z, 32) * 4)],
                    0.6,
                );
            }

            if (y < 9 && noise(x / 4, y / 6, z / 4, 33) > 0.45 + y / 25) {
                colour = algae[Math.floor(hash(x, y, z, 34) * 3)];
            } else if (y < 6) {
                colour = shade(colour, 0.85);
            }
        }

        grid.set(x, y, z, colour);
    });

    return grid;
}
