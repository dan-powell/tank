<?php

namespace App\Simulation\Systems;

use App\Enums\TankEventType;
use App\Simulation\StepContext;
use App\Simulation\TankState;

/**
 * Raise a warning when a water parameter crosses into a harmful range.
 */
final class WarningSystem implements SimulationSystem
{
    public function apply(TankState $state, StepContext $context): void
    {
        $before = $context->before;

        $this->warnIfRisen($context, $before->ammonia, $state->ammonia, 0.5, 'ammonia', 'Ammonia is building up. A water change will help.');
        $this->warnIfRisen($context, $before->nitrite, $state->nitrite, 0.5, 'nitrite', 'Nitrite is building up. Your fish may be stressed.');
        $this->warnIfRisen($context, $before->nitrate, $state->nitrate, 40, 'nitrate', 'Nitrate is high. Time for a water change.');
        $this->warnIfRisen($context, $before->algae, $state->algae, 50, 'algae', 'Algae is taking over the glass.');
        $this->warnIfRisen($context, -$before->oxygen, -$state->oxygen, -4, 'oxygen', 'Oxygen is running low. Fish are gasping at the surface.');
    }

    private function warnIfRisen(StepContext $context, float $before, float $after, float $threshold, string $parameter, string $message): void
    {
        if ($before < $threshold && $after >= $threshold) {
            $context->emit(TankEventType::Warning, $message, ['parameter' => $parameter]);
        }
    }
}
