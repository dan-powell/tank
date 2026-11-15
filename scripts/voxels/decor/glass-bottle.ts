import { Grid, hash } from '../voxel-tools.ts';
import { fbm, noise, Solid } from './shapes.ts';

/** Body, shoulder, neck and lip radii along the bottle, from the base (0) to the mouth. */
function outerRadius(along: number): number {
    if (along < 44) {
        // A slightly rounded heel where the body meets the base.
        return along < 2.5 ? 11.6 + along * 0.36 : 12.5;
    }

    if (along < 54) {
        const t = (along - 44) / 10;

        return 5.6 + (12.5 - 5.6) * (1 - t * t * (3 - 2 * t));
    }

    // A thicker lip ring at the mouth.
    return along > 60.5 ? 6.6 : 5.6;
}

/**
 * An old green glass bottle lying on its side, settled into the sand with
 * its neck raised a little. It is hollow, so small fish and shrimp can swim
 * in through the open mouth, where a rolled message tied with red string
 * still pokes out. The glass is shaded to read as glass without
 * transparency: pale streaks where it catches the light, deeper green at
 * the edges, a peeling paper label, a dusting of biofilm and sediment
 * settled inside.
 */
export function glassBottle(): Grid {
    const [width, height, depth] = [70, 30, 32];
    const grid = new Grid(width, height, depth);
    const GLASS = 1;
    const SEDIMENT = 2;
    const SCROLL = 3;
    const STRING = 4;
    const solid = new Solid(width, height, depth);

    // The bottle's axis: base at the left, neck raised 4° and turned 6° towards the viewer.
    const base = [2, 11.6, 13];
    const [pitch, yaw] = [(4 * Math.PI) / 180, (6 * Math.PI) / 180];
    const axis = [
        Math.cos(pitch) * Math.cos(yaw),
        Math.sin(pitch),
        Math.cos(pitch) * Math.sin(yaw),
    ];
    const length = 63;
    const wall = 1.7;

    /** Position along the axis, distance from it, and angle around it (0 = up, π/2 = towards the viewer). */
    const local = (x: number, y: number, z: number) => {
        const [dx, dy, dz] = [x - base[0], y - base[1], z - base[2]];
        const along = dx * axis[0] + dy * axis[1] + dz * axis[2];
        const [rx, ry, rz] = [
            dx - axis[0] * along,
            dy - axis[1] * along,
            dz - axis[2] * along,
        ];
        // "Sideways" is the horizontal direction across the axis, towards the viewer.
        const side = [-axis[2], 0, axis[0]];
        const up = ry;
        const across = rx * side[0] + rz * side[2];

        return {
            along,
            radius: Math.hypot(rx, ry, rz),
            angle: Math.atan2(across, up),
        };
    };

    for (let y = 0; y < height; y++) {
        for (let z = 0; z < depth; z++) {
            for (let x = 0; x < width; x++) {
                const { along, radius } = local(x, y, z);

                if (along < 0 || along > length) {
                    continue;
                }

                const outer = outerRadius(along);
                // The punt: the base pushes up into the bottle in a shallow dome.
                const punt = 2.2 * Math.max(0, 1 - (radius / 9) ** 2);

                if (
                    radius <= outer &&
                    (radius >= outer - wall || along <= wall + punt)
                ) {
                    solid.put(x, y, z, GLASS);
                }
            }
        }
    }

    // Sediment settled along the inside, deepest in the body.
    for (let y = 0; y < height; y++) {
        for (let z = 0; z < depth; z++) {
            for (let x = 0; x < width; x++) {
                if (solid.at(x, y, z)) {
                    continue;
                }

                const { along, radius } = local(x, y, z);
                const floor = 3.2 + (noise(x / 4, 0, z / 4, 5) - 0.5) * 1.6;

                if (
                    along > 2 &&
                    along < 50 &&
                    radius < outerRadius(along) &&
                    y <= floor
                ) {
                    solid.put(x, y, z, SEDIMENT);
                }
            }
        }
    }

    // A rolled message lying in the neck, poking out of the mouth, tied with string.
    const scrollRadius = 1.6;

    for (let y = 0; y < height; y++) {
        for (let z = 0; z < depth; z++) {
            for (let x = 0; x < width; x++) {
                const { along, radius, angle } = local(x, y, z);

                if (along < 46 || along > 68) {
                    continue;
                }

                // The scroll's own axis runs along the bottom of the neck.
                const floorOfNeck = 5.6 - wall - scrollRadius;
                const sy = radius * Math.cos(angle) + floorOfNeck;
                const sx = radius * Math.sin(angle);

                if (Math.hypot(sx, sy) <= scrollRadius && !solid.at(x, y, z)) {
                    solid.put(
                        x,
                        y,
                        z,
                        Math.abs(along - 64.5) < 0.9 ? STRING : SCROLL,
                    );
                }
            }
        }
    }

    // ------------------------------------------------ colours

    const greens = [
        '#123d27',
        '#174a30',
        '#1d5a3a',
        '#256b45',
        '#2e7b50',
        '#3a8c5d',
        '#4a9d6b',
    ];
    const highlight = ['#8fd0a4', '#bfe8c9', '#e6f8ea'];
    const lightDirection = [-0.35, 0.8, 0.5];
    const view = [0, 0, 1];
    const halfway = lightDirection.map((v, i) => v + view[i]);
    const halfwayLength = Math.hypot(...halfway);

    solid.each((x, y, z, kind) => {
        const { along, radius, angle } = local(x, y, z);

        if (kind === SEDIMENT) {
            const n = fbm(x / 3, y / 3, z / 3, 21);
            grid.set(
                x,
                y,
                z,
                n > 0.62
                    ? '#6d5a3c'
                    : n > 0.48
                      ? '#8a7650'
                      : hash(x, y, z, 22) < 0.1
                        ? '#a8946a'
                        : '#7c6946',
            );

            return;
        }

        if (kind === SCROLL) {
            const end = along > 67;
            const n = noise(x / 2, y / 2, z / 2, 31);
            grid.set(
                x,
                y,
                z,
                end
                    ? hash(x, y, z, 32) < 0.5
                        ? '#bfa678'
                        : '#a68d60'
                    : n > 0.6
                      ? '#c9b083'
                      : '#e0cda3',
            );

            return;
        }

        if (kind === STRING) {
            grid.set(x, y, z, hash(x, y, z, 33) < 0.4 ? '#8c2a22' : '#a8352a');

            return;
        }

        // Glass: is this the inner or outer skin, and which way does it face?
        const outer = outerRadius(along);
        const inner = radius < outer - wall * 0.55 && along > wall + 0.5;
        const normal = (() => {
            const [nx, ny, nz] = [
                Math.sin(angle) * -axis[2],
                Math.cos(angle),
                Math.sin(angle) * axis[0],
            ];

            return inner ? [-nx, -ny, -nz] : [nx, ny, nz];
        })();
        const facing =
            normal[0] * view[0] + normal[1] * view[1] + normal[2] * view[2];
        const specular =
            (normal[0] * halfway[0] +
                normal[1] * halfway[1] +
                normal[2] * halfway[2]) /
            halfwayLength;

        // Deeper colour at the silhouette, lighter where the glass faces the viewer.
        let shadeIndex =
            2 +
            Math.round(Math.max(0, facing) * 2.6) +
            Math.round((fbm(x / 5, y / 5, z / 5, 41) - 0.5) * 2);

        shadeIndex = inner ? shadeIndex - 2 : Math.max(1, shadeIndex);

        if (along < wall + 2.5 || (along > 60 && radius > outer - 0.9)) {
            // The thick glass of the base and the lip.
            shadeIndex -= 1;
        }

        let colour =
            greens[Math.max(0, Math.min(greens.length - 1, shadeIndex))];

        // Reflected light from the far side: a soft glow along the lower edge.
        if (!inner && Math.cos(angle) < -0.25 && facing > 0.2 && y > 2) {
            colour = greens[Math.min(greens.length - 1, shadeIndex + 2)];
        }

        // Long, thin streaks where the glass catches the light, broken here and there.
        const streakBreak = noise(along / 5, 0, 0, 43);
        const streakWidth = 0.75 / Math.max(outer, 4);

        if (
            !inner &&
            Math.abs(angle - 0.8) < streakWidth * 1.3 &&
            streakBreak > 0.22
        ) {
            colour =
                highlight[Math.abs(angle - 0.8) < streakWidth * 0.6 ? 2 : 1];
        } else if (
            !inner &&
            Math.abs(angle - 1.3) < streakWidth * 0.7 &&
            streakBreak > 0.4
        ) {
            colour = highlight[0];
        } else if (!inner && specular > 0.9) {
            colour = greens[greens.length - 1];
        }

        // A peeling paper label on the front of the body.
        const labelAngle = angle - 1.75;

        if (!inner && along > 12 && along < 36 && Math.abs(labelAngle) < 1) {
            const ragged =
                (noise(along / 7, labelAngle * 2, 0.5, 51) - 0.5) * 5;
            const across = Math.abs(labelAngle) * outer;

            if (
                Math.abs(along - 24) + ragged < 10 &&
                across + ragged * 0.6 < 9
            ) {
                const band = Math.abs(along - 24) < 2;
                const print =
                    across < 5 &&
                    Math.abs(along - 24) > 3.5 &&
                    Math.abs(along - 24) < 7.5;
                const stain = fbm(x / 3, y / 3, z / 3, 52);
                colour = band
                    ? stain > 0.55
                        ? '#7a3a2c'
                        : '#94493a'
                    : print &&
                        hash(Math.round(along), Math.round(across), 0, 53) <
                            0.35
                      ? '#6e5e44'
                      : stain > 0.62
                        ? '#a89268'
                        : stain > 0.45
                          ? '#c4ae84'
                          : '#d6c39a';
            }
        }

        // Biofilm and fine algae over the upper glass, thicker towards the base.
        const film = fbm(x / 4, y / 4, z / 4, 61) + (1 - along / length) * 0.12;

        if (!inner && Math.cos(angle) > 0.35 && film > 0.7) {
            colour = hash(x, y, z, 62) < 0.5 ? '#5a6b3a' : '#4b5c32';
        } else if (!inner && y <= 2 && hash(x, y, z, 63) < 0.45) {
            // Silt clinging along the sand line.
            colour = '#4f5a3c';
        }

        grid.set(x, y, z, colour);
    });

    return grid;
}
