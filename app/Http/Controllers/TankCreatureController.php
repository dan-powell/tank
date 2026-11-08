<?php

namespace App\Http\Controllers;

use App\Actions\Tank\RemoveCreature;
use App\Http\Requests\Tank\RenameInhabitantRequest;
use App\Models\Creature;
use App\Models\Tank;
use Illuminate\Http\RedirectResponse;

class TankCreatureController extends Controller
{
    /**
     * Name (or un-name) a living animal.
     */
    public function update(RenameInhabitantRequest $request, Tank $tank, Creature $creature): RedirectResponse
    {
        abort_if($creature->died_at !== null, 404);

        $creature->update(['nickname' => $request->nickname()]);

        return back();
    }

    /**
     * Take a living animal out of the tank.
     */
    public function destroy(Tank $tank, Creature $creature, RemoveCreature $removeCreature): RedirectResponse
    {
        $removeCreature->handle($tank, $creature);

        return back();
    }
}
