<?php

namespace App\Actions\Tank;

use App\Enums\TankEventType;
use App\Models\Tank;
use App\Simulation\SimEvent;

class ChangeWater
{
    use MixesTapWater;
    use MutatesTank;

    /**
     * Replace a percentage of the water with fresh tap water. Dissolved waste
     * is diluted; temperature, pH and gases mix towards the tap water's values,
     * so very large changes can shock the fish.
     */
    public function handle(Tank $tank, int $percent): void
    {
        $this->mutate($tank, function (Tank $tank) use ($percent): SimEvent {
            $this->mixInTapWater($tank, $percent / 100);

            return $this->event($tank, TankEventType::WaterChange, "You changed {$percent}% of the water.", ['percent' => $percent]);
        });
    }
}
