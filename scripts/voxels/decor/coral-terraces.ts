import {
    anemones,
    brainCoral,
    fbm,
    paintRock,
    plantLedges,
    polyps,
    profile,
    reef,
    seaFans,
    staghorn,
    tableCoral,
    tubeCoral,
    Volume,
    weather,
    rockMass,
    support,
} from '../decor-tools.ts';
import type { Cell, RockScheme } from '../decor-tools.ts';
import { Grid } from '../voxel-tools.ts';

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
export function coralTerraces(): Grid {
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
