<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Let plants grow from an anchor point on a decoration instead of the substrate.
 */
return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('plants', function (Blueprint $table) {
            $table->foreignId('decoration_id')->nullable()->after('layer')->constrained()->nullOnDelete();
            $table->unsignedTinyInteger('anchor_index')->nullable()->after('decoration_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('plants', function (Blueprint $table) {
            $table->dropConstrainedForeignId('decoration_id');
            $table->dropColumn('anchor_index');
        });
    }
};
