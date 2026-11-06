<?php

namespace Tests\Unit\Simulation\Systems;

use App\Simulation\Systems\PhotosynthesisSystem;
use PHPUnit\Framework\TestCase;
use Tests\Unit\Simulation\BuildsSimulationState;

class PhotosynthesisSystemTest extends TestCase
{
    use BuildsSimulationState;

    public function test_lit_plants_release_oxygen_and_consume_co2(): void
    {
        $state = $this->tankState(['plants' => [$this->plant(overrides: ['size' => 5.0])]]);

        (new PhotosynthesisSystem)->apply($state, $this->context($state, dtSeconds: 3600));

        $this->assertGreaterThan(8.0, $state->oxygen);
        $this->assertLessThan(2.0, $state->co2);
    }

    public function test_plants_consume_oxygen_in_the_dark(): void
    {
        $state = $this->tankState(['isLit' => false, 'plants' => [$this->plant(overrides: ['size' => 5.0])]]);

        (new PhotosynthesisSystem)->apply($state, $this->context($state, dtSeconds: 3600));

        $this->assertLessThan(8.0, $state->oxygen);
        $this->assertGreaterThan(2.0, $state->co2);
    }
}
