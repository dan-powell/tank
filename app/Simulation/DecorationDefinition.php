<?php

namespace App\Simulation;

use App\Enums\DecorationSource;

/**
 * Immutable view of a catalogue decoration.
 *
 * Sizes and anchors are in decoration grid cells, in the model's unrotated
 * orientation (x right, y up, z towards the viewer). An anchor is the empty
 * cell directly above a solid voxel, where a plant's roots sit.
 */
final readonly class DecorationDefinition
{
    /**
     * @param  array{0: int, 1: int, 2: int}  $size
     * @param  list<array{0: int, 1: int, 2: int}>  $anchors
     * @param  array<string, mixed>  $params
     */
    public function __construct(
        public string $slug,
        public string $name,
        public string $description,
        public DecorationSource $source,
        public array $size,
        public array $anchors = [],
        public array $params = [],
    ) {}

    /**
     * Size after turning the model a number of quarter turns about the vertical axis.
     *
     * @return array{0: int, 1: int, 2: int}
     */
    public function rotatedSize(int $rotation): array
    {
        [$width, $height, $depth] = $this->size;

        return $rotation % 2 === 0 ? [$width, $height, $depth] : [$depth, $height, $width];
    }

    /**
     * A local model cell after the given quarter turns, relative to the rotated box's corner.
     *
     * One quarter turn matches a +90° rotation about Y in three.js (x → z, z → -x).
     *
     * @param  array{0: int, 1: int, 2: int}  $cell
     * @return array{0: int, 1: int, 2: int}
     */
    public function rotateCell(array $cell, int $rotation): array
    {
        [$x, $y, $z] = $cell;
        [$width, , $depth] = $this->size;

        return match ($rotation % 4) {
            1 => [$z, $y, $width - 1 - $x],
            2 => [$width - 1 - $x, $y, $depth - 1 - $z],
            3 => [$depth - 1 - $z, $y, $x],
            default => [$x, $y, $z],
        };
    }
}
