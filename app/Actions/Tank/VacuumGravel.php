<?php

namespace App\Actions\Tank;

use App\Enums\TankEventType;
use App\Models\Tank;
use App\Simulation\SimEvent;

class VacuumGravel
{
    use MutatesTank;

    /**
     * Siphon detritus and leftover food out of the substrate. Disturbing the
     * gravel removes a little of the beneficial bacteria too.
     */
    public function handle(Tank $tank): void
    {
        $this->mutate($tank, function (Tank $tank): SimEvent {
            $tank->detritus *= 0.4;
            $tank->uneaten_food *= 0.5;
            $tank->bacteria *= 0.95;

            return $this->event($tank, TankEventType::Vacuum, 'You vacuumed the gravel.');
        });
    }
}
