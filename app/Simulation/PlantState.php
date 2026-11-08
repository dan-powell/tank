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
        public int $layer,
        public float $size,
        public int $segments,
        public float $health,
        public int $ageSeconds,
        public ?int $decorationId = null,
        public ?int $anchorIndex = null,
    ) {}

    /**
     * Photosynthetically active biomass.
     */
    public function biomass(): float
    {
        return $this->size * $this->health;
    }
}
