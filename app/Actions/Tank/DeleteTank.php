<?php

namespace App\Actions\Tank;

use App\Models\Tank;
use Illuminate\Support\Facades\DB;

class DeleteTank
{
    /**
     * Delete the tank with everything in it, and the owner's alerts about it.
     * Takes the simulation's row lock so a running step finishes first.
     */
    public function handle(Tank $tank): void
    {
        DB::transaction(function () use ($tank): void {
            $locked = Tank::query()->lockForUpdate()->find($tank->id);

            if ($locked === null) {
                return;
            }

            $locked->user->notifications()->where('data->tank_id', $locked->id)->delete();
            $locked->delete();
        });
    }
}
