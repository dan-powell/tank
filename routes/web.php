<?php

use App\Http\Controllers\DashboardController;
use App\Http\Controllers\TankController;
use App\Http\Controllers\TankMaintenanceController;
use App\Http\Controllers\TankStockController;
use Illuminate\Support\Facades\Route;

Route::inertia('/', 'welcome')->name('home');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('dashboard', DashboardController::class)->name('dashboard');

    Route::post('tanks', [TankController::class, 'store'])->name('tanks.store');
    Route::get('tanks/{tank}', [TankController::class, 'show'])->can('view', 'tank')->name('tanks.show');

    Route::prefix('tanks/{tank}')
        ->name('tanks.')
        ->middleware(['can:update,tank', 'throttle:tank-actions'])
        ->group(function () {
            Route::post('feed', [TankMaintenanceController::class, 'feed'])->name('feed');
            Route::post('water-change', [TankMaintenanceController::class, 'changeWater'])->name('water-change');
            Route::post('vacuum', [TankMaintenanceController::class, 'vacuum'])->name('vacuum');
            Route::post('scrub', [TankMaintenanceController::class, 'scrub'])->name('scrub');
            Route::post('light', [TankMaintenanceController::class, 'toggleLight'])->name('light');
            Route::post('stock', [TankStockController::class, 'store'])->name('stock');
        });
});

require __DIR__.'/settings.php';
