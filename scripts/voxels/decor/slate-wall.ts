import { Grid, hash, mix } from '../voxel-tools.ts';
import { fbm, noise, profile, sequence, Solid } from './shapes.ts';
import type { Cell } from './shapes.ts';
import { clearPlantSpots, reservedAbove, step } from './wall-tools.ts';

/** Plant spots (must match the catalogue). */
const ANCHORS: Cell[] = [
    [22, 40, 20],
    [67, 27, 24],
    [112, 46, 18],
    [37, 70, 6],
];

/**
 * A stepped backdrop of stacked slate that leans on the back glass: thin,
 * slightly tilted beds whose cleaved fronts jut out by different amounts,
 * giving overhangs, a deep crevice near the foot and flat terraces. Dark
 * blue-grey stone with seams between the beds, quartz veins, rusty iron
 * stains running down the faces, and moss and lichen on the terraces.
 * Flat ledges carry the plant spots, and broken chips lie at the foot.
 */
export function slateWall(): Grid {
    const [width, height, depth] = [140, 75, 30];
    const grid = new Grid(width, height, depth);
    const solid = new Solid(width, height, depth);
    const random = sequence(1407);

    // The beds, bottom up: each has a thickness and its own reach forward.
    type Bed = {
        bottom: number;
        top: number;
        reach: number;
        cuts: number[];
        steps: number[];
    };
    const beds: Bed[] = [];

    for (let bottom = 0; bottom < height + 10;) {
        const thickness = 3 + Math.floor(random() * 5);
        const cuts: number[] = [];
        const steps: number[] = [];

        for (let x = 0; x < width; x += 9 + Math.floor(random() * 16)) {
            cuts.push(x);
            steps.push(random() < 0.2 ? Math.round((random() - 0.5) * 8) : 0);
        }

        beds.push({
            bottom,
            top: bottom + thickness,
            reach:
                random() < 0.3
                    ? Math.round((random() - 0.4) * 10)
                    : Math.round((random() - 0.5) * 2),
            cuts,
            steps,
        });
        bottom += thickness;
    }

    // A deep crevice two beds up, where fish can hide.
    beds[2].reach = -12;
    beds[2].steps = beds[2].steps.map(() => 0);

    /** The tilted height a cell sits at within the bedding. */
    const bedHeight = (x: number, y: number) =>
        y + (x - 70) * 0.035 + (noise(x / 25, y / 9, 0, 3) - 0.5) * 1.2;
    const bedOf = (x: number, y: number) => {
        const level = bedHeight(x, y);

        return beds.find((bed) => level < bed.top) ?? beds[beds.length - 1];
    };
    const segmentOf = (bed: Bed, x: number) => {
        let index = 0;

        while (index + 1 < bed.cuts.length && bed.cuts[index + 1] <= x) {
            index++;
        }

        return index;
    };

    // Terraced skyline: a high tier on the left, stepping down and up again.
    const skyline: [number, number][] = [
        [0, 30],
        [4, 46],
        [8, 58],
        [14, 64],
        [26, 64],
        [30, 71],
        [45, 71],
        [49, 61],
        [58, 60],
        [62, 50],
        [79, 50],
        [83, 57],
        [93, 57],
        [97, 67],
        [109, 67],
        [114, 60],
        [127, 60],
        [131, 50],
        [135, 38],
        [139, 22],
    ];

    for (let x = 0; x < width; x++) {
        const top = profile(skyline, x);

        for (let y = 0; y < height; y++) {
            const bed = bedOf(x, y);

            // Whole beds only, so the top of each column is a flat terrace.
            if (bed.top - (x - 70) * 0.035 > top + 1.5) {
                continue;
            }

            const rise = Math.min(1, y / top);
            const segment = segmentOf(bed, x);
            const endTaper = Math.min(1, x / 12, (width - 1 - x) / 12);
            const front =
                (0.55 + 0.45 * endTaper) * 7 +
                (0.55 + 0.45 * endTaper) * 21 * Math.pow(1 - rise, 0.8) +
                bed.reach +
                bed.steps[segment] +
                (fbm(x / 3, y / 3, 0, 9) - 0.5) * 1.2;

            for (let z = 0; z <= front && z < depth; z++) {
                solid.put(x, y, z);
            }
        }
    }

    // Flat slate ledges under the plant spots, slightly overhanging.
    for (const [ax, ay, az] of ANCHORS) {
        for (let y = ay - 4; y < ay; y++) {
            for (let z = 0; z <= az + 5; z++) {
                for (let x = ax - 8; x <= ax + 8; x++) {
                    solid.put(x, y, z);
                }
            }
        }

        // A thinner bed propping it up from beneath.
        for (let y = ay - 9; y < ay - 4; y++) {
            for (let z = 0; z <= az; z++) {
                for (let x = ax - 6; x <= ax + 6; x++) {
                    solid.put(x, y, z);
                }
            }
        }
    }

    // Chipped corners along the cleaved edges.
    const chips: Cell[] = [];

    solid.each((x, y, z) => {
        const exposedSides =
            (solid.at(x + 1, y, z) ? 0 : 1) +
            (solid.at(x - 1, y, z) ? 0 : 1) +
            (solid.at(x, y + 1, z) ? 0 : 1) +
            (solid.at(x, y, z + 1) ? 0 : 1);

        if (y > 0 && exposedSides >= 3 && hash(x, y, z, 17) < 0.45) {
            chips.push([x, y, z]);
        }
    });

    for (const [x, y, z] of chips) {
        solid.put(x, y, z, 0);
    }

    // Broken slabs lying at the foot.
    for (const [cx, length, reach, thickness] of [
        [12, 9, 6, 2],
        [48, 13, 7, 3],
        [92, 8, 5, 2],
        [124, 11, 6, 2],
    ]) {
        let front = depth - 1;

        while (front > 0 && !solid.at(cx, 0, front)) {
            front--;
        }

        solid.box(
            [cx, 0, front - 2],
            [cx + length, thickness - 1, Math.min(depth - 1, front + reach)],
        );
    }

    clearPlantSpots(solid, ANCHORS);
    solid.keepConnected();

    // ------------------------------------------------ colours

    const greys = [
        '#2f3439',
        '#383e44',
        '#41474e',
        '#4a5159',
        '#545c64',
        '#5f6770',
        '#6b737b',
        '#7a8289',
    ];
    const seam = '#24282c';
    const rust = '#8c5631';
    const mosses = ['#3e6331', '#4c7438', '#5b8540', '#6c9549'];
    const reserved = reservedAbove(ANCHORS);

    solid.each((x, y, z) => {
        const bed = bedOf(x, y);
        const bedIndex = beds.indexOf(bed);
        const segment = segmentOf(bed, x);
        const sunlit = !solid.at(x, y + 1, z);
        const overhang = y > 0 && !solid.at(x, y - 1, z);
        const front = !solid.at(x, y, z + 1);
        let tone =
            2 +
            ((bedIndex * 5 + segment * 3) % 4) -
            1 +
            Math.round((fbm(x / 2, y / 2, z / 2, 21) - 0.5) * 2.5) +
            (sunlit ? 2 : 0) -
            (overhang ? 2 : 0) -
            (y < 6 ? 1 : 0);
        tone = Math.max(0, Math.min(greys.length - 1, tone));
        let colour = greys[tone];

        const level = bedHeight(x, y);

        if (front && !sunlit && level - bed.bottom < 0.9) {
            colour = seam;
        } else if (front && bed.cuts.includes(x) && x > 0 && !sunlit) {
            colour = mix(greys[tone], seam, 0.5);
        }

        if (Math.abs(noise(x / 11, y / 7, z / 11, 31) - 0.5) < 0.006) {
            colour = '#a7abad';
        }

        // Iron stains streaking down the faces from seams.
        const stain = noise(x / 4, y / 26, z / 4, 41);

        if (!sunlit && stain > 0.66) {
            colour = mix(colour, rust, step((stain - 0.66) * 3.2, 4) * 0.75);
        }

        // Moss and lichen on the terraces and the lips of the beds.
        const mossiness = fbm(x / 6, y / 4, z / 6, 51);

        if (sunlit && mossiness > 0.56) {
            colour = mosses[Math.floor(hash(x, y, z, 52) * mosses.length)];
        } else if (front && solid.at(x, y + 1, z) === 0 && mossiness > 0.6) {
            colour = mix(colour, mosses[1], 0.5);
        } else if (front && hash(x, y, z, 53) < 0.012) {
            colour = hash(x, y, z, 54) < 0.5 ? '#b3b06a' : '#9aa69a';
        }

        grid.set(x, y, z, colour);

        // Tufts of moss standing up from the terraces.
        if (sunlit && mossiness > 0.62 && hash(x, y, z, 55) < 0.14) {
            const tall = 1 + Math.floor(hash(x, y, z, 56) * 2.5);

            for (let up = 1; up <= tall; up++) {
                if (!reserved(x, y + up, z)) {
                    grid.fill(
                        x,
                        y + up,
                        z,
                        up === tall ? mosses[3] : mosses[2],
                    );
                }
            }
        }
    });

    return grid;
}
