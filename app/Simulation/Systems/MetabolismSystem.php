<?php

namespace App\Simulation\Systems;

use App\Simulation\StepContext;
use App\Simulation\TankState;

/**
 * Creatures age, get hungry, breathe and excrete; well-fed juveniles grow.
 */
final class MetabolismSystem implements RequiresWater, SimulationSystem
{
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

            $oxygenUsed = $state->ppm($species->number('oxygen_use') * $metabolism);
            $state->oxygen -= $oxygenUsed;
            $state->co2 += $oxygenUsed * 1.2;
            $state->ammonia += $state->ppm($species->number('bioload') * $metabolism);
            $state->detritus += $species->number('solid_waste') * $metabolism;

            $adultSize = $species->number('adult_size', 1);

            if ($creature->size < $adultSize && $creature->hunger < 0.6 && $creature->health > 0.4) {
                $creature->size += ($adultSize - $creature->size) * $species->number('growth_per_day')
                    * (1 - $creature->hunger) * $context->hours / 24;
            }
        }
    }
}
