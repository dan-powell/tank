import { Grid, hash } from '../voxel-tools.ts';
import { fbm, noise, Solid } from './shapes.ts';
import type { Cell } from './shapes.ts';

/** The plant spot on the crown (must match the catalogue). */
const CROWN: Cell = [25, 41, 17];

/**
 * A giant weathered skull, jawless, resting on its upper teeth and the back
 * of its head. The braincase is hollow and opens through deep eye sockets
 * and the nasal cavity, so small fish and shrimp can hide inside. The bone
 * is darker in its hollows and seams, with wavy sutures, hairline cracks,
 * a broken patch, chipped and missing teeth, and algae and moss over the
 * crown, where a plant can take root.
 */
export function skull(): Grid {
    const [width, height, depth] = [50, 44, 52];
    const grid = new Grid(width, height, depth);
    const BONE = 1;
    const TOOTH = 2;
    const solid = new Solid(width, height, depth);
    /** Cells carved out of the skull: the inside, coloured in shadow. */
    const hollow = new Solid(width, height, depth);
    const roughen =
        (seed: number, amount: number) => (x: number, y: number, z: number) =>
            (noise(x / 4, y / 4, z / 4, seed) - 0.5) * amount;

    // The braincase, resting on the sand at the back.
    solid.ellipsoid([25, 21, 20], [20.5, 19.5, 19.5], BONE, roughen(1, 0.05));
    // The face: a flatter mass at the front of the braincase.
    solid.ellipsoid([25, 17, 31], [17.5, 15, 15], BONE, roughen(2, 0.06));
    // A heavy brow ridge over the eyes.
    solid.ellipsoid([25, 27, 40], [17, 4, 5], BONE, roughen(3, 0.1));

    for (const side of [-1, 1]) {
        // Cheekbones, and the arch running back from each towards the ear.
        solid.ellipsoid(
            [25 + side * 14.5, 14, 39],
            [4.5, 4, 6.5],
            BONE,
            roughen(4, 0.1),
        );
        solid.tube(
            [25 + side * 17, 13, 36],
            [25 + side * 19.5, 13, 20],
            2.3,
            1.8,
        );
    }

    // The upper jaw, narrowing to the front, where the teeth sit.
    const jaw = (x: number, z: number) => {
        const forward = Math.max(0, (z - 30) / 18);
        const halfWidth = 12 - forward * forward * 4.5;

        return Math.hypot((x - 25) / halfWidth, Math.max(0, z - 30) / 18);
    };

    for (let z = 28; z < depth; z++) {
        for (let x = 0; x < width; x++) {
            const curve = jaw(x, z);

            for (let y = 4; y < 13; y++) {
                if (curve < 1 - Math.max(0, y - 10) * 0.05) {
                    solid.put(x, y, z, BONE);
                }
            }

            // A row of blunt teeth around the jaw's rim, standing on the sand.
            if (curve >= 0.74 && curve < 1.0 && z > 33) {
                const around = Math.atan2(x - 25, z - 30);
                const slot = around * 6.2;
                const gap = Math.abs(slot - Math.round(slot)) > 0.36;
                const missing = hash(Math.round(slot), 0, 0, 5) < 0.12;
                const chipped = hash(Math.round(slot), 1, 0, 6) < 0.3;

                if (!gap && !missing) {
                    for (let y = chipped ? 1 : 0; y < 4; y++) {
                        solid.put(x, y, z, TOOTH);
                    }
                }
            }
        }
    }

    const carve = (centre: Cell, radii: Cell, seed: number) => {
        const [cx, cy, cz] = centre;
        const [rx, ry, rz] = radii;

        for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++) {
            for (let z = Math.floor(cz - rz - 1); z <= cz + rz + 1; z++) {
                for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++) {
                    const d =
                        ((x - cx) / rx) ** 2 +
                        ((y - cy) / ry) ** 2 +
                        ((z - cz) / rz) ** 2;

                    if (
                        solid.inside(x, y, z) &&
                        d < 1 + (noise(x / 3, y / 3, z / 3, seed) - 0.5) * 0.2
                    ) {
                        solid.put(x, y, z, 0);
                        hollow.put(x, y, z, 1);
                    }
                }
            }
        }
    };

    // Hollow out the braincase and face, leaving a thick shell.
    carve([25, 22, 20], [17, 16.5, 16.5], 11);
    carve([25, 16, 30], [12.5, 9, 11], 12);

    // Deep eye sockets tunnelling back into the braincase.
    for (const side of [-1, 1]) {
        carve([25 + side * 8.5, 20.5, 42], [6.2, 6, 9], 13 + side);
    }

    // The nasal cavity: a pointed, heart-shaped opening above the teeth,
    // split low down by a thin bony ridge.
    for (let y = 7; y <= 17; y++) {
        const halfWidth = y > 10 ? (17 - y) * 0.5 + 0.5 : 2.2 + (y - 7) * 0.4;

        for (let z = 30; z < depth; z++) {
            for (let x = 0; x < width; x++) {
                const offset = Math.abs(x + 0.5 - 25);
                const septum = offset < 0.6 && y < 11 && z > 40;

                if (offset <= halfWidth && !septum && solid.at(x, y, z)) {
                    solid.put(x, y, z, 0);
                    hollow.put(x, y, z, 1);
                }
            }
        }
    }

    // The hole at the base of the skull, at the back, and a broken patch on the crown.
    carve([25, 4, 4], [5, 4, 6], 17);
    carve([10, 31, 12], [4, 3.5, 4], 18);

    // A small flat spot on the crown for a plant.
    const [ax, ay, az] = CROWN;

    for (let y = ay; y < height; y++) {
        for (let z = az - 5; z <= az + 5; z++) {
            for (let x = ax - 5; x <= ax + 5; x++) {
                if (Math.hypot(x - ax, z - az) <= 4.5) {
                    solid.put(x, y, z, 0);
                }
            }
        }
    }

    for (let z = az - 2; z <= az + 2; z++) {
        for (let x = ax - 2; x <= ax + 2; x++) {
            for (let y = ay - 4; y < ay; y++) {
                solid.put(x, y, z, BONE);
            }
        }
    }

    // ------------------------------------------------ colours

    const bone = [
        '#a08f6a',
        '#b5a47e',
        '#c6b58e',
        '#d4c49e',
        '#dfd1ae',
        '#e8dcbf',
        '#f1e8d2',
    ];
    const shadow = ['#2e271d', '#3b3226', '#4a3f2f', '#5c4f3a'];
    const teeth = ['#bfae84', '#d8caa2', '#eae0c2'];
    const directions: Cell[] = [
        [1, 0, 0],
        [-1, 0, 0],
        [0, 1, 0],
        [0, -1, 0],
        [0, 0, 1],
        [0, 0, -1],
    ];

    solid.each((x, y, z, kind) => {
        const open = ([dx, dy, dz]: Cell) => !solid.at(x + dx, y + dy, z + dz);
        const outside = ([dx, dy, dz]: Cell) =>
            open([dx, dy, dz]) && !hollow.at(x + dx, y + dy, z + dz);

        if (kind === TOOTH) {
            const stained = y === 3 || hash(x, y, z, 22) < 0.12;
            grid.set(
                x,
                y,
                z,
                stained ? teeth[0] : y === 0 ? teeth[1] : teeth[2],
            );

            return;
        }

        // Surfaces seen only from inside the hollows are in deep shadow,
        // lightening towards the openings.
        if (!directions.some(outside)) {
            const depthInside = Math.max(
                0,
                Math.min(3, Math.round((z - 26) / 5)),
            );
            grid.set(x, y, z, shadow[depthInside]);

            return;
        }

        const grain = Math.round((fbm(x / 3, y / 3, z / 3, 23) - 0.5) * 2.2);
        const sunlit = outside([0, 1, 0]) ? 1 : 0;
        const low = y < 7 ? -1 : 0;
        // Rims around the openings are worn and darker.
        const rim = directions.some(
            ([dx, dy, dz]) =>
                hollow.at(x + dx * 2, y + dy * 2, z + dz * 2) === 1,
        )
            ? -1
            : 0;
        let colour =
            bone[
                Math.max(
                    0,
                    Math.min(bone.length - 1, 3 + grain + sunlit + low + rim),
                )
            ];

        // Wavy sutures over the top and across the crown, and a hairline crack.
        const sagittal = Math.abs(
            x - 25 + 1.1 * Math.sin(z * 1.1) + 0.5 * Math.sin(z * 2.7),
        );
        const coronal = Math.abs(
            z - 25 + 1.1 * Math.sin(x * 1.2) + 0.5 * Math.sin(x * 3.1),
        );
        const lambdoid = Math.abs(z - 7 + (y - 22) * 0.4 + Math.sin(x * 1.3));

        if (
            y > 28 &&
            ((sagittal < 0.6 && z < 25) || (coronal < 0.6 && y > 24))
        ) {
            colour = '#8a7856';
        } else if (y > 12 && lambdoid < 0.55 && z < 14) {
            colour = '#8a7856';
        } else if (
            Math.abs(noise(x / 8, y / 8, z / 8, 21) - 0.5) < 0.018 &&
            y > 10
        ) {
            colour = '#6a5c42';
        } else if (fbm(x / 6, y / 6, z / 6, 25) > 0.66) {
            // Tea-coloured staining.
            colour = mixStain(colour);
        }

        // Algae on the sunlit crown.
        if (sunlit) {
            const algae = fbm(x / 5, y / 5, z / 5, 26) + (y - 32) * 0.012;

            if (algae > 0.64) {
                colour = hash(x, y, z, 27) < 0.5 ? '#5f7a34' : '#6f8c3c';
            } else if (algae > 0.59) {
                colour = '#9aa266';
            }
        }

        // Green-brown biofilm creeping up from the sand.
        if (y < 3 && hash(x, y, z, 28) < 0.55) {
            colour = '#76704a';
        }

        grid.set(x, y, z, colour);
    });

    // Tufts of moss standing on the crown, clear of the plant spot.
    for (let z = 2; z < 40; z++) {
        for (let x = 4; x < 46; x++) {
            for (let y = height - 2; y > 24; y--) {
                if (solid.at(x, y, z)) {
                    const algae =
                        fbm(x / 5, y / 5, z / 5, 26) + (y - 32) * 0.012;

                    if (
                        algae > 0.68 &&
                        hash(x, y, z, 29) < 0.4 &&
                        Math.hypot(x - ax, z - az) > 6
                    ) {
                        grid.fill(
                            x,
                            y + 1,
                            z,
                            hash(x, y, z, 30) < 0.5 ? '#7fa046' : '#5f8a36',
                        );
                    }

                    break;
                }
            }
        }
    }

    return grid;
}

/** Darken bone towards a tea-brown stain. */
function mixStain(colour: string): string {
    const stains: Record<string, string> = {
        '#a08f6a': '#94805a',
        '#b5a47e': '#a38d62',
        '#c6b58e': '#b09a6c',
        '#d4c49e': '#bda676',
        '#dfd1ae': '#c8b282',
        '#e8dcbf': '#d2bd8e',
        '#f1e8d2': '#dccaa0',
    };

    return stains[colour] ?? colour;
}
