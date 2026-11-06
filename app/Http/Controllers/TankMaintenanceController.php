<?php

namespace App\Http\Controllers;

use App\Actions\Tank\ChangeWater;
use App\Actions\Tank\FeedTank;
use App\Actions\Tank\ScrubAlgae;
use App\Actions\Tank\ToggleLight;
use App\Actions\Tank\VacuumGravel;
use App\Http\Requests\Tank\ChangeWaterRequest;
use App\Http\Requests\Tank\FeedTankRequest;
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

    public function toggleLight(Tank $tank, ToggleLight $toggleLight): RedirectResponse
    {
        $toggleLight->handle($tank);

        return back();
    }
}
