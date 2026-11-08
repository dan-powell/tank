<?php

namespace App\Simulation;

use App\Enums\DecorationSource;
use InvalidArgumentException;

/**
 * The built-in decorations.
 *
 * Grid cells are 0.5 cm. `.vox` models live in resources/models/decor and are
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
                size: [14, 8, 12],
                anchors: [[7, 7, 6]],
                params: ['colors' => ['#8d8a82', '#a29d92', '#6f6c66'], 'roughness' => 0.15],
            ),
            'boulder' => new DecorationDefinition(
                slug: 'boulder',
                name: 'Boulder',
                description: 'A craggy centrepiece rock with room for plants on its shoulders.',
                source: DecorationSource::Rock,
                size: [26, 18, 22],
                anchors: [[13, 17, 11], [6, 11, 9], [20, 11, 13]],
                params: ['colors' => ['#6d6a63', '#7f7a70', '#5a5751', '#948e81'], 'roughness' => 0.35],
            ),
            'slate-slab' => new DecorationDefinition(
                slug: 'slate-slab',
                name: 'Slate slab',
                description: 'A low, flat-topped stone that is easy to stack.',
                source: DecorationSource::Rock,
                size: [36, 8, 20],
                anchors: [[10, 7, 10], [26, 7, 10]],
                params: ['colors' => ['#4f5559', '#5d6468', '#454b4f'], 'roughness' => 0.2, 'flatness' => 0.6],
            ),
            'coral-wall' => new DecorationDefinition(
                slug: 'coral-wall',
                name: 'Coral wall',
                description: 'A tall rocky backdrop with three ledges for plants.',
                source: DecorationSource::Vox,
                size: [48, 36, 12],
                anchors: [[8, 12, 8], [24, 20, 7], [39, 15, 8], [24, 23, 2]],
            ),
            'driftwood-arch' => new DecorationDefinition(
                slug: 'driftwood-arch',
                name: 'Driftwood arch',
                description: 'A gnarled bough that fish can swim beneath.',
                source: DecorationSource::Vox,
                size: [44, 24, 14],
                anchors: [[12, 22, 9], [22, 21, 6], [31, 17, 5]],
            ),
            'treasure-chest' => new DecorationDefinition(
                slug: 'treasure-chest',
                name: 'Treasure chest',
                description: 'Every aquarium needs one.',
                source: DecorationSource::Vox,
                size: [16, 13, 11],
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
