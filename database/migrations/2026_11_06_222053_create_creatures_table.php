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
        Schema::create('creatures', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tank_id')->constrained()->cascadeOnDelete();
            $table->foreignId('species_id')->constrained();
            $table->foreignId('mother_id')->nullable()->constrained('creatures')->nullOnDelete();
            $table->foreignId('father_id')->nullable()->constrained('creatures')->nullOnDelete();
            $table->string('nickname')->nullable();
            $table->string('sex');
            $table->double('size');
            $table->double('hunger')->default(0);
            $table->double('health')->default(1);
            $table->unsignedBigInteger('age_seconds')->default(0);
            $table->unsignedBigInteger('gestation_seconds')->nullable();
            $table->double('zone_x');
            $table->double('zone_y');
            $table->double('zone_z');
            $table->double('zone_radius');
            $table->unsignedSmallInteger('generation')->default(1);
            $table->timestamp('died_at')->nullable();
            $table->string('death_cause')->nullable();
            $table->timestamps();

            $table->index(['tank_id', 'died_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('creatures');
    }
};
