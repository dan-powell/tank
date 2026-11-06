<?php

namespace App\Simulation\Systems;

use App\Simulation\StepContext;
use App\Simulation\TankState;

/**
 * The lamp runs on a timer from 08:00 to 20:00 simulated time while the
 * user's light switch is on.
 */
final class LightingSystem implements SimulationSystem
{
    public const int LIGHTS_ON_HOUR = 8;

    public const int LIGHTS_OFF_HOUR = 20;

    public function apply(TankState $state, StepContext $context): void
    {
        $state->isLit = $state->lightOn && self::isDaytime($state->simSeconds);
    }

    public static function isDaytime(int $simSeconds): bool
    {
        $hour = intdiv($simSeconds % 86400, 3600);

        return $hour >= self::LIGHTS_ON_HOUR && $hour < self::LIGHTS_OFF_HOUR;
    }
}
