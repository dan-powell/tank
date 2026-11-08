<?php

namespace App\Simulation;

use App\Enums\Habitat;
use App\Models\Decoration;
use App\Models\Tank;

/**
 * The tank's physical layout on the decoration grid.
 *
 * The grid divides a tank's interior into 0.5 cm cells, from the glass floor
 * (y = 0) to the rim, with x running left to right and z from the back glass
 * (z = 0) to the front. Decorations, the substrate and the water level are all
 * measured in these cells, so none of them depends on the others.
 */
final class TankGeometry
{
    /** Grid cells per centimetre. */
    public const int CELLS_PER_CM = 2;

    /** Interior size of a starter tank (60 x 32.5 x 27.5 cm), in cells. */
    public const int DEFAULT_WIDTH = 120;

    public const int DEFAULT_HEIGHT = 65;

    public const int DEFAULT_DEPTH = 55;

    /** Allowed interior sizes, in whole centimetres: [min, max]. */
    public const array WIDTH_CM = [20, 120];

    public const array HEIGHT_CM = [20, 60];

    public const array DEPTH_CM = [15, 50];

    /** Smallest gap between a full tank's water line and the rim, in cells. */
    public const int RIM_GAP = 4;

    /** The substrate heightmap holds one height per square of this many cells. */
    public const int SUBSTRATE_COLUMN = 2;

    /** Substrate depth of an unsculpted tank, in cells. */
    public const int DEFAULT_SUBSTRATE = 4;

    /** Target thickness of one depth layer, in cells (5.5 cm). */
    private const int LAYER_CELLS = 11;

    /** Wall clearance used when dividing the depth into layers (matches the client's MARGIN). */
    private const int LAYER_MARGIN = 4;

    /** How far below the water line an emergent plant's roots may sit, in cells (3 cm). */
    private const int EMERGENT_BELOW = 6;

    /** How far above the water line an emergent plant's roots may sit, in cells (2 cm). */
    private const int EMERGENT_ABOVE = 4;

    /** Litres held by one grid cell (0.5 cm cubed). */
    private const float LITRES_PER_CELL = 0.000125;

    /**
     * The grid dimensions sent to the browser.
     *
     * @return array{width: int, height: int, depth: int, water_level: int, max_water_level: int, substrate_column: int}
     */
    public static function grid(Tank $tank): array
    {
        return [
            'width' => $tank->grid_width,
            'height' => $tank->grid_height,
            'depth' => $tank->grid_depth,
            'water_level' => self::waterLevel($tank),
            'max_water_level' => self::maxWaterLevel($tank->grid_height),
            'substrate_column' => self::SUBSTRATE_COLUMN,
        ];
    }

    /**
     * First cell row above the water.
     */
    public static function waterLevel(Tank $tank): int
    {
        return $tank->water_level;
    }

    /**
     * The highest water level a tank of this height (in cells) can be filled to.
     */
    public static function maxWaterLevel(int $height): int
    {
        return $height - self::RIM_GAP;
    }

    /**
     * The water level for a depth of water (cm) above an unsculpted substrate.
     */
    public static function waterLevelForDepth(float $depthCm): int
    {
        return self::DEFAULT_SUBSTRATE + (int) round($depthCm * self::CELLS_PER_CM);
    }

    /**
     * The deepest water (cm above an unsculpted substrate) a tank of this height (in cells) can hold.
     */
    public static function maxWaterDepthCm(int $height): float
    {
        return (self::maxWaterLevel($height) - self::DEFAULT_SUBSTRATE) / self::CELLS_PER_CM;
    }

    /**
     * Whether the tank holds no water at all.
     */
    public static function isDry(Tank $tank): bool
    {
        return self::waterCells($tank) === 0;
    }

    /**
     * Whether a cell row lies below the water line.
     */
    public static function isSubmerged(Tank $tank, int $y): bool
    {
        return $y < self::waterLevel($tank);
    }

    /**
     * How many depth layers a tank of this depth (in cells) is divided into.
     */
    public static function layerCountFor(int $depth): int
    {
        return max(2, (int) round($depth / self::LAYER_CELLS));
    }

    /**
     * The volume of water in the tank, from the substrate's surface up to the water line.
     */
    public static function waterLitres(Tank $tank): int
    {
        return (int) round(self::waterCells($tank) * self::LITRES_PER_CELL);
    }

    /**
     * How many grid cells of water the tank holds.
     */
    private static function waterCells(Tank $tank): int
    {
        [$columns, $rows] = self::substrateColumns($tank);
        $heights = self::substrateHeights($tank);
        $waterLevel = self::waterLevel($tank);
        $cells = 0;

        for ($row = 0; $row < $rows; $row++) {
            $rowDepth = min(self::SUBSTRATE_COLUMN, $tank->grid_depth - $row * self::SUBSTRATE_COLUMN);

            for ($column = 0; $column < $columns; $column++) {
                $columnWidth = min(self::SUBSTRATE_COLUMN, $tank->grid_width - $column * self::SUBSTRATE_COLUMN);
                $cells += $rowDepth * $columnWidth * max(0, $waterLevel - $heights[$row * $columns + $column]);
            }
        }

        return $cells;
    }

    /**
     * The volume of air inside the tank: above the water and the substrate, up to the rim.
     */
    public static function airLitres(Tank $tank): float
    {
        [$columns, $rows] = self::substrateColumns($tank);
        $heights = self::substrateHeights($tank);
        $waterLevel = self::isDry($tank) ? 0 : self::waterLevel($tank);
        $cells = 0;

        for ($row = 0; $row < $rows; $row++) {
            $rowDepth = min(self::SUBSTRATE_COLUMN, $tank->grid_depth - $row * self::SUBSTRATE_COLUMN);

            for ($column = 0; $column < $columns; $column++) {
                $columnWidth = min(self::SUBSTRATE_COLUMN, $tank->grid_width - $column * self::SUBSTRATE_COLUMN);
                $floor = max($waterLevel, $heights[$row * $columns + $column]);
                $cells += $rowDepth * $columnWidth * max(0, $tank->grid_height - $floor);
            }
        }

        return $cells * self::LITRES_PER_CELL;
    }

    /**
     * The share (0..1) of the tank's floor plan covered by open water.
     */
    public static function waterSurfaceShare(Tank $tank): float
    {
        if (self::isDry($tank)) {
            return 0.0;
        }

        $heights = self::substrateHeights($tank);
        $waterLevel = self::waterLevel($tank);

        return count(array_filter($heights, fn (int $height): bool => $height < $waterLevel)) / count($heights);
    }

    /**
     * Dry ground above the water: substrate columns whose surface is out of
     * the water, plus the tops of decorations that stand clear of it. Each is
     * the cell at the column's centre, standing on the surface: [x, y, z].
     *
     * @param  iterable<Decoration>  $decorations
     * @return list<array{0: int, 1: int, 2: int}>
     */
    public static function landColumns(Tank $tank, iterable $decorations): array
    {
        [$columns, $rows] = self::substrateColumns($tank);
        $heights = self::substrateHeights($tank);
        $dry = self::isDry($tank);
        $waterLevel = self::waterLevel($tank);
        $land = [];
        $half = intdiv(self::SUBSTRATE_COLUMN, 2);

        for ($row = 0; $row < $rows; $row++) {
            for ($column = 0; $column < $columns; $column++) {
                $height = $heights[$row * $columns + $column];

                if ($dry || $height >= $waterLevel) {
                    $land[$row * $columns + $column] = [
                        min($tank->grid_width - 1, $column * self::SUBSTRATE_COLUMN + $half),
                        $height,
                        min($tank->grid_depth - 1, $row * self::SUBSTRATE_COLUMN + $half),
                    ];
                }
            }
        }

        foreach ($decorations as $decoration) {
            $box = self::footprint($decoration);

            if (! $dry && $box->maxY() < $waterLevel) {
                continue;
            }

            for ($row = intdiv($box->z, self::SUBSTRATE_COLUMN); $row <= intdiv($box->maxZ() - 1, self::SUBSTRATE_COLUMN) && $row < $rows; $row++) {
                for ($column = intdiv($box->x, self::SUBSTRATE_COLUMN); $column <= intdiv($box->maxX() - 1, self::SUBSTRATE_COLUMN) && $column < $columns; $column++) {
                    $index = $row * $columns + $column;

                    if (! isset($land[$index]) || $land[$index][1] < $box->maxY()) {
                        $land[$index] = [
                            min($tank->grid_width - 1, $column * self::SUBSTRATE_COLUMN + $half),
                            $box->maxY(),
                            min($tank->grid_depth - 1, $row * self::SUBSTRATE_COLUMN + $half),
                        ];
                    }
                }
            }
        }

        return array_values($land);
    }

    /**
     * Height of whatever stands highest at a grid column: the substrate or a
     * decoration over it.
     *
     * @param  iterable<Decoration>  $decorations
     */
    public static function surfaceAt(Tank $tank, iterable $decorations, int $x, int $z): int
    {
        $surface = self::substrateHeightAt($tank, $x, $z);

        foreach ($decorations as $decoration) {
            $box = self::footprint($decoration);

            if ($box->coversColumn($x, $z)) {
                $surface = max($surface, $box->maxY());
            }
        }

        return $surface;
    }

    /**
     * Square centimetres of dry ground (see landColumns()).
     *
     * @param  iterable<Decoration>  $decorations
     */
    public static function landAreaCm2(Tank $tank, iterable $decorations): float
    {
        $columnCm = self::SUBSTRATE_COLUMN / self::CELLS_PER_CM;

        return count(self::landColumns($tank, $decorations)) * $columnCm * $columnCm;
    }

    /**
     * Substrate positions (normalised x, depth layer) where a plant of the
     * given habitat could root: suitable ground no decoration rests on, in
     * layers up to `$maxLayer`.
     *
     * @param  iterable<Decoration>  $decorations
     * @return list<array{0: float, 1: int}>
     */
    public static function rootSpots(Tank $tank, Habitat $habitat, iterable $decorations, ?int $maxLayer = null): array
    {
        [$columns] = self::substrateColumns($tank);
        $heights = self::substrateHeights($tank);
        $footprints = self::groundedFootprints($tank, $decorations);
        $hasWater = ! self::isDry($tank);
        $waterLevel = self::waterLevel($tank);
        $spots = [];

        for ($layer = 0; $layer <= ($maxLayer ?? $tank->layer_count - 1); $layer++) {
            for ($x = 1; $x < $tank->grid_width; $x += self::SUBSTRATE_COLUMN) {
                $rootX = self::normalisedX($x, $tank->grid_width);

                if ($rootX < 0.06 || $rootX > 0.94) {
                    continue;
                }

                [$columnX, $columnZ] = self::plantColumn($rootX, $layer, $tank->layer_count, $tank->grid_width, $tank->grid_depth);
                $height = $heights[intdiv($columnZ, self::SUBSTRATE_COLUMN) * $columns + intdiv($columnX, self::SUBSTRATE_COLUMN)]
                    ?? self::DEFAULT_SUBSTRATE;

                if (array_any($footprints, fn (GridBox $box): bool => $box->coversColumn($columnX, $columnZ))) {
                    continue;
                }

                if (self::rootSuits($habitat, $height, $waterLevel, $hasWater)) {
                    $spots[] = [$rootX, $layer];
                }
            }
        }

        return $spots;
    }

    /**
     * Whether a plant of the given habitat can thrive with its roots in a grid row.
     */
    public static function rootSuits(Habitat $habitat, int $rootHeight, int $waterLevel, bool $hasWater): bool
    {
        return match ($habitat) {
            Habitat::Aquatic => $hasWater && $rootHeight < $waterLevel,
            Habitat::Terrestrial => ! $hasWater || $rootHeight >= $waterLevel,
            Habitat::Emergent => $hasWater
                && $rootHeight >= $waterLevel - self::EMERGENT_BELOW
                && $rootHeight <= $waterLevel + self::EMERGENT_ABOVE,
            Habitat::Amphibious => true,
        };
    }

    /**
     * The substrate heightmap's column counts along x and z.
     *
     * @return array{0: int, 1: int}
     */
    public static function substrateColumns(Tank $tank): array
    {
        return [
            (int) ceil($tank->grid_width / self::SUBSTRATE_COLUMN),
            (int) ceil($tank->grid_depth / self::SUBSTRATE_COLUMN),
        ];
    }

    /**
     * The full substrate heightmap, row by row from the back glass (index = row * columns + column).
     *
     * @return list<int>
     */
    public static function substrateHeights(Tank $tank): array
    {
        [$columns, $rows] = self::substrateColumns($tank);
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
        [$columns, $rows] = self::substrateColumns($tank);
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
        [$columns, $rows] = self::substrateColumns($tank);
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
            && $box->maxX() <= $tank->grid_width
            && $box->maxY() <= $tank->grid_height
            && $box->maxZ() <= $tank->grid_depth;
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
     * The grid column under a substrate-rooted plant (normalised x, depth layer)
     * in a tank of the given width and depth (in cells).
     *
     * @return array{0: int, 1: int}
     */
    public static function plantColumn(float $rootX, int $layer, int $layerCount, int $width, int $depth): array
    {
        return [
            min($width - 1, max(0, (int) floor($rootX * $width))),
            (int) floor(self::LAYER_MARGIN + ($layer + 0.5) * self::layerDepth($layerCount, $depth)),
        ];
    }

    /**
     * The normalised x (0..1) at the centre of a grid column.
     */
    public static function normalisedX(int $x, int $width): float
    {
        return ($x + 0.5) / $width;
    }

    /**
     * The depth layer containing a grid row along z.
     */
    public static function layerAt(int $z, int $layerCount, int $depth): int
    {
        $layer = (int) floor(($z + 0.5 - self::LAYER_MARGIN) / self::layerDepth($layerCount, $depth));

        return min($layerCount - 1, max(0, $layer));
    }

    private static function layerDepth(int $layerCount, int $depth): float
    {
        return ($depth - 2 * self::LAYER_MARGIN) / max(1, $layerCount);
    }
}
