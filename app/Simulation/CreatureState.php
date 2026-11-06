<?php

namespace App\Simulation;

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
        public float $zoneZ,
        public float $zoneRadius,
        public int $generation,
    ) {}

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
