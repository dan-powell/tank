<?php

namespace App\Actions\Tank;

use App\Enums\LightMode;
use App\Enums\TankEventType;
use App\Models\Tank;
use App\Simulation\SimEvent;

class SetLightMode
{
    use MutatesTank;

    /**
     * Set the master switch for every light on the gantry: on their timers, all on or all off.
     */
    public function handle(Tank $tank, LightMode $mode): void
    {
        if ($tank->light_mode === $mode) {
            return;
        }

        $this->mutate($tank, function (Tank $tank) use ($mode): SimEvent {
            $tank->light_mode = $mode;

            return $this->event(
                $tank,
                TankEventType::LightToggled,
                match ($mode) {
                    LightMode::Timer => 'You set the lights back to their timers.',
                    LightMode::On => 'You switched all the lights on.',
                    LightMode::Off => 'You switched all the lights off.',
                },
                ['light_mode' => $mode->value],
            );
        });
    }
}
