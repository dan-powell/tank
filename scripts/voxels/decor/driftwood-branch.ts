import type { Grid } from '../voxel-tools.ts';
import { driftwood } from './driftwood.ts';

/**
 * A long, weathered branch lying on the substrate: a thick, snapped-off
 * butt on the left tapers to a thin tip on the right, with forked twigs
 * reaching up and back, one limb lying along the floor in front, and three
 * plant spots along its top.
 */
export function driftwoodBranch(): Grid {
    return driftwood({
        size: [140, 36, 46],
        seed: 912,
        knots: 8,
        anchors: [
            [38, 14, 25],
            [78, 11, 20],
            [112, 9, 23],
        ],
        hollows: [
            // The butt end has rotted hollow.
            { centre: [0, 7, 21], radii: [7, 4, 3.5] },
        ],
        limbs: [
            // The main log, from its thin tip back to the snapped butt.
            {
                points: [
                    [138, 2.6, 27],
                    [124, 3, 25],
                    [112, 3.6, 23],
                    [98, 4, 21],
                    [80, 4.8, 20],
                    [62, 5.4, 22],
                    [46, 6, 24],
                    [30, 6.6, 24],
                    [14, 7, 22],
                    [1, 7.4, 21],
                ],
                radii: [2.4, 3.4, 4.2, 4.8, 5.6, 6.2, 6.8, 7.2, 7.6, 8],
                twist: 0.02,
                broken: true,
            },
            // A big bough rising up and back from the middle, then forking.
            {
                points: [
                    [56, 9, 22],
                    [55, 18, 16],
                    [52, 26, 11],
                    [49, 33, 7],
                ],
                radii: [4, 3, 2.2, 1.2],
            },
            {
                points: [
                    [55, 18, 16],
                    [61, 25, 12],
                    [66, 31, 10],
                    [68, 34, 9],
                ],
                radii: [2.2, 1.7, 1.1, 0.7],
            },
            {
                points: [
                    [52, 26, 11],
                    [45, 30, 12],
                    [41, 31, 13],
                ],
                radii: [1.4, 1, 0.6],
            },
            // A twig reaching up and forward near the tip, forked at the top.
            {
                points: [
                    [94, 6, 22],
                    [95, 14, 28],
                    [97, 22, 33],
                    [99, 28, 36],
                ],
                radii: [3, 2.2, 1.6, 1],
            },
            {
                points: [
                    [97, 22, 33],
                    [92, 27, 38],
                    [89, 30, 40],
                ],
                radii: [1.3, 0.9, 0.6],
            },
            // A short, snapped twig near the butt.
            {
                points: [
                    [20, 10, 24],
                    [16, 17, 30],
                    [14, 21, 33],
                ],
                radii: [3.2, 2.6, 2.3],
                broken: true,
            },
            // A side limb lying along the floor towards the front.
            {
                points: [
                    [68, 4, 23],
                    [72, 3, 32],
                    [78, 2.4, 40],
                    [84, 2, 44],
                ],
                radii: [3.6, 2.8, 2.2, 1.4],
            },
            {
                points: [
                    [76, 3, 38],
                    [70, 4, 43],
                ],
                radii: [1.4, 0.8],
            },
            // A broken stub poking back near the tip.
            {
                points: [
                    [124, 4, 25],
                    [127, 7, 17],
                    [128, 8, 13],
                ],
                radii: [2.2, 1.9, 1.7],
                broken: true,
            },
            // A thin twig curling up from behind the first plant spot.
            {
                points: [
                    [28, 10, 19],
                    [26, 18, 12],
                    [29, 25, 8],
                ],
                radii: [2, 1.4, 0.8],
            },
        ],
    });
}
