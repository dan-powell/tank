<?php

namespace Tests\Unit\Simulation\Systems;

use App\Simulation\Systems\NitrogenCycleSystem;
use PHPUnit\Framework\TestCase;
use Tests\Unit\Simulation\BuildsSimulationState;

class NitrogenCycleSystemTest extends TestCase
{
    use BuildsSimulationState;

    public function test_established_bacteria_convert_ammonia_through_nitrite_to_nitrate(): void
    {
        $state = $this->tankState(['ammonia' => 1.0, 'nitrate' => 0.0, 'bacteria' => 1.0]);

        (new NitrogenCycleSystem)->apply($state, $this->context($state, dtSeconds: 3600));

        $this->assertLessThan(1.0, $state->ammonia);
        $this->assertGreaterThan(0.0, $state->nitrite);
        $this->assertGreaterThan(0.0, $state->nitrate);
    }

    public function test_rotting_food_releases_ammonia_in_an_uncycled_tank(): void
    {
        $state = $this->tankState(['uneatenFood' => 0.5, 'bacteria' => 0.005]);

        (new NitrogenCycleSystem)->apply($state, $this->context($state, dtSeconds: 3600));

        $this->assertLessThan(0.5, $state->uneatenFood);
        $this->assertGreaterThan(0.05, $state->ammonia);
    }

    public function test_bacteria_grow_when_fed_and_die_back_when_starved(): void
    {
        $fed = $this->tankState(['ammonia' => 2.0, 'bacteria' => 0.1]);
        $starved = $this->tankState(['ammonia' => 0.0, 'nitrite' => 0.0, 'bacteria' => 0.1]);

        (new NitrogenCycleSystem)->apply($fed, $this->context($fed, dtSeconds: 3600));
        (new NitrogenCycleSystem)->apply($starved, $this->context($starved, dtSeconds: 3600));

        $this->assertGreaterThan(0.1, $fed->bacteria);
        $this->assertLessThan(0.1, $starved->bacteria);
    }
}
