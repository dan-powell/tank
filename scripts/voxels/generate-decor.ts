/**
 * Generate decoration models at the tank's 0.2 cm voxel size.
 *
 *     node scripts/voxels/generate-decor.ts [--force] [--out dir] [slug...]
 *
 * Writes resources/models/decor/{slug}.vox, one model per module in
 * scripts/voxels/decor. With --out, writes into that directory instead and
 * leaves generated.json alone (for previews). Each model's size and plant
 * anchors must match app/Simulation/DecorationCatalogue.php (checked by
 * DecorationCatalogueTest): every anchor is an empty cell with solid rock
 * directly beneath it. Like the species script, a file whose contents no
 * longer match what this script last wrote (generated.json) has been edited
 * by hand and is left alone unless --force.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { writeVox } from '../../resources/js/lib/tank/vox-file.ts';
import { coralReef } from './decor/coral-reef.ts';
import { coralWall } from './decor/coral-wall.ts';
import { driftwoodArch } from './decor/driftwood-arch.ts';
import { driftwoodBranch } from './decor/driftwood-branch.ts';
import { glassBottle } from './decor/glass-bottle.ts';
import { lavaRockWall } from './decor/lava-rock-wall.ts';
import { miniAtlantis } from './decor/mini-atlantis.ts';
import { pirateShip } from './decor/pirate-ship.ts';
import { rockPillar } from './decor/rock-pillar.ts';
import { sandstoneWall } from './decor/sandstone-wall.ts';
import { skull } from './decor/skull.ts';
import { slateWall } from './decor/slate-wall.ts';
import { smallCastle } from './decor/small-castle.ts';
import { treasureChest } from './decor/treasure-chest.ts';
import { Grid, Palette } from './voxel-tools.ts';

const OUTPUT = 'resources/models/decor';
const MANIFEST = 'scripts/voxels/generated.json';

// ---------------------------------------------------------------- main

const DECORATIONS: Record<string, () => Grid> = {
    'coral-wall': coralWall,
    'treasure-chest': treasureChest,
    'driftwood-arch': driftwoodArch,
    'driftwood-branch': driftwoodBranch,
    'small-castle': smallCastle,
    skull: skull,
    'pirate-ship': pirateShip,
    'coral-reef': coralReef,
    'slate-wall': slateWall,
    'lava-rock-wall': lavaRockWall,
    'sandstone-wall': sandstoneWall,
    'glass-bottle': glassBottle,
    'rock-pillar': rockPillar,
    'mini-atlantis': miniAtlantis,
};

const args = process.argv.slice(2);
const force = args.includes('--force');
const outIndex = args.indexOf('--out');
const previewDirectory = outIndex >= 0 ? args[outIndex + 1] : null;
const only = args.filter(
    (arg, index) =>
        !arg.startsWith('--') && (outIndex < 0 || index !== outIndex + 1),
);
const manifest: Record<string, string> = existsSync(MANIFEST)
    ? JSON.parse(readFileSync(MANIFEST, 'utf8'))
    : {};
const digest = (bytes: Uint8Array) =>
    createHash('sha256').update(bytes).digest('hex');

for (const [slug, build] of Object.entries(DECORATIONS)) {
    if (only.length > 0 && !only.includes(slug)) {
        continue;
    }

    const key = `decor/${slug}`;

    if (previewDirectory !== null) {
        const palette = new Palette();
        const path = `${previewDirectory}/${slug}.vox`;
        writeFileSync(
            path,
            writeVox({
                models: [build().toModel(slug, palette)],
                palette: palette.toVox(),
            }),
        );
        console.log(`wrote ${path}`);
        continue;
    }

    const path = `${OUTPUT}/${slug}.vox`;

    if (
        existsSync(path) &&
        !force &&
        manifest[key] !== digest(readFileSync(path))
    ) {
        console.log(
            `skip  ${path} (not written by this script; use --force to replace)`,
        );
        continue;
    }

    const palette = new Palette();
    const bytes = writeVox({
        models: [build().toModel(slug, palette)],
        palette: palette.toVox(),
    });
    writeFileSync(path, bytes);
    manifest[key] = digest(bytes);
    console.log(`wrote ${path}`);
}

if (previewDirectory === null) {
    writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 4)}\n`);
}
