<?php

namespace App\Simulation\Systems;

use App\Enums\CreatureIntent;
use App\Enums\CreatureMood;
use App\Simulation\CreatureState;
use App\Simulation\SpeciesDefinition;
use App\Simulation\StepContext;
use App\Simulation\TankState;

/**
 * Animals decide what they are busy doing (one intent at a time) and pick up
 * passing moods, from how they feel and what the tank is like.
 *
 * Each intent is scored from hunger, health, light, age and danger, weighted
 * by the species' `behaviours`, with a little randomness. An animal sticks
 * with its current intent for at least an hour unless something else is far
 * more pressing, so it doesn't flit between them. Zoomies come and go on a
 * timer; skittish and sluggish last as long as their causes. The browser
 * shows all of this in how they move and look; other systems use it too.
 */
final class BehaviourSystem implements SimulationSystem
{
    /** Simulated seconds an animal keeps to an intent before reconsidering. */
    public const int MIN_INTENT_SECONDS = 3600;

    /** Extra score for carrying on with the current intent. */
    private const float STICKINESS = 0.25;

    /** How much better an intent must score to interrupt the current one early. */
    private const float URGENT_MARGIN = 0.6;

    /** Random spread added to each score, so animals of a kind don't act in lockstep. */
    private const float JITTER = 0.15;

    /** Shortest and longest bout of zoomies, in simulated seconds. */
    private const array ZOOMIES_SECONDS = [1200, 3600];

    /** Newcomers stay skittish for their first simulated day. */
    private const int NEWBORN_SECONDS = 86400;

    public function apply(TankState $state, StepContext $context): void
    {
        $fryPredators = $state->fryPredatorCount();

        foreach ($state->livingCreatures() as $creature) {
            $species = $state->speciesOf($creature);
            $this->chooseIntent($creature, $this->scores($creature, $species, $state, $fryPredators), $context);
            $this->updateMoods($creature, $species, $state, $context);
        }
    }

    /**
     * How strongly the animal is drawn to each intent right now (0 = not at all).
     *
     * @return array<string, float> Keyed by CreatureIntent value.
     */
    private function scores(CreatureState $creature, SpeciesDefinition $species, TankState $state, int $fryPredators): array
    {
        $stress = (1 - $creature->health) + ($creature->mainStressor !== null ? 0.3 : 0.0);
        $isJuvenile = ! $creature->isMature($species);
        $hidesFromPredators = $fryPredators > 0 && $state->isFry($creature);

        $raw = [
            CreatureIntent::Wander->value => 0.35,
            CreatureIntent::Hunt->value => $this->eatsFoodOrPrey($species) ? $creature->hunger ** 1.5 * 2 : 0.0,
            CreatureIntent::Rest->value => ($state->isLit ? 0.15 : 1.0) + (1 - $creature->health) * 0.6,
            CreatureIntent::Hide->value => (1 - $creature->health) * 0.8
                + ($creature->mainStressor !== null ? 0.3 : 0.0)
                + ($hidesFromPredators ? 1.2 : 0.0),
            CreatureIntent::Shoal->value => 0.4 + $stress,
            CreatureIntent::Explore->value => $state->isLit ? 0.35 + ($isJuvenile ? 0.25 : 0.0) : 0.0,
            CreatureIntent::Patrol->value => $state->isLit ? 0.4 : 0.0,
        ];

        $scores = [];

        foreach ($raw as $intent => $score) {
            $weight = $intent === CreatureIntent::Wander->value ? 1.0 : $this->weight($species, $intent);
            $scores[$intent] = $score * $weight;
        }

        return $scores;
    }

    /**
     * Switch to the most appealing intent if it's been long enough, or if it is far more pressing.
     *
     * @param  array<string, float>  $scores
     */
    private function chooseIntent(CreatureState $creature, array $scores, StepContext $context): void
    {
        $current = $creature->intent->value;
        $stillOpen = ($scores[$current] ?? 0.0) > 0;
        $best = $current;
        $bestScore = -INF;
        $currentScore = 0.0;

        foreach ($scores as $intent => $score) {
            if ($score <= 0) {
                continue;
            }

            $score += $context->between(0, self::JITTER) + ($intent === $current ? self::STICKINESS : 0.0);

            if ($intent === $current) {
                $currentScore = $score;
            }

            if ($score > $bestScore) {
                $best = $intent;
                $bestScore = $score;
            }
        }

        $isSettled = $creature->intentSeconds >= self::MIN_INTENT_SECONDS;
        $shouldSwitch = $best !== $current
            && (! $stillOpen || $isSettled || $bestScore - $currentScore > self::URGENT_MARGIN);

        if ($shouldSwitch) {
            $creature->intent = CreatureIntent::from($best);
            $creature->intentSeconds = 0;
        } else {
            $creature->intentSeconds += $context->dtSeconds;
        }
    }

    private function updateMoods(CreatureState $creature, SpeciesDefinition $species, TankState $state, StepContext $context): void
    {
        $moods = [];

        $zoomiesLeft = ($creature->moods[CreatureMood::Zoomies->value] ?? 0) - $context->dtSeconds;

        if ($zoomiesLeft > 0) {
            $moods[CreatureMood::Zoomies->value] = $zoomiesLeft;
        } elseif ($this->canGetZoomies($creature, $state)
            && $context->chancePerDay($this->weight($species, CreatureMood::Zoomies->value) * ($creature->isMature($species) ? 2 : 6))) {
            $moods[CreatureMood::Zoomies->value] = (int) round($context->between(...self::ZOOMIES_SECONDS));
        }

        if ($creature->health < 0.5 || $creature->ageSeconds < self::NEWBORN_SECONDS) {
            $moods[CreatureMood::Skittish->value] = 0;
        }

        if ($this->isSluggish($species, $state)) {
            $moods[CreatureMood::Sluggish->value] = 0;
        }

        $creature->moods = $moods;
    }

    private function canGetZoomies(CreatureState $creature, TankState $state): bool
    {
        return $state->isLit && $creature->health > 0.7 && $creature->hunger < 0.6;
    }

    /**
     * Cold, or short of oxygen in whatever it breathes.
     */
    private function isSluggish(SpeciesDefinition $species, TankState $state): bool
    {
        [$coldest] = $species->param('temperature', [0, 100]);

        if ($state->temperature < $coldest) {
            return true;
        }

        return $species->habitat()->breathesAir()
            ? $state->airOxygen < 16
            : $state->hasWater && $state->oxygen < 4;
    }

    private function eatsFoodOrPrey(SpeciesDefinition $species): bool
    {
        $diet = $species->param('diet', []);

        return isset($diet['food']) || isset($diet['prey']);
    }

    private function weight(SpeciesDefinition $species, string $behaviour): float
    {
        return max(0.0, $species->number("behaviours.{$behaviour}"));
    }
}
