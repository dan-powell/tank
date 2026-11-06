<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Replace continuous depth (zone_z / root_z) with discrete depth layers.
 */
return new class extends Migration
{
    private const DEFAULT_LAYERS = 5;

    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('tanks', function (Blueprint $table) {
            $table->unsignedTinyInteger('layer_count')->default(self::DEFAULT_LAYERS)->after('volume_litres');
        });

        Schema::table('creatures', function (Blueprint $table) {
            $table->unsignedTinyInteger('layer')->default(0)->after('zone_y');
        });

        Schema::table('plants', function (Blueprint $table) {
            $table->unsignedTinyInteger('layer')->default(0)->after('root_y');
        });

        $this->backfillLayers('creatures', 'zone_z');
        $this->backfillLayers('plants', 'root_z');

        Schema::table('creatures', function (Blueprint $table) {
            $table->dropColumn('zone_z');
        });

        Schema::table('plants', function (Blueprint $table) {
            $table->dropColumn('root_z');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('creatures', function (Blueprint $table) {
            $table->double('zone_z')->default(0.5)->after('zone_y');
        });

        Schema::table('plants', function (Blueprint $table) {
            $table->double('root_z')->default(0.3)->after('root_y');
        });

        $layers = self::DEFAULT_LAYERS;
        DB::table('creatures')->update(['zone_z' => DB::raw("(layer + 0.5) / {$layers}")]);
        DB::table('plants')->update(['root_z' => DB::raw("(layer + 0.5) / {$layers}")]);

        Schema::table('creatures', function (Blueprint $table) {
            $table->dropColumn('layer');
        });

        Schema::table('plants', function (Blueprint $table) {
            $table->dropColumn('layer');
        });

        Schema::table('tanks', function (Blueprint $table) {
            $table->dropColumn('layer_count');
        });
    }

    /**
     * Convert a normalised 0..1 depth column into a layer index.
     */
    private function backfillLayers(string $table, string $depthColumn): void
    {
        DB::table($table)->select(['id', $depthColumn])->orderBy('id')->chunkById(500, function ($rows) use ($table, $depthColumn): void {
            foreach ($rows as $row) {
                $layer = min(self::DEFAULT_LAYERS - 1, max(0, (int) floor($row->{$depthColumn} * self::DEFAULT_LAYERS)));

                DB::table($table)->where('id', $row->id)->update(['layer' => $layer]);
            }
        });
    }
};
