<?php

namespace Database\Factories;

use App\Models\LightFixture;
use App\Models\Tank;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<LightFixture>
 */
class LightFixtureFactory extends Factory
{
    /**
     * Define the model's default state: a spotlight in the front-left slot, on 08:00–20:00.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'tank_id' => Tank::factory(),
            'type' => 'spotlight',
            'column' => 0,
            'row' => 0,
            'length' => 1,
            'colour' => '#fff1d6',
            'brightness' => 80,
            'on_minute' => 8 * 60,
            'off_minute' => 20 * 60,
            'ramp_minutes' => 30,
        ];
    }

    /**
     * An LED tube spanning `length` slots of a row.
     */
    public function tube(int $column, int $row, int $length): static
    {
        return $this->state(fn (array $attributes): array => [
            'type' => 'led-tube',
            'column' => $column,
            'row' => $row,
            'length' => $length,
            'colour' => '#f4f7ff',
        ]);
    }

    /**
     * Hang the fixture at a gantry slot.
     */
    public function at(int $column, int $row): static
    {
        return $this->state(fn (array $attributes): array => [
            'column' => $column,
            'row' => $row,
        ]);
    }
}
