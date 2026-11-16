import { readVox } from '@/lib/tank/vox-file';
import type { VoxFile, VoxModel } from '@/lib/tank/vox-file';
import { SPECIES_MODEL_FILES } from '@/lib/tank/species-files';

/** Palette index species models use for parts recoloured per individual (see voxel-volume TINT_INDEX). */
const TINT_INDEX = 255;

/** Colour shown for per-individual parts, e.g. guppy tails. */
const TINT_RGB: [number, number, number] = [240, 128, 60];

/** How much darker the deepest visible voxels are than the nearest, for a hint of form. */
const DEPTH_SHADE = 0.35;

/** Plant parts stacked bottom to top to suggest a whole plant. */
const PLANT_STACK = ['base', 'stem.0', 'stem.1', 'tip'];

type Layer = {
    width: number;
    height: number;
    /** RGB per pixel, row by row from the top, or null where empty. */
    pixels: ([number, number, number] | null)[];
};

const sprites = new Map<string, Promise<string | null>>();

/**
 * A small side-on picture of a species, drawn from its voxel model as a PNG
 * data URL: an adult animal facing right, or a plant's parts stacked. Null
 * when the species has no model or it cannot be loaded.
 */
export function loadSpeciesSprite(slug: string): Promise<string | null> {
    let sprite = sprites.get(slug);

    if (sprite === undefined) {
        sprite = drawSprite(slug);
        sprites.set(slug, sprite);
    }

    return sprite;
}

async function drawSprite(slug: string): Promise<string | null> {
    const url = SPECIES_MODEL_FILES[slug];

    if (url === undefined) {
        return null;
    }

    try {
        const response = await fetch(url);
        const file = readVox(new Uint8Array(await response.arrayBuffer()));
        const layers = pickModels(file.models).map((model) =>
            project(model, file.palette),
        );

        return layers.length === 0 ? null : toDataUrl(stack(layers));
    } catch (error) {
        console.error(`Could not draw an icon for ${slug}`, error);

        return null;
    }
}

/** The models that make up the picture, bottom first. */
function pickModels(models: VoxModel[]): VoxModel[] {
    const byName = new Map(models.map((model) => [model.name, model]));
    const plantParts = PLANT_STACK.map((name) => byName.get(name)).filter(
        (model): model is VoxModel => model !== undefined,
    );

    if (plantParts.length > 0) {
        return plantParts;
    }

    const animal =
        byName.get('adult.idle.0') ??
        models.find((model) => model.name.startsWith('adult.')) ??
        models.findLast((model) => model.name.endsWith('.idle.0')) ??
        models[0];

    return animal === undefined ? [] : [animal];
}

/** The model seen from the front: the nearest voxel in each column, darkened by depth. */
function project(model: VoxModel, palette: VoxFile['palette']): Layer {
    const [width, depth, height] = model.size;
    const nearest = Array.from({ length: width * height }, () => -1);
    const colours = Array.from({ length: width * height }, () => 0);
    const { voxels } = model;

    for (let i = 0; i < voxels.length; i += 4) {
        const [x, y, z, colour] = [
            voxels[i],
            voxels[i + 1],
            voxels[i + 2],
            voxels[i + 3],
        ];
        const pixel = (height - 1 - z) * width + x;

        if (nearest[pixel] === -1 || y < nearest[pixel]) {
            nearest[pixel] = y;
            colours[pixel] = colour;
        }
    }

    const front = Math.min(...nearest.filter((y) => y >= 0));

    return {
        width,
        height,
        pixels: nearest.map((y, pixel) => {
            if (y < 0) {
                return null;
            }

            const shade =
                1 - (DEPTH_SHADE * (y - front)) / Math.max(1, depth - 1);

            return rgb(colours[pixel], palette).map((channel) =>
                Math.round(channel * shade),
            ) as [number, number, number];
        }),
    };
}

function rgb(
    index: number,
    palette: VoxFile['palette'],
): [number, number, number] {
    if (index === TINT_INDEX) {
        return TINT_RGB;
    }

    const hex = palette[index - 1] ?? 0;

    return [hex & 0xff, (hex >> 8) & 0xff, (hex >> 16) & 0xff];
}

/** Layers piled bottom first, each centred across the widest. */
function stack(layers: Layer[]): Layer {
    const width = Math.max(...layers.map((layer) => layer.width));
    const height = layers.reduce((sum, layer) => sum + layer.height, 0);
    const pixels: Layer['pixels'] = Array.from(
        { length: width * height },
        () => null,
    );
    let bottom = height;

    for (const layer of layers) {
        const top = bottom - layer.height;
        const left = Math.floor((width - layer.width) / 2);

        layer.pixels.forEach((colour, pixel) => {
            if (colour !== null) {
                const x = left + (pixel % layer.width);
                const y = top + Math.floor(pixel / layer.width);
                pixels[y * width + x] = colour;
            }
        });

        bottom = top;
    }

    return { width, height, pixels };
}

function toDataUrl({ width, height, pixels }: Layer): string | null {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');

    if (context === null) {
        return null;
    }

    const image = context.createImageData(width, height);

    pixels.forEach((colour, pixel) => {
        if (colour !== null) {
            image.data.set([...colour, 255], pixel * 4);
        }
    });
    context.putImageData(image, 0, 0);

    return canvas.toDataURL();
}
