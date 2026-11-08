<?php

namespace App\Simulation;

use App\Models\Decoration;
use App\Models\Tank;

/**
 * The tank's physical layout on the decoration grid.
 *
 * The grid divides the tank's interior into 0.5 cm cells, from the glass floor
 * (y = 0) to the rim, with x running left to right and z from the back glass
 * (z = 0) to the front. Decorations, the substrate and the water level are all
 * measured in these cells, so none of them depends on the others.
 *
 * Every tank currently shares one size and water level; reading them through
 * this class keeps that a single change when tanks gain their own.
 */
final class TankGeometry
{
    /** Interior width, height (floor to rim) and depth in cells. */
    public const int WIDTH = 120;

    public const int HEIGHT = 65;

    public const int DEPTH = 55;

    /** First cell row above the water. */
    public const int WATER_LEVEL = 61;

    /** The substrate heightmap holds one height per square of this many cells. */
    public const int SUBSTRATE_COLUMN = 4;

    /** Substrate depth of an unsculpted tank, in cells. */
    public const int DEFAULT_SUBSTRATE = 4;

    /** Wall clearance used when dividing the depth into layers (matches the client's MARGIN). */
    private const int LAYER_MARGIN = 4;

    /**
     * The grid dimensions sent to the browser.
     *
     * @return array{width: int, height: int, depth: int, water_level: int, substrate_column: int}
     */
    public static function grid(Tank $tank): array
    {
        return [
            'width' => self::WIDTH,
            'height' => self::HEIGHT,
            'depth' => self::DEPTH,
            'water_level' => self::waterLevel($tank),
            'substrate_column' => self::SUBSTRATE_COLUMN,
        ];
    }

    public static function waterLevel(Tank $tank): int
    {
        return self::WATER_LEVEL;
    }

    /**
     * Whether a cell row lies below the water line.
     */
    public static function isSubmerged(Tank $tank, int $y): bool
    {
        return $y < self::waterLevel($tank);
    }

    /**
     * The substrate heightmap's column counts along x and z.
     *
     * @return array{0: int, 1: int}
     */
    public static function substrateColumns(): array
    {
        return [
            (int) ceil(self::WIDTH / self::SUBSTRATE_COLUMN),
            (int) ceil(self::DEPTH / self::SUBSTRATE_COLUMN),
        ];
    }

    /**
     * The full substrate heightmap, row by row from the back glass (index = row * columns + column).
     *
     * @return list<int>
     */
    public static function substrateHeights(Tank $tank): array
    {
        [$columns, $rows] = self::substrateColumns();
        $stored = $tank->substrate_heights ?? [];

        return array_map(
            fn (int $index): int => (int) ($stored[$index] ?? self::DEFAULT_SUBSTRATE),
            range(0, $columns * $rows - 1),
        );
    }

    /**
     * Height of the substrate's surface above the glass floor at a grid column.
     */
    public static function substrateHeightAt(Tank $tank, int $x, int $z): int
    {
        [$columns, $rows] = self::substrateColumns();
        $column = min($columns - 1, max(0, intdiv($x, self::SUBSTRATE_COLUMN)));
        $row = min($rows - 1, max(0, intdiv($z, self::SUBSTRATE_COLUMN)));

        return self::substrateHeights($tank)[$row * $columns + $column];
    }

    /**
     * The highest substrate surface beneath a floor plan.
     */
    public static function highestSubstrateUnder(Tank $tank, GridBox $box): int
    {
        $heights = self::substrateHeights($tank);
        [$columns, $rows] = self::substrateColumns();
        $highest = 0;

        for ($row = intdiv($box->z, self::SUBSTRATE_COLUMN); $row <= min($rows - 1, intdiv($box->maxZ() - 1, self::SUBSTRATE_COLUMN)); $row++) {
            for ($column = intdiv($box->x, self::SUBSTRATE_COLUMN); $column <= min($columns - 1, intdiv($box->maxX() - 1, self::SUBSTRATE_COLUMN)); $column++) {
                $highest = max($highest, $heights[$row * $columns + $column]);
            }
        }

        return $highest;
    }

    /**
     * Whether a box lies entirely inside the tank.
     */
    public static function contains(Tank $tank, GridBox $box): bool
    {
        return $box->x >= 0 && $box->y >= 0 && $box->z >= 0
            && $box->maxX() <= self::WIDTH && $box->maxY() <= self::HEIGHT && $box->maxZ() <= self::DEPTH;
    }

    /**
     * The box a placed decoration occupies, after its rotation.
     */
    public static function footprint(Decoration $decoration): GridBox
    {
        [$width, $height, $depth] = $decoration->definition()->rotatedSize($decoration->rotation);

        return new GridBox($decoration->x, $decoration->y, $decoration->z, $width, $height, $depth);
    }

    /**
     * The tank cell of one of a placed decoration's anchors.
     *
     * @return array{0: int, 1: int, 2: int}
     */
    public static function anchorCell(Decoration $decoration, int $anchorIndex): array
    {
        $definition = $decoration->definition();
        [$x, $y, $z] = $definition->rotateCell($definition->anchors[$anchorIndex], $decoration->rotation);

        return [$decoration->x + $x, $decoration->y + $y, $decoration->z + $z];
    }

    /**
     * The decorations that rest on the substrate, so plants cannot root beneath them.
     *
     * @param  iterable<Decoration>  $decorations
     * @return list<GridBox>
     */
    public static function groundedFootprints(Tank $tank, iterable $decorations): array
    {
        $grounded = [];

        foreach ($decorations as $decoration) {
            $box = self::footprint($decoration);

            if ($box->y <= self::highestSubstrateUnder($tank, $box) + 1) {
                $grounded[] = $box;
            }
        }

        return $grounded;
    }

    /**
     * The grid column under a substrate-rooted plant (normalised x, depth layer).
     *
     * @return array{0: int, 1: int}
     */
    public static function plantColumn(float $rootX, int $layer, int $layerCount): array
    {
        $layerDepth = (self::DEPTH - 2 * self::LAYER_MARGIN) / max(1, $layerCount);

        return [
            min(self::WIDTH - 1, max(0, (int) floor($rootX * self::WIDTH))),
            (int) floor(self::LAYER_MARGIN + ($layer + 0.5) * $layerDepth),
        ];
    }

    /**
     * The normalised x (0..1) at the centre of a grid column.
     */
    public static function normalisedX(int $x): float
    {
        return ($x + 0.5) / self::WIDTH;
    }

    /**
     * The depth layer containing a grid row along z.
     */
    public static function layerAt(int $z, int $layerCount): int
    {
        $layerDepth = (self::DEPTH - 2 * self::LAYER_MARGIN) / max(1, $layerCount);
        $layer = (int) floor(($z + 0.5 - self::LAYER_MARGIN) / $layerDepth);

        return min($layerCount - 1, max(0, $layer));
    }
}
