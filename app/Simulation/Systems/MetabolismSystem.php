<?php

namespace App\Simulation\Systems;

use App\Simulation\StepContext;
use App\Simulation\TankState;

/**
 * Creatures age, get hungry, breathe and excrete; well-fed juveniles grow.
 * Water breathers use dissolved oxygen and excrete ammonia into the water;
 * air breathers use the air above it, and land animals' waste becomes
 * detritus in the soil.
 */
final class MetabolismSystem implements SimulationSystem
{
    /** Milligrams of CO2 breathed out per milligram of oxygen (44 / 32). */
    private const float CO2_PER_OXYGEN = 1.375;

    /** Grams of detritus per milligram of nitrogenous waste a land animal leaves. */
    private const float LAND_WASTE_GRAMS_PER_MG = 0.02;

    /** Animals are less active at night. */
    private const float NIGHT_ACTIVITY = 0.6;

    public function apply(TankState $state, StepContext $context): void
    {
        $activity = $state->isLit ? 1.0 : self::NIGHT_ACTIVITY;

        foreach ($state->livingCreatures() as $creature) {
            $species = $state->speciesOf($creature);
            $metabolism = $creature->metabolicFactor($species) * $activity * $context->hours;

            $creature->ageSeconds += $context->dtSeconds;
            $creature->hunger = min(1.0, $creature->hunger + $species->number('hunger_per_hour') * $activity * $context->hours);

            $habitat = $species->habitat();
            $oxygenMg = $species->number('oxygen_use') * $metabolism;
            $wasteMg = $species->number('bioload') * $metabolism;

            if ($habitat->breathesAir()) {
                $state->addAirOxygen(-$oxygenMg);
                $state->addAirCo2($oxygenMg * self::CO2_PER_OXYGEN);
            } elseif ($state->hasWater) {
                $state->oxygen -= $state->ppm($oxygenMg);
                $state->co2 += $state->ppm($oxygenMg) * 1.2;
            }

            if ($habitat->reachesWater() && $state->hasWater) {
                $state->ammonia += $state->ppm($wasteMg);
            } else {
                $state->detritus += $wasteMg * self::LAND_WASTE_GRAMS_PER_MG;
            }

            $state->detritus += $species->number('solid_waste') * $metabolism;

            $adultSize = $species->number('adult_size', 1);

            if ($creature->size < $adultSize && $creature->hunger < 0.6 && $creature->health > 0.4) {
                $creature->size += ($adultSize - $creature->size) * $species->number('growth_per_day')
                    * (1 - $creature->hunger) * $context->hours / 24;
            }
        }
    }
}
