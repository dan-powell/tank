<?php

namespace App\Simulation;

use App\Enums\DecorationSource;
use InvalidArgumentException;

/**
 * The built-in decorations.
 *
 * Grid cells are 0.2 cm. `.vox` models live in resources/models/decor and are
 * read with MagicaVoxel's Z axis as height and its Y axis pointing away from
 * the viewer. Every decoration has LED light points. Rock anchors and
 * light points are guaranteed by the browser's rock generator, which always
 * keeps a solid voxel under each anchor and sets each LED into a niche.
 */
final class DecorationCatalogue
{
    /**
     * @return array<string, DecorationDefinition>
     */
    public static function definitions(): array
    {
        return [
            'pebble' => new DecorationDefinition(
                slug: 'pebble',
                name: 'River pebble',
                description: 'A smooth, rounded stone for the foreground.',
                source: DecorationSource::Rock,
                size: [35, 20, 30],
                anchors: [[18, 18, 16]],
                params: ['colors' => ['#8d8a82', '#a29d92', '#6f6c66'], 'roughness' => 0.15],
                lightPoints: [[12, 8, 24], [23, 8, 24]],
                lightColour: '#cfe6ff',
            ),
            'boulder' => new DecorationDefinition(
                slug: 'boulder',
                name: 'Boulder',
                description: 'A craggy centrepiece rock with room for plants on its shoulders.',
                source: DecorationSource::Rock,
                size: [65, 45, 55],
                anchors: [[33, 43, 28], [16, 28, 23], [51, 28, 33]],
                params: ['colors' => ['#6d6a63', '#7f7a70', '#5a5751', '#948e81'], 'roughness' => 0.35],
                lightPoints: [[20, 18, 46], [33, 22, 47], [46, 18, 46]],
                lightColour: '#cfe6ff',
            ),
            'slate-slab' => new DecorationDefinition(
                slug: 'slate-slab',
                name: 'Slate slab',
                description: 'A low, flat-topped stone that is easy to stack.',
                source: DecorationSource::Rock,
                size: [90, 20, 50],
                anchors: [[26, 18, 26], [66, 18, 26]],
                params: ['colors' => ['#4f5559', '#5d6468', '#454b4f'], 'roughness' => 0.2, 'flatness' => 0.6],
                lightPoints: [[20, 8, 42], [45, 8, 44], [70, 8, 42]],
                lightColour: '#cfe6ff',
            ),
            'coral-wall' => new DecorationDefinition(
                slug: 'coral-wall',
                name: 'Coral wall',
                description: 'A tall rocky backdrop with three ledges for plants.',
                source: DecorationSource::Vox,
                size: [120, 90, 30],
                anchors: [[21, 30, 21], [61, 50, 18], [98, 38, 21], [61, 58, 6]],
                lightPoints: [[60, 42, 12], [22, 40, 16], [54, 24, 16]],
                lightColour: '#4fe3ff',
            ),
            'slate-wall' => new DecorationDefinition(
                slug: 'slate-wall',
                name: 'Slate wall',
                description: 'A terraced backdrop of stacked slate, with moss on its ledges and a crevice for shy fish.',
                source: DecorationSource::Vox,
                size: [140, 75, 30],
                anchors: [[22, 40, 20], [67, 27, 24], [112, 46, 18], [37, 70, 6]],
                lightPoints: [[30, 25, 26], [70, 17, 22], [100, 35, 19], [55, 50, 11]],
                lightColour: '#8fd3ff',
            ),
            'lava-rock-wall' => new DecorationDefinition(
                slug: 'lava-rock-wall',
                name: 'Lava rock wall',
                description: 'Two porous volcanic spires, bored through by lava tubes fish can swim along.',
                source: DecorationSource::Vox,
                size: [100, 100, 32],
                anchors: [[18, 46, 19], [48, 67, 8], [80, 40, 20]],
                lightPoints: [[31, 10, 7], [75, 11, 9], [62, 58, 15]],
                lightColour: '#ff5a1f',
            ),
            'sandstone-wall' => new DecorationDefinition(
                slug: 'sandstone-wall',
                name: 'Sandstone wall',
                description: 'Warm, wind-worn sandstone with an arch to swim under and a window right through.',
                source: DecorationSource::Vox,
                size: [130, 85, 32],
                anchors: [[20, 34, 22], [52, 52, 17], [96, 62, 12]],
                lightPoints: [[27, 57, 8], [88, 30, 23], [105, 12, 25], [60, 45, 15]],
                lightColour: '#ffcf7a',
            ),
            'rock-pillar' => new DecorationDefinition(
                slug: 'rock-pillar',
                name: 'Rock pillar',
                description: 'A tall, leaning column of stacked stone with a mossy summit and a ledge for plants.',
                source: DecorationSource::Vox,
                size: [40, 110, 40],
                anchors: [[18, 106, 18], [26, 106, 25], [5, 64, 24]],
                lightPoints: [[22, 20, 27], [14, 50, 25], [24, 80, 31]],
                lightColour: '#a8f0d0',
            ),
            'coral-reef' => new DecorationDefinition(
                slug: 'coral-reef',
                name: 'Coral reef',
                description: 'A free-standing reef mound teeming with coral, with a tunnel fish can swim through.',
                source: DecorationSource::Vox,
                size: [110, 55, 65],
                anchors: [[22, 28, 40], [86, 23, 24]],
                lightPoints: [[40, 33, 22], [70, 27, 44], [92, 23, 40], [17, 29, 24]],
                lightColour: '#b36bff',
            ),
            'driftwood-arch' => new DecorationDefinition(
                slug: 'driftwood-arch',
                name: 'Driftwood arch',
                description: 'A gnarled bough that fish can swim beneath.',
                source: DecorationSource::Vox,
                size: [110, 60, 35],
                anchors: [[31, 55, 23], [56, 53, 16], [78, 43, 13]],
                lightPoints: [[15, 25, 32], [40, 52, 25], [70, 48, 17], [94, 25, 14]],
                lightColour: '#fff1c1',
            ),
            'driftwood-branch' => new DecorationDefinition(
                slug: 'driftwood-branch',
                name: 'Driftwood branch',
                description: 'A long, weathered branch lying along the floor, with room for moss on top.',
                source: DecorationSource::Vox,
                size: [140, 36, 46],
                anchors: [[38, 14, 25], [78, 11, 20], [112, 9, 23]],
                lightPoints: [[20, 12, 29], [60, 9, 28], [100, 9, 23], [129, 8, 16]],
                lightColour: '#fff1c1',
            ),
            'treasure-chest' => new DecorationDefinition(
                slug: 'treasure-chest',
                name: 'Treasure chest',
                description: 'Every aquarium needs one.',
                source: DecorationSource::Vox,
                size: [40, 33, 28],
                lightPoints: [[12, 18, 27], [20, 21, 27], [28, 18, 27]],
                lightColour: '#ffc34d',
            ),
            'glass-bottle' => new DecorationDefinition(
                slug: 'glass-bottle',
                name: 'Glass bottle',
                description: 'An old bottle lying in the sand, with a message still tucked in its open neck.',
                source: DecorationSource::Vox,
                size: [70, 30, 32],
                lightPoints: [[15, 15, 26], [35, 16, 28], [60, 14, 24]],
                lightColour: '#ffe08a',
            ),
            'skull' => new DecorationDefinition(
                slug: 'skull',
                name: 'Skull',
                description: 'A giant weathered skull with hollow eye sockets for shy fish to hide in.',
                source: DecorationSource::Vox,
                size: [50, 44, 52],
                anchors: [[25, 41, 17]],
                lightPoints: [[17, 14, 40], [33, 14, 40]],
                lightColour: '#7dff6a',
            ),
            'small-castle' => new DecorationDefinition(
                slug: 'small-castle',
                name: 'Small castle',
                description: 'A turreted stone castle with an arched gateway fish can swim through.',
                source: DecorationSource::Vox,
                size: [75, 85, 55],
                anchors: [[61, 50, 42], [29, 32, 40]],
                lightPoints: [[29, 44, 22], [43, 44, 22], [13, 40, 49], [52, 58, 13]],
                lightColour: '#ffb347',
            ),
            'pirate-ship' => new DecorationDefinition(
                slug: 'pirate-ship',
                name: 'Pirate ship',
                description: 'A sunken wreck listing in the sand, with a broken hull that fish can swim into.',
                source: DecorationSource::Vox,
                size: [150, 90, 56],
                anchors: [[52, 21, 30], [101, 19, 27]],
                lightPoints: [[7, 45, 37], [79, 35, 40], [130, 29, 35]],
                lightColour: '#ffb347',
            ),
            'mini-atlantis' => new DecorationDefinition(
                slug: 'mini-atlantis',
                name: 'Mini Atlantis',
                description: 'A sunken domed temple among broken columns, lit by glowing crystals.',
                source: DecorationSource::Vox,
                size: [130, 80, 70],
                anchors: [[13, 5, 22], [100, 10, 40], [121, 19, 22]],
                lightPoints: [[40, 26, 52], [88, 24, 55], [10, 13, 50], [65, 71, 38]],
                lightColour: '#5ff2e0',
            ),
        ];
    }

    public static function exists(string $slug): bool
    {
        return array_key_exists($slug, self::definitions());
    }

    public static function find(string $slug): DecorationDefinition
    {
        return self::definitions()[$slug] ?? throw new InvalidArgumentException("Unknown decoration [{$slug}].");
    }
}
