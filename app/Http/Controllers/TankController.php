<?php

namespace App\Http\Controllers;

use App\Actions\Tank\CreateStarterTank;
use App\Http\Resources\SpeciesResource;
use App\Http\Resources\TankEventResource;
use App\Http\Resources\TankResource;
use App\Models\Species;
use App\Models\Tank;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class TankController extends Controller
{
    /**
     * Show the 3D tank view.
     */
    public function show(Tank $tank): Response
    {
        $tank->load([
            'plants' => fn ($query) => $query->alive()->orderBy('id'),
            'creatures' => fn ($query) => $query->alive()->orderBy('id'),
        ]);

        return Inertia::render('tanks/show', [
            'tank' => TankResource::make($tank)->resolve(),
            'species' => fn () => SpeciesResource::collection(
                Species::query()->orderBy('kind')->orderBy('name')->get(),
            )->resolve(),
            'events' => TankEventResource::collection(
                $tank->events()->orderByDesc('id')->limit(30)->get(),
            )->resolve(),
        ]);
    }

    /**
     * Give a user without a tank a new starter tank.
     */
    public function store(Request $request, CreateStarterTank $createStarterTank): RedirectResponse
    {
        $tank = $request->user()->tanks()->first() ?? $createStarterTank->handle($request->user());

        return to_route('tanks.show', $tank);
    }
}
