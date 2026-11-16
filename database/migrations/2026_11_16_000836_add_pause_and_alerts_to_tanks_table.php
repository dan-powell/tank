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
            $table->boolean('is_paused')->default(false)->after('is_active')->index();
            $table->timestamp('paused_at')->nullable()->after('is_paused');
            $table->string('pause_reason', 16)->nullable()->after('paused_at');
            $table->json('alert_settings')->nullable()->after('pause_reason');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('tanks', function (Blueprint $table) {
            $table->dropIndex(['is_paused']);
            $table->dropColumn(['is_paused', 'paused_at', 'pause_reason', 'alert_settings']);
        });
    }
};
