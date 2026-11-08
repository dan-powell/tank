<?php

namespace Database\Factories;

use App\Models\Tank;
use App\Models\User;
use App\Simulation\TankGeometry;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Tank>
 */
class TankFactory extends Factory
{
    /**
     * Define the model's default state: a healthy, cycled tank.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'name' => fake()->firstName()."'s Tank",
            'volume_litres' => 60,
            'grid_width' => TankGeometry::DEFAULT_WIDTH,
            'grid_height' => TankGeometry::DEFAULT_HEIGHT,
            'grid_depth' => TankGeometry::DEFAULT_DEPTH,
            'layer_count' => 5,
            'temperature' => 25,
            'target_temperature' => 25,
            'ph' => 7.4,
            'ammonia' => 0,
            'nitrite' => 0,
            'nitrate' => 5,
            'oxygen' => 8.3,
            'co2' => 2,
            'detritus' => 0,
            'uneaten_food' => 0,
            'algae' => 2,
            'bacteria' => 0.3,
            'light_on' => true,
            'is_active' => true,
            'sim_tick' => 0,
            'sim_seconds' => 12 * 3600,
            'rng_seed' => fake()->numberBetween(1, 2_147_483_647),
            'last_simulated_at' => now(),
        ];
    }

    /**
     * A tank with the given interior size in grid cells, with matching layers.
     */
    public function sized(int $width, int $height, int $depth): static
    {
        return $this->state(fn (array $attributes): array => [
            'grid_width' => $width,
            'grid_height' => $height,
            'grid_depth' => $depth,
            'layer_count' => TankGeometry::layerCountFor($depth),
        ]);
    }

    /**
     * A brand new tank with no established nitrifying bacteria.
     */
    public function uncycled(): static
    {
        return $this->state(fn (array $attributes): array => [
            'bacteria' => 0.005,
            'nitrate' => 0,
        ]);
    }

    /**
     * A neglected tank with poor water quality.
     */
    public function dirty(): static
    {
        return $this->state(fn (array $attributes): array => [
            'ammonia' => 1.5,
            'nitrite' => 1.0,
            'nitrate' => 60,
            'detritus' => 3,
            'algae' => 40,
        ]);
    }

    public function inactive(): static
    {
        return $this->state(fn (array $attributes): array => [
            'is_active' => false,
        ]);
    }

    /**
     * A tank with an auto-feeder installed and its hopper full.
     */
    public function withAutoFeeder(): static
    {
        return $this->state(fn (array $attributes): array => [
            'auto_feeder_installed' => true,
            'auto_feeder_feeds_per_day' => 2,
            'auto_feeder_unlimited' => false,
            'auto_feeder_portions' => config('simulation.auto_feeder.hopper_capacity'),
        ]);
    }
}
