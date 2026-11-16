<?php

namespace App\Simulation;

use App\Enums\CreatureIntent;
use App\Enums\CreatureMood;
use App\Enums\Sex;

/**
 * Mutable working copy of a creature during a simulation step.
 */
final class CreatureState
{
    public bool $isDead = false;

    public ?string $deathCause = null;

    /** The largest stressor from the most recent health update, if any. */
    public ?string $mainStressor = null;

    /** Whether the tank pauses when this animal comes close to death. */
    public bool $watched = false;

    /**
     * @param  array<string, int>  $moods  Active moods (CreatureMood values) => simulated seconds left; 0 = held while a condition lasts.
     */
    public function __construct(
        public ?int $id,
        public int $speciesId,
        public ?int $motherId,
        public ?int $fatherId,
        public ?string $nickname,
        public Sex $sex,
        public float $size,
        public float $hunger,
        public float $health,
        public int $ageSeconds,
        public ?int $gestationSeconds,
        public float $zoneX,
        public float $zoneY,
        public int $layer,
        public float $zoneRadius,
        public int $generation,
        public CreatureIntent $intent = CreatureIntent::Wander,
        public int $intentSeconds = 0,
        public array $moods = [],
    ) {}

    public function hasMood(CreatureMood $mood): bool
    {
        return array_key_exists($mood->value, $this->moods);
    }

    /**
     * How busy its intent and moods keep it, as a multiplier on its metabolism (1 = ordinary).
     */
    public function activityFactor(): float
    {
        $factor = $this->intent->activity();

        foreach (array_keys($this->moods) as $mood) {
            $factor *= CreatureMood::tryFrom($mood)?->activity() ?? 1.0;
        }

        return $factor;
    }

    /**
     * Metabolic scale relative to an adult of the species (adult = 1).
     */
    public function metabolicFactor(SpeciesDefinition $species): float
    {
        $relativeSize = $this->size / max($species->number('adult_size', 1), 0.01);

        return min(max($relativeSize, 0.1), 1.5) ** 2;
    }

    public function isMature(SpeciesDefinition $species): bool
    {
        return $this->ageSeconds >= $species->number('maturity_days') * 86400;
    }

    public function die(string $cause): void
    {
        $this->isDead = true;
        $this->deathCause = $cause;
    }
}
