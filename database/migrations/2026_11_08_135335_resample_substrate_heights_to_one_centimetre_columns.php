<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * The substrate heightmap moves from 2 cm (4 cell) columns to 1 cm (2 cell)
 * columns. Each sculpted heightmap is resampled: every old column becomes
 * the 2 x 2 new columns it covered.
 */
return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        $this->resample(from: 4, to: 2);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        $this->resample(from: 2, to: 4);
    }

    private function resample(int $from, int $to): void
    {
        DB::table('tanks')->whereNotNull('substrate_heights')->orderBy('id')
            ->chunkById(100, function ($tanks) use ($from, $to): void {
                foreach ($tanks as $tank) {
                    $old = json_decode($tank->substrate_heights, true);
                    $oldColumns = (int) ceil($tank->grid_width / $from);
                    $newColumns = (int) ceil($tank->grid_width / $to);
                    $newRows = (int) ceil($tank->grid_depth / $to);
                    $heights = [];

                    for ($row = 0; $row < $newRows; $row++) {
                        for ($column = 0; $column < $newColumns; $column++) {
                            $oldColumn = intdiv($column * $to, $from);
                            $oldRow = intdiv($row * $to, $from);
                            $heights[] = (int) ($old[$oldRow * $oldColumns + $oldColumn] ?? 4);
                        }
                    }

                    DB::table('tanks')->where('id', $tank->id)->update(['substrate_heights' => json_encode($heights)]);
                }
            });
    }
};
