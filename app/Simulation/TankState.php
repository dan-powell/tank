<?php

namespace App\Simulation;

/**
 * Mutable working copy of a tank's full simulated state.
 *
 * Concentrations are mg/L (ppm), detritus and food grams, algae percentage
 * coverage, bacteria nitrifying capacity in ppm/hour.
 */
final class TankState
{
    /** Whether the tank is lit during the current step (derived each step). */
    public bool $isLit = false;

    /**
     * @param  array<int, SpeciesDefinition>  $species  Keyed by species id.
     * @param  list<PlantState>  $plants
     * @param  list<CreatureState>  $creatures
     * @param  array<int, array<int, array{0: int, 1: int, 2: int}>>  $decorationAnchors  Submerged anchor cells, keyed by decoration id then anchor index.
     * @param  list<GridBox>  $groundedFootprints  Decorations resting on the substrate, where plants cannot root.
     * @param  int  $gridWidth  Interior width in decoration grid cells.
     * @param  int  $gridDepth  Interior depth in decoration grid cells.
     */
    public function __construct(
        public int $volumeLitres,
        public int $layerCount,
        public float $temperature,
        public float $targetTemperature,
        public float $ph,
        public float $ammonia,
        public float $nitrite,
        public float $nitrate,
        public float $oxygen,
        public float $co2,
        public float $detritus,
        public float $uneatenFood,
        public float $algae,
        public float $bacteria,
        public bool $lightOn,
        public int $simTick,
        public int $simSeconds,
        public int $rngSeed,
        public array $species,
        public array $plants = [],
        public array $creatures = [],
        public ?AutoFeederState $autoFeeder = null,
        public array $decorationAnchors = [],
        public array $groundedFootprints = [],
        public int $gridWidth = TankGeometry::DEFAULT_WIDTH,
        public int $gridDepth = TankGeometry::DEFAULT_DEPTH,
    ) {}

    /**
     * Deep copy, so a simulation run never mutates its input.
     */
    public function copy(): self
    {
        $copy = clone $this;
        $copy->plants = array_map(fn (PlantState $plant): PlantState => clone $plant, $this->plants);
        $copy->creatures = array_map(fn (CreatureState $creature): CreatureState => clone $creature, $this->creatures);
        $copy->autoFeeder = $this->autoFeeder === null ? null : clone $this->autoFeeder;

        return $copy;
    }

    public function speciesOf(PlantState|CreatureState $entity): SpeciesDefinition
    {
        return $this->species[$entity->speciesId];
    }

    /**
     * @return list<PlantState>
     */
    public function livingPlants(): array
    {
        return array_values(array_filter($this->plants, fn (PlantState $plant): bool => ! $plant->isDead));
    }

    /**
     * @return list<CreatureState>
     */
    public function livingCreatures(): array
    {
        return array_values(array_filter($this->creatures, fn (CreatureState $creature): bool => ! $creature->isDead));
    }

    /**
     * Anchor indexes of a decoration that no living plant is growing from.
     *
     * @return list<int>
     */
    public function freeAnchors(int $decorationId): array
    {
        $taken = array_map(
            fn (PlantState $plant): ?int => $plant->anchorIndex,
            array_filter($this->livingPlants(), fn (PlantState $plant): bool => $plant->decorationId === $decorationId),
        );

        return array_values(array_diff(array_keys($this->decorationAnchors[$decorationId] ?? []), $taken));
    }

    /**
     * Whether a decoration rests on the substrate at a plant's root position.
     */
    public function isSubstrateCovered(float $rootX, int $layer): bool
    {
        [$x, $z] = TankGeometry::plantColumn($rootX, $layer, $this->layerCount, $this->gridWidth, $this->gridDepth);

        return array_any($this->groundedFootprints, fn (GridBox $box): bool => $box->coversColumn($x, $z));
    }

    /**
     * Convert a mass in milligrams dissolved in the tank into a concentration in ppm.
     */
    public function ppm(float $milligrams): float
    {
        return $milligrams / max($this->volumeLitres, 1);
    }

    /**
     * Total healthy plant biomass, weighted by each species' algae competitiveness.
     */
    public function competitivePlantBiomass(): float
    {
        return array_sum(array_map(
            fn (PlantState $plant): float => $plant->biomass() * $this->speciesOf($plant)->number('algae_competition', 1),
            $this->livingPlants(),
        ));
    }

    /**
     * Clamp water parameters back into physically meaningful ranges.
     */
    public function normalise(): void
    {
        $this->ammonia = max(0.0, $this->ammonia);
        $this->nitrite = max(0.0, $this->nitrite);
        $this->nitrate = max(0.0, $this->nitrate);
        $this->oxygen = max(0.0, $this->oxygen);
        $this->co2 = max(0.0, $this->co2);
        $this->detritus = max(0.0, $this->detritus);
        $this->uneatenFood = max(0.0, $this->uneatenFood);
        $this->algae = min(100.0, max(0.0, $this->algae));
        $this->ph = min(9.5, max(4.5, $this->ph));
    }
}
