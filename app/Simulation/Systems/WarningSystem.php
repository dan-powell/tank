<?php

namespace App\Simulation\Systems;

use App\Enums\TankEventType;
use App\Simulation\PlantState;
use App\Simulation\StepContext;
use App\Simulation\TankState;

/**
 * Raise a warning when a water parameter crosses into a harmful range, or
 * when plants start going short of light.
 */
final class WarningSystem implements RequiresWater, SimulationSystem
{
    public function apply(TankState $state, StepContext $context): void
    {
        $before = $context->before;

        $this->warnIfRisen($context, $before->ammonia, $state->ammonia, 0.5, 'ammonia', 'Ammonia is building up. A water change will help.');
        $this->warnIfRisen($context, $before->nitrite, $state->nitrite, 0.5, 'nitrite', 'Nitrite is building up. Your fish may be stressed.');
        $this->warnIfRisen($context, $before->nitrate, $state->nitrate, 40, 'nitrate', 'Nitrate is high. Time for a water change.');
        $this->warnIfRisen($context, $before->algae, $state->algae, 50, 'algae', 'Algae is taking over the glass.');
        $this->warnIfRisen($context, -$before->oxygen, -$state->oxygen, -4, 'oxygen', 'Oxygen is running low. Fish are gasping at the surface.');
        $this->warnIfRisen($context, $this->plantsShortOfLight($before), $this->plantsShortOfLight($state), 1, 'light', 'Some plants are not getting enough light. Add a light above them or lengthen the day.');
    }

    /**
     * How many living plants get less light over a day than their species needs.
     */
    private function plantsShortOfLight(TankState $state): int
    {
        return count(array_filter(
            $state->livingPlants(),
            fn (PlantState $plant): bool => $plant->dailyLight < $state->speciesOf($plant)->param('light', [0.0])[0],
        ));
    }

    private function warnIfRisen(StepContext $context, float $before, float $after, float $threshold, string $parameter, string $message): void
    {
        if ($before < $threshold && $after >= $threshold) {
            $context->emit(TankEventType::Warning, $message, ['parameter' => $parameter]);
        }
    }
}
