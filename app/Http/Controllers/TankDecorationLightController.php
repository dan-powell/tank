<?php

namespace App\Http\Controllers;

use App\Actions\Tank\ConfigureDecorationLights;
use App\Http\Requests\Tank\UpdateDecorationLightsRequest;
use App\Models\Decoration;
use App\Models\Tank;
use Illuminate\Http\RedirectResponse;

class TankDecorationLightController extends Controller
{
    /**
     * Change a decoration's LED settings.
     */
    public function update(UpdateDecorationLightsRequest $request, Tank $tank, Decoration $decoration, ConfigureDecorationLights $configureDecorationLights): RedirectResponse
    {
        $configureDecorationLights->handle($tank, $decoration, $request->validated());

        return back();
    }
}
