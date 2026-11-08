<?php

namespace Tests\Unit\Simulation\Systems;

use App\Simulation\Systems\AirSystem;
use PHPUnit\Framework\TestCase;
use Tests\Unit\Simulation\BuildsSimulationState;

class AirSystemTest extends TestCase
{
    use BuildsSimulationState;

    public function test_an_open_tank_breathes_room_air(): void
    {
        $state = $this->tankState(['airCo2' => 2000.0, 'airOxygen' => 18.0, 'waterSurfaceShare' => 0.0]);

        (new AirSystem)->apply($state, $this->context($state, dtSeconds: 3600));

        $this->assertLessThan(600.0, $state->airCo2);
        $this->assertGreaterThan(20.5, $state->airOxygen);
    }

    public function test_a_sealed_tank_keeps_its_air(): void
    {
        $state = $this->tankState(['isSealed' => true, 'airCo2' => 2000.0, 'airOxygen' => 18.0]);

        (new AirSystem)->apply($state, $this->context($state, dtSeconds: 3600));

        $this->assertSame(2000.0, $state->airCo2);
        $this->assertSame(18.0, $state->airOxygen);
    }

    public function test_open_water_makes_a_sealed_tank_humid(): void
    {
        $state = $this->tankState(['isSealed' => true, 'humidity' => 60.0, 'waterSurfaceShare' => 1.0]);

        (new AirSystem)->apply($state, $this->context($state, dtSeconds: 3600));

        $this->assertGreaterThan(85.0, $state->humidity);
        $this->assertLessThanOrEqual(98.0, $state->humidity);
    }
}
