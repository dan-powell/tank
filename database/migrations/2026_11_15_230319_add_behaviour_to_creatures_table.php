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
        Schema::table('creatures', function (Blueprint $table) {
            $table->string('intent')->default('wander')->after('generation');
            $table->unsignedInteger('intent_seconds')->default(0)->after('intent');
            $table->json('moods')->nullable()->after('intent_seconds');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('creatures', function (Blueprint $table) {
            $table->dropColumn(['intent', 'intent_seconds', 'moods']);
        });
    }
};
