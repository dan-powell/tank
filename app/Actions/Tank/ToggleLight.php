<?php

namespace App\Actions\Tank;

use App\Enums\TankEventType;
use App\Models\Tank;
use App\Simulation\SimEvent;

class ToggleLight
{
    use MutatesTank;

    /**
     * Flip the lamp's master switch. While on, the lamp follows its daily timer.
     */
    public function handle(Tank $tank): void
    {
        $this->mutate($tank, function (Tank $tank): SimEvent {
            $tank->light_on = ! $tank->light_on;

            return $this->event(
                $tank,
                TankEventType::LightToggled,
                $tank->light_on ? 'You switched the lamp timer on.' : 'You switched the lamp off.',
                ['light_on' => $tank->light_on],
            );
        });
    }
}
