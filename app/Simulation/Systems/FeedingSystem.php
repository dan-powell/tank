<?php

namespace App\Simulation\Systems;

use App\Simulation\CreatureState;
use App\Simulation\StepContext;
use App\Simulation\TankState;

/**
 * Hungry creatures eat from the food sources in their diet. Mid-water fish
 * reach dropped food first; bottom feeders get whatever sinks.
 *
 * A species' diet maps each source (food, algae, detritus) to the amount of
 * that source which fully satisfies an adult.
 */
final class FeedingSystem implements SimulationSystem
{
    /** A full meal can be eaten in this many hours. */
    private const float MEAL_DURATION_HOURS = 0.25;

    private const float SATED = 0.05;

    public function apply(TankState $state, StepContext $context): void
    {
        $creatures = $context->random->shuffleArray($state->livingCreatures());
        usort($creatures, fn (CreatureState $a, CreatureState $b): int => $state->speciesOf($a)->number('feeding_order', 1) <=> $state->speciesOf($b)->number('feeding_order', 1));

        $eatingRate = min(1.0, $context->hours / self::MEAL_DURATION_HOURS);

        foreach ($creatures as $creature) {
            $species = $state->speciesOf($creature);
            $appetite = $creature->metabolicFactor($species);

            foreach ($species->param('diet', []) as $source => $meal) {
                if ($creature->hunger <= self::SATED) {
                    break;
                }

                $fullMeal = $meal * $appetite;
                $wanted = min($creature->hunger * $fullMeal, $fullMeal * $eatingRate);
                $eaten = min($wanted, $this->available($state, $source));

                $this->consume($state, $source, $eaten);
                $creature->hunger = max(0.0, $creature->hunger - $eaten / max($fullMeal, 1e-9));
            }
        }
    }

    private function available(TankState $state, string $source): float
    {
        return match ($source) {
            'food' => $state->uneatenFood,
            'algae' => $state->algae,
            'detritus' => $state->detritus,
            default => 0.0,
        };
    }

    private function consume(TankState $state, string $source, float $amount): void
    {
        match ($source) {
            'food' => $state->uneatenFood -= $amount,
            'algae' => $state->algae -= $amount,
            'detritus' => $state->detritus -= $amount,
            default => null,
        };
    }
}
