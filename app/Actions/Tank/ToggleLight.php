<?php

namespace App\Actions\Tank;

use App\Enums\TankEventType;
use App\Models\Tank;
use App\Simulation\SimEvent;

class ToggleLight
{
    use MutatesTank;

    /**
     * Flip the master switch for every light on the gantry. While on, each light follows its own timer.
     */
    public function handle(Tank $tank): void
    {
        $this->mutate($tank, function (Tank $tank): SimEvent {
            $tank->light_on = ! $tank->light_on;

            return $this->event(
                $tank,
                TankEventType::LightToggled,
                $tank->light_on ? 'You switched the lights back on to their timers.' : 'You switched all the lights off.',
                ['light_on' => $tank->light_on],
            );
        });
    }
}
