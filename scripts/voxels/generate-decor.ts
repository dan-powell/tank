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
import {
    anemones,
    brainCoral,
    clamp,
    clearShaft,
    fbm,
    noise,
    paintRock,
    pick,
    plantLedges,
    polyps,
    profile,
    reef,
    seaFans,
    sequence,
    staghorn,
    tableCoral,
    tubeCoral,
    Volume,
    weather,
} from './decor-tools.ts';
import type { Cell, RockScheme } from './decor-tools.ts';
import { Grid, hash, mix, Palette, shade } from './voxel-tools.ts';

const OUTPUT = 'resources/models/decor';
const MANIFEST = 'scripts/voxels/generated.json';

/**
 * Fill a rock mass leaning on the back glass: up to `top(x)` at each x, and
 * forward to `front(x, y, rise)` at each height (rise is 0 at the foot, 1 at
 * the top).
 */
function rockMass(
    volume: Volume,
    top: (x: number) => number,
    front: (x: number, y: number, rise: number) => number,
    value = 1,
): void {
    for (let x = 0; x < volume.width; x++) {
        const height = top(x);

        for (let y = 0; y < volume.height && y < height; y++) {
            const reach = front(x, y, y / height);

            for (let z = 0; z < volume.depth && z <= reach; z++) {
                volume.put(x, y, z, value);
            }
        }
    }
}

/** Make sure each anchor has rock just beneath it. */
function support(volume: Volume, anchors: Cell[], value = 1): void {
    for (const [ax, ay, az] of anchors) {
        volume.put(ax, ay - 1, az, value);
    }
}

// ---------------------------------------------------------------- coral wall

const GREY_REEF: RockScheme = {
    tones: [
        '#55514a',
        '#605c55',
        '#6c6860',
        '#78736a',
        '#847e73',
        '#908a7e',
        '#9c968a',
    ],
    bands: [2, 4, 3, 5, 3],
    warm: '#8a7d68',
    crack: '#433f39',
    algae: ['#c98aa0', '#b67a8e'],
    algaeAbove: 0.63,
    shadowBelow: 10,
    stratum: 4.5,
    tilt: 0.07,
    seed: 0,
};

/**
 * A tall rocky backdrop that leans on the back glass: three craggy masses
 * (a lower pillar between two peaks) in tilted, cracked strata, with a cave
 * at the foot, four ledges for plants, and corals growing over it: branching
 * staghorn, grooved brain coral, sea fans, tube clusters and polyps.
 */
function coralWall(): Grid {
    const volume = new Volume(120, 90, 30);
    const grid = new Grid(volume.width, volume.height, volume.depth);

    /** Plant spots (must match the catalogue). */
    const anchors: Cell[] = [
        [21, 30, 21],
        [61, 50, 18],
        [98, 38, 21],
        [61, 58, 6],
    ];

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

    rockMass(
        volume,
        // Keep the pillar's top flat where its plant spot sits.
        (x) =>
            x >= 56 && x <= 66
                ? profile(skyline, x)
                : profile(skyline, x) + (fbm(x / 7, 0, 3.7, 11) - 0.5) * 7,
        // Deep at the foot, thin near the top.
        (x, y, rise) =>
            5 +
            ((x > 41 && x < 75 ? 21 : 29) - 5) * Math.pow(1 - rise, 0.7) +
            (fbm(x / 6, y / 6, 1.3, 21) - 0.5) * 7,
    );

    // A cave at the foot of the left peak, and a smaller hollow on the right.
    volume.carve([30, 6, 27], [10, 8, 10]);
    volume.carve([96, 19, 27], [6, 5, 7]);

    const reserved = plantLedges(volume, anchors);
    weather(volume, reserved);
    support(volume, anchors);
    paintRock(volume, grid, GREY_REEF);

    const corals = reef(volume, grid, reserved, 2026);
    staghorn(corals, 6);
    brainCoral(corals, 5);
    seaFans(corals, 3);
    tubeCoral(corals, 6);
    polyps(corals);

    return grid;
}

// ---------------------------------------------------------------- terraced coral wall

const LIMESTONE_REEF: RockScheme = {
    tones: [
        '#6b604f',
        '#776b58',
        '#837662',
        '#8f826d',
        '#9b8e78',
        '#a79a83',
        '#b3a68e',
    ],
    bands: [3, 2, 4, 3, 5],
    warm: '#a08660',
    crack: '#4a4136',
    algae: ['#c97f8f', '#d79aa6'],
    algaeAbove: 0.67,
    shadowBelow: 8,
    stratum: 3.5,
    tilt: 0.03,
    seed: 100,
};

/**
 * A wide, low reef in three terraces stepping down towards the viewer, in
 * pale limestone: table corals and anemones on the broad steps, brain coral,
 * yellow staghorn and tubes, and two overhangs at the foot to hide under.
 */
function coralTerraces(): Grid {
    const volume = new Volume(140, 70, 36);
    const grid = new Grid(volume.width, volume.height, volume.depth);

    const anchors: Cell[] = [
        [22, 22, 28],
        [72, 22, 29],
        [120, 22, 28],
        [45, 44, 17],
        [100, 44, 17],
        [74, 64, 6],
    ];

    const skyline: [number, number][] = [
        [0, 52],
        [12, 60],
        [30, 63],
        [48, 59],
        [62, 66],
        [70, 64],
        [80, 64],
        [92, 68],
        [110, 61],
        [126, 63],
        [139, 50],
    ];

    // Where each step begins, wavering along the reef.
    const lowerStep = (x: number) => 21 + (fbm(x / 9, 0, 0.5, 111) - 0.5) * 7;
    const upperStep = (x: number) => 43 + (fbm(x / 9, 0, 4.5, 112) - 0.5) * 7;

    rockMass(
        volume,
        (x) =>
            x >= 69 && x <= 79
                ? 64
                : profile(skyline, x) + (fbm(x / 6, 0, 2.1, 113) - 0.5) * 6,
        (x, y) => {
            const reach = y < lowerStep(x) ? 32 : y < upperStep(x) ? 21 : 10;
            const crag = (fbm(x / 5, y / 5, 7.3, 114) - 0.5) * 6;
            // Each step's edge slopes back a little.
            const slope =
                y < lowerStep(x)
                    ? (y / lowerStep(x)) * 3
                    : y < upperStep(x)
                      ? ((y - lowerStep(x)) / 22) * 3
                      : 0;

            return reach + crag - slope;
        },
    );

    volume.carve([55, 6, 33], [10, 7, 8], 115);
    volume.carve([110, 5, 33], [7, 5, 7], 116);

    const reserved = plantLedges(volume, anchors);
    weather(volume, reserved, 0.06, 117);
    support(volume, anchors);
    paintRock(volume, grid, LIMESTONE_REEF);

    const corals = reef(volume, grid, reserved, 2027, { minY: 6, minZ: 6 });
    tableCoral(corals, 4);
    brainCoral(corals, 4, {
        groove: '#4f6f3d',
        rim: '#a7cf7a',
        body: '#86b25d',
    });
    anemones(corals, 5);
    staghorn(corals, 4, { tip: '#fff3b0', dark: '#d9b43a', body: '#e8c64e' });
    tubeCoral(corals, 4, ['#ffe9c2', '#e2793d', '#ef8f50']);
    seaFans(corals, 2, ['#9b3b4a', '#cf5b6c']);
    polyps(corals, 0.03, ['#fff1e0', '#ffd0b8']);

    return grid;
}

// ---------------------------------------------------------------- coral pinnacles

const BASALT_REEF: RockScheme = {
    tones: [
        '#3d4247',
        '#474d53',
        '#51575e',
        '#5b626a',
        '#666e76',
        '#717a82',
        '#7c868e',
    ],
    bands: [2, 3, 2, 4, 3],
    warm: '#6e5f58',
    crack: '#2a2d31',
    algae: ['#d0667e', '#e08a9a'],
    algaeAbove: 0.64,
    shadowBelow: 10,
    stratum: 5,
    tilt: -0.05,
    seed: 200,
};

/**
 * Three dark volcanic spires rising from a shared rubble base, the middle
 * one the tallest, with a natural bridge (and a window beneath it) joining
 * the middle and right spires: purple staghorn and big sea fans climb them.
 */
function coralPinnacles(): Grid {
    const volume = new Volume(110, 110, 32);
    const grid = new Grid(volume.width, volume.height, volume.depth);

    const anchors: Cell[] = [
        [19, 47, 19],
        [55, 72, 17],
        [91, 41, 19],
        [74, 63, 11],
    ];

    // The rubble base the spires stand on.
    rockMass(
        volume,
        (x) => 16 + (fbm(x / 8, 0, 9.1, 201) - 0.5) * 10,
        (x, y, rise) =>
            6 +
            22 * Math.pow(1 - rise, 0.6) +
            (fbm(x / 5, y / 5, 9.7, 202) - 0.5) * 6,
    );

    // Spires: [centre x, height, base half-width, lean per cell of height].
    const spires: [number, number, number, number][] = [
        [20, 82, 17, 0.05],
        [55, 108, 20, -0.03],
        [90, 72, 16, -0.06],
    ];

    for (const [index, [cx, tall, base, lean]] of spires.entries()) {
        for (let y = 0; y < tall; y++) {
            const rise = y / tall;
            const half =
                3 +
                (base - 3) * Math.pow(1 - rise, 0.75) +
                (fbm(cx / 9, y / 5, index, 203) - 0.5) * 5;
            const centre =
                cx + lean * y + (noise(y / 9, index, 0, 204) - 0.5) * 4;
            const reach = 8 + 16 * Math.pow(1 - rise, 0.8);

            for (let x = Math.floor(centre - half); x <= centre + half; x++) {
                const edge = 1 - Math.abs(x - centre) / half;
                const front =
                    reach * Math.sqrt(Math.max(0, edge)) +
                    (fbm(x / 4, y / 4, index + 3, 205) - 0.5) * 5;

                for (let z = 0; z <= front; z++) {
                    volume.put(x, y, z, 1);
                }
            }
        }
    }

    // A natural bridge from the middle spire to the right one.
    volume.capsule([60, 56, 9], [86, 50, 10], 6, 5, 1);
    volume.carve([73, 40, 12], [7, 9, 14], 206);
    volume.carve([38, 8, 29], [8, 6, 8], 207);

    const reserved = plantLedges(volume, anchors);
    weather(volume, reserved, 0.08, 208);
    support(volume, anchors);
    paintRock(volume, grid, BASALT_REEF);

    const corals = reef(volume, grid, reserved, 2028, { minY: 8, minZ: 6 });
    seaFans(corals, 6, ['#5a2f6e', '#9a5cc0'], { spacing: 14, length: 9 });
    staghorn(corals, 5, { tip: '#e4dcff', dark: '#6f5bb8', body: '#8a74d6' });
    brainCoral(corals, 3, {
        groove: '#7a5a1f',
        rim: '#f1cf6e',
        body: '#d9ad45',
    });
    tubeCoral(corals, 4, ['#fff1b0', '#e2b33a', '#efc451']);
    anemones(corals, 3, ['#5d7fd6', '#86a7f2', '#e6f0ff']);
    polyps(corals, 0.03, ['#ffd3e0', '#f7a8c0']);

    return grid;
}

// ---------------------------------------------------------------- rock wall

/**
 * A backdrop of stacked slate: slabs of different thickness, each jutting
 * out its own way, with crevices between them, a few vertical fractures,
 * rust stains, moss on the ledges and a scree of fallen chips at the foot.
 */
function rockWall(): Grid {
    const volume = new Volume(130, 80, 26);
    const grid = new Grid(volume.width, volume.height, volume.depth);
    const random = sequence(301);

    const anchors: Cell[] = [
        [18, 26, 20],
        [63, 42, 15],
        [105, 32, 18],
        [40, 60, 10],
    ];

    // Slab courses from the floor up: [first row, thickness, how far it juts, seed].
    const slabs: { from: number; to: number; reach: number; seed: number }[] =
        [];

    for (let y = 0; y < volume.height;) {
        const thickness = 3 + Math.floor(random() * 5);
        const rise = y / volume.height;
        slabs.push({
            from: y,
            to: y + thickness,
            reach: 22 - rise * 13 + (random() - 0.5) * 6,
            seed: slabs.length,
        });
        y += thickness;
    }

    const slabAt = (y: number) =>
        slabs.find((slab) => y >= slab.from && y < slab.to) ?? slabs[0];

    const skyline: [number, number][] = [
        [0, 58],
        [14, 66],
        [30, 70],
        [44, 64],
        [58, 74],
        [76, 78],
        [92, 69],
        [108, 72],
        [122, 63],
        [129, 55],
    ];

    for (let x = 0; x < volume.width; x++) {
        const top = profile(skyline, x) + (fbm(x / 6, 0, 1.1, 302) - 0.5) * 5;

        for (let y = 0; y < top && y < volume.height; y++) {
            const slab = slabAt(y);
            // Each slab's front edge wanders along x, more so at its corners.
            let reach =
                slab.reach +
                (fbm(x / 7, slab.seed, 3.3, 303) - 0.5) * 9 +
                (noise(x / 2, slab.seed, 5.1, 304) - 0.5) * 2;

            // Crevices between some slabs: the bottom row of a slab tucked back.
            if (y === slab.from && slab.seed % 3 === 1) {
                reach -= 3;
            }

            // Vertical fractures through a slab.
            if (hash(Math.floor(x / 2), slab.seed, 0, 305) < 0.04) {
                reach -= 4;
            }

            for (let z = 0; z < volume.depth && z <= reach; z++) {
                volume.put(x, y, z, 1);
            }
        }
    }

    // Scree: chips of slate fallen at the foot.
    for (let i = 0; i < 26; i++) {
        const x = 3 + random() * (volume.width - 6);
        const z = 16 + random() * 9;
        volume.ball([x, 0.5 + random() * 1.5, z], 1 + random() * 1.6, 1);
    }

    for (const anchor of anchors) {
        const [ax, ay, az] = anchor;

        // A slab top to stand on, from the wall out to the plant spot.
        for (let z = 0; z <= az + 3; z++) {
            for (let x = ax - 5; x <= ax + 5; x++) {
                for (let y = ay - 3; y < ay; y++) {
                    volume.put(x, y, z, 1);
                }
            }
        }

        clearShaft(volume, anchor, 4.5, 14);
    }

    support(volume, anchors);

    const slate = ['#3f464c', '#475057', '#4f5960', '#58626a', '#616c74'];
    const rust = ['#7d5a3a', '#94693f'];
    const moss = ['#4d6b34', '#5e7d3d', '#6f8f47'];

    volume.each((x, y, z) => {
        if (!volume.at(x, y, z)) {
            return;
        }

        const slab = slabAt(y);
        const tone = Math.floor(hash(slab.seed, 0, 0, 306) * slate.length);
        const grain = Math.round((fbm(x / 3, y / 1.5, z / 3, 307) - 0.5) * 3);
        const sunlit = !volume.at(x, y + 1, z);
        const front = !volume.at(x, y, z + 1);
        let colour =
            slate[clamp(tone + grain + (sunlit ? 1 : 0), 0, slate.length - 1)];

        // The edge rows of each slab are worn paler.
        if (front && (y === slab.to - 1 || y === slab.from)) {
            colour = mix(colour, '#8a949a', 0.25);
        }

        // Iron staining in streaks down the face.
        if (front && noise(x / 4, y / 16, 0.5, 308) > 0.78) {
            colour = mix(colour, pick(rust, hash(x, y, z, 309)), 0.35);
        }

        if (sunlit && noise(x / 5, y / 5, z / 5, 310) > 0.6) {
            colour = pick(moss, hash(x, y, z, 311));
        } else if (front && hash(x, y, z, 312) < 0.04) {
            colour = shade(colour, 0.8);
        }

        grid.set(x, y, z, colour);
    });

    // Tufts of moss and short weed on the ledges (clear of the plant spots).
    const reserved = (x: number, y: number, z: number) =>
        anchors.some(
            ([ax, ay, az]) =>
                y >= ay - 1 && y <= ay + 14 && Math.hypot(x - ax, z - az) <= 6,
        );
    volume.each((x, y, z) => {
        if (
            volume.at(x, y, z) &&
            !volume.at(x, y + 1, z) &&
            !volume.at(x, y + 1, z + 1) &&
            hash(x, y, z, 313) < 0.022 &&
            !reserved(x, y + 1, z)
        ) {
            const tall = 1 + Math.floor(hash(x, y, z, 314) * 3);

            for (let i = 1; i <= tall; i++) {
                grid.fill(x, y + i, z, i === tall ? '#8fb357' : '#6f9a45');
            }
        }
    });

    return grid;
}

// ---------------------------------------------------------------- driftwood arch

type Tube = {
    /** Control points: [x, y, z, radius]. */
    points: [number, number, number, number][];
    /** Whether the far end is snapped off (flat, showing the heartwood). */
    snapped: boolean;
};

type TubeSample = {
    p: [number, number, number];
    tangent: [number, number, number];
    normal: [number, number, number];
    binormal: [number, number, number];
    radius: number;
    /** Distance along the tube, in cells. */
    s: number;
};

const sub = (a: number[], b: number[]) => a.map((v, i) => v - b[i]);
const dot = (a: number[], b: number[]) =>
    a.reduce((t, v, i) => t + v * b[i], 0);
const crossV = (a: number[], b: number[]): [number, number, number] => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
];
const normalise = (v: number[]): [number, number, number] => {
    const length = Math.hypot(v[0], v[1], v[2]) || 1;

    return [v[0] / length, v[1] / length, v[2] / length];
};

/** Points along a Catmull-Rom curve through a tube's control points, about every half cell. */
function sampleTube(tube: Tube): TubeSample[] {
    const points = tube.points;
    const at = (i: number) => points[clamp(i, 0, points.length - 1)];
    const samples: TubeSample[] = [];
    let s = 0;
    let previous: number[] | null = null;

    for (let segment = 0; segment < points.length - 1; segment++) {
        const [p0, p1, p2, p3] = [
            at(segment - 1),
            at(segment),
            at(segment + 1),
            at(segment + 2),
        ];
        const length = Math.hypot(p2[0] - p1[0], p2[1] - p1[1], p2[2] - p1[2]);
        const steps = Math.max(2, Math.ceil(length * 2));

        for (let step = 0; step < steps; step++) {
            const t = step / steps;
            const point = [0, 1, 2, 3].map(
                (k) =>
                    0.5 *
                    (2 * p1[k] +
                        (-p0[k] + p2[k]) * t +
                        (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t * t +
                        (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t * t * t),
            );

            if (previous !== null) {
                s += Math.hypot(
                    point[0] - previous[0],
                    point[1] - previous[1],
                    point[2] - previous[2],
                );
            }

            previous = point;
            samples.push({
                p: [point[0], point[1], point[2]],
                tangent: [0, 0, 0],
                normal: [0, 0, 0],
                binormal: [0, 0, 0],
                radius: point[3],
                s,
            });
        }
    }

    const last = points[points.length - 1];
    s += Math.hypot(
        last[0] - previous![0],
        last[1] - previous![1],
        last[2] - previous![2],
    );
    samples.push({
        p: [last[0], last[1], last[2]],
        tangent: [0, 0, 0],
        normal: [0, 0, 0],
        binormal: [0, 0, 0],
        radius: last[3],
        s,
    });

    for (const [i, sample] of samples.entries()) {
        const before = samples[Math.max(0, i - 1)].p;
        const after = samples[Math.min(samples.length - 1, i + 1)].p;
        sample.tangent = normalise(sub(after, before));
        const side = Math.abs(sample.tangent[1]) > 0.9 ? [0, 0, 1] : [0, 1, 0];
        sample.normal = normalise(crossV(sample.tangent, side));
        sample.binormal = crossV(sample.tangent, sample.normal);
    }

    return samples;
}

/**
 * A gnarled, sun-bleached bough arching over the gravel: ridged and grooved
 * bark that twists along its length, knots, a hollow in its thick left foot,
 * splayed roots, a snapped-off branch and twig showing pale heartwood, and
 * green algae on its upper side.
 */
function driftwoodArch(): Grid {
    const volume = new Volume(110, 60, 35);
    const grid = new Grid(volume.width, volume.height, volume.depth);

    const anchors: Cell[] = [
        [31, 55, 23],
        [56, 53, 16],
        [78, 43, 13],
    ];

    const tubes: Tube[] = [
        {
            snapped: false,
            points: [
                [4, 1, 28, 7],
                [9, 12, 27, 6.8],
                [15, 26, 26, 6.4],
                [22, 39, 24.5, 6],
                [31, 49, 23, 5.4],
                [43, 51.5, 19.5, 5],
                [56, 48, 16, 4.6],
                [67, 44.5, 14, 4.3],
                [78, 38.5, 13, 4],
                [87, 28, 13.5, 4],
                [94, 16, 15, 4.2],
                [99, 5, 17, 4.6],
                [101, 1, 18, 5],
            ],
        },
        // A snapped-off branch reaching up and back, and a twig to the front.
        {
            snapped: true,
            points: [
                [43, 51, 18, 3.6],
                [42, 54.5, 14, 3.1],
                [40, 57, 10, 2.8],
            ],
        },
        {
            snapped: true,
            points: [
                [87, 29, 15, 3.2],
                [90, 32, 20, 2.7],
                [92, 34, 25, 2.3],
            ],
        },
        {
            snapped: true,
            points: [
                [17, 30, 26, 2.6],
                [12, 36, 29, 2.2],
                [9, 40, 31, 1.9],
            ],
        },
        // Roots splayed over the gravel at both feet.
        {
            snapped: false,
            points: [
                [6, 3, 26, 2.6],
                [2, 1.5, 31, 1.8],
                [0, 1, 34, 1.2],
            ],
        },
        {
            snapped: false,
            points: [
                [7, 3, 24, 2.4],
                [3, 1.5, 19, 1.7],
                [1, 1, 14, 1.1],
            ],
        },
        {
            snapped: false,
            points: [
                [9, 3, 29, 2.2],
                [14, 1.5, 32, 1.6],
                [19, 1, 34, 1],
            ],
        },
        {
            snapped: false,
            points: [
                [100, 3, 19, 2.4],
                [105, 1.5, 24, 1.7],
                [109, 1, 28, 1.1],
            ],
        },
        {
            snapped: false,
            points: [
                [101, 3, 16, 2.2],
                [105, 1.5, 11, 1.5],
                [108, 1, 7, 1],
            ],
        },
    ];

    // Knots along the main bough: [distance along it, angle round it].
    const knots: [number, number][] = [
        [28, 1.2],
        [58, -2.1],
        [86, 0.4],
        [120, 2.6],
    ];

    const cells = volume.width * volume.height * volume.depth;
    const best = new Float32Array(cells).fill(9);
    const along = new Float32Array(cells);
    const angle = new Float32Array(cells);
    const tubeOf = new Int8Array(cells).fill(-1);
    const toEnd = new Float32Array(cells).fill(99);
    const index = (x: number, y: number, z: number) =>
        (y * volume.depth + z) * volume.width + x;

    for (const [tubeIndex, tube] of tubes.entries()) {
        const samples = sampleTube(tube);
        const end = samples[samples.length - 1];

        for (const sample of samples) {
            const reach = Math.ceil(sample.radius * 1.5 + 2);
            const [px, py, pz] = sample.p;

            for (let y = Math.floor(py - reach); y <= py + reach; y++) {
                for (let z = Math.floor(pz - reach); z <= pz + reach; z++) {
                    for (let x = Math.floor(px - reach); x <= px + reach; x++) {
                        if (!volume.inside(x, y, z)) {
                            continue;
                        }

                        const centre = [x + 0.5, y + 0.5, z + 0.5];
                        const offset = sub(centre, sample.p);
                        const beyondEnd = dot(sub(centre, end.p), end.tangent);

                        if (tube.snapped && beyondEnd > 0) {
                            continue;
                        }

                        const theta = Math.atan2(
                            dot(offset, sample.binormal),
                            dot(offset, sample.normal),
                        );
                        const [c, s] = [Math.cos(theta), Math.sin(theta)];
                        let radius =
                            sample.radius *
                            (1 +
                                0.12 * Math.sin(5 * theta + sample.s * 0.21) +
                                0.24 *
                                    (noise(
                                        sample.s / 3,
                                        c * 1.2 + tubeIndex * 5,
                                        s * 1.2,
                                        401,
                                    ) -
                                        0.5));

                        if (tubeIndex === 0) {
                            for (const [knotS, knotAngle] of knots) {
                                const gap = Math.hypot(
                                    (sample.s - knotS) / 2.5,
                                    Math.atan2(
                                        Math.sin(theta - knotAngle),
                                        Math.cos(theta - knotAngle),
                                    ) / 0.6,
                                );
                                radius += Math.max(0, 1 - gap) * 1.6;
                            }
                        }

                        const ratio =
                            Math.hypot(offset[0], offset[1], offset[2]) /
                            radius;
                        const i = index(x, y, z);

                        if (ratio < best[i]) {
                            best[i] = ratio;
                            along[i] = sample.s;
                            angle[i] = theta;
                            tubeOf[i] = tubeIndex;
                            toEnd[i] = tube.snapped ? -beyondEnd : 99;
                        }
                    }
                }
            }
        }
    }

    volume.each((x, y, z) => {
        if (best[index(x, y, z)] < 1) {
            volume.put(x, y, z, 1);
        }
    });

    // A hollow rotted into the thick left foot.
    volume.carve([9, 7, 31], [3.2, 4.5, 3.5], 402);

    for (const anchor of anchors) {
        const [ax, ay, az] = anchor;

        // A flattened spot on the wood, built up to the anchor where needed.
        for (let z = az - 2; z <= az + 2; z++) {
            for (let x = ax - 2; x <= ax + 2; x++) {
                if (Math.hypot(x - ax, z - az) > 2.3) {
                    continue;
                }

                for (
                    let y = ay - 1;
                    y >= ay - 6 && !volume.at(x, y - 1, z);
                    y--
                ) {
                    volume.put(x, y, z, 1);
                }

                volume.put(x, ay - 1, z, 1);
            }
        }

        clearShaft(volume, anchor, 3.5, 14);
    }

    support(volume, anchors);

    const tones = ['#6f5a46', '#7d6650', '#8a7259', '#967e63', '#a38b6e'];
    const knotColour = (s: number, theta: number) => {
        for (const [knotS, knotAngle] of knots) {
            const gap = Math.hypot(
                (s - knotS) / 2.5,
                Math.atan2(
                    Math.sin(theta - knotAngle),
                    Math.cos(theta - knotAngle),
                ) / 0.6,
            );

            if (gap < 0.45) {
                return '#3a2c20';
            }

            if (gap < 0.8) {
                return '#4e3c2c';
            }
        }

        return null;
    };

    volume.each((x, y, z) => {
        if (!volume.at(x, y, z)) {
            return;
        }

        const i = index(x, y, z);
        const s = along[i];
        const theta = angle[i];
        const tube = tubeOf[i];
        const [c, sn] = [Math.cos(theta), Math.sin(theta)];
        const sunlit = !volume.at(x, y + 1, z);

        // Snapped ends: pale heartwood with growth rings.
        if (toEnd[i] < 1.2) {
            const ring = Math.floor(best[i] * 4);
            grid.set(x, y, z, ring % 2 === 0 ? '#c9a97a' : '#a8875c');

            return;
        }

        const streak = noise(s / 6, c * 1.5 + tube * 3, sn * 1.5, 403);
        let colour =
            tones[
                clamp(
                    Math.floor(streak * tones.length + (sunlit ? 1 : 0)),
                    0,
                    tones.length - 1,
                )
            ];
        const groove = Math.sin(
            7 * theta + s * 0.15 + 2 * noise(s / 4, c, sn, 404),
        );

        if (tube === 0 && knotColour(s, theta) !== null) {
            colour = knotColour(s, theta)!;
        } else if (groove > 0.62) {
            colour = shade(colour, 0.68);
        } else if (groove < -0.75) {
            colour = mix(colour, '#c4b399', 0.35);
        }

        if (sunlit && fbm(x / 5, y / 5, z / 5, 405) > 0.62) {
            colour = hash(x, y, z, 406) < 0.5 ? '#6b8a43' : '#7f9d52';
        } else if (sunlit && y > 30) {
            colour = mix(colour, '#d2c4a8', 0.3);
        }

        // The rotten hollow's walls.
        if (Math.hypot((x - 9) / 4.2, (y - 7) / 5.5, (z - 31) / 4.5) < 1) {
            colour = '#4a3626';
        }

        grid.set(x, y, z, colour);
    });

    return grid;
}

// ---------------------------------------------------------------- treasure chest

/**
 * A banded wooden chest with its domed lid lifted a crack on the gold
 * inside: planked sides, brass bands with rivets, a lock plate and hasp,
 * iron handles, and coins and gems spilled on the gravel in front.
 */
function treasureChest(): Grid {
    const [width, height, depth] = [40, 33, 28];
    const grid = new Grid(width, height, depth);
    const volume = new Volume(width, height, depth);

    const [x0, x1] = [3, 36];
    const [z0, z1] = [4, 23];
    const bodyTop = 15;
    const lidOpen = (16 * Math.PI) / 180;
    const [lidDepth, lidRise] = [10.5, 8];
    const bands = (x: number) => (x >= 7 && x <= 8) || (x >= 31 && x <= 32);

    const wood = ['#5a3a22', '#6b4529', '#7a5030', '#865a36'];
    const seam = '#3a2414';
    const brass = ['#8f6a20', '#b8892c', '#d4a63f'];
    const rivet = '#f3d27a';
    const gold = ['#e0b23a', '#f2c94c', '#ffe08a', '#c99a2e'];
    const gems = ['#d23b4c', '#2f9e6e', '#3b6fd2', '#e9e4f5'];

    const plank = (along: number, row: number, salt: number) => {
        const tone = wood[Math.floor(hash(row, salt, 0, 501) * wood.length)];
        const grain = noise(along / 5, row * 3, salt, 502);

        return grain > 0.7
            ? shade(tone, 0.85)
            : grain < 0.25
              ? shade(tone, 1.1)
              : tone;
    };

    // The body: planked walls round a hold heaped with gold.
    for (let y = 0; y <= bodyTop; y++) {
        for (let z = z0; z <= z1; z++) {
            for (let x = x0; x <= x1; x++) {
                const wall =
                    x <= x0 + 1 ||
                    x >= x1 - 1 ||
                    z <= z0 + 1 ||
                    z >= z1 - 1 ||
                    y <= 1;
                const row = Math.floor(y / 4);
                const front = z >= z1 - 1 || z <= z0 + 1;

                if (wall) {
                    grid.set(
                        x,
                        y,
                        z,
                        y % 4 === 3 && y !== bodyTop
                            ? seam
                            : plank(front ? x : z, row, front ? 1 : 2),
                    );
                    volume.put(x, y, z, 1);

                    continue;
                }

                const mound =
                    11 +
                    4 *
                        (1 -
                            Math.hypot(
                                (x - (x0 + x1) / 2) / ((x1 - x0) / 2),
                                (z - (z0 + z1) / 2) / ((z1 - z0) / 2),
                            ) **
                                2);

                if (y <= mound) {
                    const coin = hash(x, y, z, 503);
                    grid.set(
                        x,
                        y,
                        z,
                        coin < 0.015
                            ? pick(gems, hash(x, y, z, 504))
                            : pick(gold, coin),
                    );
                    volume.put(x, y, z, 1);
                }
            }
        }
    }

    // Brass bands round the body, a rim at the top and a skirt at the foot.
    for (let y = 0; y <= bodyTop; y++) {
        for (let x = x0 - 1; x <= x1 + 1; x++) {
            for (const z of [z0 - 1, z1 + 1]) {
                const rim = y === bodyTop || y === bodyTop - 1 || y <= 1;
                const sideRim = x === x0 - 1 || x === x1 + 1;

                if ((bands(x) || rim) && !sideRim) {
                    grid.set(
                        x,
                        y,
                        z,
                        (y + x) % 3 === 0 && bands(x)
                            ? rivet
                            : brass[1 + (y % 2)],
                    );
                }
            }
        }

        for (let z = z0 - 1; z <= z1 + 1; z++) {
            for (const x of [x0 - 1, x1 + 1]) {
                if (
                    y === bodyTop ||
                    y === bodyTop - 1 ||
                    y <= 1 ||
                    z === z0 - 1 ||
                    z === z1 + 1
                ) {
                    grid.set(x, y, z, brass[1]);
                }
            }
        }
    }

    // Iron ring handles on the ends.
    for (const x of [x0 - 2, x1 + 2]) {
        for (let y = 5; y <= 12; y++) {
            for (let z = z0 + 5; z <= z1 - 5; z++) {
                const d = Math.hypot(y - 9.5, z - (z0 + z1) / 2);

                if (d > 2.2 && d < 3.4 && y <= 10) {
                    grid.set(x, y, z, '#4a4d52');
                }
            }
        }
    }

    // The lid, hinged along the back top edge and lifted a crack.
    for (let y = bodyTop + 1; y < height; y++) {
        for (let z = 0; z < depth; z++) {
            for (let x = x0 - 1; x <= x1 + 1; x++) {
                const dy = y + 0.5 - (bodyTop + 1);
                const dz = z + 0.5 - z0;
                const u = dz * Math.cos(lidOpen) + dy * Math.sin(lidOpen);
                const v = -dz * Math.sin(lidOpen) + dy * Math.cos(lidOpen);

                if (v < -0.2) {
                    continue;
                }

                const banded = bands(x);
                const grow = banded ? 1 : 0;
                const outer = Math.hypot(
                    (u - lidDepth + 0.5) / (lidDepth + grow),
                    v / (lidRise + grow),
                );
                const inner = Math.hypot(
                    (u - lidDepth + 0.5) / (lidDepth - 2),
                    v / (lidRise - 2),
                );
                const endCap = x <= x0 + 1 || x >= x1 - 1;
                const inLid =
                    x >= x0 && x <= x1
                        ? outer <= 1 && (inner > 1 || endCap)
                        : false;
                const inBand = banded && outer <= 1 && inner > 1;

                if (!inLid && !inBand) {
                    continue;
                }

                const phi = Math.atan2(
                    v / lidRise,
                    (u - lidDepth + 0.5) / lidDepth,
                );
                const row = Math.floor(phi / (Math.PI / 7));
                const onSeam =
                    Math.abs(phi - (row + 0.5) * (Math.PI / 7)) >
                    (Math.PI / 7) * 0.42;

                let colour = onSeam && !endCap ? seam : plank(x, row, 3);

                if (inner <= 1 && !endCap) {
                    colour = '#2a1a10';
                }

                if (banded && outer > 0.86) {
                    colour = Math.round(phi * 9) % 3 === 0 ? rivet : brass[2];
                } else if (outer > 0.92 && hash(x, y, z, 505) < 0.12) {
                    colour = '#6f8a45';
                }

                // The front lip of the lid is shod in brass.
                if (u > lidDepth * 2 - 2.2) {
                    colour = brass[1];
                }

                grid.set(x, y, z, colour);
            }
        }
    }

    // The lock: a plate on the body, and the lid's hasp hanging over it.
    for (let y = 8; y <= bodyTop - 1; y++) {
        for (let x = 17; x <= 22; x++) {
            const keyhole = (x === 19 || x === 20) && y >= 10 && y <= 12;
            grid.set(
                x,
                y,
                z1 + 1,
                keyhole
                    ? '#1c1408'
                    : y === 8 || y === bodyTop - 1 || x === 17 || x === 22
                      ? brass[0]
                      : brass[2],
            );
        }
    }

    const lipY = Math.round(bodyTop + 1 + lidDepth * 2 * Math.sin(lidOpen));
    const lipZ = Math.round(z0 + lidDepth * 2 * Math.cos(lidOpen));

    for (let y = lipY - 5; y <= lipY; y++) {
        for (let x = 18; x <= 21; x++) {
            grid.set(x, y, lipZ + 1, y === lipY - 5 ? brass[0] : brass[2]);
        }
    }

    // Coins, a pearl string and gems spilled over the front edge and onto the gravel.
    const random = sequence(506);

    for (let i = 0; i < 30; i++) {
        const x = Math.floor(6 + random() * 28);
        const z = Math.floor(z1 + 2 + random() * 3);
        const stack = random() < 0.25 ? 1 + Math.floor(random() * 3) : 1;

        for (let y = 0; y < stack; y++) {
            grid.set(x, y, Math.min(depth - 1, z), pick(gold, random()));
            grid.set(
                Math.min(width - 1, x + 1),
                y,
                Math.min(depth - 1, z),
                pick(gold, random()),
            );
        }
    }

    for (let i = 0; i < 5; i++) {
        grid.set(
            Math.floor(8 + random() * 24),
            0,
            Math.floor(z1 + 2 + random() * 3),
            pick(gems, random()),
        );
    }

    // Coins tumbling over the rim at the front.
    for (let x = 12; x <= 27; x++) {
        if (hash(x, 0, 0, 507) < 0.6) {
            const drop = Math.floor(hash(x, 1, 0, 508) * 4);
            grid.set(x, bodyTop - drop, z1 + 1, pick(gold, hash(x, 2, 0, 509)));
        }
    }

    return grid;
}

// ---------------------------------------------------------------- castle

/** What a castle cell is made of. */
const Stone = {
    Wall: 1,
    Tower: 2,
    Roof: 3,
    Wood: 4,
    Iron: 5,
    Rock: 6,
    Flag: 7,
    Shadow: 8,
    Pole: 9,
} as const;

/**
 * A ruined castle: a square keep with a corner turret under a slate cone
 * and a banner, two round towers joined by a curtain wall, and a gateway
 * with a half-raised portcullis that fish can swim through. Coursed
 * masonry with arched windows, missing merlons, fallen blocks, moss on the
 * ledges and weed at the foot.
 */
function castle(): Grid {
    const volume = new Volume(90, 100, 60);
    const grid = new Grid(volume.width, volume.height, volume.depth);
    const towers: Record<string, [number, number, number]> = {
        left: [14, 42, 11],
        right: [75, 44, 10],
        turret: [54, 9, 6],
    };

    const anchors: Cell[] = [
        [44, 80, 19],
        [14, 64, 42],
        [75, 54, 44],
        [58, 42, 45],
    ];

    /** Crenellation: is this cell along a parapet a merlon (not a gap or a fallen one)? */
    const merlon = (along: number, salt: number) => {
        const block = Math.floor(along / 4);

        return block % 2 === 0 && hash(block, salt, 0, 601) > 0.15;
    };

    // The rocky mound it all stands on.
    for (let z = 0; z < volume.depth; z++) {
        for (let x = 0; x < volume.width; x++) {
            const edge = Math.min(
                x,
                z,
                volume.width - 1 - x,
                volume.depth - 1 - z,
            );
            const mound =
                Math.min(4, edge * 0.6) + (fbm(x / 6, 0, z / 6, 602) - 0.5) * 3;

            for (let y = 0; y < mound; y++) {
                volume.put(x, y, z, Stone.Rock);
            }
        }
    }

    // The keep: solid up to its roof, then a parapet round a walkway.
    const keep = { x0: 30, x1: 57, z0: 6, z1: 31, roof: 79 };

    for (let y = 0; y <= keep.roof + 7; y++) {
        for (let z = keep.z0; z <= keep.z1; z++) {
            for (let x = keep.x0; x <= keep.x1; x++) {
                const rim =
                    x <= keep.x0 + 1 ||
                    x >= keep.x1 - 1 ||
                    z <= keep.z0 + 1 ||
                    z >= keep.z1 - 1;

                if (y <= keep.roof) {
                    volume.put(x, y, z, Stone.Wall);
                } else if (
                    rim &&
                    (y <= keep.roof + 3 ||
                        merlon(
                            z <= keep.z0 + 1 || z >= keep.z1 - 1 ? x : z + 100,
                            1,
                        ))
                ) {
                    volume.put(x, y, z, Stone.Wall);
                }
            }
        }
    }

    // Round towers, with a floor and battlements on top.
    const roundTower = (
        [cx, cz, radius]: [number, number, number],
        top: number,
        salt: number,
    ) => {
        for (let y = 0; y <= top + 7; y++) {
            for (let z = Math.floor(cz - radius); z <= cz + radius; z++) {
                for (let x = Math.floor(cx - radius); x <= cx + radius; x++) {
                    const r = Math.hypot(x + 0.5 - cx, z + 0.5 - cz);

                    if (r > radius) {
                        continue;
                    }

                    const ring = r > radius - 2.2;
                    const around =
                        (Math.atan2(z + 0.5 - cz, x + 0.5 - cx) + Math.PI) *
                        radius;

                    if (
                        y < top ||
                        (ring && (y <= top + 3 || merlon(around, salt)))
                    ) {
                        volume.put(x, y, z, Stone.Tower);
                    }
                }
            }
        }
    };
    roundTower(towers.left, 64, 2);
    roundTower(towers.right, 54, 3);

    // The curtain wall between them, with a parapet on its front edge.
    const wall = { x0: 22, x1: 68, z0: 42, z1: 51, top: 41 };

    for (let y = 0; y <= wall.top + 6; y++) {
        for (let z = wall.z0; z <= wall.z1; z++) {
            for (let x = wall.x0; x <= wall.x1; x++) {
                if (
                    y <= wall.top ||
                    (z >= wall.z1 - 2 && (y <= wall.top + 2 || merlon(x, 4)))
                ) {
                    volume.put(x, y, z, Stone.Wall);
                }
            }
        }
    }

    // The gateway through the curtain wall, with a semicircular head.
    const gate = { cx: 45, half: 8, spring: 22 };
    const inGate = (x: number, y: number) => {
        const dx = (x + 0.5 - gate.cx) / gate.half;

        return (
            Math.abs(dx) <= 1 &&
            y < gate.spring + Math.sqrt(Math.max(0, 1 - dx * dx)) * gate.half
        );
    };

    for (let y = 0; y < volume.height; y++) {
        for (let z = wall.z0; z <= wall.z1; z++) {
            for (
                let x = gate.cx - gate.half - 1;
                x <= gate.cx + gate.half + 1;
                x++
            ) {
                if (inGate(x, y)) {
                    volume.put(x, y, z, 0);
                }
            }
        }
    }

    // The portcullis, half raised: bars hanging into the top of the arch.
    for (let x = gate.cx - gate.half; x <= gate.cx + gate.half; x++) {
        for (let y = gate.spring - 4; y < gate.spring + gate.half; y++) {
            if (
                inGate(x, y) &&
                ((x - gate.cx) % 3 === 0 ||
                    y === gate.spring - 4 ||
                    y === gate.spring + 1)
            ) {
                volume.put(x, y, 47, Stone.Iron);
            }
        }
    }

    // The corner turret, corbelled out from the keep and capped with a slate cone.
    const [tx, tz, tr] = towers.turret;

    for (let y = 56; y < volume.height; y++) {
        const radius =
            y < 62
                ? 2 + ((y - 56) / 6) * (tr - 2)
                : y < 88
                  ? tr
                  : (tr + 1.5) * (1 - (y - 88) / 12);
        const material = y < 88 ? Stone.Tower : Stone.Roof;

        for (let z = Math.floor(tz - radius - 1); z <= tz + radius + 1; z++) {
            for (
                let x = Math.floor(tx - radius - 1);
                x <= tx + radius + 1;
                x++
            ) {
                if (Math.hypot(x + 0.5 - tx, z + 0.5 - tz) <= radius) {
                    volume.put(x, y, z, material);
                }
            }
        }
    }

    // Arched windows and the keep's door, set back into the walls.
    const recess = (
        x0: number,
        x1: number,
        y0: number,
        y1: number,
        zFront: number,
        deep: number,
        backing: number,
    ) => {
        const mid = (x0 + x1 + 1) / 2;
        const half = (x1 - x0 + 1) / 2;

        for (let y = y0; y <= y1 + half; y++) {
            for (let x = x0; x <= x1; x++) {
                const dx = (x + 0.5 - mid) / half;

                if (
                    y > y1 &&
                    y - y1 > Math.sqrt(Math.max(0, 1 - dx * dx)) * half
                ) {
                    continue;
                }

                for (let z = zFront - deep + 1; z <= zFront; z++) {
                    volume.put(x, y, z, z === zFront - deep + 1 ? backing : 0);
                }
            }
        }
    };

    recess(40, 47, 3, 13, keep.z1, 3, Stone.Wood);
    recess(35, 37, 46, 53, keep.z1, 2, Stone.Shadow);
    recess(50, 52, 46, 53, keep.z1, 2, Stone.Shadow);
    recess(42, 45, 60, 68, keep.z1, 2, Stone.Shadow);
    recess(36, 37, 26, 31, keep.z1, 2, Stone.Shadow);
    recess(50, 51, 26, 31, keep.z1, 2, Stone.Shadow);

    for (const [[cx, cz, radius], rows] of [
        [towers.left, [24, 46]],
        [towers.right, [22, 38]],
    ] as [[number, number, number], number[]][]) {
        for (const y0 of rows) {
            recess(
                cx - 1,
                cx,
                y0,
                y0 + 6,
                Math.floor(cz + radius),
                3,
                Stone.Shadow,
            );
        }
    }

    // Arrow slits along the curtain wall.
    for (const x of [27, 33, 57, 63]) {
        recess(x, x, 28, 33, wall.z1, 2, Stone.Shadow);
    }

    // A banner on a pole at the keep's back corner.
    for (let y = keep.roof + 1; y <= 97; y++) {
        volume.put(33, y, 9, Stone.Pole);
    }

    for (let y = 89; y <= 96; y++) {
        for (let x = 34; x <= 43; x++) {
            const wave = Math.round(Math.sin((x - 34) * 0.7) * 1.1);
            const tail = x >= 41 && Math.abs(y - 92.5) < (x - 40) * 0.8;

            if (!tail) {
                volume.put(x, y, 9 + wave, Stone.Flag);
            }
        }
    }

    // Blocks fallen from the battlements, lying on the mound.
    const random = sequence(603);

    for (let i = 0; i < 9; i++) {
        const x = Math.floor(4 + random() * 80);
        const z = Math.floor(53 + random() * 5);
        const base = Math.ceil(4 + (fbm(x / 6, 0, z / 6, 602) - 0.5) * 3) - 1;

        for (let y = base; y < base + 2; y++) {
            for (let dz = 0; dz < 2; dz++) {
                for (let dx = 0; dx < 3; dx++) {
                    volume.put(
                        x + dx,
                        y,
                        Math.min(volume.depth - 1, z + dz),
                        Stone.Wall,
                    );
                }
            }
        }
    }

    for (const anchor of anchors) {
        clearShaft(volume, anchor, 3, 12);
    }

    support(volume, anchors, Stone.Wall);

    // ------------------------------------------------ colour

    const stones = [
        '#77736b',
        '#827d73',
        '#8d877c',
        '#6c6962',
        '#958f83',
        '#7b766c',
    ];
    const mortar = '#4b4842';
    const moss = ['#4f6b37', '#5f7d41', '#6f8f4c'];
    const slates = ['#3f4c5d', '#4b5a6e', '#56677d'];

    /** Coursed blocks: which block a spot on a wall face falls in, or null on a mortar line. */
    const masonry = (u: number, y: number, salt: number): number | null => {
        const course = Math.floor(y / 4);
        const length = 6 + (course % 3);
        const shifted = u + course * 3.7;

        if (y % 4 === 0 || ((shifted % length) + length) % length < 1) {
            return null;
        }

        return Math.floor(shifted / length) * 131 + course * 7 + salt;
    };

    volume.each((x, y, z) => {
        const material = volume.at(x, y, z);

        if (!material) {
            return;
        }

        const sunlit = !volume.at(x, y + 1, z);
        let colour: string;

        switch (material) {
            case Stone.Wall:
            case Stone.Tower: {
                let u = x + z;

                if (material === Stone.Tower) {
                    const [cx, cz, radius] = Object.values(towers).reduce(
                        (nearest, tower) =>
                            Math.abs(
                                Math.hypot(x - tower[0], z - tower[1]) -
                                    tower[2],
                            ) <
                            Math.abs(
                                Math.hypot(x - nearest[0], z - nearest[1]) -
                                    nearest[2],
                            )
                                ? tower
                                : nearest,
                    );
                    u = Math.atan2(z + 0.5 - cz, x + 0.5 - cx) * radius;
                }

                // The arch round the gateway is set with wedge-shaped voussoirs.
                const archR = Math.hypot(x + 0.5 - gate.cx, y - gate.spring);

                if (
                    z >= wall.z0 &&
                    y >= gate.spring &&
                    archR >= gate.half &&
                    archR < gate.half + 3
                ) {
                    const wedge = Math.floor(
                        Math.atan2(y - gate.spring, x + 0.5 - gate.cx) /
                            (Math.PI / 9),
                    );
                    colour =
                        (Math.atan2(y - gate.spring, x + 0.5 - gate.cx) /
                            (Math.PI / 9)) %
                            1 <
                        0.12
                            ? mortar
                            : pick(stones, hash(wedge, 0, 0, 604));
                    break;
                }

                const block = masonry(u, y, material);
                colour =
                    block === null
                        ? mortar
                        : shade(
                              pick(stones, hash(block, 0, 0, 605)),
                              pick(
                                  [0.9, 1, 1.08],
                                  fbm(x / 2, y / 2, z / 2, 606),
                              ),
                          );

                // Weathering: grime low down, a crack down the keep's face.
                if (y < 10) {
                    colour = mix(colour, '#3f4a37', y < 4 ? 0.4 : 0.2);
                }

                if (
                    Math.abs(x - 49 - Math.sin(y / 5) * 2) < 0.6 &&
                    y > 34 &&
                    y < 58 &&
                    z === keep.z1
                ) {
                    colour = '#2f2c28';
                }

                break;
            }
            case Stone.Roof: {
                const [cx, cz] = towers.turret;
                const around =
                    (Math.atan2(z + 0.5 - cz, x + 0.5 - cx) + Math.PI) * 4 +
                    (Math.floor(y / 2) % 2) * 1.5;
                colour =
                    y % 2 === 0
                        ? '#323c49'
                        : pick(slates, hash(Math.floor(around / 3), y, 0, 607));
                break;
            }
            case Stone.Wood:
                colour =
                    x % 3 === 0
                        ? '#3d2716'
                        : y % 5 === 2 && x % 4 === 1
                          ? '#4a4d52'
                          : pick(['#6b4a2e', '#7a5536'], hash(x, 0, 0, 608));
                break;
            case Stone.Iron:
                colour = '#3c3f44';
                break;
            case Stone.Pole:
                colour = '#5a4632';
                break;
            case Stone.Flag:
                colour =
                    Math.hypot(x - 37.5, y - 92.5) < 2
                        ? '#e8c35a'
                        : (x + y) % 5 === 0
                          ? '#a52a33'
                          : '#c4363f';
                break;
            case Stone.Shadow:
                colour = '#1d2126';
                break;
            default: {
                const rock = ['#5e5a52', '#6a655c', '#575349', '#716b60'];
                colour = pick(rock, fbm(x / 3, y / 3, z / 3, 609));
            }
        }

        if (
            sunlit &&
            material !== Stone.Flag &&
            material !== Stone.Pole &&
            material !== Stone.Iron &&
            material !== Stone.Roof &&
            noise(x / 5, y / 5, z / 5, 610) > 0.5
        ) {
            colour = pick(moss, hash(x, y, z, 611));
        }

        grid.set(x, y, z, colour);
    });

    // Weed sprouting along the foot of the walls, clear of the gateway.
    volume.each((x, y, z) => {
        if (
            volume.at(x, y, z) === Stone.Rock &&
            !volume.at(x, y + 1, z) &&
            hash(x, y, z, 612) < 0.07 &&
            !inGate(x, 0)
        ) {
            const tall = 1 + Math.floor(hash(x, y, z, 613) * 4);

            for (let i = 1; i <= tall; i++) {
                grid.fill(x, y + i, z, i === tall ? '#8fb357' : '#5f8a3e');
            }
        }
    });

    return grid;
}

// ---------------------------------------------------------------- main

const DECORATIONS: Record<string, () => Grid> = {
    'coral-wall': coralWall,
    'coral-terraces': coralTerraces,
    'coral-pinnacles': coralPinnacles,
    'rock-wall': rockWall,
    'driftwood-arch': driftwoodArch,
    'treasure-chest': treasureChest,
    castle,
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
