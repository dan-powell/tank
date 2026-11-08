<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The air above the water (humidity %, oxygen % by volume, CO2 ppm) and
 * whether the tank's lid is sealed, cutting it off from the room.
 */
return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('tanks', function (Blueprint $table) {
            $table->double('humidity')->default(70)->after('bacteria');
            $table->double('air_oxygen')->default(20.9)->after('humidity');
            $table->double('air_co2')->default(420)->after('air_oxygen');
            $table->boolean('is_sealed')->default(false)->after('light_on');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('tanks', function (Blueprint $table) {
            $table->dropColumn(['humidity', 'air_oxygen', 'air_co2', 'is_sealed']);
        });
    }
};
