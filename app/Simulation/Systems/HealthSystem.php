<?php

namespace App\Simulation\Systems;

use App\Enums\Habitat;
use App\Simulation\CreatureState;
use App\Simulation\SpeciesDefinition;
use App\Simulation\StepContext;
use App\Simulation\TankState;

/**
 * Poor water quality, unsuitable temperature/pH and starvation damage
 * health; good conditions let creatures recover. Land animals suffer from
 * stale or dry air instead, and drown without dry land; amphibians need
 * both water and land.
 */
final class HealthSystem implements SimulationSystem
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
        $habitat = $species->habitat();
        $shared = [
            'temperature stress' => $species->distanceOutside('temperature', $state->temperature) * 0.01,
            'starvation' => $creature->hunger >= 0.95 ? 0.004 : 0.0,
        ];

        if (! $habitat->breathesAir()) {
            return [...$this->waterStressors($species, $state, 1.0), ...$shared];
        }

        $stressors = [
            ...$shared,
            'suffocation' => max(0.0, 16 - $state->airOxygen) * 0.05,
            'CO2 poisoning' => max(0.0, $state->airCo2 - 5000) * 0.00002,
            'drying out' => $species->distanceOutside('humidity', $state->humidity) * 0.004,
            // Amphibians can swim, but still need somewhere to haul out.
            'drowning' => $state->landAreaCm2 > 0 ? 0.0 : ($habitat === Habitat::Amphibious ? 0.02 : 0.2),
        ];

        if ($habitat === Habitat::Amphibious) {
            $stressors['drying out'] += $state->hasWater ? 0.0 : 0.02;

            if ($state->hasWater) {
                $water = $this->waterStressors($species, $state, 0.5);
                unset($water['suffocation']);
                $stressors = [...$stressors, ...$water];
            }
        }

        return $stressors;
    }

    /**
     * Harm from the water itself, scaled for animals that only partly live in it.
     *
     * @return array<string, float>
     */
    private function waterStressors(SpeciesDefinition $species, TankState $state, float $exposure): array
    {
        if (! $state->hasWater) {
            return ['suffocation' => 0.5];
        }

        $ammoniaToxicity = min(4.0, max(0.2, 10 ** ($state->ph - 7.2)));

        return array_map(fn (float $loss): float => $loss * $exposure, [
            'ammonia poisoning' => max(0.0, $state->ammonia * $ammoniaToxicity - 0.25) * 0.05,
            'nitrite poisoning' => max(0.0, $state->nitrite - 0.5) * 0.04,
            'nitrate stress' => max(0.0, $state->nitrate - 50) * 0.0003,
            'suffocation' => max(0.0, 4 - $state->oxygen) * 0.03,
            'pH stress' => $species->distanceOutside('ph', $state->ph) * 0.03,
        ]);
    }
}
