<?php

namespace Database\Factories;

use App\Enums\TankEventType;
use App\Models\Tank;
use App\Models\TankEvent;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<TankEvent>
 */
class TankEventFactory extends Factory
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
            'type' => TankEventType::Feeding,
            'message' => 'You sprinkled in some food.',
            'payload' => null,
            'sim_tick' => 0,
        ];
    }
}
