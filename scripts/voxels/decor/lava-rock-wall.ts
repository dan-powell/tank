import { Grid, hash, mix } from '../voxel-tools.ts';
import { fbm, noise, profile, sequence, Solid } from './shapes.ts';
import type { Cell } from './shapes.ts';
import { clearPlantSpots, reservedAbove, step } from './wall-tools.ts';

/** Plant spots (must match the catalogue). */
const ANCHORS: Cell[] = [
    [18, 46, 19],
    [48, 67, 8],
    [80, 40, 20],
];

/** Glowing cracks, where the decoration's LEDs sit (must match the catalogue). */
const EMBERS: Cell[] = [
    [31, 10, 7],
    [75, 11, 9],
    [62, 58, 15],
];

/**
 * A tall backdrop of porous volcanic rock that leans on the back glass: two
 * lumpy spires with a saddle between them, bored through by two winding
 * lava tubes that fish can swim along, and pocked all over with gas
 * bubbles. Crusty black basalt rusts to red-brown in patches, with pale
 * mineral crusts, a little algae on the tops, and cracks that glow like
 * embers. Lumpy shelves carry the plant spots.
 */
export function lavaRockWall(): Grid {
    const [width, height, depth] = [100, 100, 32];
    const grid = new Grid(width, height, depth);
    const solid = new Solid(width, height, depth);
    const random = sequence(4410);

    const skyline: [number, number][] = [
        [0, 50],
        [7, 66],
        [16, 86],
        [25, 97],
        [32, 90],
        [39, 75],
        [45, 67],
        [52, 66],
        [58, 74],
        [65, 86],
        [72, 95],
        [79, 87],
        [87, 70],
        [94, 56],
        [99, 38],
    ];

    for (let x = 0; x < width; x++) {
        const top = profile(skyline, x);
        const endTaper = Math.min(1, x / 10, (width - 1 - x) / 10);

        for (let y = 0; y < height; y++) {
            for (let z = 0; z < depth; z++) {
                const lump = (fbm(x / 9, y / 9, z / 9, 7) - 0.5) * 14;
                const rise = Math.min(1, Math.max(0, y / top));
                const front =
                    (0.6 + 0.4 * endTaper) *
                    (6 + 25 * Math.pow(1 - rise, 0.75));

                if (y < top + lump * 0.8 && z < front + lump) {
                    solid.put(x, y, z);
                }
            }
        }
    }

    // Lava tubes: one winding along the foot, one through the left spire.
    const tunnel = (points: Cell[], radius: number) => {
        for (let i = 1; i < points.length; i++) {
            solid.tube(points[i - 1], points[i], radius, radius, 0);
        }
    };
    tunnel(
        [
            [-6, 12, 15],
            [14, 15, 17],
            [32, 11, 14],
            [52, 14, 16],
            [70, 10, 15],
            [88, 13, 17],
            [106, 11, 14],
        ],
        6.5,
    );
    tunnel(
        [
            [-6, 60, 9],
            [10, 57, 11],
            [24, 62, 10],
            [36, 58, 13],
            [44, 56, 18],
        ],
        4.5,
    );

    // Mouths opening the lower tube to the front, and a vent above it.
    solid.tube([30, 12, 14], [30, 11, depth + 4], 6, 7, 0);
    solid.tube([74, 11, 15], [76, 12, depth + 4], 5, 6, 0);
    solid.tube([52, 14, 16], [55, 30, depth + 4], 3, 4, 0);

    // Gas bubbles frozen into the rock, opening as pits on its skin.
    for (let i = 0; i < 1400; i++) {
        const [x, y, z] = [
            random() * width,
            random() * height,
            random() * depth,
        ];
        const radius = 0.7 + Math.pow(random(), 2.2) * 2.6;

        if (solid.at(Math.floor(x), Math.floor(y), Math.floor(z))) {
            solid.ellipsoid([x, y, z], [radius, radius, radius], 0);
        }
    }

    // Lumpy shelves under the plant spots, propped on the rock behind.
    for (const [ax, ay, az] of ANCHORS) {
        const wobble = (x: number, y: number, z: number) =>
            (noise(x / 3, y / 3, z / 3, 13) - 0.5) * 0.6;
        solid.ellipsoid([ax, ay - 3, az - 2], [8, 3.2, 7], 1, wobble);
        solid.tube([ax, ay - 4, az - 2], [ax, ay - 14, 2], 4.5, 3, 1);

        for (let z = az - 3; z <= az + 3; z++) {
            for (let x = ax - 3; x <= ax + 3; x++) {
                solid.put(x, ay - 1, z);
            }
        }
    }

    clearPlantSpots(solid, ANCHORS);
    solid.keepConnected();

    // ------------------------------------------------ colours

    const basalt = [
        '#191716',
        '#211e1c',
        '#2a2623',
        '#332e2a',
        '#3d3631',
        '#48403a',
    ];
    const rusted = ['#4a281f', '#5a3023', '#6b3a27', '#7f452c', '#935232'];
    const reserved = reservedAbove(ANCHORS);

    solid.each((x, y, z) => {
        const sunlit = !solid.at(x, y + 1, z);
        const open =
            (solid.at(x + 1, y, z) ? 0 : 1) +
            (solid.at(x - 1, y, z) ? 0 : 1) +
            (solid.at(x, y + 1, z) ? 0 : 1) +
            (solid.at(x, y - 1, z) ? 0 : 1) +
            (solid.at(x, y, z + 1) ? 0 : 1);
        const crust = Math.floor(hash(x, y, z, 21) * 3) - 1;
        const oxidised = fbm(x / 13, y / 13, z / 13, 31);
        const shading = (sunlit ? 1 : 0) - (y < 8 ? 1 : 0) + crust;
        let colour: string;

        if (oxidised > 0.55) {
            const tone = Math.round((oxidised - 0.55) * 18) + shading;
            colour = rusted[Math.max(0, Math.min(rusted.length - 1, tone))];
        } else {
            const tone =
                2 +
                shading +
                Math.round((fbm(x / 3, y / 3, z / 3, 41) - 0.5) * 3);
            colour = basalt[Math.max(0, Math.min(basalt.length - 1, tone))];
        }

        // Pits and hollows are darker inside.
        if (
            open === 1 &&
            solid.at(x, y, z + 1) === 0 &&
            hash(x, y, z, 22) < 0.3
        ) {
            colour = mix(colour, '#0f0d0c', 0.5);
        }

        // Cracks: dark red, glowing where they are deepest.
        const crack = Math.abs(noise(x / 14, y / 16, z / 14, 51) - 0.5);

        if (crack < 0.004) {
            colour = hash(x, y, z, 52) < 0.5 ? '#d9541c' : '#c2401a';
        } else if (crack < 0.014) {
            colour = mix(colour, '#7a1e0c', step((0.014 - crack) * 90, 3));
        }

        // Pale mineral crust and a little algae on the tops.
        if (sunlit && fbm(x / 5, y / 5, z / 5, 61) > 0.67) {
            colour = hash(x, y, z, 62) < 0.5 ? '#46613a' : '#557040';
        } else if (hash(x, y, z, 63) < 0.01) {
            colour = hash(x, y, z, 64) < 0.5 ? '#c9bfae' : '#a99f90';
        }

        grid.set(x, y, z, colour);

        if (
            sunlit &&
            fbm(x / 5, y / 5, z / 5, 61) > 0.68 &&
            hash(x, y, z, 65) < 0.12 &&
            !reserved(x, y + 1, z)
        ) {
            grid.fill(x, y + 1, z, '#628048');
        }
    });

    // A glowing seam around each LED, deep in the tube mouths and up the face.
    for (const [ex, ey, ez] of EMBERS) {
        for (let y = ey - 5; y <= ey + 5; y++) {
            const x = ex + Math.round(Math.sin(y * 1.3) * 1.2);

            for (let z = ez - 2; z <= ez + 2; z++) {
                if (solid.isSurface(x, y, z)) {
                    grid.set(
                        x,
                        y,
                        z,
                        Math.abs(y - ey) < 3 ? '#e8662a' : '#9a2e12',
                    );
                }
            }
        }

        grid.set(ex, ey, ez, '#ff7a2e');
    }

    return grid;
}
