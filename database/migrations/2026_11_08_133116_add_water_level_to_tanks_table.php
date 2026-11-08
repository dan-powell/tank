<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Let each tank hold its own amount of water: the first grid cell row above
 * the water. Existing tanks stay filled to 2 cm below the rim.
 */
return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('tanks', function (Blueprint $table) {
            $table->unsignedSmallInteger('water_level')->default(61)->after('grid_depth');
        });

        DB::table('tanks')->update(['water_level' => DB::raw('grid_height - 4')]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('tanks', function (Blueprint $table) {
            $table->dropColumn('water_level');
        });
    }
};
