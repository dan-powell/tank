<?php

namespace App\Actions\Tank;

use App\Enums\TankEventType;
use App\Models\Tank;
use App\Simulation\SimEvent;

class RefillAutoFeeder
{
    use MutatesTank;

    /**
     * Top the auto-feeder's hopper back up to capacity.
     */
    public function handle(Tank $tank): void
    {
        $this->mutate($tank, function (Tank $tank): SimEvent {
            $tank->auto_feeder_portions = config('simulation.auto_feeder.hopper_capacity');

            return $this->event($tank, TankEventType::AutoFeederChanged, 'You refilled the auto-feeder hopper.');
        });
    }
}
