<?php

namespace App\Simulation\Systems;

use App\Enums\Habitat;
use App\Simulation\CreatureState;
use App\Simulation\StepContext;
use App\Simulation\TankState;

/**
 * Hungry creatures eat from the food sources in their diet. Mid-water fish
 * reach dropped food first; bottom feeders get whatever sinks.
 *
 * A species' diet maps each source (food, algae, detritus) to the amount of
 * that source which fully satisfies an adult, or for `prey`, the number of
 * small `prey` animals that make a full meal. Land animals can't reach food
 * or algae in the water.
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
                if ($creature->hunger <= self::SATED || $creature->isDead) {
                    break;
                }

                if (! $this->canReach($state, $species->habitat(), $source)) {
                    continue;
                }

                if ($source === 'prey') {
                    $this->hunt($creature, max(1.0, $meal * $appetite), $eatingRate, $state, $context);

                    continue;
                }

                $fullMeal = $meal * $appetite;
                $wanted = min($creature->hunger * $fullMeal, $fullMeal * $eatingRate);
                $eaten = min($wanted, $this->available($state, $source));

                $this->consume($state, $source, $eaten);
                $creature->hunger = max(0.0, $creature->hunger - $eaten / max($fullMeal, 1e-9));
            }
        }
    }

    /**
     * Whether an animal of this habitat can get at a food source.
     */
    private function canReach(TankState $state, Habitat $habitat, string $source): bool
    {
        return match ($source) {
            'food', 'algae' => $state->hasWater && $habitat->reachesWater(),
            default => true,
        };
    }

    /**
     * Catch and eat whole prey animals (not of the hunter's own species).
     */
    private function hunt(CreatureState $hunter, float $fullMeal, float $eatingRate, TankState $state, StepContext $context): void
    {
        $wanted = min($hunter->hunger * $fullMeal, $fullMeal * $eatingRate);
        $catches = (int) floor($wanted) + ($context->random->nextFloat() < $wanted - floor($wanted) ? 1 : 0);

        for ($i = 0; $i < $catches; $i++) {
            $prey = array_values(array_filter(
                $state->livingCreatures(),
                fn (CreatureState $other): bool => $other->speciesId !== $hunter->speciesId
                    && (bool) $state->speciesOf($other)->param('prey', false),
            ));

            if ($prey === []) {
                return;
            }

            $prey[$context->random->getInt(0, count($prey) - 1)]->die('eaten');
            $hunter->hunger = max(0.0, $hunter->hunger - 1 / $fullMeal);
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
