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
        Schema::table('tanks', function (Blueprint $table) {
            $table->boolean('auto_feeder_installed')->default(false)->after('light_on');
            $table->unsignedTinyInteger('auto_feeder_feeds_per_day')->default(2)->after('auto_feeder_installed');
            $table->boolean('auto_feeder_unlimited')->default(false)->after('auto_feeder_feeds_per_day');
            $table->unsignedSmallInteger('auto_feeder_portions')->default(0)->after('auto_feeder_unlimited');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('tanks', function (Blueprint $table) {
            $table->dropColumn([
                'auto_feeder_installed',
                'auto_feeder_feeds_per_day',
                'auto_feeder_unlimited',
                'auto_feeder_portions',
            ]);
        });
    }
};
