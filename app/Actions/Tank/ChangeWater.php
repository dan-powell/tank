<?php

namespace App\Actions\Tank;

use App\Enums\TankEventType;
use App\Models\Tank;
use App\Simulation\SimEvent;

class ChangeWater
{
    use MutatesTank;

    /**
     * Replace a percentage of the water with fresh tap water. Dissolved waste
     * is diluted; temperature, pH and gases mix towards the tap water's values,
     * so very large changes can shock the fish.
     */
    public function handle(Tank $tank, int $percent): void
    {
        $this->mutate($tank, function (Tank $tank) use ($percent): SimEvent {
            $fraction = $percent / 100;
            $tap = config('simulation.tap_water');
            $mix = fn (float $current, float $fresh): float => $current * (1 - $fraction) + $fresh * $fraction;

            $tank->ammonia *= 1 - $fraction;
            $tank->nitrite *= 1 - $fraction;
            $tank->nitrate *= 1 - $fraction;
            $tank->temperature = $mix($tank->temperature, $tap['temperature']);
            $tank->ph = $mix($tank->ph, $tap['ph']);
            $tank->oxygen = $mix($tank->oxygen, $tap['oxygen']);
            $tank->co2 = $mix($tank->co2, $tap['co2']);

            return $this->event($tank, TankEventType::WaterChange, "You changed {$percent}% of the water.", ['percent' => $percent]);
        });
    }
}
