<?php

namespace App\Simulation;

use App\Enums\Habitat;

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
     * @param  array<int, array<int, array{0: int, 1: int, 2: int}>>  $decorationAnchors  Anchor cells, keyed by decoration id then anchor index.
     * @param  list<GridBox>  $groundedFootprints  Decorations resting on the substrate, where plants cannot root.
     * @param  int  $gridWidth  Interior width in decoration grid cells.
     * @param  int  $gridDepth  Interior depth in decoration grid cells.
     * @param  int  $waterLevel  First grid cell row above the water.
     * @param  bool  $hasWater  False while the tank is empty; water-only systems are skipped.
     * @param  float  $humidity  Relative humidity of the air above the water, %.
     * @param  float  $airOxygen  Oxygen in the air, % by volume.
     * @param  float  $airCo2  CO2 in the air, ppm.
     * @param  float  $airLitres  Volume of air inside the tank.
     * @param  float  $landAreaCm2  Dry ground above the water.
     * @param  float  $waterSurfaceShare  Share of the floor plan that is open water (0..1).
     * @param  bool  $isSealed  Whether the lid is sealed (no air exchange with the room).
     * @param  SubstrateHeightmap|null  $substrate  The substrate heightmap (null when flat).
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
        public int $waterLevel = TankGeometry::DEFAULT_HEIGHT - TankGeometry::RIM_GAP,
        public bool $hasWater = true,
        public float $humidity = 70.0,
        public float $airOxygen = Air::ROOM_OXYGEN,
        public float $airCo2 = Air::ROOM_CO2,
        public float $airLitres = 3.3,
        public float $landAreaCm2 = 0.0,
        public float $waterSurfaceShare = 1.0,
        public bool $isSealed = false,
        public ?SubstrateHeightmap $substrate = null,
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
     * Whether a plant's roots are where its habitat needs them and, for land
     * plants, the air is humid enough.
     */
    public function suitsPlant(PlantState $plant): bool
    {
        $species = $this->speciesOf($plant);
        $habitat = $species->habitat();

        if (! TankGeometry::rootSuits($habitat, $plant->rootHeight, $this->waterLevel, $this->hasWater)) {
            return false;
        }

        return $habitat !== Habitat::Terrestrial || $species->distanceOutside('humidity', $this->humidity) === 0.0;
    }

    /**
     * Whether a plant of this habitat could root at a grid row.
     */
    public function rootSuits(Habitat $habitat, int $rootHeight): bool
    {
        return TankGeometry::rootSuits($habitat, $rootHeight, $this->waterLevel, $this->hasWater);
    }

    /**
     * Height of the substrate at a grid column.
     */
    public function substrateHeightAt(int $x, int $z): int
    {
        return $this->substrate?->heightAt($x, $z) ?? TankGeometry::DEFAULT_SUBSTRATE;
    }

    /**
     * Add (or, when negative, remove) a mass of oxygen to the air, in mg.
     */
    public function addAirOxygen(float $milligrams): void
    {
        $this->airOxygen += $milligrams / (max($this->airLitres, 0.5) * Air::OXYGEN_MG_PER_LITRE_PER_PERCENT);
    }

    /**
     * Add (or, when negative, remove) a mass of CO2 to the air, in mg.
     */
    public function addAirCo2(float $milligrams): void
    {
        $this->airCo2 += $milligrams / (max($this->airLitres, 0.5) * Air::CO2_MG_PER_LITRE_PER_PPM);
    }

    /**
     * The habitat of a creature's species.
     */
    public function habitatOf(CreatureState $creature): Habitat
    {
        return $this->speciesOf($creature)->habitat();
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
        $this->humidity = min(Air::MAX_HUMIDITY, max(0.0, $this->humidity));
        $this->airOxygen = min(100.0, max(0.0, $this->airOxygen));
        $this->airCo2 = max(0.0, $this->airCo2);
        $this->ph = min(9.5, max(4.5, $this->ph));
    }
}
