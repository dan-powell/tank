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
        Schema::create('decorations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tank_id')->constrained()->cascadeOnDelete();
            $table->string('type');
            $table->unsignedSmallInteger('x');
            $table->unsignedSmallInteger('y');
            $table->unsignedSmallInteger('z');
            $table->unsignedTinyInteger('rotation')->default(0);
            $table->unsignedInteger('seed')->default(0);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('decorations');
    }
};
