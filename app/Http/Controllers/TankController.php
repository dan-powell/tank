<?php

namespace App\Http\Controllers;

use App\Actions\Tank\CreateTank;
use App\Actions\Tank\DeleteTank;
use App\Actions\Tank\RenameTank;
use App\Http\Requests\Tank\StoreTankRequest;
use App\Http\Requests\Tank\UpdateTankRequest;
use App\Http\Resources\DecorationDefinitionResource;
use App\Http\Resources\LightDefinitionResource;
use App\Http\Resources\SpeciesResource;
use App\Http\Resources\TankEventResource;
use App\Http\Resources\TankResource;
use App\Models\Species;
use App\Models\Tank;
use App\Simulation\DecorationCatalogue;
use App\Simulation\LightCatalogue;
use Illuminate\Http\RedirectResponse;
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
            'decorations' => fn ($query) => $query->orderBy('id'),
            'lightFixtures' => fn ($query) => $query->orderBy('id'),
        ]);

        return Inertia::render('tanks/show', [
            'tank' => TankResource::make($tank)->resolve(),
            'species' => fn () => SpeciesResource::collection(
                Species::query()->orderBy('kind')->orderBy('name')->get(),
            )->resolve(),
            'decorationCatalogue' => fn () => DecorationDefinitionResource::collection(
                array_values(DecorationCatalogue::definitions()),
            )->resolve(),
            'lightCatalogue' => fn () => LightDefinitionResource::collection(
                array_values(LightCatalogue::definitions()),
            )->resolve(),
            'events' => TankEventResource::collection(
                $tank->events()->orderByDesc('id')->limit(30)->get(),
            )->resolve(),
        ]);
    }

    /**
     * Set up a new tank of the chosen size.
     */
    public function store(StoreTankRequest $request, CreateTank $createTank): RedirectResponse
    {
        $tank = $createTank->handle(
            $request->user(),
            $request->string('name')->trim()->toString(),
            $request->cells('width'),
            $request->cells('height'),
            $request->cells('depth'),
            $request->boolean('stocked'),
            $request->waterLevel(),
        );

        return to_route('tanks.show', $tank);
    }

    /**
     * Rename the tank.
     */
    public function update(UpdateTankRequest $request, Tank $tank, RenameTank $renameTank): RedirectResponse
    {
        $renameTank->handle($tank, $request->string('name')->toString());

        return back();
    }

    /**
     * Delete the tank and everything in it.
     */
    public function destroy(Tank $tank, DeleteTank $deleteTank): RedirectResponse
    {
        $deleteTank->handle($tank);

        return to_route('dashboard');
    }
}
