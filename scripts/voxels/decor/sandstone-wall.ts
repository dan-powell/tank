import { Grid, hash, mix } from '../voxel-tools.ts';
import { fbm, noise, profile, sequence, Solid } from './shapes.ts';
import type { Cell } from './shapes.ts';
import { clearPlantSpots, reservedAbove, step } from './wall-tools.ts';

/** Plant spots (must match the catalogue). */
const ANCHORS: Cell[] = [
    [20, 34, 22],
    [52, 52, 17],
    [96, 62, 12],
];

/**
 * A warm backdrop of banded sandstone that leans on the back glass, worn by
 * wind and water into rounded domes: a free-standing arch on the right that
 * fish can swim under, a round window right through the left mass, wind
 * caves at the foot, honeycomb weathering on the faces, and a mushroom rock
 * standing out in front. Cream, ochre and rust stripes with dark streaks of
 * varnish, a little algae on the tops, and sand drifted against the foot.
 * Rounded shelves carry the plant spots.
 */
export function sandstoneWall(): Grid {
    const [width, height, depth] = [130, 85, 32];
    const grid = new Grid(width, height, depth);
    const solid = new Solid(width, height, depth);
    const random = sequence(8513);

    const skyline: [number, number][] = [
        [0, 34],
        [5, 50],
        [12, 62],
        [20, 67],
        [28, 63],
        [35, 70],
        [43, 79],
        [51, 77],
        [58, 68],
        [64, 60],
        [72, 56],
        [80, 64],
        [92, 70],
        [104, 66],
        [114, 58],
        [122, 50],
        [126, 40],
        [129, 26],
    ];

    /** The wall is thinner behind the arch, so fish can pass between them. */
    const behindArch = (x: number) =>
        Math.max(0, Math.min(1, (x - 70) / 6, (122 - x) / 6));

    for (let x = 0; x < width; x++) {
        const top = profile(skyline, x);
        const endTaper = Math.min(1, x / 10, (width - 1 - x) / 10);

        for (let y = 0; y < height; y++) {
            const rise = Math.min(1, y / top);
            const bulge = (fbm(x / 14, y / 12, 0.5, 3) - 0.5) * 10;
            const deep = 8 + 18 * Math.pow(1 - rise, 0.9) + bulge;
            const thin = 7 + 4 * (1 - rise) + bulge * 0.3;
            const front =
                (0.6 + 0.4 * endTaper) * (deep + (thin - deep) * behindArch(x));

            for (let z = 0; z < depth; z++) {
                const roundness = (fbm(x / 9, y / 9, z / 9, 5) - 0.5) * 5;

                if (y < top + roundness && z < front + roundness) {
                    solid.put(x, y, z);
                }
            }
        }
    }

    // The arch: two weathered legs and a span joined to the wall above.
    solid.tube([80, 0, 23], [83, 40, 20], 8, 6);
    solid.tube([113, 0, 22], [109, 40, 20], 9, 6);
    solid.tube([82, 38, 20], [96, 47, 19], 6.5, 7.5);
    solid.tube([96, 47, 19], [110, 38, 20], 7.5, 6.5);
    solid.ellipsoid([96, 54, 11], [17, 9, 11]);

    // Hollow out under the span so the arch stands clear of the wall.
    solid.ellipsoid([96, 18, 18], [10, 24, 7], 0);

    // A round window through the left mass.
    solid.tube([33, 47, -2], [31, 49, depth + 2], 6.5, 7.5, 0);

    // A mushroom rock in front: a narrow stem under a wide cap.
    solid.tube([13, 0, 26], [15, 15, 26], 5, 3);
    solid.ellipsoid([15, 17, 26], [8, 3.5, 6]);
    solid.box([8, 0, 20], [20, 2, 29]);

    // Wind caves along the foot.
    solid.ellipsoid([42, 6, 28], [9, 7, 8], 0);
    solid.ellipsoid([62, 9, 26], [5, 5, 6], 0);

    // Rounded shelves under the plant spots, worn into a shallow bowl on top.
    for (const [ax, ay, az] of ANCHORS) {
        const wobble = (x: number, y: number, z: number) =>
            (noise(x / 3, y / 3, z / 3, 13) - 0.5) * 0.4;
        solid.ellipsoid([ax, ay - 3, az - 2], [9, 4.5, 7.5], 1, wobble);
        solid.tube([ax, ay - 4, az - 2], [ax, ay - 13, 3], 5, 4);
    }

    // Honeycomb weathering: rows of small pits in patches of the faces.
    for (let y = 3; y < height; y += 3) {
        for (let x = (y / 3) % 2 === 0 ? 1 : 2.5; x < width; x += 3.2) {
            const [cx, cy] = [Math.round(x + (random() - 0.5)), y];

            if (fbm(cx / 11, cy / 11, 1.5, 9) < 0.53) {
                continue;
            }

            let cz = depth - 1;

            while (cz > 0 && !solid.at(cx, cy, cz)) {
                cz--;
            }

            if (
                cz > 4 &&
                solid.at(cx, cy - 2, cz) &&
                solid.at(cx, cy + 2, cz)
            ) {
                const radius = 1.2 + random() * 0.6;
                solid.ellipsoid(
                    [cx, cy, cz + 0.4],
                    [radius, radius, radius * 1.4],
                    0,
                );
            }
        }
    }

    clearPlantSpots(solid, ANCHORS);
    solid.keepConnected();

    // ------------------------------------------------ colours

    const bands = [
        '#d7a865',
        '#e6c992',
        '#c98f4f',
        '#efd9ab',
        '#b8693a',
        '#dcb57a',
        '#d69a7a',
        '#c48346',
        '#e9cf9d',
    ];
    const shades = bands.map((colour) =>
        [-0.6, -0.4, -0.2, 0, 0.2, 0.4, 0.55].map((t) =>
            t < 0 ? mix(colour, '#5e3a22', -t) : mix(colour, '#fbf0d2', t),
        ),
    );
    const reserved = reservedAbove(ANCHORS);

    solid.each((x, y, z) => {
        const sunlit = !solid.at(x, y + 1, z);
        const facing = !solid.at(x, y, z + 1);
        const level =
            (y +
                Math.sin(x / 17) * 2.5 +
                (noise(x / 12, y / 8, z / 12, 21) - 0.5) * 5) /
            3.4;
        const band =
            ((Math.floor(level) % bands.length) + bands.length) % bands.length;

        // Tone 3 is the band's own colour; lower is shadowed, higher sunlit.
        const grain =
            fbm(x / 2, y / 2, z / 2, 31) -
            0.5 +
            (hash(x, y, z, 32) - 0.5) * 0.25;
        let tone = 3 + Math.round(grain * 3);

        if (sunlit) {
            tone += 2;
        } else if (y > 0 && !solid.at(x, y - 1, z)) {
            tone -= 2;
        }

        // Pit walls and caves are shaded deeper inside.
        const enclosed =
            (solid.at(x + 2, y, z + 2) ? 1 : 0) +
            (solid.at(x - 2, y, z + 2) ? 1 : 0) +
            (solid.at(x, y + 2, z + 2) ? 1 : 0) +
            (solid.at(x, y - 2, z + 2) ? 1 : 0);

        if (facing && enclosed >= 2) {
            tone -= enclosed >= 3 ? 3 : 2;
        }

        let colour = shades[band][Math.max(0, Math.min(6, tone))];

        // Dark streaks of desert varnish running down the faces.
        const varnish = noise(x / 3, y / 28, z / 3, 41);

        if (!sunlit && facing && varnish > 0.7) {
            colour =
                varnish > 0.8 ? '#5e3e29' : mix(bands[band], '#5a3a26', 0.45);
        }

        // Algae film on the tops, sand drifted against the foot.
        if (sunlit && fbm(x / 6, y / 6, z / 6, 51) > 0.63) {
            colour = hash(x, y, z, 52) < 0.5 ? '#8a8f4c' : '#76813f';
        } else if (y < 2 && facing && noise(x / 6, 0, z / 6, 53) > 0.5) {
            colour = hash(x, y, z, 54) < 0.5 ? '#dcc79a' : '#cdb586';
        }

        grid.set(x, y, z, colour);

        if (
            sunlit &&
            fbm(x / 6, y / 6, z / 6, 51) > 0.68 &&
            hash(x, y, z, 55) < 0.1 &&
            !reserved(x, y + 1, z)
        ) {
            grid.fill(x, y + 1, z, '#94a052');
        }
    });

    return grid;
}
