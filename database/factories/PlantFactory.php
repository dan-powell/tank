<?php

namespace Database\Factories;

use App\Models\Plant;
use App\Models\Species;
use App\Models\Tank;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Plant>
 */
class PlantFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'tank_id' => Tank::factory(),
            'species_id' => Species::factory()->plant(),
            'root_x' => fake()->randomFloat(3, 0.1, 0.9),
            'root_y' => 0,
            'root_z' => fake()->randomFloat(3, 0.1, 0.5),
            'size' => 2,
            'segments' => 4,
            'health' => 1,
            'age_seconds' => 0,
        ];
    }

    public function dead(): static
    {
        return $this->state(fn (array $attributes): array => [
            'health' => 0,
            'died_at' => now(),
        ]);
    }
}
