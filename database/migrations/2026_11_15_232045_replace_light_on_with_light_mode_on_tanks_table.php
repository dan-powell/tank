<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * The master switch becomes three-way: lights on their timers, all on
     * or all off. Tanks switched off stay off; the rest follow their timers.
     */
    public function up(): void
    {
        Schema::table('tanks', function (Blueprint $table) {
            $table->string('light_mode', 8)->default('timer')->after('light_on');
        });

        DB::table('tanks')->where('light_on', false)->update(['light_mode' => 'off']);

        Schema::table('tanks', function (Blueprint $table) {
            $table->dropColumn('light_on');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('tanks', function (Blueprint $table) {
            $table->boolean('light_on')->default(true)->after('light_mode');
        });

        DB::table('tanks')->where('light_mode', 'off')->update(['light_on' => false]);

        Schema::table('tanks', function (Blueprint $table) {
            $table->dropColumn('light_mode');
        });
    }
};
