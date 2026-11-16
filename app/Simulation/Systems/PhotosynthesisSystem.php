<?php

namespace App\Simulation\Systems;

use App\Enums\Habitat;
use App\Simulation\LightField;
use App\Simulation\StepContext;
use App\Simulation\TankState;

/**
 * Plants and algae release oxygen and consume CO2 under light (each plant in
 * proportion to the light at its crown), and respire in the dark. Underwater plants and algae work on the water; land and edge
 * plants on the air above it.
 */
final class PhotosynthesisSystem implements SimulationSystem
{
    /** mg O2 per hour per unit of plant biomass at full light. */
    private const float PLANT_OXYGEN_RATE = 0.5;

    private const float PLANT_RESPIRATION_RATE = 0.08;

    /** ppm O2 per hour per percent of algae coverage. */
    private const float ALGAE_OXYGEN_RATE = 0.01;

    private const float ALGAE_RESPIRATION_RATE = 0.003;

    /** Milligrams of CO2 taken up or given off per milligram of oxygen (44 / 32). */
    private const float CO2_PER_OXYGEN = 1.375;

    public function apply(TankState $state, StepContext $context): void
    {
        $waterBiomass = 0.0;
        $airBiomass = 0.0;
        $litWaterBiomass = 0.0;
        $litAirBiomass = 0.0;

        foreach ($state->livingPlants() as $plant) {
            $species = $state->speciesOf($plant);
            $litBiomass = $plant->biomass() * $species->lightFactor($plant->light);

            if ($species->habitat() === Habitat::Aquatic) {
                $waterBiomass += $plant->biomass();
                $litWaterBiomass += $litBiomass;
            } else {
                $airBiomass += $plant->biomass();
                $litAirBiomass += $litBiomass;
            }
        }

        if ($state->hasWater) {
            $this->inWater($state, $context, $waterBiomass, $litWaterBiomass);
        }

        $this->inAir($state, $context, $airBiomass, $litAirBiomass);
    }

    /**
     * @param  float  $litBiomass  Biomass weighted by how well lit each plant is.
     */
    private function inWater(TankState $state, StepContext $context, float $biomass, float $litBiomass): void
    {
        if ($state->isLit) {
            $co2Factor = $state->co2 / ($state->co2 + 1);
            $algaeLight = min(1.0, $state->lightLevel / LightField::REFERENCE_FLOOR_LIGHT);
            $plantOxygen = $state->ppm($litBiomass * self::PLANT_OXYGEN_RATE * $co2Factor * $context->hours);
            $algaeOxygen = $state->algae * self::ALGAE_OXYGEN_RATE * $algaeLight * $co2Factor * $context->hours;

            $state->oxygen += $plantOxygen + $algaeOxygen;
            $state->co2 -= ($plantOxygen + $algaeOxygen) * 1.2;

            return;
        }

        $respired = $state->ppm($biomass * self::PLANT_RESPIRATION_RATE * $context->hours)
            + $state->algae * self::ALGAE_RESPIRATION_RATE * $context->hours;

        $state->oxygen -= $respired;
        $state->co2 += $respired * 1.2;
    }

    /**
     * @param  float  $litBiomass  Biomass weighted by how well lit each plant is.
     */
    private function inAir(TankState $state, StepContext $context, float $biomass, float $litBiomass): void
    {
        if ($biomass <= 0) {
            return;
        }

        $oxygenMg = $state->isLit
            ? $litBiomass * self::PLANT_OXYGEN_RATE * $state->airCo2 / ($state->airCo2 + 400) * $context->hours
            : -$biomass * self::PLANT_RESPIRATION_RATE * $context->hours;

        $state->addAirOxygen($oxygenMg);
        $state->addAirCo2(-$oxygenMg * self::CO2_PER_OXYGEN);
    }
}
