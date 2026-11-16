<?php

namespace App\Http\Controllers;

use App\Actions\Tank\ChangeWater;
use App\Actions\Tank\ConfigureAlerts;
use App\Actions\Tank\FeedTank;
use App\Actions\Tank\ScrubAlgae;
use App\Actions\Tank\SetBackground;
use App\Actions\Tank\SetLightMode;
use App\Actions\Tank\SetPaused;
use App\Actions\Tank\SetWaterLevel;
use App\Actions\Tank\ToggleLid;
use App\Actions\Tank\VacuumGravel;
use App\Actions\Tank\WatchSpecies;
use App\Enums\LightMode;
use App\Http\Requests\Tank\ChangeWaterRequest;
use App\Http\Requests\Tank\FeedTankRequest;
use App\Http\Requests\Tank\SetBackgroundRequest;
use App\Http\Requests\Tank\SetLightModeRequest;
use App\Http\Requests\Tank\SetPausedRequest;
use App\Http\Requests\Tank\SetWaterLevelRequest;
use App\Http\Requests\Tank\UpdateAlertSettingsRequest;
use App\Http\Requests\Tank\WatchSpeciesRequest;
use App\Models\Species;
use App\Models\Tank;
use Illuminate\Http\RedirectResponse;

class TankMaintenanceController extends Controller
{
    public function feed(FeedTankRequest $request, Tank $tank, FeedTank $feedTank): RedirectResponse
    {
        $feedTank->handle($tank, $request->float('x'), $request->float('z'));

        return back();
    }

    public function changeWater(ChangeWaterRequest $request, Tank $tank, ChangeWater $changeWater): RedirectResponse
    {
        $changeWater->handle($tank, $request->integer('percent'));

        return back();
    }

    public function setWaterLevel(SetWaterLevelRequest $request, Tank $tank, SetWaterLevel $setWaterLevel): RedirectResponse
    {
        $setWaterLevel->handle($tank, $request->waterLevel());

        return back();
    }

    public function vacuum(Tank $tank, VacuumGravel $vacuumGravel): RedirectResponse
    {
        $vacuumGravel->handle($tank);

        return back();
    }

    public function scrub(Tank $tank, ScrubAlgae $scrubAlgae): RedirectResponse
    {
        $scrubAlgae->handle($tank);

        return back();
    }

    public function toggleLid(Tank $tank, ToggleLid $toggleLid): RedirectResponse
    {
        $toggleLid->handle($tank);

        return back();
    }

    public function setLightMode(SetLightModeRequest $request, Tank $tank, SetLightMode $setLightMode): RedirectResponse
    {
        $setLightMode->handle($tank, $request->enum('mode', LightMode::class));

        return back();
    }

    public function setBackground(SetBackgroundRequest $request, Tank $tank, SetBackground $setBackground): RedirectResponse
    {
        $setBackground->handle($tank, $request->string('colour')->value(), $request->input('gradient_colour'));

        return back();
    }

    public function setPaused(SetPausedRequest $request, Tank $tank, SetPaused $setPaused): RedirectResponse
    {
        $setPaused->handle($tank, $request->boolean('paused'));

        return back();
    }

    public function setAlerts(UpdateAlertSettingsRequest $request, Tank $tank, ConfigureAlerts $configureAlerts): RedirectResponse
    {
        $configureAlerts->handle(
            $tank,
            $request->float('near_death_health'),
            $request->array('disabled_parameters'),
            $request->boolean('mail'),
            $request->boolean('browser'),
        );

        return back();
    }

    /**
     * Choose whether a species' animals pause the tank when close to death.
     */
    public function watchSpecies(WatchSpeciesRequest $request, Tank $tank, Species $species, WatchSpecies $watchSpecies): RedirectResponse
    {
        abort_unless($species->kind->isFauna(), 404);

        $watchSpecies->handle($tank, $species, $request->boolean('watched'));

        return back();
    }
}
