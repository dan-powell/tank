<?php

namespace App\Simulation\Systems;

use App\Simulation\StepContext;
use App\Simulation\TankState;

/**
 * One stage of the ecosystem pipeline. Systems mutate the working state in place.
 */
interface SimulationSystem
{
    public function apply(TankState $state, StepContext $context): void;
}
