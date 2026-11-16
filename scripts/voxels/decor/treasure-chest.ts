import { Grid, hash } from '../voxel-tools.ts';
import { fbm, noise, Solid } from './shapes.ts';

const WOOD = ['#3f2615', '#4a2c18', '#55331c', '#603a20', '#6b4224', '#764a29'];
const BRASS = ['#7a5c24', '#8a6a2a', '#a07c32', '#b8913c', '#cfa84a'];
const VERDIGRIS = ['#4a7d6c', '#5a917c', '#6aa38c'];
const RIVET = '#e6c460';
const COINS = ['#c98f2a', '#e0a93a', '#f2c14e', '#ffd76a', '#fff0a8'];
const GEMS = ['#c2263a', '#1f9e5a', '#2a5fd0', '#f4efe4', '#8e3fbf'];
const AMBER = ['#ffb627', '#ffd36b'];
const ALGAE = ['#3f5a26', '#4d6b2e', '#5c7c37'];
const BARNACLE = ['#b9b2a4', '#d6d0c2', '#8f887b'];
const SHADOW = '#1e130b';

/** Lid opening: the hinge at the back top edge, and how far it is lifted. */
const HINGE_Y = 18.5;
const HINGE_Z = 0.5;
const LID_ANGLE = (6 * Math.PI) / 180;

/** Brass straps running over the body and the lid. */
const isStrap = (x: number) => (x >= 6 && x <= 8) || (x >= 31 && x <= 33);

/**
 * A pirate's chest, its domed lid propped slightly open on its back hinges
 * to show a heap of gold coins and gems inside. Dark planks with grain and
 * knots are bound by riveted brass straps patched with verdigris; amber
 * jewels are set in the front rim either side of the hasp (the light
 * points), and algae and barnacles cling to its foot.
 */
export function treasureChest(): Grid {
    const [width, height, depth] = [40, 33, 28];
    const grid = new Grid(width, height, depth);

    /** 1 wood, 2 brass, 3 rivet, 4 gold, 5 amber jewel, 6 coins, 7 shadow. */
    const part = new Solid(width, height, depth);

    // ------------------------------------------------ body

    for (let y = 0; y <= 18; y++) {
        for (let z = 0; z < depth; z++) {
            for (let x = 1; x <= 38; x++) {
                const inBody = x >= 2 && x <= 37 && z >= 1 && z <= 26;
                const hollow = x >= 4 && x <= 35 && z >= 3 && z <= 24 && y >= 2;
                const onShell =
                    !inBody && (x === 1 || x === 38 || z === 0 || z === 27);
                const band =
                    y <= 1 ||
                    y >= 16 ||
                    isStrap(x) ||
                    ((z <= 2 || z >= 25) && (x <= 2 || x >= 37));

                if (inBody && !hollow) {
                    part.put(x, y, z, 1);
                } else if (onShell && band) {
                    part.put(x, y, z, 2);
                }
            }
        }
    }

    // Rivets along the straps and bands.
    part.each((x, y, z, value) => {
        const front = z === 27 || z === 0;
        const side = x === 1 || x === 38;

        if (value !== 2 || (!front && !side)) {
            return;
        }

        const along = front ? x : z;
        const strapCentre = front && (x === 7 || x === 32);
        const bandRow = y === 1 || y === 17;

        if (
            (strapCentre && y % 4 === 1) ||
            (bandRow && along % 4 === 0 && !isStrap(x))
        ) {
            part.put(x, y, z, 3);
        }
    });

    // ------------------------------------------------ treasure

    const heap = (x: number, z: number) =>
        16.6 +
        2.6 *
            Math.sin((Math.PI * (x - 4)) / 31) *
            Math.sin((Math.PI * (z - 3)) / 21) +
        (noise(x / 3, 0, z / 3, 5) - 0.5) * 2.2;

    for (let z = 3; z <= 24; z++) {
        for (let x = 4; x <= 35; x++) {
            const top = heap(x, z);

            for (let y = 2; y <= top; y++) {
                part.put(x, y, z, 6);
            }
        }
    }

    // ------------------------------------------------ lid

    /** The closed lid's dome height above the hinge plane, at depth Z from the back. */
    const dome = (lidZ: number, x: number) =>
        2 +
        9 * Math.sqrt(Math.max(0, 1 - ((lidZ - 13.5) / 14) ** 2)) +
        (isStrap(x) ? 0.9 : 0);
    const toLid = (y: number, z: number): [number, number] => {
        const [dy, dz] = [y - HINGE_Y, z - HINGE_Z];

        return [
            dy * Math.cos(LID_ANGLE) - dz * Math.sin(LID_ANGLE),
            dy * Math.sin(LID_ANGLE) + dz * Math.cos(LID_ANGLE),
        ];
    };
    const lidShape = new Map<number, { lidY: number; lidZ: number }>();

    for (let y = 17; y < height; y++) {
        for (let z = 0; z < depth; z++) {
            const [lidY, lidZ] = toLid(y, z);

            if (lidY < 0 || lidZ < 0 || lidZ > 27) {
                continue;
            }

            for (let x = 1; x <= 38; x++) {
                const top = dome(lidZ, x);

                if (lidY > top) {
                    continue;
                }

                const hollow =
                    x >= 3 &&
                    x <= 36 &&
                    lidZ >= 2 &&
                    lidZ <= 25.5 &&
                    lidY < dome(lidZ, 0) - 2;

                if (hollow) {
                    continue;
                }

                const rim = lidZ >= 25.5 || lidZ <= 1.5;
                const edge = lidY > top - 1.2 && (x === 1 || x === 38);
                part.put(x, y, z, isStrap(x) || rim || edge ? 2 : 1);
                lidShape.set((y * depth + z) * width + x, { lidY, lidZ });
            }
        }
    }

    // Rivets over the lid's straps.
    for (const [key, { lidZ }] of lidShape) {
        const x = key % width;

        if ((x === 7 || x === 32) && Math.round(lidZ) % 4 === 2) {
            const z = Math.floor(key / width) % depth;
            const y = Math.floor(key / (width * depth));

            if (!part.at(x, y + 1, z)) {
                part.put(x, y, z, 3);
            }
        }
    }

    // Hinges: two brass barrels at the back of the lid.
    for (const start of [11, 26]) {
        for (let x = start; x <= start + 3; x++) {
            part.box([x, 18, 0], [x, 19, 0], 2);
            part.put(x, 20, 0, 2);
        }
    }

    // Hasp: a brass plate hanging from the lid's lip over the gap, with a keyhole.
    part.box([18, 13, 27], [22, 21, 27], 2);
    part.box([19, 22, 27], [21, 22, 27], 2);
    part.put(20, 16, 27, 7);
    part.put(20, 15, 27, 7);
    part.put(18, 13, 27, 3);
    part.put(22, 13, 27, 3);
    part.put(20, 21, 27, 5);

    // Jewels set in the front rim either side (the light points).
    for (const jx of [12, 28]) {
        part.put(jx - 1, 18, 27, 4);
        part.put(jx + 1, 18, 27, 4);
        part.put(jx, 17, 27, 4);
        part.put(jx, 18, 27, 5);
    }

    // Spilled coins on the floor around the foot.
    for (const [cx, cz, count] of [
        [0, 25, 5],
        [39, 6, 4],
        [0, 9, 3],
    ] as const) {
        for (let i = 0; i < count; i++) {
            const z = cz + Math.round((hash(i, cx, cz, 3) - 0.5) * 5);
            part.put(cx, 0, z, 6);

            if (i < 2) {
                part.put(cx, 1, cz, 6);
            }
        }
    }

    // ------------------------------------------------ colour

    const pick = (colours: string[], value: number) =>
        colours[
            Math.max(
                0,
                Math.min(
                    colours.length - 1,
                    Math.floor(value * colours.length),
                ),
            )
        ];

    part.each((x, y, z, value) => {
        const key = (y * depth + z) * width + x;
        const lid = lidShape.get(key);
        let colour: string;

        switch (value) {
            case 1: {
                // Planks run along the chest; the lid's planks follow its curve.
                const across = lid
                    ? Math.atan2(lid.lidY, lid.lidZ - 13.5) * 11
                    : y;
                const plank = Math.floor((across - 3) / 4);
                const seam = lid ? (across - 3) % 4 < 0.7 : (y - 3) % 4 === 3;
                const grain =
                    fbm(x / 9, plank * 3.1 + across / 6, z / 9, 11) +
                    Math.sin(x * 0.45 + noise(x / 5, y / 3, z / 5, 12) * 7) *
                        0.08 +
                    (plank % 2) * 0.08 -
                    0.12;
                const knot = noise(x / 3, across / 3, z / 3, 13) > 0.8;
                colour = seam
                    ? WOOD[0]
                    : knot
                      ? pick(WOOD, grain * 0.4)
                      : pick(WOOD, grain);

                // Algae creeping up from the foot and settling on the lid.
                const algae = noise(x / 4, y / 4, z / 4, 14);

                if (
                    (y < 6 && algae > 0.6 - (6 - y) * 0.02) ||
                    (lid && !part.at(x, y + 1, z) && algae > 0.68)
                ) {
                    colour = pick(ALGAE, hash(x, y, z, 15));
                }

                break;
            }
            case 2: {
                const wear = fbm(x / 4, y / 4, z / 4, 21);
                colour =
                    wear > 0.68
                        ? pick(VERDIGRIS, hash(x, y, z, 22))
                        : pick(
                              BRASS,
                              (wear - 0.2) * 1.6 +
                                  (hash(x, y, z, 23) - 0.5) * 0.1,
                          );
                break;
            }
            case 3:
                colour = RIVET;
                break;
            case 4:
                colour = COINS[3];
                break;
            case 5:
                colour = AMBER[x === 20 ? 1 : 0];
                break;
            case 6: {
                const sparkle = hash(x, y, z, 31);
                colour =
                    sparkle < 0.035
                        ? pick(GEMS, hash(x, y, z, 32))
                        : pick(COINS, sparkle);
                break;
            }
            default:
                colour = SHADOW;
        }

        grid.set(x, y, z, colour);
    });

    // Barnacles on the lower wood, front and sides.
    part.each((x, y, z, value) => {
        if (value !== 1 || y > 5 || hash(x, y, z, 41) > 0.06) {
            return;
        }

        for (const [dx, dz] of [
            [0, 1],
            [1, 0],
            [-1, 0],
        ]) {
            const [bx, bz] = [x + dx, z + dz];

            if (part.inside(bx, y, bz) && !part.at(bx, y, bz)) {
                grid.fill(bx, y, bz, pick(BARNACLE, hash(x, y, z, 42)));
                break;
            }
        }
    });

    return grid;
}
