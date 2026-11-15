<?php

namespace App\Http\Controllers;

use App\Actions\Tank\ConfigureLightFixture;
use App\Actions\Tank\InstallLightFixture;
use App\Actions\Tank\RemoveLightFixture;
use App\Http\Requests\Tank\StoreLightFixtureRequest;
use App\Http\Requests\Tank\UpdateLightFixtureRequest;
use App\Models\LightFixture;
use App\Models\Tank;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;

class TankLightFixtureController extends Controller
{
    /**
     * Hang a new light from the gantry.
     */
    public function store(StoreLightFixtureRequest $request, Tank $tank, InstallLightFixture $installLightFixture): RedirectResponse
    {
        $fixture = $installLightFixture->handle(
            $tank,
            $request->string('type')->toString(),
            $request->integer('column'),
            $request->integer('row'),
            $request->integer('length', 1),
        );

        Inertia::flash('installedLightFixtureId', $fixture->id);

        return back();
    }

    /**
     * Change any of a light's settings.
     */
    public function update(UpdateLightFixtureRequest $request, Tank $tank, LightFixture $lightFixture, ConfigureLightFixture $configureLightFixture): RedirectResponse
    {
        $configureLightFixture->handle($tank, $lightFixture, $request->validated());

        return back();
    }

    /**
     * Take a light down.
     */
    public function destroy(Tank $tank, LightFixture $lightFixture, RemoveLightFixture $removeLightFixture): RedirectResponse
    {
        $removeLightFixture->handle($tank, $lightFixture);

        return back();
    }
}
