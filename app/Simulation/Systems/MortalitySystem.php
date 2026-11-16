<?php

namespace App\Simulation\Systems;

use App\Enums\CreatureIntent;
use App\Enums\TankEventType;
use App\Simulation\CreatureState;
use App\Simulation\StepContext;
use App\Simulation\TankState;

/**
 * Deaths from failing health, old age, and fry being eaten (less likely in
 * densely planted tanks, especially for fry that are hiding). Corpses and dead plants become detritus.
 */
final class MortalitySystem implements SimulationSystem
{
    /** Hiding fry count this much more of the plants as cover. */
    private const float HIDING_COVER = 2.0;

    public function apply(TankState $state, StepContext $context): void
    {
        $predators = $state->fryPredatorCount();
        $cover = $state->competitivePlantBiomass() * 100 / max($state->volumeLitres, 1);

        foreach ($state->livingCreatures() as $creature) {
            $species = $state->speciesOf($creature);
            $lifespanSeconds = $species->number('lifespan_days', 365) * 86400;

            if ($creature->health <= 0) {
                $creature->die($creature->mainStressor ?? 'poor health');
            } elseif ($creature->ageSeconds > $lifespanSeconds
                && $context->chancePerDay(0.25 * (1 + 4 * ($creature->ageSeconds - $lifespanSeconds) / $lifespanSeconds))) {
                $creature->die('old age');
            } elseif ($predators > 0 && $state->isFry($creature)
                && $context->chancePerDay(0.4 * $predators / ($predators + 3) / (1 + $this->coverFor($creature, $cover) / 10))) {
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

    /**
     * The plant cover a fry makes use of: more when it is hiding in it.
     */
    private function coverFor(CreatureState $creature, float $cover): float
    {
        return $creature->intent === CreatureIntent::Hide ? $cover * self::HIDING_COVER : $cover;
    }

    private function recordCreatureDeath(CreatureState $creature, TankState $state, StepContext $context): void
    {
        $species = $state->speciesOf($creature);

        if ($creature->deathCause !== 'eaten') {
            $state->detritus += 0.5 * $creature->metabolicFactor($species);
        }

        $name = $creature->nickname ?? ($state->isFry($creature) ? "A {$species->name} fry" : "A {$species->name}");
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
