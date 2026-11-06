<?php

namespace Database\Factories;

use App\Enums\Sex;
use App\Models\Creature;
use App\Models\Species;
use App\Models\Tank;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Creature>
 */
class CreatureFactory extends Factory
{
    /**
     * Define the model's default state: a healthy adult.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'tank_id' => Tank::factory(),
            'species_id' => Species::factory(),
            'sex' => fake()->randomElement(Sex::cases()),
            'size' => 3.5,
            'hunger' => 0.2,
            'health' => 1,
            'age_seconds' => 60 * 86400,
            'zone_x' => 0.5,
            'zone_y' => 0.6,
            'layer' => 2,
            'zone_radius' => 0.25,
            'generation' => 1,
        ];
    }

    public function female(): static
    {
        return $this->state(fn (array $attributes): array => ['sex' => Sex::Female]);
    }

    public function male(): static
    {
        return $this->state(fn (array $attributes): array => ['sex' => Sex::Male]);
    }

    public function starving(): static
    {
        return $this->state(fn (array $attributes): array => ['hunger' => 1.0]);
    }

    public function dying(): static
    {
        return $this->state(fn (array $attributes): array => ['health' => 0.00001, 'hunger' => 1.0]);
    }

    public function dead(): static
    {
        return $this->state(fn (array $attributes): array => [
            'health' => 0,
            'died_at' => now(),
            'death_cause' => 'old age',
        ]);
    }
}
