import {
    clamp,
    clearShaft,
    fbm,
    noise,
    pick,
    profile,
    sequence,
    Volume,
    support,
} from '../decor-tools.ts';
import type { Cell } from '../decor-tools.ts';
import { Grid, hash, mix, shade } from '../voxel-tools.ts';

/**
 * A backdrop of stacked slate: slabs of different thickness, each jutting
 * out its own way, with crevices between them, a few vertical fractures,
 * rust stains, moss on the ledges and a scree of fallen chips at the foot.
 */
export function rockWall(): Grid {
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
