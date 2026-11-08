<?php

namespace App\Simulation;

use App\Enums\Habitat;
use App\Models\Decoration;
use App\Models\Tank;

/**
 * The tank's physical layout on the decoration grid.
 *
 * The grid divides a tank's interior into 0.2 cm cells, from the glass floor
 * (y = 0) to the rim, with x running left to right and z from the back glass
 * (z = 0) to the front. Decorations, the substrate and the water level are all
 * measured in these cells, so none of them depends on the others.
 */
final class TankGeometry
{
    /** Grid cells per centimetre. */
    public const int CELLS_PER_CM = 5;

    /** Interior size of a starter tank (60 x 32.6 x 27.6 cm), in cells. */
    public const int DEFAULT_WIDTH = 300;

    public const int DEFAULT_HEIGHT = 163;

    public const int DEFAULT_DEPTH = 138;

    /** Allowed interior sizes, in whole centimetres: [min, max]. */
    public const array WIDTH_CM = [20, 120];

    public const array HEIGHT_CM = [20, 60];

    public const array DEPTH_CM = [15, 50];

    /** Smallest gap between a full tank's water line and the rim, in cells. */
    public const int RIM_GAP = 10;

    /** Spacing of the lattice (1 cm) that dry ground and plant root spots are sampled on, in cells. */
    public const int SAMPLE_SPACING = 5;

    /** Substrate depth of an unsculpted tank, in cells (2 cm). */
    public const int DEFAULT_SUBSTRATE = 10;

    /** Target thickness of one depth layer, in cells (5.6 cm). */
    private const int LAYER_CELLS = 28;

    /** Wall clearance used when dividing the depth into layers, 2 cm (matches the client's MARGIN). */
    private const int LAYER_MARGIN = 10;

    /** How far below the water line an emergent plant's roots may sit, in cells (3 cm). */
    private const int EMERGENT_BELOW = 15;

    /** How far above the water line an emergent plant's roots may sit, in cells (2 cm). */
    private const int EMERGENT_ABOVE = 10;

    /** Litres held by one grid cell (0.2 cm cubed). */
    private const float LITRES_PER_CELL = 0.000008;

    /**
     * The grid dimensions sent to the browser.
     *
     * @return array{width: int, height: int, depth: int, water_level: int, max_water_level: int}
     */
    public static function grid(Tank $tank): array
    {
        return [
            'width' => $tank->grid_width,
            'height' => $tank->grid_height,
            'depth' => $tank->grid_depth,
            'water_level' => self::waterLevel($tank),
            'max_water_level' => self::maxWaterLevel($tank->grid_height),
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
        $waterLevel = self::waterLevel($tank);
        $cells = 0;

        foreach (self::substrateHeights($tank) as $height) {
            if ($height < $waterLevel) {
                $cells += $waterLevel - $height;
            }
        }

        return $cells;
    }

    /**
     * The volume of air inside the tank: above the water and the substrate, up to the rim.
     */
    public static function airLitres(Tank $tank): float
    {
        $waterLevel = self::isDry($tank) ? 0 : self::waterLevel($tank);
        $cells = 0;

        foreach (self::substrateHeights($tank) as $height) {
            $cells += max(0, $tank->grid_height - max($waterLevel, $height));
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
     * Dry ground above the water, sampled once per square centimetre (see
     * SAMPLE_SPACING): the substrate where its surface is out of the water,
     * or the top of a decoration standing clear of it. Each is the cell at
     * the square's centre, standing on the surface: [x, y, z].
     *
     * @param  iterable<Decoration>  $decorations
     * @return list<array{0: int, 1: int, 2: int}>
     */
    public static function landColumns(Tank $tank, iterable $decorations): array
    {
        $heightmap = SubstrateHeightmap::of($tank);
        $dry = self::isDry($tank);
        $waterLevel = self::waterLevel($tank);
        $raised = array_values(array_filter(
            array_map(self::footprint(...), is_array($decorations) ? $decorations : iterator_to_array($decorations, false)),
            fn (GridBox $box): bool => $dry || $box->maxY() >= $waterLevel,
        ));
        $half = intdiv(self::SAMPLE_SPACING, 2);
        $land = [];

        for ($z = min($half, $tank->grid_depth - 1); $z < $tank->grid_depth; $z += self::SAMPLE_SPACING) {
            for ($x = min($half, $tank->grid_width - 1); $x < $tank->grid_width; $x += self::SAMPLE_SPACING) {
                $height = $heightmap->heightAt($x, $z);
                $surface = $dry || $height >= $waterLevel ? $height : null;

                foreach ($raised as $box) {
                    if ($box->coversColumn($x, $z) && ($surface === null || $surface < $box->maxY())) {
                        $surface = $box->maxY();
                    }
                }

                if ($surface !== null) {
                    $land[] = [$x, $surface, $z];
                }
            }
        }

        return $land;
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
        $sampleCm = self::SAMPLE_SPACING / self::CELLS_PER_CM;

        return count(self::landColumns($tank, $decorations)) * $sampleCm * $sampleCm;
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
        $heightmap = SubstrateHeightmap::of($tank);
        $footprints = self::groundedFootprints($tank, $decorations);
        $hasWater = ! self::isDry($tank);
        $waterLevel = self::waterLevel($tank);
        $spots = [];

        for ($layer = 0; $layer <= ($maxLayer ?? $tank->layer_count - 1); $layer++) {
            for ($x = 1; $x < $tank->grid_width; $x += self::SAMPLE_SPACING) {
                $rootX = self::normalisedX($x, $tank->grid_width);

                if ($rootX < 0.06 || $rootX > 0.94) {
                    continue;
                }

                [$columnX, $columnZ] = self::plantColumn($rootX, $layer, $tank->layer_count, $tank->grid_width, $tank->grid_depth);
                $height = $heightmap->heightAt($columnX, $columnZ);

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
     * The full substrate heightmap: one height per grid column, row by row from the back glass (index = z * width + x).
     *
     * @return list<int>
     */
    public static function substrateHeights(Tank $tank): array
    {
        return SubstrateHeightmap::of($tank)->heights();
    }

    /**
     * Height of the substrate's surface above the glass floor at a grid column.
     */
    public static function substrateHeightAt(Tank $tank, int $x, int $z): int
    {
        return SubstrateHeightmap::of($tank)->heightAt($x, $z);
    }

    /**
     * The highest substrate surface beneath a floor plan.
     */
    public static function highestSubstrateUnder(Tank $tank, GridBox $box): int
    {
        $heightmap = SubstrateHeightmap::of($tank);
        $highest = 0;

        for ($z = max(0, $box->z); $z < min($tank->grid_depth, $box->maxZ()); $z++) {
            for ($x = max(0, $box->x); $x < min($tank->grid_width, $box->maxX()); $x++) {
                $highest = max($highest, $heightmap->heightAt($x, $z));
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
