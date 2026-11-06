<?php

namespace App\Simulation;

/**
 * Mutable working copy of a plant during a simulation step.
 */
final class PlantState
{
    public bool $isDead = false;

    public function __construct(
        public ?int $id,
        public int $speciesId,
        public ?int $parentId,
        public float $rootX,
        public float $rootY,
        public float $rootZ,
        public float $size,
        public int $segments,
        public float $health,
        public int $ageSeconds,
    ) {}

    /**
     * Photosynthetically active biomass.
     */
    public function biomass(): float
    {
        return $this->size * $this->health;
    }
}
