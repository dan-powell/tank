<?php

namespace Database\Factories;

use App\Models\Decoration;
use App\Models\Tank;
use App\Simulation\TankGeometry;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Decoration>
 */
class DecorationFactory extends Factory
{
    /**
     * Define the model's default state: a boulder resting on the substrate at the back left.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'tank_id' => Tank::factory(),
            'type' => 'boulder',
            'x' => 10,
            'y' => TankGeometry::DEFAULT_SUBSTRATE,
            'z' => 0,
            'rotation' => 0,
            'seed' => fake()->numberBetween(1, 1_000_000),
        ];
    }

    /**
     * Place the decoration at a grid position.
     */
    public function at(int $x, int $y, int $z, int $rotation = 0): static
    {
        return $this->state(fn (array $attributes): array => [
            'x' => $x,
            'y' => $y,
            'z' => $z,
            'rotation' => $rotation,
        ]);
    }
}
