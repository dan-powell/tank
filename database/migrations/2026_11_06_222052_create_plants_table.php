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
        Schema::create('plants', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tank_id')->constrained()->cascadeOnDelete();
            $table->foreignId('species_id')->constrained();
            $table->foreignId('parent_id')->nullable()->constrained('plants')->nullOnDelete();
            $table->double('root_x');
            $table->double('root_y');
            $table->double('root_z');
            $table->double('size');
            $table->unsignedSmallInteger('segments');
            $table->double('health')->default(1);
            $table->unsignedBigInteger('age_seconds')->default(0);
            $table->timestamp('died_at')->nullable();
            $table->timestamps();

            $table->index(['tank_id', 'died_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('plants');
    }
};
