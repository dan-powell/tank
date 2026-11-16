import {
    anemones,
    brainCoral,
    fbm,
    noise,
    paintRock,
    plantLedges,
    polyps,
    reef,
    seaFans,
    staghorn,
    tubeCoral,
    Volume,
    weather,
    rockMass,
    support,
} from '../decor-tools.ts';
import type { Cell, RockScheme } from '../decor-tools.ts';
import { Grid } from '../voxel-tools.ts';

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
export function coralPinnacles(): Grid {
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
