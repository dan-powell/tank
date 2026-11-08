<?php

namespace App\Actions\Tank;

use App\Models\Tank;

/**
 * Blend fresh tap water into a tank's water.
 */
trait MixesTapWater
{
    /**
     * Make `$fraction` (0..1) of the tank's water fresh tap water: dissolved
     * waste is diluted, and temperature, pH and gases move towards the tap
     * water's values.
     */
    protected function mixInTapWater(Tank $tank, float $fraction): void
    {
        $tap = config('simulation.tap_water');
        $mix = fn (float $current, float $fresh): float => $current * (1 - $fraction) + $fresh * $fraction;

        $tank->ammonia *= 1 - $fraction;
        $tank->nitrite *= 1 - $fraction;
        $tank->nitrate *= 1 - $fraction;
        $tank->temperature = $mix($tank->temperature, $tap['temperature']);
        $tank->ph = $mix($tank->ph, $tap['ph']);
        $tank->oxygen = $mix($tank->oxygen, $tap['oxygen']);
        $tank->co2 = $mix($tank->co2, $tap['co2']);
    }
}
