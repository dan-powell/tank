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

/** A plain silhouette: an upright strip for plants, an ellipse for animals. */
function placeholderSprite(species: Species): ImageData {
    const isPlant = species.kind === 'plant';
    const [width, height] = isPlant ? [5, 32] : [14, 7];
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
            const filled = isPlant
                ? Math.abs(nx) < 0.3 + 0.2 * (y / height)
                : nx * nx + ny * ny * 1.2 < 0.25;

            if (filled) {
                pixels.data.set([r, g, b, 255], (y * width + x) * 4);
            }
        }
    }

    return pixels;
}
