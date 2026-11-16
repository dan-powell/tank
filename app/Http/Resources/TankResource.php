<?php

namespace App\Http\Resources;

use App\Models\LightFixture;
use App\Models\Tank;
use App\Simulation\AlertSettings;
use App\Simulation\BalanceLimits;
use App\Simulation\Gantry;
use App\Simulation\LightField;
use App\Simulation\LightFixtureState;
use App\Simulation\SubstrateHeightmap;
use App\Simulation\TankGeometry;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Snapshot of a tank sent to the browser for rendering.
 *
 * @mixin Tank
 */
class TankResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'volume_litres' => $this->volume_litres,
            'layer_count' => $this->layer_count,
            'grid' => TankGeometry::grid($this->resource),
            'has_water' => ! TankGeometry::isDry($this->resource),
            'land_area_cm2' => round(TankGeometry::landAreaCm2($this->resource, $this->decorations), 1),
            'is_sealed' => $this->is_sealed,
            'background' => [
                'colour' => $this->background_colour,
                'gradient_colour' => $this->background_gradient_colour,
            ],
            'air' => [
                'humidity' => round($this->humidity, 1),
                'oxygen' => round($this->air_oxygen, 2),
                'co2' => round($this->air_co2),
            ],
            'substrate' => SubstrateHeightmap::of($this->resource)->toRuns(),
            'water' => [
                'temperature' => round($this->temperature, 1),
                'target_temperature' => round($this->target_temperature, 1),
                'ph' => round($this->ph, 2),
                'ammonia' => round($this->ammonia, 3),
                'nitrite' => round($this->nitrite, 3),
                'nitrate' => round($this->nitrate, 1),
                'oxygen' => round($this->oxygen, 2),
                'co2' => round($this->co2, 2),
                'detritus' => round($this->detritus, 3),
                'uneaten_food' => round($this->uneaten_food, 3),
                'algae' => round($this->algae, 1),
            ],
            'light_mode' => $this->light_mode,
            'is_lit' => $this->isLit(),
            'lighting' => $this->lighting($request),
            'auto_feeder' => $this->auto_feeder_installed ? [
                'feeds_per_day' => $this->auto_feeder_feeds_per_day,
                'feed_hours' => config("simulation.auto_feeder.schedules.{$this->auto_feeder_feeds_per_day}", []),
                'unlimited' => $this->auto_feeder_unlimited,
                'portions' => $this->auto_feeder_portions,
                'capacity' => config('simulation.auto_feeder.hopper_capacity'),
            ] : null,
            'is_paused' => $this->is_paused,
            'pause_reason' => $this->pause_reason,
            'limits' => BalanceLimits::forTank($this->resource)->toArray(),
            'alerts' => [
                ...$this->alertSettings()->toArray(),
                'parameters' => AlertSettings::parameters(),
            ],
            'sim_tick' => $this->sim_tick,
            'sim_seconds' => $this->sim_seconds,
            'time_scale' => (float) config('simulation.time_scale'),
            'last_simulated_at' => $this->last_simulated_at?->toIso8601String(),
            'plants' => $this->whenLoaded('plants', fn (): array => PlantResource::collection($this->plants)->resolve($request)),
            'creatures' => $this->whenLoaded('creatures', fn (): array => CreatureResource::collection($this->creatures)->resolve($request)),
            'decorations' => $this->whenLoaded('decorations', fn (): array => DecorationResource::collection($this->decorations)->resolve($request)),
        ];
    }

    /**
     * Whether any light on the gantry is on right now.
     */
    private function isLit(): bool
    {
        return array_any($this->fixtureStates(), fn (LightFixtureState $fixture): bool => $fixture->levelAt($this->sim_seconds) > 0);
    }

    /**
     * The gantry and the lights hanging from it.
     *
     * @return array<string, mixed>
     */
    private function lighting(Request $request): array
    {
        $gantry = Gantry::of($this->resource);

        return [
            'gantry' => [
                'columns' => $gantry->columns,
                'rows' => $gantry->rows,
                'clearance' => Gantry::CLEARANCE,
            ],
            'fixtures' => LightFixtureResource::collection($this->lightFixtures)->resolve($request),
            'max_fixtures' => config('simulation.lighting.max_fixtures'),
            'photoperiod_hours' => (new LightField($this->fixtureStates(), 0, false))->photoperiodHours(),
        ];
    }

    /**
     * The lights as the master switch runs them.
     *
     * @return list<LightFixtureState>
     */
    private function fixtureStates(): array
    {
        $gantry = Gantry::of($this->resource);

        return $this->light_mode->fixturesInEffect(
            $this->lightFixtures->map(fn (LightFixture $fixture): LightFixtureState => LightFixtureState::fromModel($fixture, $gantry))->all(),
        );
    }
}
