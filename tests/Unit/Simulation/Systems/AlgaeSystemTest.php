<?php

namespace Tests\Unit\Simulation\Systems;

use App\Simulation\Systems\AlgaeSystem;
use PHPUnit\Framework\TestCase;
use Tests\Unit\Simulation\BuildsSimulationState;

class AlgaeSystemTest extends TestCase
{
    use BuildsSimulationState;

    public function test_algae_grow_faster_without_competing_plants(): void
    {
        $bare = $this->tankState(['nitrate' => 30.0, 'algae' => 10.0]);
        $planted = $this->tankState([
            'nitrate' => 30.0,
            'algae' => 10.0,
            'plants' => array_map(fn (): mixed => $this->plant(overrides: ['size' => 6.0]), range(1, 6)),
        ]);

        (new AlgaeSystem)->apply($bare, $this->context($bare, dtSeconds: 3600));
        (new AlgaeSystem)->apply($planted, $this->context($planted, dtSeconds: 3600));

        $this->assertGreaterThan(10.0, $bare->algae);
        $this->assertGreaterThan($planted->algae, $bare->algae);
    }

    public function test_algae_slowly_die_back_in_the_dark(): void
    {
        $state = $this->tankState(['isLit' => false, 'nitrate' => 30.0, 'algae' => 10.0]);

        (new AlgaeSystem)->apply($state, $this->context($state, dtSeconds: 3600));

        $this->assertLessThan(10.0, $state->algae);
    }
}
