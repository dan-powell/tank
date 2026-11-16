<?php

namespace App\Simulation\Systems;

use App\Enums\Habitat;
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
}
