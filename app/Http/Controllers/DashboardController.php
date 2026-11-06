<?php

namespace App\Http\Controllers;

use App\Models\Tank;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    /**
     * List the user's tanks.
     */
    public function __invoke(Request $request): Response
    {
        $tanks = $request->user()->tanks()
            ->withCount([
                'creatures as creatures_count' => fn ($query) => $query->alive(),
                'plants as plants_count' => fn ($query) => $query->alive(),
            ])
            ->orderBy('id')
            ->get()
            ->map(fn (Tank $tank): array => [
                'id' => $tank->id,
                'name' => $tank->name,
                'volume_litres' => $tank->volume_litres,
                'creatures_count' => $tank->creatures_count,
                'plants_count' => $tank->plants_count,
                'temperature' => round($tank->temperature, 1),
                'ammonia' => round($tank->ammonia, 2),
                'nitrate' => round($tank->nitrate, 1),
            ]);

        return Inertia::render('dashboard', [
            'tanks' => $tanks,
        ]);
    }
}
