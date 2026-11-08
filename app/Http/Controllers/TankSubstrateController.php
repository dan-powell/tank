<?php

namespace App\Http\Controllers;

use App\Actions\Tank\SculptSubstrate;
use App\Http\Requests\Tank\SculptSubstrateRequest;
use App\Models\Tank;
use Illuminate\Http\RedirectResponse;

class TankSubstrateController extends Controller
{
    /**
     * Reshape the substrate.
     */
    public function update(SculptSubstrateRequest $request, Tank $tank, SculptSubstrate $sculptSubstrate): RedirectResponse
    {
        $sculptSubstrate->handle($tank, $request->heightmap());

        return back();
    }
}
