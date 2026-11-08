<?php

namespace App\Simulation\Systems;

use App\Enums\Habitat;
use App\Enums\TankEventType;
use App\Simulation\Air;
use App\Simulation\PlantState;
use App\Simulation\StepContext;
use App\Simulation\TankState;

/**
 * The air above the water. Open water and land plants add moisture; an open
 * tank's air mixes with the room, while a sealed tank keeps whatever its
 * water, plants and animals make of it.
 */
final class AirSystem implements SimulationSystem
{
    /** Rate (per hour) at which open water moistens the air, at full water cover. */
    private const float EVAPORATION_RATE = 1.5;

    /** Rate (per hour, per unit of land plant biomass per litre of air) of transpiration. */
    private const float TRANSPIRATION_RATE = 0.4;

    /** Rate (per hour) at which an open tank's air mixes with the room's. */
    private const float VENTILATION_RATE = 3.0;

    public function apply(TankState $state, StepContext $context): void
    {
        $evaporation = $state->hasWater ? self::EVAPORATION_RATE * $state->waterSurfaceShare : 0.0;
        $transpiration = self::TRANSPIRATION_RATE * $this->airPlantBiomass($state) / max($state->airLitres, 0.5);
        $state->humidity += (Air::MAX_HUMIDITY - $state->humidity) * $context->decay($evaporation + $transpiration);

        if (! $state->isSealed) {
            $mix = $context->decay(self::VENTILATION_RATE);
            $state->humidity += (Air::ROOM_HUMIDITY - $state->humidity) * $mix;
            $state->airOxygen += (Air::ROOM_OXYGEN - $state->airOxygen) * $mix;
            $state->airCo2 += (Air::ROOM_CO2 - $state->airCo2) * $mix;
        }

        $this->warn($state, $context);
    }

    /**
     * Biomass of the plants whose leaves are in the air (land and edge plants).
     */
    private function airPlantBiomass(TankState $state): float
    {
        return array_sum(array_map(
            fn (PlantState $plant): float => $state->speciesOf($plant)->habitat() === Habitat::Aquatic ? 0.0 : $plant->biomass(),
            $state->livingPlants(),
        ));
    }

    private function warn(TankState $state, StepContext $context): void
    {
        $before = $context->before;

        if ($before->airOxygen >= 17 && $state->airOxygen < 17) {
            $context->emit(TankEventType::Warning, 'The air in the tank is running short of oxygen.', ['parameter' => 'air_oxygen']);
        }

        if ($before->airCo2 < 3000 && $state->airCo2 >= 3000) {
            $context->emit(TankEventType::Warning, 'CO2 is building up in the air. Land animals may struggle to breathe.', ['parameter' => 'air_co2']);
        }

        if ($before->humidity >= 60 && $state->humidity < 60 && $this->hasLandLife($state)) {
            $context->emit(TankEventType::Warning, 'The air is drying out. Land plants and animals need humidity.', ['parameter' => 'humidity']);
        }
    }

    private function hasLandLife(TankState $state): bool
    {
        foreach ([...$state->livingPlants(), ...$state->livingCreatures()] as $entity) {
            if ($state->speciesOf($entity)->habitat() !== Habitat::Aquatic) {
                return true;
            }
        }

        return false;
    }
}
