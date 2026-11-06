<?php

namespace App\Simulation\Systems;

use App\Simulation\StepContext;
use App\Simulation\TankState;

/**
 * Heater, surface gas exchange and pH buffering.
 */
final class WaterQualitySystem implements SimulationSystem
{
    private const float HEATER_RATE = 0.5;

    private const float OXYGEN_EXCHANGE_RATE = 0.6;

    private const float CO2_EXCHANGE_RATE = 0.3;

    private const float CO2_EQUILIBRIUM = 2.0;

    private const float PH_RATE = 0.2;

    public function apply(TankState $state, StepContext $context): void
    {
        $state->temperature += ($state->targetTemperature - $state->temperature) * $context->decay(self::HEATER_RATE);

        $saturation = self::oxygenSaturation($state->temperature);
        $state->oxygen += ($saturation - $state->oxygen) * $context->decay(self::OXYGEN_EXCHANGE_RATE);
        $state->co2 += (self::CO2_EQUILIBRIUM - $state->co2) * $context->decay(self::CO2_EXCHANGE_RATE);

        $targetPh = 7.6 - 0.5 * log10(max($state->co2, 0.5) / self::CO2_EQUILIBRIUM) - 0.004 * $state->nitrate;
        $state->ph += ($targetPh - $state->ph) * $context->decay(self::PH_RATE);
    }

    /**
     * Dissolved oxygen saturation in fresh water (mg/L) at a temperature in °C.
     */
    public static function oxygenSaturation(float $celsius): float
    {
        return 14.62 - 0.3898 * $celsius + 0.006969 * $celsius ** 2 - 0.00005897 * $celsius ** 3;
    }
}
