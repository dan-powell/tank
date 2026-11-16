import {
    clearShaft,
    fbm,
    noise,
    pick,
    sequence,
    Volume,
    support,
} from '../decor-tools.ts';
import type { Cell } from '../decor-tools.ts';
import { Grid, hash, mix, shade } from '../voxel-tools.ts';

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
export function castle(): Grid {
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
