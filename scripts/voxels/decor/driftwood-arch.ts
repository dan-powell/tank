import type { Grid } from '../voxel-tools.ts';
import { driftwood } from './driftwood.ts';

/**
 * A gnarled bough that arches over open water for fish to swim beneath:
 * a thick, splayed root foot on the left twists up and over to a thinner
 * foot that splits into prongs on the right; a rotted hole runs through the
 * root foot. Broken stubs and a forked
 * snag stick out along the way, and its top carries three plant spots.
 */
export function driftwoodArch(): Grid {
    return driftwood({
        size: [110, 60, 35],
        seed: 404,
        knots: 9,
        hollows: [
            // A rotted-out hole through the root foot, big enough for a small fish.
            { centre: [12, 12, 26], radii: [3.2, 4, 12] },
        ],
        anchors: [
            [31, 55, 23],
            [56, 53, 16],
            [78, 43, 13],
        ],
        limbs: [
            // The main bough, from the root foot up and over to the right.
            {
                points: [
                    [7, 1, 26],
                    [11, 14, 26],
                    [17, 32, 25],
                    [24, 44, 24],
                    [31, 48.5, 23],
                    [43, 49.5, 19],
                    [56, 48, 16],
                    [67, 45, 14],
                    [78, 38.5, 13],
                    [88, 27, 11],
                    [96, 14, 9],
                    [101, 3, 8],
                ],
                radii: [9, 8, 7.2, 6.5, 6, 5.6, 5.2, 4.9, 4.6, 4.4, 4.2, 4],
                twist: 0.025,
            },
            // Roots splaying from the left foot.
            {
                points: [
                    [9, 6, 25],
                    [3, 2, 30],
                    [0, 1, 33],
                ],
                radii: [4.5, 3, 2],
            },
            {
                points: [
                    [10, 5, 24],
                    [16, 2, 32],
                    [21, 1, 34],
                ],
                radii: [4, 2.8, 1.6],
            },
            {
                points: [
                    [8, 6, 22],
                    [4, 2, 14],
                    [2, 1, 8],
                ],
                radii: [4.2, 2.8, 1.8],
                broken: true,
            },
            // The right foot splits into prongs.
            {
                points: [
                    [97, 12, 9],
                    [103, 5, 13],
                    [108, 1, 17],
                ],
                radii: [3, 2.2, 1.4],
            },
            {
                points: [
                    [98, 10, 9],
                    [100, 4, 3],
                    [101, 1, 1],
                ],
                radii: [2.8, 2, 1.4],
            },
            // A broken stub on the left shoulder, pointing up and back.
            {
                points: [
                    [20, 38, 24],
                    [15, 47, 18],
                    [13, 52, 15],
                ],
                radii: [3.4, 2.8, 2.5],
                broken: true,
            },
            // A forked snag reaching forward off the crown.
            {
                points: [
                    [44, 50, 20],
                    [46, 55, 27],
                    [45, 58, 32],
                ],
                radii: [2.8, 2, 1.2],
            },
            {
                points: [
                    [46, 55, 27],
                    [50, 57, 31],
                ],
                radii: [1.4, 0.9],
            },
            // A thick stub jutting back from the right shoulder.
            {
                points: [
                    [70, 43, 13],
                    [74, 46, 6],
                    [75, 47, 2],
                ],
                radii: [3.2, 2.8, 2.6],
                broken: true,
            },
            // A thin twig hanging down under the arch.
            {
                points: [
                    [62, 43, 15],
                    [64, 36, 19],
                    [63, 30, 21],
                ],
                radii: [1.8, 1.2, 0.7],
            },
        ],
    });
}
