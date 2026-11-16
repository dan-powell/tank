<?php

namespace App\Simulation\Systems;

use App\Enums\Habitat;
use App\Enums\TankEventType;
use App\Simulation\BalanceLimits;
use App\Simulation\PlantState;
use App\Simulation\StepContext;
use App\Simulation\TankState;

/**
 * Raise a warning when the water or air turns harmfully low or high (see
 * BalanceLimits), or when plants start going short of light.
 */
final class WarningSystem implements SimulationSystem
{
    public function apply(TankState $state, StepContext $context): void
    {
        $before = $context->before;
        $limits = BalanceLimits::forState($state);
        $values = $this->values($state);

        foreach ($this->values($before) as $parameter => $previous) {
            if (! isset($values[$parameter])) {
                continue;
            }

            $side = $limits->harmful($parameter, $values[$parameter]);

            if ($side !== null && $side !== $limits->harmful($parameter, $previous)) {
                $context->emit(TankEventType::Warning, BalanceLimits::warning($parameter, $side), ['parameter' => $parameter, 'side' => $side]);
            }
        }

        if ($state->hasWater && $this->plantsShortOfLight($state) > 0 && $this->plantsShortOfLight($before) === 0) {
            $context->emit(TankEventType::Warning, 'Some plants are not getting enough light. Add a light above them or lengthen the day.', ['parameter' => 'light']);
        }
    }

    /**
     * The parameters worth watching right now, keyed by name.
     *
     * @return array<string, float>
     */
    private function values(TankState $state): array
    {
        $values = [
            'air_oxygen' => $state->airOxygen,
            'air_co2' => $state->airCo2,
        ];

        if ($this->hasLandLife($state)) {
            $values['humidity'] = $state->humidity;
        }

        if ($state->hasWater) {
            $values += [
                'temperature' => $state->temperature,
                'ph' => $state->ph,
                'ammonia' => $state->ammonia,
                'nitrite' => $state->nitrite,
                'nitrate' => $state->nitrate,
                'oxygen' => $state->oxygen,
                'algae' => $state->algae,
                'detritus' => $state->detritus,
            ];
        }

        return $values;
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
