import { Grid, hash } from '../voxel-tools.ts';
import { fbm, noise, profile, Solid } from './shapes.ts';
import type { Cell } from './shapes.ts';

/** Plant spots on the deck (must match the catalogue). */
const ANCHORS: Cell[] = [
    [52, 21, 30],
    [101, 19, 27],
];

/** Lantern glass the LEDs sit in (must match the catalogue's light points). */
const LANTERNS: Cell[] = [
    [7, 45, 37],
    [79, 35, 40],
    [130, 29, 35],
];

/** Length of the hull from the stern (0) to the bow at the keel. */
const LENGTH = 128;

/**
 * A sunken pirate ship, settled bow-down into the sand and listing towards
 * the viewer so its deck shows. The hull is built plank by plank, with
 * seams and staggered joints, a raised stern castle with a gallery of
 * windows, and a forecastle. Cannons poke from their ports, the main mast
 * is snapped off with a tattered sail still hanging from its yard, and the
 * other masts are stumps. A ragged hole in the side lets fish swim into the
 * hold and out through the broken deck. Barnacles crust the lower hull,
 * and algae grows over everything that faces up.
 */
export function pirateShip(): Grid {
    const [width, height, depth] = [150, 90, 56];
    const grid = new Grid(width, height, depth);
    const solid = new Solid(width, height, depth);
    const HULL = 1;
    const DECK = 2;
    const MAST = 3;
    const SAIL = 4;
    const ROPE = 5;
    const IRON = 6;
    const WINDOW = 7;
    const FRAME = 8;
    const LANTERN = 9;
    const BRASS = 10;

    // ------------------------------------------------ the ship's own frame

    // Stern keel position, with the bow pitched 3° down and the deck rolled 14° towards the viewer.
    const origin = [4, -2, 23];
    const [pitch, roll] = [(3 * Math.PI) / 180, (14 * Math.PI) / 180];
    const along = [Math.cos(pitch), -Math.sin(pitch), 0];
    const upright = [Math.sin(pitch), Math.cos(pitch), 0];
    const up = upright.map(
        (v, i) => v * Math.cos(roll) + [0, 0, 1][i] * Math.sin(roll),
    );
    const across = upright.map(
        (v, i) => -v * Math.sin(roll) + [0, 0, 1][i] * Math.cos(roll),
    );

    /** Ship (s along, v up from the keel, w across towards the viewer) to grid space. */
    const toWorld = (s: number, v: number, w: number): Cell =>
        [0, 1, 2].map(
            (i) => origin[i] + along[i] * s + up[i] * v + across[i] * w,
        ) as Cell;
    const toShip = (x: number, y: number, z: number): Cell => {
        const d = [x - origin[0], y - origin[1], z - origin[2]];
        const dot = (axis: number[]) =>
            d[0] * axis[0] + d[1] * axis[1] + d[2] * axis[2];

        return [dot(along), dot(up), dot(across)];
    };

    const beam: [number, number][] = [
        [0, 14],
        [10, 17],
        [30, 19],
        [80, 19],
        [104, 15.5],
        [118, 9],
        [LENGTH, 1],
    ];
    const deckHeight = (s: number) => (s < 30 ? 38 : s > 112 ? 32 : 26);

    /** Half the hull's width at a point: full beam above the bilge, tucking in to the keel. */
    const halfWidth = (s: number, v: number) => {
        const raked = (s * LENGTH) / (LENGTH + Math.max(0, v) * 0.22);
        const bilge = Math.sqrt(Math.max(0, Math.min(1, v / 20)));
        const tumblehome = 1 - Math.max(0, v - 30) * 0.006;

        return profile(beam, raked) * bilge * tumblehome;
    };

    const nearHole = (s: number, v: number) =>
        ((s - 87) / 9) ** 2 + ((v - 18.5) / 6) ** 2 <
        1 + (noise(s / 3, v / 3, 0, 1) - 0.5) * 0.6;
    const farHole = (s: number, v: number) =>
        ((s - 90) / 6) ** 2 + ((v - 15) / 4.5) ** 2 <
        1 + (noise(s / 3, v / 3, 1, 2) - 0.5) * 0.5;
    const deckHole = (s: number, w: number) =>
        ((s - 90) / 7) ** 2 + ((w - 1) / 7.5) ** 2 <
        1 + (noise(s / 2.5, w / 2.5, 3, 3) - 0.5) * 0.7;
    const hatch = (s: number, w: number) => s > 58 && s < 66 && Math.abs(w) < 4;
    const gunPorts = [40, 54, 104].flatMap((s) => [
        [s, 1],
        [s, -1],
    ]);
    const gunPort = (s: number, v: number, w: number) =>
        gunPorts.some(
            ([ps, side]) =>
                Math.sign(w) === side &&
                Math.abs(s - ps) < 2 &&
                v > 18.5 &&
                v < 23.5,
        );
    const sternWindow = (s: number, v: number) =>
        s > 5 && s < 27 && v > 30 && v < 35.5 && (s - 5) % 6 < 3.4;

    for (let y = 0; y < height; y++) {
        for (let z = 0; z < depth; z++) {
            for (let x = 0; x < width; x++) {
                const [s, v, w] = toShip(x, y, z);
                const transom = -Math.max(0, v) * 0.12;

                if (v < -2.5 || s < transom - 0.5 || s > LENGTH + 12) {
                    continue;
                }

                const deck = deckHeight(s);
                const half = halfWidth(s, v);
                const side = Math.abs(w);

                // The keel, a narrow spine under the hull.
                if (v < 1 && side < 1.6 && s > 2 && s < LENGTH - 2) {
                    solid.put(x, y, z, HULL);
                    continue;
                }

                if (v < 0 || side > half || s < transom || v > deck + 3) {
                    continue;
                }

                const onShell =
                    side > half - 1.8 || s < transom + 1.8 || v < 1.8;

                if (onShell) {
                    if ((w > 0 && nearHole(s, v)) || (w < 0 && farHole(s, v))) {
                        continue;
                    }

                    if (gunPort(s, v, w)) {
                        continue;
                    }

                    if (sternWindow(s, v) && side > half - 1.8) {
                        solid.put(x, y, z, side > half - 0.9 ? WINDOW : FRAME);
                        continue;
                    }

                    // The stern gallery: a row of windows across the transom.
                    if (
                        s < transom + 1.8 &&
                        v > 29 &&
                        v < 35.5 &&
                        (Math.abs(w) + 1.5) % 5 < 3.2 &&
                        side < half - 2
                    ) {
                        solid.put(x, y, z, s < transom + 0.9 ? WINDOW : FRAME);
                        continue;
                    }

                    solid.put(x, y, z, HULL);
                    continue;
                }

                // Decks, broken through amidships and with an open hatch.
                if (v > deck - 1.6 && v <= deck) {
                    if (!(deck === 26 && (deckHole(s, w) || hatch(s, w)))) {
                        solid.put(x, y, z, DECK);
                    }

                    continue;
                }

                // A raised rim around the hatch.
                if (
                    deck === 26 &&
                    v > deck &&
                    v <= deck + 1.2 &&
                    hatch(s - 0.0, w) === false &&
                    s > 57 &&
                    s < 67 &&
                    side < 5
                ) {
                    solid.put(x, y, z, DECK);
                    continue;
                }

                // Bulkheads closing the stern cabin and the forecastle, each with a doorway.
                const cabinWall =
                    s > 29 &&
                    s < 31 &&
                    v > 26 &&
                    v < 38 &&
                    !(side < 3 && v < 33.5);
                const foreWall =
                    s > 111 &&
                    s < 113 &&
                    v > 26 &&
                    v < 32 &&
                    !(side < 2.5 && v < 31);

                if (cabinWall || foreWall) {
                    solid.put(x, y, z, HULL);
                }
            }
        }
    }

    // ------------------------------------------------ masts, spars and rigging

    const tubeBetween = (
        a: Cell,
        b: Cell,
        ra: number,
        rb: number,
        kind: number,
    ) => solid.tube(toWorld(...a), toWorld(...b), ra, rb, kind);

    // The main mast, snapped off with a jagged top; stumps of the mizzen and foremast.
    const mast = (
        s: number,
        from: number,
        to: number,
        radius: number,
        seed: number,
    ) => {
        for (let y = 0; y < height; y++) {
            for (let z = 0; z < depth; z++) {
                for (let x = 0; x < width; x++) {
                    const [ls, lv, lw] = toShip(x, y, z);
                    const jagged =
                        to -
                        (noise(ls * 1.5, lw * 1.5, 0, seed) * 6 +
                            hash(Math.round(ls), Math.round(lw), 0, seed) * 2);

                    if (
                        lv > from &&
                        lv < jagged &&
                        Math.hypot(ls - s, lw) < radius - (lv - from) * 0.008
                    ) {
                        solid.put(x, y, z, MAST);
                    }
                }
            }
        }
    };
    mast(70, 1, 91, 2.7, 11);
    mast(19, 30, 56, 2, 12);
    mast(118, 22, 47, 1.9, 13);

    // A broken bowsprit jutting from the bow.
    tubeBetween([LENGTH - 6, 30, 0], [LENGTH + 13, 36, 0], 1.6, 1.2, MAST);

    // The main yard, braced round and broken short at one end, with the sail
    // still hanging from it. u runs along the yard, n out from the mast.
    const brace = (60 * Math.PI) / 180;
    const fromYard = (u: number, v: number, n: number): Cell => [
        70 + u * Math.sin(brace) + n * Math.cos(brace),
        v,
        u * Math.cos(brace) - n * Math.sin(brace),
    ];
    tubeBetween(fromYard(-13, 76, 3), fromYard(17, 76, 3), 1.2, 1.2, MAST);

    for (let y = 0; y < height; y++) {
        for (let z = 0; z < depth; z++) {
            for (let x = 0; x < width; x++) {
                const [s, v, w] = toShip(x, y, z);

                if (v > 75.5 || v < 56) {
                    continue;
                }

                const u = (s - 70) * Math.sin(brace) + w * Math.cos(brace);
                const n = (s - 70) * Math.cos(brace) - w * Math.sin(brace);

                if (Math.abs(u) > 15.5 || u < -12.5) {
                    continue;
                }

                const drop = (75.5 - v) / 18;
                const belly =
                    3.4 +
                    2.4 *
                        Math.sin(Math.PI * Math.min(1, drop)) *
                        Math.cos((Math.PI * u) / 33);
                const raggedBottom =
                    59 +
                    (noise(u / 2.5, 0, 0, 21) - 0.5) * 7 +
                    Math.max(0, u - 4) * 0.5;
                const torn = fbm(u / 4, v / 4, 0.5, 22) > 0.64;
                const ripped =
                    u < -7 && v < 67 + (noise(v / 3, 0, 1, 23) - 0.5) * 5;

                if (
                    Math.abs(n - belly) < 0.9 &&
                    v > raggedBottom &&
                    !torn &&
                    !ripped
                ) {
                    solid.put(x, y, z, SAIL);
                }
            }
        }
    }

    // Shrouds from high on the main mast to the rails; some have parted and hang loose.
    for (const side of [-1, 1]) {
        for (const [index, s] of [62, 67, 73, 78].entries()) {
            const rail: Cell = [s, 28, side * (halfWidth(s, 28) - 0.8)];
            const top: Cell = [70, 82, side * 1.8];
            const parted = side > 0 && index % 2 === 1;
            const end = parted
                ? ([
                      top[0] + (rail[0] - top[0]) * 0.55,
                      top[1] + (rail[1] - top[1]) * 0.55,
                      top[2] + (rail[2] - top[2]) * 0.55,
                  ] as Cell)
                : rail;
            tubeBetween(top, end, 0.95, 0.95, ROPE);

            if (parted) {
                // The loose end hangs straight down.
                tubeBetween(
                    end,
                    [end[0], end[1] - 9, end[2] + 1],
                    0.95,
                    0.95,
                    ROPE,
                );
            }
        }
    }

    // Stays from the mast tops fore and aft.
    tubeBetween([19, 54, 0], [70, 74, 0], 0.95, 0.95, ROPE);

    // ------------------------------------------------ cannons

    for (const [s, side] of gunPorts) {
        const outside = halfWidth(s, 20.6) + 4.5;
        tubeBetween(
            [s, 20.4, side * (outside - 9)],
            [s, 20.4, side * outside],
            1.45,
            1.25,
            IRON,
        );
        tubeBetween(
            [s, 20.4, side * (outside - 0.8)],
            [s, 20.4, side * outside],
            1.75,
            1.75,
            IRON,
        );
        // A carriage block inside, resting on the sill.
        tubeBetween(
            [s, 19.2, side * (outside - 9)],
            [s, 19.2, side * (outside - 6)],
            1.4,
            1.4,
            HULL,
        );
    }

    // ------------------------------------------------ lanterns

    const lanternMounts: Cell[] = [
        [1, 38, 0],
        [70, 46, 1.5],
        [124, 32, 0],
    ];

    for (const [index, [lx, ly, lz]] of LANTERNS.entries()) {
        const mount = toWorld(...lanternMounts[index]);
        // Behind the glass, towards the mount, so the lantern sits on its bracket.
        const centre: Cell = [lx, ly, lz - 1];

        solid.box(
            [centre[0] - 1, centre[1] - 2, centre[2] - 1],
            [centre[0] + 1, centre[1] + 1, centre[2] + 1],
            LANTERN,
        );
        solid.box(
            [centre[0] - 1, centre[1] + 2, centre[2] - 1],
            [centre[0] + 1, centre[1] + 2, centre[2] + 1],
            BRASS,
        );
        solid.put(centre[0], centre[1] + 3, centre[2], BRASS);
        solid.box(
            [centre[0] - 1, centre[1] - 3, centre[2] - 1],
            [centre[0] + 1, centre[1] - 3, centre[2] + 1],
            BRASS,
        );
        // Corner posts of the frame.
        for (const [dx, dz] of [
            [-1, -1],
            [1, -1],
            [-1, 1],
            [1, 1],
        ]) {
            solid.box(
                [centre[0] + dx, centre[1] - 2, centre[2] + dz],
                [centre[0] + dx, centre[1] + 1, centre[2] + dz],
                BRASS,
            );
        }

        solid.put(lx, ly, lz, LANTERN);
        // The bracket or post back to the ship.
        solid.tube(
            [centre[0], centre[1] + 3, centre[2]],
            mount,
            0.8,
            0.8,
            FRAME,
        );
        solid.tube(
            [centre[0], centre[1] - 3, centre[2]],
            mount,
            0.8,
            0.8,
            FRAME,
        );
    }

    // ------------------------------------------------ plant spots

    for (const [ax, ay, az] of ANCHORS) {
        for (let y = ay; y < Math.min(height, ay + 17); y++) {
            for (let z = az - 5; z <= az + 5; z++) {
                for (let x = ax - 5; x <= ax + 5; x++) {
                    if (Math.hypot(x - ax, z - az) <= 4.5) {
                        solid.put(x, y, z, 0);
                    }
                }
            }
        }

        // A little mound of silt on the deck for the roots.
        for (let y = ay - 1; y >= 0; y--) {
            if (solid.at(ax, y, az) && y < ay - 1) {
                break;
            }

            for (let z = az - 1; z <= az + 1; z++) {
                for (let x = ax - 1; x <= ax + 1; x++) {
                    if (!solid.at(x, y, z)) {
                        solid.put(x, y, z, DECK);
                    }
                }
            }
        }
    }

    solid.keepConnected();

    // ------------------------------------------------ colours

    const woods = [
        '#3b2a1c',
        '#4a3422',
        '#563d27',
        '#61462d',
        '#6d4f33',
        '#7a5a3b',
        '#866544',
    ];
    const bleached = ['#7b6e5c', '#8c7f6b', '#9b8e78'];
    const deckWoods = ['#4d3a28', '#5a4430', '#674e37', '#73583e', '#7f6346'];
    const sails = ['#a39570', '#b4a680', '#c4b791', '#d2c6a2'];
    const directions: Cell[] = [
        [1, 0, 0],
        [-1, 0, 0],
        [0, 1, 0],
        [0, -1, 0],
        [0, 0, 1],
        [0, 0, -1],
    ];

    solid.each((x, y, z, kind) => {
        const [s, v, w] = toShip(x, y, z);
        const sunlit = !solid.at(x, y + 1, z);
        const algae = fbm(x / 5, y / 5, z / 5, 31);
        const silted = y < 5 ? 1 : 0;
        let colour: string;

        switch (kind) {
            case HULL: {
                // Planks run along the hull, each its own tone, with dark seams and staggered butt joints.
                const row = Math.floor(
                    (v + (noise(s / 20, 0, 0, 32) - 0.5) * 0.8) / 2.4,
                );
                const plankLength = 22;
                const stagger = (row * 7) % plankLength;
                const plank = Math.floor((s + stagger) / plankLength);
                const seam =
                    (v + (noise(s / 20, 0, 0, 32) - 0.5) * 0.8) / 2.4 - row <
                    0.2;
                const joint = (s + stagger) % plankLength < 0.7;
                const grain = Math.round(
                    (noise(s / 6, v * 1.5, w, 33) - 0.5) * 2,
                );
                const tone =
                    Math.floor(hash(row, plank, 0, 34) * 4) +
                    1 +
                    grain -
                    silted * 2;
                colour = woods[Math.max(0, Math.min(woods.length - 1, tone))];

                if (seam || joint) {
                    colour = '#2a1e14';
                } else if (sunlit && v > 24 && hash(x, y, z, 35) < 0.6) {
                    colour = bleached[Math.floor(hash(x, y, z, 36) * 3)];
                }

                break;
            }
            case DECK: {
                const row = Math.floor((w + 30) / 2.2);
                const plank = Math.floor((s + row * 5) / 18);
                const seam = (w + 30) / 2.2 - row < 0.22;
                const tone =
                    Math.floor(hash(row, plank, 1, 37) * 4) +
                    Math.round((noise(s / 5, w, 0, 38) - 0.5) * 2);
                colour = seam
                    ? '#30241a'
                    : deckWoods[
                          Math.max(0, Math.min(deckWoods.length - 1, tone))
                      ];

                if (!seam && sunlit && hash(x, y, z, 39) < 0.25) {
                    colour = bleached[1];
                }

                break;
            }
            case MAST: {
                const ring =
                    Math.abs(noise(x / 2, y / 6, z / 2, 40) - 0.5) < 0.05;
                colour = ring
                    ? '#3e2c1d'
                    : woods[2 + Math.round(noise(x / 2, y / 8, z / 2, 41) * 3)];

                if (sunlit && v > 50) {
                    colour = bleached[0];
                }

                break;
            }
            case SAIL: {
                const stain = fbm(s / 5, v / 5, w / 5, 42);
                colour =
                    sails[
                        Math.max(0, Math.min(3, Math.round(stain * 4 - 0.4)))
                    ];

                if (stain > 0.62) {
                    colour = '#8a7a52';
                } else if (
                    Math.abs(v - 68) < 0.6 ||
                    Math.abs(
                        ((s - 70) * Math.sin(brace) + w * Math.cos(brace)) % 7,
                    ) < 0.45
                ) {
                    // Stitched seams across the canvas.
                    colour = '#968a66';
                }

                break;
            }
            case ROPE:
                colour = hash(x, y, z, 43) < 0.5 ? '#5d4c32' : '#6e5c3e';
                break;
            case IRON: {
                const rust = fbm(x / 2, y / 2, z / 2, 44);
                colour =
                    rust > 0.62
                        ? '#8f5a32'
                        : rust > 0.55
                          ? '#6e4428'
                          : hash(x, y, z, 45) < 0.5
                            ? '#2d3033'
                            : '#3a3e42';
                break;
            }
            case WINDOW:
                colour = hash(x, y, z, 46) < 0.2 ? '#4a6a68' : '#1b2a2c';
                break;
            case FRAME:
                colour = '#8a6a44';
                break;
            case LANTERN:
                colour = hash(x, y, z, 47) < 0.4 ? '#f2c46a' : '#e0a94a';
                break;
            default:
                colour = hash(x, y, z, 48) < 0.5 ? '#9b7a32' : '#b8913e';
        }

        const outwardFacing = directions.some(
            ([dx, dy, dz]) => !solid.at(x + dx, y + dy, z + dz),
        );

        // Algae over upward faces of the wood, and a dark waterline near the sand.
        if (kind <= MAST && outwardFacing) {
            if (sunlit && algae > 0.62) {
                colour =
                    algae > 0.7
                        ? '#4f6b2c'
                        : hash(x, y, z, 49) < 0.5
                          ? '#5f7a34'
                          : '#6b7f40';
            } else if (y < 3 && hash(x, y, z, 50) < 0.6) {
                colour = '#3a3a28';
            }
        }

        grid.set(x, y, z, colour);
    });

    // Barnacles crusting the lower hull, in clusters.
    solid.each((x, y, z, kind) => {
        if (
            kind !== HULL ||
            y > 16 ||
            noise(x / 6, y / 6, z / 6, 51) < 0.55 ||
            hash(x, y, z, 52) > 0.16
        ) {
            return;
        }

        for (const [dx, dy, dz] of directions) {
            if (dy === 0 && !solid.at(x + dx, y + dy, z + dz)) {
                grid.fill(
                    x + dx,
                    y,
                    z + dz,
                    hash(x, y, z, 53) < 0.5 ? '#c9c2b2' : '#a8a194',
                );

                break;
            }
        }
    });

    // Strands of weed trailing up from the rails.
    solid.each((x, y, z, kind) => {
        if (
            (kind !== HULL && kind !== DECK) ||
            solid.at(x, y + 1, z) ||
            hash(x, y, z, 54) > 0.0025
        ) {
            return;
        }

        const tall = 3 + Math.floor(hash(x, y, z, 55) * 6);

        for (let step = 1; step <= tall; step++) {
            if (solid.at(x, y + step, z) || isNearAnchor(x, y + step, z)) {
                break;
            }

            grid.fill(x, y + step, z, step === tall ? '#8aa848' : '#5f8a36');
        }
    });

    return grid;
}

function isNearAnchor(x: number, y: number, z: number): boolean {
    return ANCHORS.some(
        ([ax, ay, az]) =>
            y >= ay - 1 && y <= ay + 16 && Math.hypot(x - ax, z - az) <= 6,
    );
}
