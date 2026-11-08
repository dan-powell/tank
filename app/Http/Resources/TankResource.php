<?php

namespace App\Http\Resources;

use App\Models\Tank;
use App\Simulation\Systems\LightingSystem;
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
            'substrate' => TankGeometry::substrateHeights($this->resource),
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
            'light_on' => $this->light_on,
            'is_lit' => $this->light_on && LightingSystem::isDaytime($this->sim_seconds),
            'auto_feeder' => $this->auto_feeder_installed ? [
                'feeds_per_day' => $this->auto_feeder_feeds_per_day,
                'feed_hours' => config("simulation.auto_feeder.schedules.{$this->auto_feeder_feeds_per_day}", []),
                'unlimited' => $this->auto_feeder_unlimited,
                'portions' => $this->auto_feeder_portions,
                'capacity' => config('simulation.auto_feeder.hopper_capacity'),
            ] : null,
            'sim_tick' => $this->sim_tick,
            'sim_seconds' => $this->sim_seconds,
            'last_simulated_at' => $this->last_simulated_at?->toIso8601String(),
            'plants' => $this->whenLoaded('plants', fn (): array => PlantResource::collection($this->plants)->resolve($request)),
            'creatures' => $this->whenLoaded('creatures', fn (): array => CreatureResource::collection($this->creatures)->resolve($request)),
            'decorations' => $this->whenLoaded('decorations', fn (): array => DecorationResource::collection($this->decorations)->resolve($request)),
        ];
    }
}
