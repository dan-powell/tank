<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The backdrop behind the tank: a hex colour, fading to a second one down
 * the view when a gradient is chosen (null = a solid colour).
 */
return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('tanks', function (Blueprint $table) {
            $table->string('background_colour', 7)->default('#2c3e52')->after('is_sealed');
            $table->string('background_gradient_colour', 7)->nullable()->after('background_colour');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('tanks', function (Blueprint $table) {
            $table->dropColumn(['background_colour', 'background_gradient_colour']);
        });
    }
};
