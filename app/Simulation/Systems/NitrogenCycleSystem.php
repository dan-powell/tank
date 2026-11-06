<?php

namespace App\Simulation\Systems;

use App\Simulation\StepContext;
use App\Simulation\TankState;

/**
 * Rotting food and detritus release ammonia; nitrifying bacteria oxidise
 * ammonia to nitrite and nitrite to nitrate, growing on the available load.
 */
final class NitrogenCycleSystem implements SimulationSystem
{
    /** Milligrams of ammonia released per gram of rotting food. */
    private const float FOOD_AMMONIA_MG_PER_GRAM = 50;

    /** Milligrams of ammonia released per gram of mineralised detritus. */
    private const float DETRITUS_AMMONIA_MG_PER_GRAM = 20;

    private const float FOOD_ROT_RATE = 0.25;

    private const float DETRITUS_MINERALISATION_RATE = 0.01;

    private const float BACTERIA_GROWTH_RATE = 0.04;

    private const float BACTERIA_DEATH_RATE = 0.004;

    private const float BACTERIA_CARRYING_CAPACITY = 5.0;

    private const float MINIMUM_BACTERIA = 0.005;

    public function apply(TankState $state, StepContext $context): void
    {
        $rotted = $state->uneatenFood * $context->decay(self::FOOD_ROT_RATE);
        $state->uneatenFood -= $rotted;
        $state->detritus += $rotted * 0.3;
        $state->ammonia += $state->ppm($rotted * self::FOOD_AMMONIA_MG_PER_GRAM);

        $mineralised = $state->detritus * $context->decay(self::DETRITUS_MINERALISATION_RATE);
        $state->detritus -= $mineralised;
        $state->ammonia += $state->ppm($mineralised * self::DETRITUS_AMMONIA_MG_PER_GRAM);

        $oxygenFactor = $state->oxygen / ($state->oxygen + 1);
        $capacity = $state->bacteria * $context->hours * $oxygenFactor;

        $ammoniaOxidised = min($state->ammonia, $capacity * $state->ammonia / ($state->ammonia + 0.3));
        $state->ammonia -= $ammoniaOxidised;
        $state->nitrite += $ammoniaOxidised * 2.7;

        $nitriteOxidised = min($state->nitrite, $capacity * $state->nitrite / ($state->nitrite + 0.3));
        $state->nitrite -= $nitriteOxidised;
        $state->nitrate += $nitriteOxidised * 1.35;

        $state->oxygen -= $ammoniaOxidised * 3.0 + $nitriteOxidised * 0.35;

        $load = $state->ammonia + $state->nitrite;
        $growth = self::BACTERIA_GROWTH_RATE * $load / ($load + 0.2) * $oxygenFactor
            * (1 - $state->bacteria / self::BACTERIA_CARRYING_CAPACITY);
        $state->bacteria += $state->bacteria * ($growth - self::BACTERIA_DEATH_RATE) * $context->hours;
        $state->bacteria = max(self::MINIMUM_BACTERIA, $state->bacteria);
    }
}
