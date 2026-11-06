<?php

namespace App\Http\Controllers;

use App\Actions\Tank\StockTank;
use App\Http\Requests\Tank\StockTankRequest;
use App\Models\Tank;
use Illuminate\Http\RedirectResponse;

class TankStockController extends Controller
{
    /**
     * Add plants or animals to the tank.
     */
    public function store(StockTankRequest $request, Tank $tank, StockTank $stockTank): RedirectResponse
    {
        $stockTank->handle($tank, $request->species(), $request->integer('quantity'));

        return back();
    }
}
