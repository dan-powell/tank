<?php

namespace App\Simulation\Systems;

use App\Enums\TankEventType;
use App\Simulation\CreatureState;
use App\Simulation\StepContext;
use App\Simulation\TankState;

/**
 * Deaths from failing health, old age, and fry being eaten (less likely in
 * densely planted tanks). Corpses and dead plants become detritus.
 */
final class MortalitySystem implements SimulationSystem
{
    /** Fry are vulnerable until they reach this fraction of adult size. */
    private const float FRY_SIZE_FRACTION = 0.35;

    public function apply(TankState $state, StepContext $context): void
    {
        $predators = count(array_filter(
            $state->livingCreatures(),
            fn (CreatureState $creature): bool => $state->speciesOf($creature)->param('eats_fry', false)
                && ! $this->isFry($creature, $state),
        ));
        $cover = $state->competitivePlantBiomass() * 100 / max($state->volumeLitres, 1);

        foreach ($state->livingCreatures() as $creature) {
            $species = $state->speciesOf($creature);
            $lifespanSeconds = $species->number('lifespan_days', 365) * 86400;

            if ($creature->health <= 0) {
                $creature->die($creature->mainStressor ?? 'poor health');
            } elseif ($creature->ageSeconds > $lifespanSeconds
                && $context->chancePerDay(0.25 * (1 + 4 * ($creature->ageSeconds - $lifespanSeconds) / $lifespanSeconds))) {
                $creature->die('old age');
            } elseif ($predators > 0 && $this->isFry($creature, $state)
                && $context->chancePerDay(0.4 * $predators / ($predators + 3) / (1 + $cover / 10))) {
                $creature->die('eaten');
            }

            if ($creature->isDead) {
                $this->recordCreatureDeath($creature, $state, $context);
            }
        }

        foreach ($state->livingPlants() as $plant) {
            if ($plant->health <= 0) {
                $plant->isDead = true;
                $state->detritus += $plant->size * 0.5;
                $name = $state->speciesOf($plant)->name;
                $context->emit(TankEventType::PlantDied, "A {$name} has died back.", ['species_id' => $plant->speciesId]);
            }
        }
    }

    private function isFry(CreatureState $creature, TankState $state): bool
    {
        return $creature->size < $state->speciesOf($creature)->number('adult_size', 1) * self::FRY_SIZE_FRACTION;
    }

    private function recordCreatureDeath(CreatureState $creature, TankState $state, StepContext $context): void
    {
        $species = $state->speciesOf($creature);

        if ($creature->deathCause !== 'eaten') {
            $state->detritus += 0.5 * $creature->metabolicFactor($species);
        }

        $name = $creature->nickname ?? ($this->isFry($creature, $state) ? "A {$species->name} fry" : "A {$species->name}");
        $message = $creature->deathCause === 'eaten'
            ? "{$name} was eaten."
            : "{$name} died of {$creature->deathCause}.";

        $context->emit(TankEventType::Death, $message, [
            'species_id' => $species->id,
            'creature_id' => $creature->id,
            'cause' => $creature->deathCause,
        ]);
    }
}
