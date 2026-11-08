import { use } from 'react';
import { buildVoxelGeometry, readPixels } from '@/lib/tank/voxels';
import type { VoxelModel } from '@/lib/tank/voxels';
import type { Species } from '@/types';

/**
 * Sprite URLs keyed by file name, e.g. `guppy.png` and `guppy.depth.png`.
 * Drop new PNGs into resources/images/sprites to add or replace artwork.
 */
const SPRITES: Record<string, string> = Object.fromEntries(
    Object.entries(
        import.meta.glob<string>('/resources/images/sprites/*.png', {
            eager: true,
            query: '?url',
            import: 'default',
        }),
    ).map(([path, url]) => [path.split('/').pop() as string, url]),
);

const models = new Map<string, Promise<VoxelModel>>();

/**
 * The voxel model for a species, built once and shared by every individual.
 * Suspends while the sprite loads; species without artwork get a simple
 * placeholder shape in their catalogue colour.
 */
export function useVoxelModel(species: Species): VoxelModel {
    let model = models.get(species.slug);

    if (model === undefined) {
        model = loadModel(species);
        models.set(species.slug, model);
    }

    return use(model);
}

async function loadModel(species: Species): Promise<VoxelModel> {
    const spriteUrl = SPRITES[`${species.slug}.png`];
    const depthUrl = SPRITES[`${species.slug}.depth.png`];

    if (spriteUrl === undefined) {
        return buildVoxelGeometry(placeholderSprite(species));
    }

    try {
        const [sprite, depthMap] = await Promise.all([
            readPixels(spriteUrl),
            depthUrl === undefined ? null : readPixels(depthUrl),
        ]);

        return buildVoxelGeometry(sprite, depthMap, species.render.voxel_depth);
    } catch (error) {
        console.error(`Could not load sprite for ${species.slug}`, error);

        return buildVoxelGeometry(placeholderSprite(species));
    }
}

/**
 * A plain silhouette in the species' catalogue colour: an upright strip for
 * water plants, a low dome for cushion plants, a fan of fronds for ferns and
 * edge plants, and an ellipse for animals.
 */
function placeholderSprite(species: Species): ImageData {
    const isPlant = species.kind === 'plant';
    const shape = !isPlant
        ? 'body'
        : species.behaviour === 'cushion'
          ? 'cushion'
          : species.behaviour === 'frond'
            ? 'frond'
            : 'strip';
    const [width, height] = {
        strip: [10, 64],
        cushion: [26, 9],
        frond: [24, 30],
        body: [28, 14],
    }[shape];
    const hex =
        species.render.color ??
        species.render.body ??
        species.render.shell ??
        '#9aa5b1';
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const pixels = new ImageData(width, height);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const nx = (x + 0.5) / width - 0.5;
            const ny = (y + 0.5) / height - 0.5;
            // Height above the base, 0 at the bottom row to 1 at the top.
            const up = 1 - (y + 0.5) / height;
            const filled = {
                strip: Math.abs(nx) < 0.3 + 0.2 * (y / height),
                cushion: nx * nx * 4 + up * up < 1,
                frond:
                    Math.abs(nx) < up * 0.5 + 0.04 &&
                    (Math.abs(Math.sin((nx / Math.max(up, 0.05)) * 9)) > 0.3 ||
                        Math.abs(nx) < 0.04),
                body: nx * nx + ny * ny * 1.2 < 0.25,
            }[shape];

            if (filled) {
                pixels.data.set([r, g, b, 255], (y * width + x) * 4);
            }
        }
    }

    return pixels;
}
