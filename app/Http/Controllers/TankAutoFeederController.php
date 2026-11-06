<?php

namespace App\Http\Controllers;

use App\Actions\Tank\ConfigureAutoFeeder;
use App\Actions\Tank\RefillAutoFeeder;
use App\Actions\Tank\RemoveAutoFeeder;
use App\Http\Requests\Tank\RefillAutoFeederRequest;
use App\Http\Requests\Tank\UpdateAutoFeederRequest;
use App\Models\Tank;
use Illuminate\Http\RedirectResponse;

class TankAutoFeederController extends Controller
{
    public function update(UpdateAutoFeederRequest $request, Tank $tank, ConfigureAutoFeeder $configureAutoFeeder): RedirectResponse
    {
        $configureAutoFeeder->handle($tank, $request->integer('feeds_per_day'), $request->boolean('unlimited'));

        return back();
    }

    public function destroy(Tank $tank, RemoveAutoFeeder $removeAutoFeeder): RedirectResponse
    {
        $removeAutoFeeder->handle($tank);

        return back();
    }

    public function refill(RefillAutoFeederRequest $request, Tank $tank, RefillAutoFeeder $refillAutoFeeder): RedirectResponse
    {
        $refillAutoFeeder->handle($tank);

        return back();
    }
}
