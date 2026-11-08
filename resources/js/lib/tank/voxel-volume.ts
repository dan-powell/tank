import {
    BufferGeometry,
    Color,
    Float32BufferAttribute,
    SRGBColorSpace,
} from 'three';
import { VOXLoader } from 'three/examples/jsm/loaders/VOXLoader.js';
import type { DecorationDefinition, GridCell } from '@/types';

/**
 * A fully 3D voxel model on the decoration grid. Each cell holds a palette
 * index (0 = empty); cells are stored x-fastest, then z, then y.
 */
export type VoxelVolume = {
    /** Width (x), height (y) and depth (z) in cells. */
    size: GridCell;
    cells: Uint8Array;
    /** Colours by palette index; index 0 is unused. */
    palette: Color[];
};

export function createVolume(size: GridCell, palette: Color[]): VoxelVolume {
    return {
        size,
        cells: new Uint8Array(size[0] * size[1] * size[2]),
        palette,
    };
}

/** Palette index at a cell, or 0 when empty or outside the volume. */
export function voxelAt(
    volume: VoxelVolume,
    x: number,
    y: number,
    z: number,
): number {
    const [width, height, depth] = volume.size;

    if (x < 0 || y < 0 || z < 0 || x >= width || y >= height || z >= depth) {
        return 0;
    }

    return volume.cells[(y * depth + z) * width + x];
}

function setVoxel(
    volume: VoxelVolume,
    x: number,
    y: number,
    z: number,
    value: number,
): void {
    const [width, height, depth] = volume.size;

    if (x >= 0 && y >= 0 && z >= 0 && x < width && y < height && z < depth) {
        volume.cells[(y * depth + z) * width + x] = value;
    }
}

/**
 * A cell of an unrotated model after some quarter turns about the vertical
 * axis, relative to the rotated box's corner. One quarter turn matches a +90°
 * rotation about Y in three.js. Mirrors DecorationDefinition::rotateCell().
 */
export function rotateCell(
    cell: GridCell,
    size: GridCell,
    rotation: number,
): GridCell {
    const [x, y, z] = cell;
    const [width, , depth] = size;

    switch (((rotation % 4) + 4) % 4) {
        case 1:
            return [z, y, width - 1 - x];
        case 2:
            return [width - 1 - x, y, depth - 1 - z];
        case 3:
            return [depth - 1 - z, y, x];
        default:
            return [x, y, z];
    }
}

/** Width, height and depth after some quarter turns. */
export function rotatedSize(size: GridCell, rotation: number): GridCell {
    return rotation % 2 === 0 ? size : [size[2], size[1], size[0]];
}

/** A copy of the volume turned by some quarter turns about the vertical axis. */
export function rotateVolume(
    volume: VoxelVolume,
    rotation: number,
): VoxelVolume {
    if (rotation % 4 === 0) {
        return volume;
    }

    const [width, height, depth] = volume.size;
    const rotated = createVolume(
        rotatedSize(volume.size, rotation),
        volume.palette,
    );

    for (let y = 0; y < height; y++) {
        for (let z = 0; z < depth; z++) {
            for (let x = 0; x < width; x++) {
                const value = voxelAt(volume, x, y, z);

                if (value !== 0) {
                    const [rx, ry, rz] = rotateCell(
                        [x, y, z],
                        volume.size,
                        rotation,
                    );
                    setVoxel(rotated, rx, ry, rz, value);
                }
            }
        }
    }

    return rotated;
}

/** Each face: its normal, the neighbour it borders, and its corners (counter-clockwise from outside). */
const FACES: { normal: GridCell; corners: GridCell[] }[] = [
    {
        normal: [1, 0, 0],
        corners: [
            [1, 0, 1],
            [1, 0, 0],
            [1, 1, 0],
            [1, 1, 1],
        ],
    },
    {
        normal: [-1, 0, 0],
        corners: [
            [0, 0, 0],
            [0, 0, 1],
            [0, 1, 1],
            [0, 1, 0],
        ],
    },
    {
        normal: [0, 1, 0],
        corners: [
            [0, 1, 1],
            [1, 1, 1],
            [1, 1, 0],
            [0, 1, 0],
        ],
    },
    {
        normal: [0, -1, 0],
        corners: [
            [0, 0, 0],
            [1, 0, 0],
            [1, 0, 1],
            [0, 0, 1],
        ],
    },
    {
        normal: [0, 0, 1],
        corners: [
            [0, 0, 1],
            [1, 0, 1],
            [1, 1, 1],
            [0, 1, 1],
        ],
    },
    {
        normal: [0, 0, -1],
        corners: [
            [1, 0, 0],
            [0, 0, 0],
            [0, 1, 0],
            [1, 1, 0],
        ],
    },
];

/** How much each voxel's brightness varies, so flat faces read as voxels. */
const BRIGHTNESS_JITTER = 0.08;

/**
 * Turn a volume into a mesh in cell units, with its minimum corner at the
 * origin. Only faces that border empty cells are emitted. Vertex colours and
 * an all-zero `aTint` attribute make it work with the voxel materials.
 */
export function buildVolumeGeometry(volume: VoxelVolume): BufferGeometry {
    const [width, height, depth] = volume.size;
    const positions: number[] = [];
    const normals: number[] = [];
    const colours: number[] = [];
    const colour = new Color();

    for (let y = 0; y < height; y++) {
        for (let z = 0; z < depth; z++) {
            for (let x = 0; x < width; x++) {
                const value = voxelAt(volume, x, y, z);

                if (value === 0) {
                    continue;
                }

                colour
                    .copy(volume.palette[value] ?? volume.palette[1])
                    .multiplyScalar(
                        1 + (hash3(x, y, z) - 0.5) * 2 * BRIGHTNESS_JITTER,
                    );

                for (const { normal, corners } of FACES) {
                    if (
                        voxelAt(
                            volume,
                            x + normal[0],
                            y + normal[1],
                            z + normal[2],
                        ) !== 0
                    ) {
                        continue;
                    }

                    for (const index of [0, 1, 2, 0, 2, 3]) {
                        const corner = corners[index];
                        positions.push(
                            x + corner[0],
                            y + corner[1],
                            z + corner[2],
                        );
                        normals.push(...normal);
                        colours.push(colour.r, colour.g, colour.b);
                    }
                }
            }
        }
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
    geometry.setAttribute('color', new Float32BufferAttribute(colours, 3));
    geometry.setAttribute(
        'aTint',
        new Float32BufferAttribute(new Float32Array(positions.length / 3), 1),
    );
    geometry.computeBoundingSphere();

    return geometry;
}

/**
 * Read the first model of a MagicaVoxel file. MagicaVoxel's Z axis is up and
 * its Y axis points away from the viewer, so Y becomes depth reversed.
 */
export function volumeFromVox(buffer: ArrayBuffer): VoxelVolume {
    const chunk = new VOXLoader().parse(buffer).chunks[0];

    if (chunk === undefined) {
        throw new Error('The .vox file contains no model.');
    }

    const palette = chunk.palette.map((hex) =>
        new Color().setRGB(
            (hex & 0xff) / 255,
            ((hex >> 8) & 0xff) / 255,
            ((hex >> 16) & 0xff) / 255,
            SRGBColorSpace,
        ),
    );
    const volume = createVolume(
        [chunk.size.x, chunk.size.z, chunk.size.y],
        palette,
    );

    for (let i = 0; i < chunk.data.length; i += 4) {
        setVoxel(
            volume,
            chunk.data[i],
            chunk.data[i + 2],
            chunk.size.y - 1 - chunk.data[i + 1],
            chunk.data[i + 3],
        );
    }

    return volume;
}

/**
 * A rock built from a seed: a noisy, slightly tilted dome with banded
 * colours, flattened on top by `flatness`. Every anchor is kept as an empty
 * cell above a small solid ledge, as the server's catalogue relies on it.
 */
export function generateRock(
    definition: DecorationDefinition,
    seed: number,
): VoxelVolume {
    const [width, height, depth] = definition.size;
    const random = seededRandom(seed);
    const roughness = definition.params.roughness ?? 0.25;
    const flatness = definition.params.flatness ?? 0;
    const colours = (definition.params.colors ?? ['#7f7a70']).map(
        (hex) => new Color(hex),
    );
    const volume = createVolume(definition.size, [new Color(), ...colours]);

    const noise = valueNoise(seed);
    const tiltX = (random() - 0.5) * 0.3;
    const tiltZ = (random() - 0.5) * 0.3;
    const centreX = (width - 1) / 2;
    const centreZ = (depth - 1) / 2;
    const exponent = 2 + flatness * 6;

    for (let y = 0; y < height; y++) {
        for (let z = 0; z < depth; z++) {
            for (let x = 0; x < width; x++) {
                const dx = (x - centreX) / (width / 2);
                const dz = (z - centreZ) / (depth / 2);
                const top = height * (1 + dx * tiltX + dz * tiltZ);
                const dy = (y + 0.5) / top;
                const shape =
                    dx * dx + dz * dz + Math.pow(Math.min(dy, 2), exponent);
                const wobble = noise(x / 4, y / 4, z / 4) * roughness;

                if (shape > 1 - roughness * 0.4 + wobble) {
                    continue;
                }

                const band = Math.floor((y + noise(x / 6, 0, z / 6) * 3) / 2.5);
                setVoxel(
                    volume,
                    x,
                    y,
                    z,
                    1 +
                        (((band % colours.length) + colours.length) %
                            colours.length),
                );
            }
        }
    }

    for (const [ax, ay, az] of definition.anchors) {
        for (let y = 0; y < ay; y++) {
            if (voxelAt(volume, ax, y, az) === 0) {
                setVoxel(volume, ax, y, az, 1);
            }
        }

        for (let dz = -1; dz <= 1; dz++) {
            for (let dx = -1; dx <= 1; dx++) {
                if (voxelAt(volume, ax + dx, ay - 1, az + dz) === 0) {
                    setVoxel(volume, ax + dx, ay - 1, az + dz, 1);
                }

                for (let y = ay; y < height; y++) {
                    setVoxel(volume, ax + dx, y, az + dz, 0);
                }
            }
        }
    }

    return volume;
}

/** A deterministic 0..1 generator (mulberry32). */
function seededRandom(seed: number): () => number {
    let state = seed >>> 0;

    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** Deterministic 0..1 value for an integer lattice point. */
function hash3(x: number, y: number, z: number, seed = 0): number {
    let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263);
    h ^= Math.imul(z, 2147483647) ^ Math.imul(seed, 1274126177);
    h = Math.imul(h ^ (h >>> 13), 1274126177);

    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Smooth 3D value noise in -1..1, seeded. */
function valueNoise(seed: number): (x: number, y: number, z: number) => number {
    const smooth = (t: number) => t * t * (3 - 2 * t);
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

    return (x, y, z) => {
        const x0 = Math.floor(x);
        const y0 = Math.floor(y);
        const z0 = Math.floor(z);
        const tx = smooth(x - x0);
        const ty = smooth(y - y0);
        const tz = smooth(z - z0);
        const corner = (dx: number, dy: number, dz: number) =>
            hash3(x0 + dx, y0 + dy, z0 + dz, seed);

        const value = lerp(
            lerp(
                lerp(corner(0, 0, 0), corner(1, 0, 0), tx),
                lerp(corner(0, 1, 0), corner(1, 1, 0), tx),
                ty,
            ),
            lerp(
                lerp(corner(0, 0, 1), corner(1, 0, 1), tx),
                lerp(corner(0, 1, 1), corner(1, 1, 1), tx),
                ty,
            ),
            tz,
        );

        return value * 2 - 1;
    };
}
