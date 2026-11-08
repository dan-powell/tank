<?php

namespace App\Http\Controllers;

use App\Actions\Tank\MoveDecoration;
use App\Actions\Tank\PlaceDecoration;
use App\Actions\Tank\RemoveDecoration;
use App\Http\Requests\Tank\MoveDecorationRequest;
use App\Http\Requests\Tank\StoreDecorationRequest;
use App\Models\Decoration;
use App\Models\Tank;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;

class TankDecorationController extends Controller
{
    /**
     * Add a decoration, placed automatically in a free spot.
     */
    public function store(StoreDecorationRequest $request, Tank $tank, PlaceDecoration $placeDecoration): RedirectResponse
    {
        $decoration = $placeDecoration->handle($tank, $request->string('type')->toString());

        Inertia::flash('placedDecorationId', $decoration->id);

        return back();
    }

    /**
     * Move and/or turn a decoration.
     */
    public function update(MoveDecorationRequest $request, Tank $tank, Decoration $decoration, MoveDecoration $moveDecoration): RedirectResponse
    {
        $moveDecoration->handle(
            $tank,
            $decoration,
            $request->integer('x'),
            $request->integer('y'),
            $request->integer('z'),
            $request->integer('rotation'),
        );

        return back();
    }

    /**
     * Take a decoration out of the tank.
     */
    public function destroy(Tank $tank, Decoration $decoration, RemoveDecoration $removeDecoration): RedirectResponse
    {
        $removeDecoration->handle($tank, $decoration);

        return back();
    }
}
