<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * The grid moves from 0.5 cm cells to 0.2 cm cells, so every voxel in the
 * tank (decorations, gravel and animals alike) is the same size. Sizes,
 * water levels, substrate heights and decoration positions are scaled by
 * 2.5. The substrate heightmap keeps its 1 cm columns, so only its values
 * change. Plant and creature positions are normalised and need no change.
 *
 * Column defaults are left alone: changing them rebuilds the table on SQLite,
 * which cascades to decorations, and every tank is created with an explicit
 * size from TankGeometry anyway.
 */
return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        $this->rescale(factor: 2.5, column: 5, litresPerCell: 0.000008, substrate: 10, roundContents: false);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        $this->rescale(factor: 0.4, column: 2, litresPerCell: 0.000125, substrate: 4, roundContents: true);
    }

    /**
     * Scale every tank and its decorations. Tank sizes round to the nearest
     * cell; positions inside the tank round down on the way up, so nothing
     * is pushed through the glass.
     */
    private function rescale(float $factor, int $column, float $litresPerCell, int $substrate, bool $roundContents): void
    {
        $inside = fn (int $value): int => (int) ($roundContents ? round($value * $factor) : floor($value * $factor));

        DB::table('tanks')->orderBy('id')->chunkById(100, function ($tanks) use ($factor, $column, $litresPerCell, $substrate, $inside): void {
            foreach ($tanks as $tank) {
                $width = (int) round($tank->grid_width * $factor);
                $depth = (int) round($tank->grid_depth * $factor);
                $waterLevel = $inside($tank->water_level);
                $heights = $tank->substrate_heights === null
                    ? null
                    : array_map(fn (int|string $height): int => $inside((int) $height), json_decode($tank->substrate_heights, true));

                DB::table('tanks')->where('id', $tank->id)->update([
                    'grid_width' => $width,
                    'grid_height' => (int) round($tank->grid_height * $factor),
                    'grid_depth' => $depth,
                    'water_level' => $waterLevel,
                    'substrate_heights' => $heights === null ? null : json_encode($heights),
                    'volume_litres' => $this->litres($width, $depth, $waterLevel, $heights, $column, $litresPerCell, $substrate),
                ]);
            }
        });

        DB::table('decorations')->orderBy('id')->chunkById(500, function ($decorations) use ($inside): void {
            foreach ($decorations as $decoration) {
                DB::table('decorations')->where('id', $decoration->id)->update([
                    'x' => $inside($decoration->x),
                    'y' => $inside($decoration->y),
                    'z' => $inside($decoration->z),
                ]);
            }
        });
    }

    /**
     * The water held above the substrate (see TankGeometry::waterLitres()).
     *
     * @param  list<int>|null  $heights
     */
    private function litres(int $width, int $depth, int $waterLevel, ?array $heights, int $column, float $litresPerCell, int $substrate): int
    {
        $columns = (int) ceil($width / $column);
        $rows = (int) ceil($depth / $column);
        $cells = 0;

        for ($row = 0; $row < $rows; $row++) {
            $rowDepth = min($column, $depth - $row * $column);

            for ($index = 0; $index < $columns; $index++) {
                $columnWidth = min($column, $width - $index * $column);
                $ground = $heights[$row * $columns + $index] ?? $substrate;
                $cells += $rowDepth * $columnWidth * max(0, $waterLevel - $ground);
            }
        }

        return (int) round($cells * $litresPerCell);
    }
};
