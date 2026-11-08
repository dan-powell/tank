<?php

namespace App\Simulation\Systems;

use App\Simulation\CreatureState;
use App\Simulation\SpeciesDefinition;
use App\Simulation\StepContext;
use App\Simulation\TankState;

/**
 * Poor water quality, unsuitable temperature/pH and starvation damage
 * health; good conditions let creatures recover.
 */
final class HealthSystem implements RequiresWater, SimulationSystem
{
    private const float RECOVERY_PER_HOUR = 0.03;

    public function apply(TankState $state, StepContext $context): void
    {
        foreach ($state->livingCreatures() as $creature) {
            $species = $state->speciesOf($creature);
            $stressors = $this->stressors($creature, $species, $state);
            $total = array_sum($stressors) * $species->number('sensitivity', 1);

            if ($total > 0.001) {
                arsort($stressors);
                $creature->mainStressor = array_key_first($stressors);
                $creature->health -= $total * $context->hours;
            } else {
                $creature->mainStressor = null;
                $creature->health += self::RECOVERY_PER_HOUR * (1 - $creature->hunger) * $context->hours;
            }

            $creature->health = min(1.0, max(0.0, $creature->health));
        }
    }

    /**
     * Health lost per hour from each cause.
     *
     * @return array<string, float>
     */
    private function stressors(CreatureState $creature, SpeciesDefinition $species, TankState $state): array
    {
        $ammoniaToxicity = min(4.0, max(0.2, 10 ** ($state->ph - 7.2)));

        return [
            'ammonia poisoning' => max(0.0, $state->ammonia * $ammoniaToxicity - 0.25) * 0.05,
            'nitrite poisoning' => max(0.0, $state->nitrite - 0.5) * 0.04,
            'nitrate stress' => max(0.0, $state->nitrate - 50) * 0.0003,
            'suffocation' => max(0.0, 4 - $state->oxygen) * 0.03,
            'temperature stress' => $species->distanceOutside('temperature', $state->temperature) * 0.01,
            'pH stress' => $species->distanceOutside('ph', $state->ph) * 0.03,
            'starvation' => $creature->hunger >= 0.95 ? 0.004 : 0.0,
        ];
    }
}
