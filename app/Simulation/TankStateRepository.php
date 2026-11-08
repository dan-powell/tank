<?php

namespace App\Simulation;

use App\Models\Creature;
use App\Models\Decoration;
use App\Models\Plant;
use App\Models\Species;
use App\Models\Tank;
use Carbon\CarbonInterface;

/**
 * Maps between Eloquent models and the simulation's working state.
 */
final class TankStateRepository
{
    public function load(Tank $tank): TankState
    {
        $species = Species::query()->get()->mapWithKeys(fn (Species $species): array => [
            $species->id => new SpeciesDefinition($species->id, $species->slug, $species->kind, $species->name, $species->params),
        ])->all();

        $decorations = $tank->decorations()->get()->keyBy('id');

        $plants = Plant::query()->whereBelongsTo($tank)->alive()->orderBy('id')->get()
            ->map(fn (Plant $plant): PlantState => new PlantState(
                id: $plant->id,
                speciesId: $plant->species_id,
                parentId: $plant->parent_id,
                rootX: $plant->root_x,
                rootY: $plant->root_y,
                layer: $plant->layer,
                size: $plant->size,
                segments: $plant->segments,
                health: $plant->health,
                ageSeconds: $plant->age_seconds,
                decorationId: $plant->decoration_id,
                anchorIndex: $plant->anchor_index,
                rootHeight: $this->rootHeight($tank, $plant, $decorations->get($plant->decoration_id)),
            ))->all();

        $creatures = Creature::query()->whereBelongsTo($tank)->alive()->orderBy('id')->get()
            ->map(fn (Creature $creature): CreatureState => new CreatureState(
                id: $creature->id,
                speciesId: $creature->species_id,
                motherId: $creature->mother_id,
                fatherId: $creature->father_id,
                nickname: $creature->nickname,
                sex: $creature->sex,
                size: $creature->size,
                hunger: $creature->hunger,
                health: $creature->health,
                ageSeconds: $creature->age_seconds,
                gestationSeconds: $creature->gestation_seconds,
                zoneX: $creature->zone_x,
                zoneY: $creature->zone_y,
                layer: $creature->layer,
                zoneRadius: $creature->zone_radius,
                generation: $creature->generation,
            ))->all();

        return new TankState(
            volumeLitres: $tank->volume_litres,
            layerCount: $tank->layer_count,
            temperature: $tank->temperature,
            targetTemperature: $tank->target_temperature,
            ph: $tank->ph,
            ammonia: $tank->ammonia,
            nitrite: $tank->nitrite,
            nitrate: $tank->nitrate,
            oxygen: $tank->oxygen,
            co2: $tank->co2,
            detritus: $tank->detritus,
            uneatenFood: $tank->uneaten_food,
            algae: $tank->algae,
            bacteria: $tank->bacteria,
            lightOn: $tank->light_on,
            simTick: $tank->sim_tick,
            simSeconds: $tank->sim_seconds,
            rngSeed: $tank->rng_seed,
            species: $species,
            plants: array_values($plants),
            creatures: array_values($creatures),
            autoFeeder: $tank->auto_feeder_installed ? new AutoFeederState(
                feedHours: config("simulation.auto_feeder.schedules.{$tank->auto_feeder_feeds_per_day}", []),
                portionGrams: (float) config('simulation.feed_pinch_grams'),
                unlimited: $tank->auto_feeder_unlimited,
                portions: $tank->auto_feeder_portions,
            ) : null,
            decorationAnchors: $decorations->mapWithKeys(fn (Decoration $decoration): array => [
                $decoration->id => $this->submergedAnchors($tank, $decoration),
            ])->all(),
            groundedFootprints: TankGeometry::groundedFootprints($tank, $decorations),
            gridWidth: $tank->grid_width,
            gridDepth: $tank->grid_depth,
            waterLevel: TankGeometry::waterLevel($tank),
            hasWater: ! TankGeometry::isDry($tank),
        );
    }

    /**
     * The grid row a plant's roots sit in: its anchor, or the substrate's surface beneath it.
     */
    private function rootHeight(Tank $tank, Plant $plant, ?Decoration $decoration): int
    {
        if ($decoration !== null && $plant->anchor_index !== null && isset($decoration->definition()->anchors[$plant->anchor_index])) {
            return TankGeometry::anchorCell($decoration, $plant->anchor_index)[1];
        }

        [$x, $z] = TankGeometry::plantColumn($plant->root_x, $plant->layer, $tank->layer_count, $tank->grid_width, $tank->grid_depth);

        return TankGeometry::substrateHeightAt($tank, $x, $z);
    }

    /**
     * @return array<int, array{0: int, 1: int, 2: int}>
     */
    private function submergedAnchors(Tank $tank, Decoration $decoration): array
    {
        $anchors = [];

        foreach (array_keys($decoration->definition()->anchors) as $index) {
            $cell = TankGeometry::anchorCell($decoration, $index);

            if (TankGeometry::isSubmerged($tank, $cell[1])) {
                $anchors[$index] = $cell;
            }
        }

        return $anchors;
    }

    /**
     * Persist a simulation result: water parameters, plants, creatures and events.
     */
    public function save(Tank $tank, SimulationResult $result, CarbonInterface $now): void
    {
        $state = $result->state;

        $tank->forceFill([
            'temperature' => $state->temperature,
            'ph' => $state->ph,
            'ammonia' => $state->ammonia,
            'nitrite' => $state->nitrite,
            'nitrate' => $state->nitrate,
            'oxygen' => $state->oxygen,
            'co2' => $state->co2,
            'detritus' => $state->detritus,
            'uneaten_food' => $state->uneatenFood,
            'algae' => $state->algae,
            'bacteria' => $state->bacteria,
            'sim_tick' => $state->simTick,
            'sim_seconds' => $state->simSeconds,
            'auto_feeder_portions' => $state->autoFeeder->portions ?? $tank->auto_feeder_portions,
            'last_simulated_at' => $now,
        ])->save();

        $this->savePlants($tank, $state->plants, $now);
        $this->saveCreatures($tank, $state->creatures, $now);

        if ($result->events !== []) {
            $tank->events()->createMany(array_map(fn (SimEvent $event): array => [
                'type' => $event->type,
                'message' => $event->message,
                'payload' => $event->payload ?: null,
                'sim_tick' => $event->simTick,
            ], $result->events));
        }
    }

    /**
     * @param  list<PlantState>  $plants
     */
    private function savePlants(Tank $tank, array $plants, CarbonInterface $now): void
    {
        $rows = array_map(fn (PlantState $plant): array => [
            'id' => $plant->id,
            'tank_id' => $tank->id,
            'species_id' => $plant->speciesId,
            'parent_id' => $plant->parentId,
            'root_x' => $plant->rootX,
            'root_y' => $plant->rootY,
            'layer' => $plant->layer,
            'decoration_id' => $plant->decorationId,
            'anchor_index' => $plant->anchorIndex,
            'size' => $plant->size,
            'segments' => $plant->segments,
            'health' => $plant->health,
            'age_seconds' => $plant->ageSeconds,
            'died_at' => $plant->isDead ? $now : null,
        ], $plants);

        $this->persist(Plant::class, $rows, ['size', 'segments', 'health', 'age_seconds', 'died_at']);
    }

    /**
     * @param  list<CreatureState>  $creatures
     */
    private function saveCreatures(Tank $tank, array $creatures, CarbonInterface $now): void
    {
        $rows = array_map(fn (CreatureState $creature): array => [
            'id' => $creature->id,
            'tank_id' => $tank->id,
            'species_id' => $creature->speciesId,
            'mother_id' => $creature->motherId,
            'father_id' => $creature->fatherId,
            'nickname' => $creature->nickname,
            'sex' => $creature->sex->value,
            'size' => $creature->size,
            'hunger' => $creature->hunger,
            'health' => $creature->health,
            'age_seconds' => $creature->ageSeconds,
            'gestation_seconds' => $creature->gestationSeconds,
            'zone_x' => $creature->zoneX,
            'zone_y' => $creature->zoneY,
            'layer' => $creature->layer,
            'zone_radius' => $creature->zoneRadius,
            'generation' => $creature->generation,
            'died_at' => $creature->isDead ? $now : null,
            'death_cause' => $creature->deathCause,
        ], $creatures);

        $this->persist(Creature::class, $rows, [
            'size', 'hunger', 'health', 'age_seconds', 'gestation_seconds', 'died_at', 'death_cause',
        ]);
    }

    /**
     * Bulk-update existing rows and insert new ones (rows without an id).
     *
     * @param  class-string<Plant|Creature>  $model
     * @param  list<array<string, mixed>>  $rows
     * @param  list<string>  $updateColumns
     */
    private function persist(string $model, array $rows, array $updateColumns): void
    {
        $existing = array_values(array_filter($rows, fn (array $row): bool => $row['id'] !== null));
        $new = array_map(
            fn (array $row): array => array_diff_key($row, ['id' => true]),
            array_values(array_filter($rows, fn (array $row): bool => $row['id'] === null)),
        );

        foreach (array_chunk($existing, 200) as $chunk) {
            $model::query()->upsert($chunk, ['id'], $updateColumns);
        }

        foreach (array_chunk($new, 200) as $chunk) {
            $model::query()->insert(array_map(fn (array $row): array => [
                ...$row,
                'created_at' => now(),
                'updated_at' => now(),
            ], $chunk));
        }
    }
}
