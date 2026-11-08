<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Per-column substrate depth (in decoration grid cells); null means flat.
 */
return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('tanks', function (Blueprint $table) {
            $table->json('substrate_heights')->nullable()->after('layer_count');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('tanks', function (Blueprint $table) {
            $table->dropColumn('substrate_heights');
        });
    }
};
