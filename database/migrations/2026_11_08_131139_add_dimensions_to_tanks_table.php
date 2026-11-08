<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Give each tank its own interior size, in 0.5 cm decoration grid cells.
 * Existing tanks keep the size every tank used to share (60 x 32.5 x 27.5 cm),
 * and their volume becomes the water they actually hold.
 */
return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('tanks', function (Blueprint $table) {
            $table->unsignedSmallInteger('grid_width')->default(120)->after('volume_litres');
            $table->unsignedSmallInteger('grid_height')->default(65)->after('grid_width');
            $table->unsignedSmallInteger('grid_depth')->default(55)->after('grid_height');
        });

        // 120 x 55 cells of water from the substrate (4) to the water line (61), at 0.125 ml per cell.
        DB::table('tanks')->whereNull('substrate_heights')->update(['volume_litres' => 47]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::table('tanks')->update(['volume_litres' => 60]);

        Schema::table('tanks', function (Blueprint $table) {
            $table->dropColumn(['grid_width', 'grid_height', 'grid_depth']);
        });
    }
};
