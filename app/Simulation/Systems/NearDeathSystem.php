<?php

namespace App\Simulation\Systems;

use App\Enums\TankEventType;
use App\Simulation\CreatureState;
use App\Simulation\StepContext;
use App\Simulation\TankState;

/**
 * Pause the tank when a watched animal's health drops below the owner's
 * near-death line, giving them a chance to save it. Only the drop past the
 * line counts, so resuming with an animal still below it doesn't pause again.
 */
final class NearDeathSystem implements SimulationSystem
{
    public function apply(TankState $state, StepContext $context): void
    {
        $healthBefore = [];

        foreach ($context->before->creatures as $creature) {
            if ($creature->id !== null) {
                $healthBefore[$creature->id] = $creature->health;
            }
        }

        foreach ($state->livingCreatures() as $creature) {
            $before = $healthBefore[$creature->id ?? 0] ?? null;

            if (! $creature->watched || $before === null) {
                continue;
            }

            if ($before >= $state->nearDeathHealth && $creature->health < $state->nearDeathHealth) {
                $state->pauseRequested = true;
                $context->emit(TankEventType::NearDeath, $this->message($creature, $state), [
                    'creature_id' => $creature->id,
                    'species_id' => $creature->speciesId,
                    'health' => round($creature->health, 3),
                    'cause' => $creature->mainStressor,
                ]);
            }
        }
    }

    private function message(CreatureState $creature, TankState $state): string
    {
        $species = $state->speciesOf($creature)->name;
        $name = $creature->nickname === null ? "A {$species}" : "{$creature->nickname} the {$species}";
        $health = (int) round($creature->health * 100);
        $cause = $creature->mainStressor === null ? '' : " from {$creature->mainStressor}";

        return "{$name} is close to death ({$health}% health{$cause}). The tank has been paused.";
    }
}
