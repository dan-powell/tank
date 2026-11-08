<?php

use App\Http\Controllers\DashboardController;
use App\Http\Controllers\TankAutoFeederController;
use App\Http\Controllers\TankController;
use App\Http\Controllers\TankCreatureController;
use App\Http\Controllers\TankDecorationController;
use App\Http\Controllers\TankMaintenanceController;
use App\Http\Controllers\TankPlantController;
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
        ->scopeBindings()
        ->group(function () {
            Route::post('feed', [TankMaintenanceController::class, 'feed'])->name('feed');
            Route::post('water-change', [TankMaintenanceController::class, 'changeWater'])->name('water-change');
            Route::post('vacuum', [TankMaintenanceController::class, 'vacuum'])->name('vacuum');
            Route::post('scrub', [TankMaintenanceController::class, 'scrub'])->name('scrub');
            Route::post('light', [TankMaintenanceController::class, 'toggleLight'])->name('light');
            Route::post('stock', [TankStockController::class, 'store'])->name('stock');
            Route::put('auto-feeder', [TankAutoFeederController::class, 'update'])->name('auto-feeder.update');
            Route::delete('auto-feeder', [TankAutoFeederController::class, 'destroy'])->name('auto-feeder.destroy');
            Route::post('auto-feeder/refill', [TankAutoFeederController::class, 'refill'])->name('auto-feeder.refill');
            Route::patch('creatures/{creature}', [TankCreatureController::class, 'update'])->name('creatures.update');
            Route::delete('creatures/{creature}', [TankCreatureController::class, 'destroy'])->name('creatures.destroy');
            Route::patch('plants/{plant}', [TankPlantController::class, 'update'])->name('plants.update');
            Route::delete('plants/{plant}', [TankPlantController::class, 'destroy'])->name('plants.destroy');
            Route::post('decorations', [TankDecorationController::class, 'store'])->name('decorations.store');
            Route::patch('decorations/{decoration}', [TankDecorationController::class, 'update'])->name('decorations.update');
            Route::delete('decorations/{decoration}', [TankDecorationController::class, 'destroy'])->name('decorations.destroy');
        });
});

require __DIR__.'/settings.php';
