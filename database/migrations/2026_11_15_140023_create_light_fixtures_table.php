<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Existing tanks get the light new tanks start with: one LED tube the
     * full length of the gantry's middle row, on from 08:00 to 20:00 (as the
     * old lamp was). The gantry sizing is inlined so later changes to it
     * don't change what this migration did.
     */
    public function up(): void
    {
        Schema::create('light_fixtures', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tank_id')->constrained()->cascadeOnDelete();
            $table->string('type');
            $table->unsignedTinyInteger('column');
            $table->unsignedTinyInteger('row');
            $table->unsignedTinyInteger('length')->default(1);
            $table->char('colour', 7);
            $table->unsignedTinyInteger('brightness')->default(80);
            $table->unsignedSmallInteger('on_minute')->default(480);
            $table->unsignedSmallInteger('off_minute')->default(1200);
            $table->unsignedTinyInteger('ramp_minutes')->default(30);
            $table->timestamps();
        });

        DB::table('tanks')->orderBy('id')->each(function (object $tank): void {
            $columns = max(2, (int) floor($tank->grid_width / 5 / 5));
            $rows = min(4, max(2, (int) round($tank->grid_depth / 5 / 9)));

            DB::table('light_fixtures')->insert([
                'tank_id' => $tank->id,
                'type' => 'led-tube',
                'column' => 0,
                'row' => intdiv($rows - 1, 2),
                'length' => $columns,
                'colour' => '#f4f7ff',
                'brightness' => 80,
                'on_minute' => 480,
                'off_minute' => 1200,
                'ramp_minutes' => 30,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('light_fixtures');
    }
};
