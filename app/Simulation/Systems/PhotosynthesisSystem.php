<?php

namespace App\Simulation\Systems;

use App\Simulation\PlantState;
use App\Simulation\StepContext;
use App\Simulation\TankState;

/**
 * Plants and algae release oxygen and consume CO2 under light, and respire in the dark.
 */
final class PhotosynthesisSystem implements RequiresWater, SimulationSystem
{
    /** mg O2 per hour per unit of plant biomass at full light. */
    private const float PLANT_OXYGEN_RATE = 0.5;

    private const float PLANT_RESPIRATION_RATE = 0.08;

    /** ppm O2 per hour per percent of algae coverage. */
    private const float ALGAE_OXYGEN_RATE = 0.01;

    private const float ALGAE_RESPIRATION_RATE = 0.003;

    public function apply(TankState $state, StepContext $context): void
    {
        $biomass = array_sum(array_map(fn (PlantState $plant): float => $plant->biomass(), $state->livingPlants()));

        if ($state->isLit) {
            $co2Factor = $state->co2 / ($state->co2 + 1);
            $plantOxygen = $state->ppm($biomass * self::PLANT_OXYGEN_RATE * $co2Factor * $context->hours);
            $algaeOxygen = $state->algae * self::ALGAE_OXYGEN_RATE * $co2Factor * $context->hours;

            $state->oxygen += $plantOxygen + $algaeOxygen;
            $state->co2 -= ($plantOxygen + $algaeOxygen) * 1.2;

            return;
        }

        $respired = $state->ppm($biomass * self::PLANT_RESPIRATION_RATE * $context->hours)
            + $state->algae * self::ALGAE_RESPIRATION_RATE * $context->hours;

        $state->oxygen -= $respired;
        $state->co2 += $respired * 1.2;
    }
}
