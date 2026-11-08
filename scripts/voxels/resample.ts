/**
 * Resample MagicaVoxel files by a scale factor with nearest-neighbour
 * sampling, overwriting them. Used to move decorations onto a new grid size.
 *
 *     node scripts/voxels/resample.ts 2.5 resources/models/decor/*.vox
 *
 * A new size is the old size times the factor, rounded up. New voxel i takes
 * old voxel floor(i / factor) along each axis. Sampling works in grid space
 * (x right, y up, z towards the viewer), as the catalogue's anchors do.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { readVox, writeVox, type VoxModel } from './vox-file.ts';

function resample(model: VoxModel, factor: number): VoxModel {
    const [sx, sy, sz] = model.size;
    const filled = new Map<number, number>();
    // Grid key: x + (gridY * sy + gridZ) * sx, with gridZ = sy - 1 - voxY.
    const key = (x: number, gridY: number, gridZ: number) =>
        x + (gridY * sy + gridZ) * sx;

    for (let i = 0; i < model.voxels.length; i += 4) {
        const [x, y, z, colour] = model.voxels.slice(i, i + 4);
        filled.set(key(x, z, sy - 1 - y), colour);
    }

    const size: [number, number, number] = [
        Math.ceil(sx * factor),
        Math.ceil(sy * factor),
        Math.ceil(sz * factor),
    ];
    const voxels: number[] = [];

    for (let gridY = 0; gridY < size[2]; gridY++) {
        for (let gridZ = 0; gridZ < size[1]; gridZ++) {
            for (let x = 0; x < size[0]; x++) {
                const colour = filled.get(
                    key(
                        Math.floor(x / factor),
                        Math.floor(gridY / factor),
                        Math.floor(gridZ / factor),
                    ),
                );

                if (colour !== undefined) {
                    voxels.push(x, size[1] - 1 - gridZ, gridY, colour);
                }
            }
        }
    }

    return { name: model.name, size, voxels };
}

const [factorArgument, ...paths] = process.argv.slice(2);
const factor = Number(factorArgument);

if (!(factor > 0) || paths.length === 0) {
    console.error(
        'Usage: node scripts/voxels/resample.ts <factor> <file.vox>...',
    );
    process.exit(1);
}

for (const path of paths) {
    const file = readVox(readFileSync(path));
    writeFileSync(
        path,
        writeVox({
            ...file,
            models: file.models.map((model) => resample(model, factor)),
        }),
    );
    console.log(
        `${path}: ${file.models.map((m) => resample(m, factor).size.join('x')).join(', ')}`,
    );
}
