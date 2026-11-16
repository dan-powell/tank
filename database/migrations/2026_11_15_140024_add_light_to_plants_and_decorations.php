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
        Schema::table('plants', function (Blueprint $table) {
            $table->double('light')->default(0)->after('health');
        });

        Schema::table('decorations', function (Blueprint $table) {
            $table->boolean('lights_on')->default(false)->after('seed');
            $table->char('light_colour', 7)->nullable()->after('lights_on');
            $table->string('light_mode')->default('timer')->after('light_colour');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('plants', function (Blueprint $table) {
            $table->dropColumn('light');
        });

        Schema::table('decorations', function (Blueprint $table) {
            $table->dropColumn(['lights_on', 'light_colour', 'light_mode']);
        });
    }
};
