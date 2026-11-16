import { Grid, hash, mix } from '../voxel-tools.ts';
import { fbm, noise, Solid } from './shapes.ts';
import type { Cell } from './shapes.ts';

const [WIDTH, HEIGHT, DEPTH] = [40, 110, 40];

/** Plant spots (must match the catalogue): two on the summit, one on the ledge. */
export const ROCK_PILLAR_ANCHORS: Cell[] = [
    [18, 106, 18],
    [26, 106, 25],
    [5, 64, 24],
];

/** Height of each stacked slab's base, bottom to top. */
const SLABS = [0, 7, 17, 27, 36, 47, 56, 66, 75, 85, 94, 102];

/**
 * A tall, narrow natural stone column of stacked, weathered strata. Each
 * slab sits slightly askew on the one below, so the column leans and twists
 * as it rises; a narrow neck is undercut just above the flared foot, a slab
 * juts out as a ledge part way up, and the cap is a broad, flat-ish summit
 * with room for plants. Moss crowns the tops and ledges, green algae streaks
 * run down beneath them, and lichen spots the sunlit faces.
 */
export function rockPillar(): Grid {
    const grid = new Grid(WIDTH, HEIGHT, DEPTH);
    const solid = new Solid(WIDTH, HEIGHT, DEPTH);
    const anchors = ROCK_PILLAR_ANCHORS;
    const reserved = (x: number, y: number, z: number) =>
        anchors.some(
            ([ax, ay, az]) =>
                y >= ay - 1 && y <= ay + 16 && Math.hypot(x - ax, z - az) <= 5,
        );

    const slabOf = (y: number) => {
        let index = 0;

        while (index + 1 < SLABS.length && y >= SLABS[index + 1]) {
            index++;
        }

        return index;
    };

    /** Radius of the column at a height, before roughness. */
    const radiusAt = (y: number) => {
        if (y < 7) {
            return 15.5 - y * 0.35;
        }

        if (y < 27) {
            // The undercut neck, narrowest around y 18.
            return 10.5 + Math.abs(y - 18) * 0.12;
        }

        if (y < 102) {
            return 12.8 - (y - 27) * 0.022;
        }

        return 14.5;
    };

    // Lay down each slab askew on the last: the column leans right and back
    // and turns a little with every layer.
    for (let y = 0; y < 110; y++) {
        const slab = slabOf(y);
        const slabBase = SLABS[slab];
        const slabTop = (SLABS[slab + 1] ?? 108) - 1;
        const lean = y * 0.07;
        const shiftX = (hash(slab, 0, 0, 3) - 0.5) * 2.4 + lean;
        const shiftZ = (hash(slab, 0, 0, 4) - 0.5) * 2.4 + lean * 0.35;
        const centreX = 17 + shiftX;
        const centreZ = 18 + shiftZ;
        const twist = y * 0.035 + slab * 0.4;

        // Bevel each slab's top and bottom edge so the joints read as cracks.
        const fromBottom = y - slabBase;
        const fromTop = slabTop - y;
        const bevel =
            fromBottom === 0
                ? 1.6
                : fromBottom === 1
                  ? 0.6
                  : fromTop === 0
                    ? 0.9
                    : 0;
        const summitTop = 105 - Math.round(noise(slab, y, 0, 5));

        if (y > summitTop) {
            continue;
        }

        for (let z = 0; z < DEPTH; z++) {
            for (let x = 0; x < WIDTH; x++) {
                const dx = x - centreX;
                const dz = z - centreZ;
                const angle = Math.atan2(dz, dx) + twist;
                const lobes =
                    (fbm(
                        Math.cos(angle) * 1.6 + slab * 3.1,
                        Math.sin(angle) * 1.6,
                        y / 9,
                        11,
                    ) -
                        0.5) *
                    0.7;
                const pits = (noise(x / 2.2, y / 2.2, z / 2.2, 12) - 0.5) * 1.6;
                const radius = radiusAt(y) * (1 + lobes) + pits - bevel;

                if (Math.hypot(dx, dz) <= radius) {
                    solid.put(x, y, z, 1 + slab);
                }
            }
        }
    }

    // A slab jutting out on the left as a ledge, thinning to its lip.
    const ledgeTop = 63;

    for (let y = 56; y <= ledgeTop; y++) {
        const reach = 1 + (y - 56) * 0.75;

        for (let z = 12; z < 34; z++) {
            for (let x = 0; x < 16; x++) {
                const wobble = (noise(x / 3, y / 3, z / 3, 21) - 0.5) * 3;
                const edge = Math.hypot(
                    (x - 9) / (8 + reach),
                    (z - 23) / (9 + reach * 0.2),
                );

                if (edge + wobble * 0.12 < 1 && x > 8 - reach * 1.3) {
                    solid.put(x, y, z, 7);
                }
            }
        }
    }

    // Clear room above every plant spot, and keep solid beneath it.
    for (const [ax, ay, az] of anchors) {
        for (let y = ay; y < Math.min(HEIGHT, ay + 16); y++) {
            for (let z = az - 6; z <= az + 6; z++) {
                for (let x = ax - 6; x <= ax + 6; x++) {
                    if (Math.hypot(x - ax, z - az) <= 4.5) {
                        solid.put(x, y, z, 0);
                    }
                }
            }
        }

        for (let z = az - 2; z <= az + 2; z++) {
            for (let x = ax - 2; x <= ax + 2; x++) {
                if (Math.hypot(x - ax, z - az) <= 2.2) {
                    for (let y = ay - 1; y >= 0 && !solid.at(x, y, z); y--) {
                        solid.put(x, y, z, solid.at(ax, ay - 2, az) || 12);
                    }
                }
            }
        }
    }

    // Weathering pits on exposed faces (never under a plant spot).
    for (let y = 2; y < HEIGHT; y++) {
        for (let z = 0; z < DEPTH; z++) {
            for (let x = 0; x < WIDTH; x++) {
                if (
                    solid.isSurface(x, y, z) &&
                    hash(x, y, z, 31) < 0.035 &&
                    !reserved(x, y + 1, z) &&
                    !reserved(x, y, z)
                ) {
                    solid.put(x, y, z, 0);
                }
            }
        }
    }

    for (const [ax, ay, az] of anchors) {
        solid.put(ax, ay - 1, az, solid.at(ax, ay - 2, az) || 12);
    }

    // ------------------------------------------------ colours

    /** Light-to-dark ramps: buff sandstone, warm tan and cool grey bands. */
    const ramp = (dark: string, light: string) =>
        Array.from({ length: 9 }, (_, level) => mix(dark, light, level / 8));
    const families = [
        ramp('#4a443c', '#b5aa95'),
        ramp('#463f37', '#bba48a'),
        ramp('#3f3d3a', '#a3a09a'),
    ];
    /** Which family each slab is cut from. */
    const slabFamily = [0, 2, 1, 0, 2, 0, 1, 2, 0, 1, 2, 0];
    const crack = '#37332e';
    const moss = ['#45602b', '#4e6b2f', '#5d7d35', '#6c8f3c', '#7e9c48'];
    const algae = ['#4d5f37', '#556b3a', '#62744a'];
    const lichen = ['#b9b36a', '#c9a24f', '#a7b07a', '#d6cf9a'];

    /** A top with open water above it and flat rock around it, where moss settles. */
    const isFlatTop = (x: number, y: number, z: number) => {
        if (!solid.at(x, y, z) || solid.at(x, y + 1, z)) {
            return false;
        }

        let flat = 0;

        for (let dz = -1; dz <= 1; dz++) {
            for (let dx = -1; dx <= 1; dx++) {
                if (
                    solid.at(x + dx, y, z + dz) &&
                    !solid.at(x + dx, y + 1, z + dz)
                ) {
                    flat++;
                }
            }
        }

        return flat >= 7;
    };
    const mossy = (x: number, y: number, z: number) =>
        isFlatTop(x, y, z) &&
        (reserved(x, y + 1, z) || noise(x / 4, y / 4, z / 4, 71) > 0.4);

    /** How far down below a mossy top each column's algae streak runs. */
    const streakLength = (x: number, z: number) =>
        4 + Math.floor(hash(x, 0, z, 41) * 14);

    solid.each((x, y, z, value) => {
        const slab = value - 1;
        const tones = families[slabFamily[slab % slabFamily.length]];
        const grain = (fbm(x / 2, y / 1.4, z / 2, 51) - 0.5) * 5;
        const sediment =
            Math.sin(y * 1.9 + noise(x / 6, y / 6, z / 6, 52) * 4) * 0.8;
        const open = !solid.at(x, y + 1, z);
        const exposed = solid.isSurface(x, y, z);
        const overhung =
            !open && !solid.at(x, y - 1, z) && y > 0
                ? -1
                : solid.at(x, y + 2, z) && !solid.at(x, y + 1, z)
                  ? -2
                  : 0;
        let level = Math.round(
            4 + grain + sediment + (open ? 2 : 0) + overhung - (y < 6 ? 1 : 0),
        );
        level = Math.max(0, Math.min(8, level));
        let colour = tones[level];

        if (Math.abs(noise(x / 7, y / 9, z / 7, 61) - 0.5) < 0.014) {
            colour = crack;
        } else if (mossy(x, y, z)) {
            colour = moss[Math.floor(hash(x, y, z, 72) * moss.length)];
        } else if (exposed) {
            let above = y + 1;

            while (above < HEIGHT && solid.at(x, above, z)) {
                above++;
            }

            const drop = above - 1 - y;
            const streakFrom = [x - 1, x, x + 1].some((sx) =>
                [z - 1, z, z + 1].some((sz) => mossy(sx, above - 1, sz)),
            );

            if (
                streakFrom &&
                drop < streakLength(x, z) &&
                noise(x / 2.5, 0, z / 2.5, 81) > 0.5 &&
                hash(x, y, z, 82) < 0.85 - drop * 0.04
            ) {
                colour = algae[Math.floor(hash(x, y, z, 83) * algae.length)];
            } else if (
                noise(x / 3, y / 3, z / 3, 91) > 0.79 &&
                hash(x, y, z, 92) < 0.7
            ) {
                colour = lichen[Math.floor(hash(x, y, z, 93) * lichen.length)];
            }
        }

        grid.set(x, y, z, colour);
    });

    // Moss tufts poking up from the summit and ledge.
    solid.each((x, y, z) => {
        if (
            mossy(x, y, z) &&
            !reserved(x, y + 1, z) &&
            hash(x, y, z, 101) < 0.08
        ) {
            grid.fill(
                x,
                y + 1,
                z,
                moss[Math.floor(hash(x, y, z, 102) * moss.length)],
            );
        }
    });

    return grid;
}
