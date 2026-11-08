<?php

namespace App\Http\Controllers;

use App\Actions\Tank\CreateTank;
use App\Http\Requests\Tank\StoreTankRequest;
use App\Http\Resources\DecorationDefinitionResource;
use App\Http\Resources\SpeciesResource;
use App\Http\Resources\TankEventResource;
use App\Http\Resources\TankResource;
use App\Models\Species;
use App\Models\Tank;
use App\Simulation\DecorationCatalogue;
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
        ]);

        return Inertia::render('tanks/show', [
            'tank' => TankResource::make($tank)->resolve(),
            'species' => fn () => SpeciesResource::collection(
                Species::query()->orderBy('kind')->orderBy('name')->get(),
            )->resolve(),
            'decorationCatalogue' => fn () => DecorationDefinitionResource::collection(
                array_values(DecorationCatalogue::definitions()),
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
        );

        return to_route('tanks.show', $tank);
    }
}
