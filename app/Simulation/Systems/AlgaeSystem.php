<?php

namespace App\Simulation\Systems;

use App\Simulation\StepContext;
use App\Simulation\TankState;

/**
 * Algae bloom under light when nutrients are plentiful, unless plants
 * out-compete them.
 */
final class AlgaeSystem implements SimulationSystem
{
    private const float GROWTH_RATE = 0.06;

    private const float DECAY_RATE = 0.002;

    /** Algae always have a foothold, even in a spotless tank. */
    private const float SPORE_LEVEL = 0.5;

    public function apply(TankState $state, StepContext $context): void
    {
        if ($state->isLit) {
            $nitrogen = $state->nitrate + $state->ammonia * 3;
            $nutrientFactor = $nitrogen / ($nitrogen + 10);
            $plantsPer100Litres = $state->competitivePlantBiomass() * 100 / max($state->volumeLitres, 1);
            $competition = 1 / (1 + $plantsPer100Litres / 10);

            $growth = self::GROWTH_RATE * max($state->algae, self::SPORE_LEVEL) * $nutrientFactor * $competition
                * (1 - $state->algae / 100) * $context->hours;

            $state->algae += $growth;
            $state->nitrate -= $growth * 0.1;
        }

        $state->algae -= $state->algae * $context->decay(self::DECAY_RATE);
    }
}
