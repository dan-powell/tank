<?php

namespace App\Simulation;

/**
 * Mutable working copy of a plant during a simulation step.
 *
 * `rootHeight` is the grid cell row its roots sit in (the substrate's surface
 * or a decoration anchor), which decides whether it is under water.
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
        public int $rootHeight = TankGeometry::DEFAULT_SUBSTRATE,
    ) {}

    /**
     * Photosynthetically active biomass.
     */
    public function biomass(): float
    {
        return $this->size * $this->health;
    }
}
