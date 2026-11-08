<?php

namespace Tests\Unit\Simulation\Systems;

use App\Simulation\Systems\WaterQualitySystem;
use PHPUnit\Framework\TestCase;
use Tests\Unit\Simulation\BuildsSimulationState;

class WaterQualitySystemTest extends TestCase
{
    use BuildsSimulationState;

    public function test_oxygen_that_dissolves_into_the_water_comes_out_of_the_air(): void
    {
        $state = $this->tankState(['isSealed' => true, 'oxygen' => 4.0, 'airLitres' => 3.3]);

        (new WaterQualitySystem)->apply($state, $this->context($state, dtSeconds: 3600));

        $this->assertGreaterThan(4.0, $state->oxygen);
        $this->assertLessThan(20.9, $state->airOxygen);
    }
}
