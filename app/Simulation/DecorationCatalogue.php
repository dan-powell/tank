<?php

namespace App\Simulation;

use App\Enums\DecorationSource;
use InvalidArgumentException;

/**
 * The built-in decorations.
 *
 * Grid cells are 0.2 cm. `.vox` models live in resources/models/decor and are
 * read with MagicaVoxel's Z axis as height and its Y axis pointing away from
 * the viewer. Rock anchors are guaranteed by the browser's rock generator,
 * which always keeps a solid voxel under each one.
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
            ),
            'boulder' => new DecorationDefinition(
                slug: 'boulder',
                name: 'Boulder',
                description: 'A craggy centrepiece rock with room for plants on its shoulders.',
                source: DecorationSource::Rock,
                size: [65, 45, 55],
                anchors: [[33, 43, 28], [16, 28, 23], [51, 28, 33]],
                params: ['colors' => ['#6d6a63', '#7f7a70', '#5a5751', '#948e81'], 'roughness' => 0.35],
            ),
            'slate-slab' => new DecorationDefinition(
                slug: 'slate-slab',
                name: 'Slate slab',
                description: 'A low, flat-topped stone that is easy to stack.',
                source: DecorationSource::Rock,
                size: [90, 20, 50],
                anchors: [[26, 18, 26], [66, 18, 26]],
                params: ['colors' => ['#4f5559', '#5d6468', '#454b4f'], 'roughness' => 0.2, 'flatness' => 0.6],
            ),
            'coral-wall' => new DecorationDefinition(
                slug: 'coral-wall',
                name: 'Coral wall',
                description: 'A tall rocky backdrop with three ledges for plants.',
                source: DecorationSource::Vox,
                size: [120, 90, 30],
                anchors: [[21, 30, 21], [61, 50, 18], [98, 38, 21], [61, 58, 6]],
            ),
            'driftwood-arch' => new DecorationDefinition(
                slug: 'driftwood-arch',
                name: 'Driftwood arch',
                description: 'A gnarled bough that fish can swim beneath.',
                source: DecorationSource::Vox,
                size: [110, 60, 35],
                anchors: [[31, 55, 23], [56, 53, 16], [78, 43, 13]],
            ),
            'treasure-chest' => new DecorationDefinition(
                slug: 'treasure-chest',
                name: 'Treasure chest',
                description: 'Every aquarium needs one.',
                source: DecorationSource::Vox,
                size: [40, 33, 28],
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
