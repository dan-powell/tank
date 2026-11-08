<?php

namespace App\Http\Controllers;

use App\Actions\Tank\MovePlant;
use App\Actions\Tank\RemovePlant;
use App\Http\Requests\Tank\MovePlantRequest;
use App\Http\Requests\Tank\RenameInhabitantRequest;
use App\Models\Plant;
use App\Models\Tank;
use Illuminate\Http\RedirectResponse;

class TankPlantController extends Controller
{
    /**
     * Name (or un-name) a living plant.
     */
    public function update(RenameInhabitantRequest $request, Tank $tank, Plant $plant): RedirectResponse
    {
        abort_if($plant->died_at !== null, 404);

        $plant->update(['nickname' => $request->nickname()]);

        return back();
    }

    /**
     * Replant a living plant somewhere else on the substrate.
     */
    public function move(MovePlantRequest $request, Tank $tank, Plant $plant, MovePlant $movePlant): RedirectResponse
    {
        abort_if($plant->died_at !== null, 404);

        $movePlant->handle($tank, $plant, $request->float('x'), $request->integer('layer'));

        return back();
    }

    /**
     * Uproot a living plant.
     */
    public function destroy(Tank $tank, Plant $plant, RemovePlant $removePlant): RedirectResponse
    {
        $removePlant->handle($tank, $plant);

        return back();
    }
}
