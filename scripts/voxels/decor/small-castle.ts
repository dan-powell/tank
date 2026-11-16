import { Grid, hash, mix, shade } from '../voxel-tools.ts';
import { fbm, noise, Solid } from './shapes.ts';

/** What each solid cell is made of, so it can be coloured afterwards. */
const ROCK = 1;
const MASONRY = 2;
const ROOF = 3;
const IRON = 4;
const POLE = 5;
const FLAG = 6;
const WINDOW_BACK = 7;
const DOOR = 8;

type Tower = {
    centreX: number;
    centreZ: number;
    radius: number;
    top: number;
    /** Height of a conical roof, or 0 for an open, crenellated top. */
    roof: number;
};

/**
 * A classic aquarium castle on a rocky footing: a tall keep at the back with
 * a turret, two round front towers (one roofed and flying a pennant, one
 * open with a plant spot on its battlements), and a crenellated curtain
 * wall with an arched gateway, a raised portcullis and a postern fish can
 * swim through. Every stone is its own colour, with mortar courses, arrow
 * slits, lit windows, weathering and algae creeping up from the base.
 */
export function smallCastle(): Grid {
    const [width, height, depth] = [75, 85, 55];
    const grid = new Grid(width, height, depth);
    const solid = new Solid(width, height, depth);
    /** Tower each masonry cell belongs to (for its stone courses), or -1 for walls. */
    const towerOf = new Int8Array(width * height * depth).fill(-1);
    const index = (x: number, y: number, z: number) =>
        (y * depth + z) * width + x;

    const towers: Tower[] = [
        { centreX: 13, centreZ: 42, radius: 10, top: 56, roof: 21 },
        { centreX: 61, centreZ: 42, radius: 10, top: 50, roof: 0 },
        { centreX: 52, centreZ: 9, radius: 7, top: 70, roof: 13 },
    ];

    const masonry = (x: number, y: number, z: number, tower = -1) => {
        if (solid.inside(x, y, z)) {
            solid.put(x, y, z, MASONRY);
            towerOf[index(x, y, z)] = tower;
        }
    };
    const clear = (x: number, y: number, z: number) => {
        if (solid.inside(x, y, z)) {
            solid.put(x, y, z, 0);
            towerOf[index(x, y, z)] = -1;
        }
    };
    /** Merlons along a run: solid for 4 cells, open for 3. */
    const merlon = (u: number) => ((u % 7) + 7) % 7 < 4;

    // ------------------------------------------------ keep, walls and towers

    /** An axis-aligned block of masonry with merlons along its top edges. */
    const wall = (
        x0: number,
        z0: number,
        x1: number,
        z1: number,
        top: number,
        battlements: ('front' | 'back' | 'left' | 'right')[],
    ) => {
        for (let y = 0; y < top; y++) {
            for (let z = z0; z <= z1; z++) {
                for (let x = x0; x <= x1; x++) {
                    masonry(x, y, z);
                }
            }
        }

        for (let y = top; y < top + 4; y++) {
            for (const side of battlements) {
                for (let along = 0; along <= 1; along++) {
                    if (side === 'front' || side === 'back') {
                        const z = side === 'front' ? z1 - along : z0 + along;

                        for (let x = x0; x <= x1; x++) {
                            if (merlon(x - x0) || x === x0 || x === x1) {
                                masonry(x, y, z);
                            }
                        }
                    } else {
                        const x = side === 'right' ? x1 - along : x0 + along;

                        for (let z = z0; z <= z1; z++) {
                            if (merlon(z - z0) || z === z0 || z === z1) {
                                masonry(x, y, z);
                            }
                        }
                    }
                }
            }
        }
    };

    // The keep at the back, with walls around a courtyard in front of it.
    wall(22, 3, 50, 25, 62, ['front', 'left', 'back']);
    wall(5, 13, 11, 40, 30, ['left']);
    wall(5, 9, 24, 15, 30, ['back']);
    wall(58, 15, 64, 40, 28, ['right']);
    wall(48, 15, 64, 20, 28, []);
    wall(13, 36, 61, 46, 32, ['front']);

    towers.forEach(({ centreX, centreZ, radius, top, roof }, tower) => {
        for (let y = 0; y < top; y++) {
            // A corbelled band just below the top juts out by a cell.
            const reach = y >= top - 4 ? radius + 1 : radius;

            for (let z = centreZ - reach; z <= centreZ + reach; z++) {
                for (let x = centreX - reach; x <= centreX + reach; x++) {
                    if (Math.hypot(x - centreX, z - centreZ) <= reach + 0.3) {
                        masonry(x, y, z, tower);
                    }
                }
            }
        }

        if (roof > 0) {
            // A conical roof with a little overhang.
            for (let y = top; y < top + roof; y++) {
                const reach = (radius + 2.5) * (1 - (y - top) / roof);

                for (
                    let z = centreZ - radius - 3;
                    z <= centreZ + radius + 3;
                    z++
                ) {
                    for (
                        let x = centreX - radius - 3;
                        x <= centreX + radius + 3;
                        x++
                    ) {
                        if (Math.hypot(x - centreX, z - centreZ) <= reach) {
                            solid.put(x, y, z, ROOF);
                        }
                    }
                }
            }

            return;
        }

        // An open top: a crenellated parapet ring around a flat floor.
        for (let y = top; y < top + 6; y++) {
            for (let z = centreZ - radius - 1; z <= centreZ + radius + 1; z++) {
                for (
                    let x = centreX - radius - 1;
                    x <= centreX + radius + 1;
                    x++
                ) {
                    const distance = Math.hypot(x - centreX, z - centreZ);
                    const around =
                        Math.atan2(z - centreZ, x - centreX) * radius;

                    if (
                        distance <= radius + 1.3 &&
                        distance > radius - 1.5 &&
                        (y < top + 2 || merlon(Math.floor(around + 40)))
                    ) {
                        masonry(x, y, z, tower);
                    }
                }
            }
        }
    });

    // ------------------------------------------------ rocky footing

    // A mound of rock around the walls, ragged at its edges and filling the courtyard.
    for (let z = 0; z < depth; z++) {
        for (let x = 0; x < width; x++) {
            let nearest = Infinity;

            for (let dz = -8; dz <= 8; dz++) {
                for (let dx = -8; dx <= 8; dx++) {
                    if (solid.at(x + dx, 0, z + dz) === MASONRY) {
                        nearest = Math.min(nearest, Math.hypot(dx, dz));
                    }
                }
            }

            const courtyard = x > 8 && x < 62 && z > 10 && z < 40;
            const margin = 2 + fbm(x / 5, 1, z / 5, 4) * 6;

            if (!courtyard && nearest > margin) {
                continue;
            }

            const edge = courtyard ? 1 : 1 - nearest / (margin + 0.01);
            const rise =
                1 + (2 + fbm(x / 6, 0, z / 6, 3) * 4) * Math.min(1, edge * 2.5);

            for (let y = 0; y < rise; y++) {
                if (solid.at(x, y, z) === 0) {
                    solid.put(x, y, z, ROCK);
                }
            }
        }
    }

    // A few loose stones fallen from the walls.
    for (const [stoneX, stoneZ, size] of [
        [3, 50, 2],
        [70, 30, 1.6],
        [28, 52, 1.5],
        [47, 51, 1.8],
    ]) {
        solid.ellipsoid(
            [stoneX, 1.5, stoneZ],
            [size + 0.6, size, size],
            ROCK,
            (x, y, z) => (noise(x, y, z, 6) - 0.5) * 0.6,
        );
    }

    // ------------------------------------------------ openings

    /** Carve an arch (flat sides, round top) through z0..z1 at x centre cx. */
    const arch = (
        centreX: number,
        halfWidth: number,
        springing: number,
        z0: number,
        z1: number,
        backFill = 0,
    ) => {
        for (let z = z0; z <= z1; z++) {
            for (let y = 0; y <= springing + halfWidth; y++) {
                for (
                    let x = centreX - halfWidth;
                    x <= centreX + halfWidth;
                    x++
                ) {
                    const open =
                        y <= springing ||
                        Math.hypot(x - centreX, y - springing) <=
                            halfWidth + 0.2;

                    if (open && (solid.at(x, y, z) === MASONRY || y > 1)) {
                        clear(x, y, z);
                    }
                }
            }
        }

        if (backFill) {
            for (let y = 0; y <= springing + halfWidth; y++) {
                for (
                    let x = centreX - halfWidth;
                    x <= centreX + halfWidth;
                    x++
                ) {
                    if (
                        y <= springing ||
                        Math.hypot(x - centreX, y - springing) <=
                            halfWidth + 0.2
                    ) {
                        solid.put(x, y, z0 - 1, backFill);
                    }
                }
            }
        }
    };

    /** The same as arch(), but running along x (through a wall that faces sideways). */
    const sideArch = (
        centreZ: number,
        halfWidth: number,
        springing: number,
        x0: number,
        x1: number,
    ) => {
        for (let x = x0; x <= x1; x++) {
            for (let y = 3; y <= springing + halfWidth; y++) {
                for (
                    let z = centreZ - halfWidth;
                    z <= centreZ + halfWidth;
                    z++
                ) {
                    if (
                        y <= springing ||
                        Math.hypot(z - centreZ, y - springing) <=
                            halfWidth + 0.2
                    ) {
                        clear(x, y, z);
                    }
                }
            }
        }
    };

    // The gateway through the curtain wall, opening onto the courtyard.
    arch(37, 7, 15, 36, 46);

    for (let y = 3; y < 9; y++) {
        for (let x = 30; x <= 44; x++) {
            for (let z = 26; z <= 46; z++) {
                if (solid.at(x, y, z) === ROCK) {
                    solid.put(x, y, z, 0);
                }
            }
        }
    }

    // A raised portcullis hanging in the arch.
    for (let x = 31; x <= 43; x++) {
        for (let y = 17; y <= 22; y++) {
            const inArch = Math.hypot(x - 37, y - 15) <= 7.2 || y <= 15;

            if (inArch && ((x - 31) % 3 === 0 || y === 18 || y === 21)) {
                solid.put(x, y, 41, IRON);
            }
        }
    }

    // The keep's great door, at the back of the courtyard.
    arch(36, 4, 11, 22, 25, DOOR);

    // A postern through the left wall, and a hole low in the right one.
    sideArch(27, 5, 9, 5, 11);
    sideArch(28, 4, 7, 58, 64);

    /** A window recessed `deep` cells into a face looking towards the viewer. */
    const window = (
        centreX: number,
        bottom: number,
        tall: number,
        halfWidth: number,
        front: number,
        deep: number,
    ) => {
        for (let z = front - deep + 1; z <= front; z++) {
            for (let y = bottom; y < bottom + tall; y++) {
                for (
                    let x = centreX - halfWidth;
                    x <= centreX + halfWidth;
                    x++
                ) {
                    const rounded =
                        y < bottom + tall - halfWidth - 1 ||
                        Math.hypot(
                            x - centreX,
                            y - (bottom + tall - halfWidth - 1),
                        ) <=
                            halfWidth + 0.3;

                    if (rounded) {
                        clear(x, y, z);
                    }
                }
            }
        }

        for (let y = bottom; y < bottom + tall; y++) {
            for (let x = centreX - halfWidth; x <= centreX + halfWidth; x++) {
                if (solid.at(x, y, front - deep) !== 0) {
                    solid.put(x, y, front - deep, WINDOW_BACK);
                }
            }
        }
    };

    // Lit windows: two in the keep, one in the roofed tower, one in the turret.
    window(29, 42, 8, 1, 25, 3);
    window(43, 42, 8, 1, 25, 3);
    window(36, 51, 6, 1, 25, 3);
    window(13, 38, 7, 1, 52, 3);
    window(52, 56, 6, 1, 16, 3);

    // Arrow slits.
    window(61, 26, 6, 0, 52, 3);
    window(61, 38, 5, 0, 52, 3);
    window(13, 22, 6, 0, 52, 3);
    window(22, 23, 5, 0, 46, 2);
    window(52, 23, 5, 0, 46, 2);
    window(29, 30, 5, 0, 25, 2);
    window(43, 30, 5, 0, 25, 2);

    // A pennant on the roofed tower.
    const [flagTower] = towers;
    const tip = flagTower.top + flagTower.roof;

    for (let y = tip - 2; y < Math.min(height, tip + 7); y++) {
        solid.put(flagTower.centreX, y, flagTower.centreZ, POLE);
    }

    for (let x = 1; x <= 7; x++) {
        const droop = Math.floor(x / 3);

        for (let y = tip + 2; y < tip + 6 - Math.floor(x / 4); y++) {
            const wave = Math.round(Math.sin(x * 0.9));

            solid.put(
                flagTower.centreX + x,
                y - droop + 1,
                flagTower.centreZ + wave,
                FLAG,
            );
        }
    }

    // ------------------------------------------------ colours

    const stones = [
        '#7f786c',
        '#8c8476',
        '#978f80',
        '#a29a89',
        '#ada593',
        '#878274',
        '#9a8f7b',
        '#8a8578',
    ];
    const mortar = '#5f5a51';
    const algae = ['#41602f', '#52733a', '#638646', '#3a5229'];
    const moss = ['#6e8f45', '#7fa04f'];
    const rock = ['#5e5a52', '#6b665c', '#787266', '#545049'];
    const tiles = ['#9a3f2e', '#a94a35', '#8b3727', '#b5583f'];

    solid.each((x, y, z, value) => {
        let colour: string;
        const grain = noise(x / 2, y / 2, z / 2, 7);
        const open = !solid.at(x, y + 1, z);

        if (value === ROCK) {
            colour = rock[Math.floor(fbm(x / 3, y / 3, z / 3, 9) * 3.99)];

            if (open && noise(x / 4, 0, z / 4, 13) > 0.55) {
                colour = algae[Math.floor(hash(x, y, z, 14) * 4)];
            }
        } else if (value === ROOF) {
            const tower = towers.find(
                (candidate) =>
                    candidate.roof > 0 &&
                    Math.hypot(x - candidate.centreX, z - candidate.centreZ) <=
                        candidate.radius + 4 &&
                    y >= candidate.top,
            ) as Tower;
            const around = Math.atan2(z - tower.centreZ, x - tower.centreX);
            const course = Math.floor((y - tower.top) / 2);
            const tile = Math.floor(around * 4 + (course % 2) * 0.5);
            colour = tiles[Math.floor(hash(tile, course, 0, 21) * 4)];

            if ((y - tower.top) % 2 === 0) {
                colour = shade(colour, 0.8);
            }

            if (y === tower.top) {
                colour = '#5c2a20';
            }
        } else if (value === IRON) {
            colour = hash(x, y, z, 31) < 0.3 ? '#6b4a33' : '#3b3b3e';
        } else if (value === POLE) {
            colour = '#6a4b2c';
        } else if (value === FLAG) {
            colour = (x + y) % 3 === 0 ? '#e8c45a' : '#c8343a';
        } else if (value === WINDOW_BACK) {
            colour = '#2b2420';
        } else if (value === DOOR) {
            colour =
                x % 3 === 0 ? '#4f3520' : y % 6 === 0 ? '#3b3b3e' : '#64432a';
        } else {
            // Masonry in courses: each stone its own shade, with mortar lines.
            const tower = towerOf[index(x, y, z)];
            const course = Math.floor(y / 4);
            const along =
                tower >= 0
                    ? (Math.atan2(
                          z - towers[tower].centreZ,
                          x - towers[tower].centreX,
                      ) +
                          Math.PI) *
                      towers[tower].radius
                    : x + z;
            const offset = along + (course % 2) * 3.5;
            const isMortar = y % 4 === 0 || ((offset % 7) + 7) % 7 < 1;
            const stone = Math.floor(offset / 7);

            colour = isMortar
                ? mortar
                : stones[
                      Math.floor(hash(stone, course, tower, 41) * stones.length)
                  ];

            if (!isMortar && grain > 0.68) {
                colour = shade(colour, 1.08);
            } else if (!isMortar && grain < 0.3) {
                colour = shade(colour, 0.9);
            }

            // Grime low down, algae climbing from the footing, moss on ledges.
            const climb = noise(x / 5, y / 7, z / 5, 51);

            if (y < 26 && climb > 0.42 + y / 30) {
                colour = algae[Math.floor(hash(x, y, z, 52) * 4)];
            } else if (y < 10 && !isMortar) {
                colour = mix(colour, '#4c5a3a', 0.35);
            } else if (open && noise(x / 3, y / 3, z / 3, 53) > 0.6) {
                colour = moss[Math.floor(hash(x, y, z, 54) * 2)];
            } else if (Math.abs(noise(x / 8, y / 8, z / 8, 55) - 0.5) < 0.012) {
                colour = '#4d4840';
            } else if (
                !isMortar &&
                noise(x / 1.6, y / 14, z / 1.6, 56) > 0.74
            ) {
                // Streaks where water has run down the stone.
                colour = shade(colour, 0.82);
            }
        }

        grid.set(x, y, z, colour);
    });

    return grid;
}
