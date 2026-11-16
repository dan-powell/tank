<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Whether the tank pauses when this animal is close to death: null
     * follows its species' setting.
     */
    public function up(): void
    {
        Schema::table('creatures', function (Blueprint $table) {
            $table->boolean('pause_when_dying')->nullable()->after('moods');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('creatures', function (Blueprint $table) {
            $table->dropColumn('pause_when_dying');
        });
    }
};
