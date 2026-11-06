import {
    BufferGeometry,
    Color,
    Float32BufferAttribute,
    SRGBColorSpace,
} from 'three';

/**
 * A voxel model built from a 2D sprite. One pixel is one voxel (1 unit).
 * The geometry is centred on x and z and anchored with its bottom row at
 * y = 0, so callers can scale it to real size and offset it as needed.
 */
export type VoxelModel = {
    geometry: BufferGeometry;
    /** Width in voxels (sprite width). */
    width: number;
    /** Height in voxels (sprite height). */
    height: number;
    /** Thickness of the thickest column, in voxels. */
    depth: number;
};

/** Pixels with alpha below this are empty. */
const ALPHA_THRESHOLD = 128;

/** How quickly the pillow extrusion thickens away from the silhouette edge. */
const PILLOW_BULGE = 0.6;

/** Sprite pixels of exactly this colour are tinted per individual. */
const TINT_KEY = { r: 255, g: 0, b: 255 } as const;

/**
 * Read a PNG (or any image URL) into raw RGBA pixels.
 */
export async function readPixels(url: string): Promise<ImageData> {
    const image = new Image();
    image.src = url;
    await image.decode();

    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d', { willReadFrequently: true });

    if (context === null) {
        throw new Error('Canvas 2D context is unavailable.');
    }

    context.drawImage(image, 0, 0);

    return context.getImageData(0, 0, canvas.width, canvas.height);
}

/**
 * Turn a sprite into a solid voxel mesh.
 *
 * Each opaque pixel becomes a column of voxels symmetric about z = 0. Its
 * thickness comes from the matching pixel of an optional greyscale depth map
 * (black = 1 voxel, white = `maxDepth`); without one, columns thicken with
 * distance from the silhouette edge, so bodies are rounded and fins stay thin.
 * Only faces that border empty space are emitted.
 */
export function buildVoxelGeometry(
    sprite: ImageData,
    depthMap: ImageData | null = null,
    maxDepth = defaultMaxDepth(sprite.height),
): VoxelModel {
    const { width, height, data } = sprite;
    const halfDepths = depthMap
        ? halfDepthsFromMap(sprite, depthMap, maxDepth)
        : pillowHalfDepths(sprite, maxDepth);

    const positions: number[] = [];
    const normals: number[] = [];
    const colours: number[] = [];
    const tints: number[] = [];
    const colour = new Color();

    /** Half-thickness at a pixel, or 0 when empty or out of bounds. */
    const extentAt = (x: number, y: number): number =>
        x < 0 || y < 0 || x >= width || y >= height
            ? 0
            : halfDepths[y * width + x];

    for (let row = 0; row < height; row++) {
        for (let column = 0; column < width; column++) {
            const extent = halfDepths[row * width + column];

            if (extent === 0) {
                continue;
            }

            const offset = (row * width + column) * 4;
            const [r, g, b] = [
                data[offset],
                data[offset + 1],
                data[offset + 2],
            ];
            const isTint =
                r === TINT_KEY.r && g === TINT_KEY.g && b === TINT_KEY.b;
            colour.setRGB(r / 255, g / 255, b / 255, SRGBColorSpace);

            const x0 = column - width / 2;
            const x1 = x0 + 1;
            const y0 = height - 1 - row;
            const y1 = y0 + 1;

            const quad = (corners: number[][], normal: number[]): void => {
                for (const index of [0, 1, 2, 0, 2, 3]) {
                    positions.push(...corners[index]);
                    normals.push(...normal);
                    colours.push(colour.r, colour.g, colour.b);
                    tints.push(isTint ? 1 : 0);
                }
            };

            quad(
                [
                    [x0, y0, extent],
                    [x1, y0, extent],
                    [x1, y1, extent],
                    [x0, y1, extent],
                ],
                [0, 0, 1],
            );
            quad(
                [
                    [x1, y0, -extent],
                    [x0, y0, -extent],
                    [x0, y1, -extent],
                    [x1, y1, -extent],
                ],
                [0, 0, -1],
            );

            /** Emit the side wall towards a neighbour, where it is not covered. */
            const side = (
                neighbourExtent: number,
                corners: (z0: number, z1: number) => number[][],
                normal: number[],
            ): void => {
                if (neighbourExtent >= extent) {
                    return;
                }

                if (neighbourExtent === 0) {
                    quad(corners(-extent, extent), normal);

                    return;
                }

                quad(corners(neighbourExtent, extent), normal);
                quad(corners(-extent, -neighbourExtent), normal);
            };

            side(
                extentAt(column + 1, row),
                (z0, z1) => [
                    [x1, y0, z1],
                    [x1, y0, z0],
                    [x1, y1, z0],
                    [x1, y1, z1],
                ],
                [1, 0, 0],
            );
            side(
                extentAt(column - 1, row),
                (z0, z1) => [
                    [x0, y0, z0],
                    [x0, y0, z1],
                    [x0, y1, z1],
                    [x0, y1, z0],
                ],
                [-1, 0, 0],
            );
            side(
                extentAt(column, row - 1),
                (z0, z1) => [
                    [x0, y1, z1],
                    [x1, y1, z1],
                    [x1, y1, z0],
                    [x0, y1, z0],
                ],
                [0, 1, 0],
            );
            side(
                extentAt(column, row + 1),
                (z0, z1) => [
                    [x0, y0, z0],
                    [x1, y0, z0],
                    [x1, y0, z1],
                    [x0, y0, z1],
                ],
                [0, -1, 0],
            );
        }
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
    geometry.setAttribute('color', new Float32BufferAttribute(colours, 3));
    geometry.setAttribute('aTint', new Float32BufferAttribute(tints, 1));
    geometry.computeBoundingSphere();

    return {
        geometry,
        width,
        height,
        depth: Math.max(0, ...halfDepths) * 2,
    };
}

/** Default maximum thickness: about half the sprite's height, always odd. */
function defaultMaxDepth(spriteHeight: number): number {
    return Math.max(1, Math.round(spriteHeight / 2)) | 1;
}

/** Largest half-thickness for a maximum (odd) thickness in voxels. */
function maxHalfDepth(maxDepth: number): number {
    return Math.max(0, Math.floor((maxDepth - 1) / 2)) + 0.5;
}

/**
 * Half-thickness per pixel from a greyscale depth map. Columns stay whole
 * voxels: k voxels either side of a centre voxel.
 */
function halfDepthsFromMap(
    sprite: ImageData,
    depthMap: ImageData,
    maxDepth: number,
): Float32Array {
    const { width, height } = sprite;
    const result = new Float32Array(width * height);
    const maxHalf = maxHalfDepth(maxDepth);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (sprite.data[(y * width + x) * 4 + 3] < ALPHA_THRESHOLD) {
                continue;
            }

            const inMap = x < depthMap.width && y < depthMap.height;
            const grey = inMap
                ? depthMap.data[(y * depthMap.width + x) * 4] / 255
                : 0;
            result[y * width + x] = Math.round(grey * (maxHalf - 0.5)) + 0.5;
        }
    }

    return result;
}

/**
 * Half-thickness per pixel growing with chessboard distance from the
 * nearest empty pixel (the image border counts as empty).
 */
function pillowHalfDepths(sprite: ImageData, maxDepth: number): Float32Array {
    const { width, height, data } = sprite;
    const distance = new Int32Array(width * height).fill(-1);
    const queue: number[] = [];

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const index = y * width + x;

            if (data[index * 4 + 3] < ALPHA_THRESHOLD) {
                continue;
            }

            if (touchesEmpty(data, width, height, x, y)) {
                distance[index] = 0;
                queue.push(index);
            }
        }
    }

    for (let head = 0; head < queue.length; head++) {
        const index = queue[head];
        const x = index % width;
        const y = (index - x) / width;

        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                const nx = x + dx;
                const ny = y + dy;

                if (nx < 0 || ny < 0 || nx >= width || ny >= height) {
                    continue;
                }

                const next = ny * width + nx;

                if (
                    distance[next] === -1 &&
                    data[next * 4 + 3] >= ALPHA_THRESHOLD
                ) {
                    distance[next] = distance[index] + 1;
                    queue.push(next);
                }
            }
        }
    }

    const maxHalf = maxHalfDepth(maxDepth);
    const result = new Float32Array(width * height);

    for (let index = 0; index < distance.length; index++) {
        if (distance[index] >= 0) {
            result[index] = Math.min(
                maxHalf,
                Math.floor(distance[index] * PILLOW_BULGE) + 0.5,
            );
        }
    }

    return result;
}

function touchesEmpty(
    data: Uint8ClampedArray,
    width: number,
    height: number,
    x: number,
    y: number,
): boolean {
    for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx;
            const ny = y + dy;

            if (
                nx < 0 ||
                ny < 0 ||
                nx >= width ||
                ny >= height ||
                data[(ny * width + nx) * 4 + 3] < ALPHA_THRESHOLD
            ) {
                return true;
            }
        }
    }

    return false;
}
