<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('tanks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->unsignedSmallInteger('volume_litres');
            $table->double('temperature')->default(25);
            $table->double('target_temperature')->default(25);
            $table->double('ph')->default(7.2);
            $table->double('ammonia')->default(0);
            $table->double('nitrite')->default(0);
            $table->double('nitrate')->default(0);
            $table->double('oxygen')->default(8);
            $table->double('co2')->default(3);
            $table->double('detritus')->default(0);
            $table->double('uneaten_food')->default(0);
            $table->double('algae')->default(0);
            $table->double('bacteria')->default(0.01);
            $table->boolean('light_on')->default(true);
            $table->boolean('is_active')->default(true)->index();
            $table->unsignedBigInteger('sim_tick')->default(0);
            $table->unsignedBigInteger('sim_seconds')->default(0);
            $table->unsignedInteger('rng_seed');
            $table->timestamp('last_simulated_at')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('tanks');
    }
};
