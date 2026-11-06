<?php

namespace Tests\Unit\Simulation;

use App\Enums\Sex;
use App\Simulation\CreatureState;
use App\Simulation\PlantState;
use App\Simulation\SpeciesCatalogue;
use App\Simulation\SpeciesDefinition;
use App\Simulation\StepContext;
use App\Simulation\TankState;
use Random\Engine\Mt19937;
use Random\Randomizer;

/**
 * Builds in-memory simulation state from the real species catalogue.
 */
trait BuildsSimulationState
{
    /**
     * Catalogue species keyed by id, ids assigned in catalogue order (1 = vallisneria ...).
     *
     * @param  array<string, array<string, mixed>>  $paramOverrides  Keyed by slug.
     * @return array<int, SpeciesDefinition>
     */
    protected function catalogue(array $paramOverrides = []): array
    {
        $species = [];
        $id = 1;

        foreach (SpeciesCatalogue::definitions() as $slug => $definition) {
            $params = array_replace_recursive($definition['params'], $paramOverrides[$slug] ?? []);
            $species[$id] = new SpeciesDefinition($id, $slug, $definition['kind'], $definition['name'], $params);
            $id++;
        }

        return $species;
    }

    protected function speciesId(string $slug): int
    {
        return array_search($slug, array_keys(SpeciesCatalogue::definitions()), true) + 1;
    }

    /**
     * A clean, cycled, lit tank with no inhabitants.
     *
     * @param  array<string, mixed>  $overrides  Constructor argument overrides, plus `isLit`.
     */
    protected function tankState(array $overrides = []): TankState
    {
        $isLit = $overrides['isLit'] ?? true;
        unset($overrides['isLit']);

        $state = new TankState(...[
            'volumeLitres' => 60,
            'temperature' => 25.0,
            'targetTemperature' => 25.0,
            'ph' => 7.4,
            'ammonia' => 0.0,
            'nitrite' => 0.0,
            'nitrate' => 10.0,
            'oxygen' => 8.0,
            'co2' => 2.0,
            'detritus' => 0.0,
            'uneatenFood' => 0.0,
            'algae' => 2.0,
            'bacteria' => 0.3,
            'lightOn' => true,
            'simTick' => 0,
            'simSeconds' => 12 * 3600,
            'rngSeed' => 1234,
            'species' => $this->catalogue(),
            ...$overrides,
        ]);
        $state->isLit = $isLit;

        return $state;
    }

    /**
     * @param  array<string, mixed>  $overrides
     */
    protected function plant(string $slug = 'vallisneria', array $overrides = []): PlantState
    {
        return new PlantState(...[
            'id' => null,
            'speciesId' => $this->speciesId($slug),
            'parentId' => null,
            'rootX' => 0.5,
            'rootY' => 0.0,
            'rootZ' => 0.3,
            'size' => 2.0,
            'segments' => 4,
            'health' => 1.0,
            'ageSeconds' => 0,
            ...$overrides,
        ]);
    }

    /**
     * An adult creature of the given species.
     *
     * @param  array<string, mixed>  $overrides
     */
    protected function creature(string $slug = 'guppy', array $overrides = []): CreatureState
    {
        $params = SpeciesCatalogue::definitions()[$slug]['params'];

        return new CreatureState(...[
            'id' => null,
            'speciesId' => $this->speciesId($slug),
            'motherId' => null,
            'fatherId' => null,
            'nickname' => null,
            'sex' => Sex::Female,
            'size' => (float) $params['adult_size'],
            'hunger' => 0.2,
            'health' => 1.0,
            'ageSeconds' => 365 * 86400,
            'gestationSeconds' => null,
            'zoneX' => 0.5,
            'zoneY' => 0.5,
            'zoneZ' => 0.5,
            'zoneRadius' => 0.25,
            'generation' => 1,
            ...$overrides,
        ]);
    }

    protected function context(TankState $state, int $dtSeconds = 300, int $seed = 1): StepContext
    {
        return new StepContext($dtSeconds, new Randomizer(new Mt19937($seed)), $state->copy());
    }
}
