<?php

namespace App\Simulation\Systems;

use App\Simulation\LightField;
use App\Simulation\StepContext;
use App\Simulation\TankState;

/**
 * Algae bloom under light when nutrients are plentiful, unless plants
 * out-compete them. Bright light and long days make them grow faster.
 */
final class AlgaeSystem implements RequiresWater, SimulationSystem
{
    private const float GROWTH_RATE = 0.06;

    private const float DECAY_RATE = 0.002;

    /** Algae always have a foothold, even in a spotless tank. */
    private const float SPORE_LEVEL = 0.5;

    /** Hours of light per day algae can have before long days start to favour them. */
    public const float LONG_DAY_HOURS = 12.0;

    /** Extra growth per hour of daylight beyond LONG_DAY_HOURS. */
    private const float LONG_DAY_BOOST = 0.15;

    /** Light at which algae grow at half their brightest-light rate. */
    private const float HALF_SATURATION = 0.3;

    public function apply(TankState $state, StepContext $context): void
    {
        if ($state->isLit) {
            $nitrogen = $state->nitrate + $state->ammonia * 3;
            $nutrientFactor = $nitrogen / ($nitrogen + 10);
            $plantsPer100Litres = $state->competitivePlantBiomass() * 100 / max($state->volumeLitres, 1);
            $competition = 1 / (1 + $plantsPer100Litres / 10);

            $growth = self::GROWTH_RATE * max($state->algae, self::SPORE_LEVEL) * $nutrientFactor * $competition
                * $this->lightFactor($state) * (1 - $state->algae / 100) * $context->hours;

            $state->algae += $growth;
            $state->nitrate -= $growth * 0.1;
        }

        $state->algae -= $state->algae * $context->decay(self::DECAY_RATE);
    }

    /**
     * Growth relative to a default tank: more light on the substrate and
     * days longer than LONG_DAY_HOURS both feed a bloom.
     */
    private function lightFactor(TankState $state): float
    {
        $reference = LightField::REFERENCE_FLOOR_LIGHT;
        $brightness = ($state->lightLevel / ($state->lightLevel + self::HALF_SATURATION))
            / ($reference / ($reference + self::HALF_SATURATION));
        $longDays = 1 + max(0.0, $state->photoperiodHours - self::LONG_DAY_HOURS) * self::LONG_DAY_BOOST;

        return $brightness * $longDays;
    }
}
