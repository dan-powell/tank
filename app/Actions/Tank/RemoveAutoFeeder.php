<?php

namespace App\Actions\Tank;

use App\Enums\TankEventType;
use App\Models\Tank;
use App\Simulation\SimEvent;

class RemoveAutoFeeder
{
    use MutatesTank;

    /**
     * Take the auto-feeder off the tank, discarding whatever is left in its hopper.
     */
    public function handle(Tank $tank): void
    {
        $this->mutate($tank, function (Tank $tank): SimEvent {
            $tank->auto_feeder_installed = false;
            $tank->auto_feeder_portions = 0;

            return $this->event($tank, TankEventType::AutoFeederChanged, 'You removed the auto-feeder.');
        });
    }
}
