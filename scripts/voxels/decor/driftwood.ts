/**
 * Shared driftwood builder for the arch and the branch: limbs are smooth
 * curves through control points with tapering radii, spiralling bark
 * ridges and lumps, flat pale faces where they snapped off, and knots.
 * The wood is bleached silver-grey on top, warm brown on the sides and
 * dark and wet underneath, with moss and biofilm here and there.
 */
import { Grid, hash, shade } from '../voxel-tools.ts';
import type { Cell } from './shapes.ts';
import { fbm, noise, sequence, Solid } from './shapes.ts';

export type Limb = {
    /** Control points the limb's centre passes through, from its base. */
    points: Cell[];
    /** Radius at each control point. */
    radii: number[];
    /** How quickly the bark ridges spiral round the limb, in turns per cell. */
    twist?: number;
    /** Ends in a flat, snapped-off face rather than a rounded tip. */
    broken?: boolean;
};

export type DriftwoodOptions = {
    size: Cell;
    limbs: Limb[];
    /** Plant spots: kept clear above, with wood directly beneath. */
    anchors: Cell[];
    seed: number;
    /** How many knots to scatter along the thicker limbs. */
    knots: number;
    /** Rotted-out holes bored through the wood, as centres and radii. */
    hollows?: { centre: Cell; radii: Cell }[];
};

type Sample = {
    position: Cell;
    tangent: Cell;
    normal: Cell;
    binormal: Cell;
    radius: number;
    along: number;
};

const add = (a: Cell, b: Cell, scale = 1): Cell => [
    a[0] + b[0] * scale,
    a[1] + b[1] * scale,
    a[2] + b[2] * scale,
];
const subtract = (a: Cell, b: Cell): Cell => [
    a[0] - b[0],
    a[1] - b[1],
    a[2] - b[2],
];
const dot = (a: Cell, b: Cell) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Cell, b: Cell): Cell => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
];
const normalise = (a: Cell): Cell => {
    const length = Math.hypot(...a) || 1;

    return [a[0] / length, a[1] / length, a[2] / length];
};

/** Catmull-Rom position between p1 and p2. */
function catmullRom(p0: Cell, p1: Cell, p2: Cell, p3: Cell, t: number): Cell {
    const t2 = t * t;
    const t3 = t2 * t;

    return [0, 1, 2].map(
        (i) =>
            0.5 *
            (2 * p1[i] +
                (-p0[i] + p2[i]) * t +
                (2 * p0[i] - 5 * p1[i] + 4 * p2[i] - p3[i]) * t2 +
                (-p0[i] + 3 * p1[i] - 3 * p2[i] + p3[i]) * t3),
    ) as Cell;
}

/** Points every half cell along a limb, each with a frame and radius. */
function sampleLimb(limb: Limb): Sample[] {
    const { points, radii } = limb;
    const positions: { position: Cell; radius: number }[] = [];

    for (let segment = 0; segment < points.length - 1; segment++) {
        const p0 = points[Math.max(0, segment - 1)];
        const p1 = points[segment];
        const p2 = points[segment + 1];
        const p3 = points[Math.min(points.length - 1, segment + 2)];
        const steps = Math.max(
            2,
            Math.ceil(Math.hypot(...subtract(p2, p1)) * 2),
        );

        for (let step = 0; step < steps; step++) {
            const t = step / steps;
            positions.push({
                position: catmullRom(p0, p1, p2, p3, t),
                radius:
                    radii[segment] + (radii[segment + 1] - radii[segment]) * t,
            });
        }
    }

    positions.push({
        position: points[points.length - 1],
        radius: radii[radii.length - 1],
    });

    let along = 0;

    return positions.map(({ position, radius }, index) => {
        const next =
            positions[Math.min(positions.length - 1, index + 1)].position;
        const previous = positions[Math.max(0, index - 1)].position;
        const tangent = normalise(subtract(next, previous));
        const reference: Cell =
            Math.abs(tangent[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
        const normal = normalise(
            subtract(reference, [
                tangent[0] * dot(reference, tangent),
                tangent[1] * dot(reference, tangent),
                tangent[2] * dot(reference, tangent),
            ]),
        );

        if (index > 0) {
            along += Math.hypot(...subtract(position, previous));
        }

        return {
            position,
            tangent,
            normal,
            binormal: cross(tangent, normal),
            radius,
            along,
        };
    });
}

/** Bleached grey (top) through warm brown (sides) to dark wet wood (underneath). */
const BLEACHED = ['#8c877d', '#9a948a', '#a8a296', '#b5afa2', '#c2bcae'];
const WARM = ['#6a5a4a', '#776653', '#84725e', '#917f69', '#9d8b75'];
const WET = ['#33281f', '#3c2f24', '#46372a', '#504032', '#5a4939'];
const BREAK = ['#c7b089', '#b89f78', '#a88f69', '#d4c09b'];
const MOSS = ['#4c6a2c', '#5a7a34', '#6a8a3e', '#7c9a4a'];
const BIOFILM = ['#4f4a2a', '#5c5631', '#6a6238'];
const KNOT = ['#2e2219', '#4a3626', '#6a5039'];

export function driftwood(options: DriftwoodOptions): Grid {
    const [width, height, depth] = options.size;
    const { anchors, seed } = options;
    const grid = new Grid(width, height, depth);
    const solid = new Solid(width, height, depth);
    const total = width * height * depth;
    const index = (x: number, y: number, z: number) =>
        (y * depth + z) * width + x;

    /** Per cell: how deep inside its limb it is (0 centre, 1 bark), and where. */
    const ratio = new Float32Array(total).fill(Infinity);
    const alongAt = new Float32Array(total);
    const angleAt = new Float32Array(total);
    const limbAt = new Uint8Array(total);
    const breakAt = new Uint8Array(total);

    const reserved = (x: number, y: number, z: number) =>
        anchors.some(
            ([ax, ay, az]) =>
                y >= ay && y <= ay + 16 && Math.hypot(x - ax, z - az) <= 4.5,
        );

    const sampled = options.limbs.map(sampleLimb);

    sampled.forEach((samples, limbIndex) => {
        const limb = options.limbs[limbIndex];
        const twist = limb.twist ?? 0.05;
        const end = samples[samples.length - 1];

        for (const sample of samples) {
            const { position, radius } = sample;
            const reach = Math.ceil(radius * 1.3 + 1.5);

            for (
                let y = Math.floor(position[1] - reach);
                y <= position[1] + reach;
                y++
            ) {
                for (
                    let z = Math.floor(position[2] - reach);
                    z <= position[2] + reach;
                    z++
                ) {
                    for (
                        let x = Math.floor(position[0] - reach);
                        x <= position[0] + reach;
                        x++
                    ) {
                        if (!solid.inside(x, y, z)) {
                            continue;
                        }

                        const offset = subtract([x, y, z], position);

                        if (
                            limb.broken &&
                            dot(
                                subtract([x, y, z], end.position),
                                end.tangent,
                            ) > 0
                        ) {
                            continue;
                        }

                        const angle = Math.atan2(
                            dot(offset, sample.binormal),
                            dot(offset, sample.normal),
                        );
                        const distance = Math.hypot(...offset);
                        const ridges =
                            radius > 2
                                ? 0.11 *
                                      Math.sin(
                                          angle * 7 +
                                              sample.along *
                                                  twist *
                                                  Math.PI *
                                                  2,
                                      ) +
                                  0.04 *
                                      Math.sin(angle * 13 - sample.along * 0.21)
                                : 0;
                        const lumps =
                            radius > 1.5
                                ? (fbm(x / 7, y / 7, z / 7, seed + limbIndex) -
                                      0.5) *
                                  0.3
                                : 0;
                        const shape = Math.max(
                            0.4,
                            radius * (1 + ridges + lumps),
                        );
                        const depthRatio = distance / shape;
                        const cell = index(x, y, z);

                        if (depthRatio < ratio[cell]) {
                            ratio[cell] = depthRatio;
                            alongAt[cell] = sample.along;
                            angleAt[cell] =
                                angle + sample.along * twist * Math.PI * 2;
                            limbAt[cell] = limbIndex;
                            breakAt[cell] =
                                limb.broken &&
                                dot(
                                    subtract([x, y, z], end.position),
                                    end.tangent,
                                ) > -1.2
                                    ? 1
                                    : 0;
                        }
                    }
                }
            }
        }
    });

    for (let y = 0; y < height; y++) {
        for (let z = 0; z < depth; z++) {
            for (let x = 0; x < width; x++) {
                if (ratio[index(x, y, z)] <= 1 && !reserved(x, y, z)) {
                    solid.put(x, y, z);
                }
            }
        }
    }

    for (const [ax, ay, az] of anchors) {
        solid.put(ax, ay - 1, az);
        ratio[index(ax, ay - 1, az)] = Math.min(
            ratio[index(ax, ay - 1, az)],
            1,
        );
    }

    const hollows = options.hollows ?? [];
    const inHollow = (x: number, y: number, z: number, margin: number) =>
        hollows.some(
            ({ centre, radii }) =>
                ((x - centre[0]) / (radii[0] + margin)) ** 2 +
                    ((y - centre[1]) / (radii[1] + margin)) ** 2 +
                    ((z - centre[2]) / (radii[2] + margin)) ** 2 <
                1,
        );

    for (const { centre, radii } of hollows) {
        solid.ellipsoid(
            centre,
            radii,
            0,
            (x, y, z) =>
                (noise(x / 2.5, y / 2.5, z / 2.5, seed + 21) - 0.5) * 0.5,
        );
    }

    // Knots: dark whorls on the bark of the thicker limbs.
    const random = sequence(seed);
    const knots: { centre: Cell; radius: number }[] = [];

    for (
        let attempt = 0;
        knots.length < options.knots && attempt < 500;
        attempt++
    ) {
        const limbIndex = Math.floor(random() * sampled.length);
        const samples = sampled[limbIndex];
        const sample = samples[Math.floor(random() * samples.length)];

        if (sample.radius < 2.5) {
            continue;
        }

        const angle = random() * Math.PI * 2;
        const centre = add(
            sample.position,
            add(
                [
                    sample.normal[0] * Math.cos(angle),
                    sample.normal[1] * Math.cos(angle),
                    sample.normal[2] * Math.cos(angle),
                ],
                sample.binormal,
                Math.sin(angle),
            ),
            sample.radius,
        );
        knots.push({ centre, radius: 1.6 + random() * 1.6 });

        // A knot bulges slightly out of the bark.
        solid.ellipsoid(centre.map(Math.round) as Cell, [1.6, 1.6, 1.6], 1);
    }

    keepLargestPiece(solid);

    // Smooth surface normals from the surrounding wood.
    const normalAt = (x: number, y: number, z: number): Cell => {
        let normal: Cell = [0, 0, 0];

        for (let dy = -2; dy <= 2; dy++) {
            for (let dz = -2; dz <= 2; dz++) {
                for (let dx = -2; dx <= 2; dx++) {
                    if (solid.at(x + dx, y + dy, z + dz)) {
                        normal = add(normal, [-dx, -dy, -dz]);
                    }
                }
            }
        }

        return normalise(normal);
    };

    const pick = (colours: string[], value: number) =>
        colours[
            Math.max(
                0,
                Math.min(
                    colours.length - 1,
                    Math.floor(value * colours.length),
                ),
            )
        ];

    solid.each((x, y, z) => {
        if (!solid.isSurface(x, y, z)) {
            grid.set(x, y, z, WET[1]);

            return;
        }

        const cell = index(x, y, z);
        const along = alongAt[cell];
        const angle = angleAt[cell];
        const limb = limbAt[cell];
        const [, up] = normalAt(x, y, z);
        // Long streaks along the limb, varying round it.
        const grain =
            fbm(
                along / 16,
                Math.cos(angle) * 2.5,
                Math.sin(angle) * 2.5 + limb * 5,
                seed + 7,
            ) +
            (hash(x, y, z, seed) - 0.5) * 0.06;
        const knot = knots.find(
            ({ centre, radius }) =>
                Math.hypot(...subtract([x, y, z], centre)) <= radius + 1,
        );
        let colour: string;

        if (inHollow(x, y, z, 1.6)) {
            // Rotten, damp wood lining a hole.
            colour = pick(
                WET,
                hash(x, y, z, seed + 22) * 0.7 +
                    (inHollow(x, y, z, 0.8) ? 0 : 0.3),
            );
        } else if (breakAt[cell]) {
            // Growth rings on the snapped-off face.
            const ring = Math.floor(
                ratio[cell] * 5 + hash(x, y, z, seed + 9) * 0.6,
            );
            colour = BREAK[ring % BREAK.length];
        } else if (knot !== undefined) {
            const distance = Math.hypot(...subtract([x, y, z], knot.centre));
            colour = pick(KNOT, distance / (knot.radius + 1));
        } else if (up > 0.35) {
            colour = pick(BLEACHED, grain + (up - 0.35) * 0.4);
        } else if (up > -0.3 && y > 3) {
            colour = pick(WARM, grain);
        } else {
            colour = pick(WET, grain);
        }

        // Shadowed grooves between the ridges of the grain.
        if (
            !breakAt[cell] &&
            knot === undefined &&
            Math.sin(angle * 7) < -0.75
        ) {
            colour = shade(colour, 0.74);
        }

        // Moss on the sunlit tops, biofilm in the damp underneath.
        if (!breakAt[cell] && knot === undefined) {
            const moss = noise(x / 5, y / 5, z / 5, seed + 11);

            if (up > 0.45 && moss > 0.66) {
                colour = pick(
                    MOSS,
                    hash(x, y, z, seed + 12) * 0.6 + (moss - 0.66) * 3,
                );
            } else if (
                up < 0.1 &&
                y < 8 &&
                noise(x / 4, y / 4, z / 4, seed + 13) > 0.55
            ) {
                colour = pick(BIOFILM, hash(x, y, z, seed + 14));
            }
        }

        grid.set(x, y, z, colour);
    });

    // Tufts of moss poking up from the mossiest tops (never on a plant spot).
    solid.each((x, y, z) => {
        if (
            !solid.at(x, y + 1, z) &&
            !reserved(x, y + 1, z) &&
            noise(x / 5, y / 5, z / 5, seed + 11) > 0.72 &&
            hash(x, y, z, seed + 15) < 0.35
        ) {
            grid.fill(x, y + 1, z, pick(MOSS, hash(x, y, z, seed + 16)));
        }
    });

    return grid;
}

/** Drop any crumbs not joined face-to-face to the largest piece of wood. */
function keepLargestPiece(solid: Solid): void {
    const { width, height, depth, cells } = solid;
    const piece = new Int32Array(cells.length).fill(-1);
    const sizes: number[] = [];

    for (let start = 0; start < cells.length; start++) {
        if (!cells[start] || piece[start] >= 0) {
            continue;
        }

        const id = sizes.length;
        const stack = [start];
        piece[start] = id;
        let size = 0;

        while (stack.length > 0) {
            const cell = stack.pop() as number;
            const x = cell % width;
            const z = Math.floor(cell / width) % depth;
            const y = Math.floor(cell / (width * depth));
            size++;

            for (const [dx, dy, dz] of [
                [1, 0, 0],
                [-1, 0, 0],
                [0, 1, 0],
                [0, -1, 0],
                [0, 0, 1],
                [0, 0, -1],
            ]) {
                const [nx, ny, nz] = [x + dx, y + dy, z + dz];

                if (
                    nx < 0 ||
                    ny < 0 ||
                    nz < 0 ||
                    nx >= width ||
                    ny >= height ||
                    nz >= depth
                ) {
                    continue;
                }

                const neighbour = (ny * depth + nz) * width + nx;

                if (cells[neighbour] && piece[neighbour] < 0) {
                    piece[neighbour] = id;
                    stack.push(neighbour);
                }
            }
        }

        sizes.push(size);
    }

    const largest = sizes.indexOf(Math.max(...sizes));

    for (let cell = 0; cell < cells.length; cell++) {
        if (cells[cell] && piece[cell] !== largest) {
            cells[cell] = 0;
        }
    }
}
