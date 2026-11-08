<?php

namespace Tests\Unit\Simulation\Systems;

use App\Simulation\Systems\MetabolismSystem;
use PHPUnit\Framework\TestCase;
use Tests\Unit\Simulation\BuildsSimulationState;

class MetabolismSystemTest extends TestCase
{
    use BuildsSimulationState;

    public function test_creatures_get_hungry_breathe_and_excrete(): void
    {
        $guppy = $this->creature('guppy', ['hunger' => 0.2]);
        $state = $this->tankState(['creatures' => [$guppy]]);

        (new MetabolismSystem)->apply($state, $this->context($state, dtSeconds: 3600));

        $this->assertGreaterThan(0.2, $guppy->hunger);
        $this->assertLessThan(8.0, $state->oxygen);
        $this->assertGreaterThan(0.0, $state->ammonia);
        $this->assertSame(365 * 86400 + 3600, $guppy->ageSeconds);
    }

    public function test_well_fed_juveniles_grow_towards_adult_size(): void
    {
        $fry = $this->creature('guppy', ['size' => 1.0, 'hunger' => 0.0]);
        $state = $this->tankState(['creatures' => [$fry]]);

        (new MetabolismSystem)->apply($state, $this->context($state, dtSeconds: 3600));

        $this->assertGreaterThan(1.0, $fry->size);
    }

    public function test_land_animals_breathe_the_air_and_leave_their_waste_in_the_soil(): void
    {
        $isopod = $this->creature('dwarf-white-isopod');
        $state = $this->tankState(['creatures' => [$isopod], 'airLitres' => 1.0]);

        (new MetabolismSystem)->apply($state, $this->context($state, dtSeconds: 3600));

        $this->assertLessThan(20.9, $state->airOxygen);
        $this->assertGreaterThan(420.0, $state->airCo2);
        $this->assertSame(8.0, $state->oxygen);
        $this->assertSame(0.0, $state->ammonia);
        $this->assertGreaterThan(0.0, $state->detritus);
    }
}
