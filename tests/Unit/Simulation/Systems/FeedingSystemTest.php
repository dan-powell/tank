<?php

namespace Tests\Unit\Simulation\Systems;

use App\Simulation\Systems\FeedingSystem;
use PHPUnit\Framework\TestCase;
use Tests\Unit\Simulation\BuildsSimulationState;

class FeedingSystemTest extends TestCase
{
    use BuildsSimulationState;

    public function test_hungry_fish_eat_floating_food(): void
    {
        $guppy = $this->creature('guppy', ['hunger' => 0.8]);
        $state = $this->tankState(['uneatenFood' => 0.1, 'creatures' => [$guppy]]);

        (new FeedingSystem)->apply($state, $this->context($state));

        $this->assertLessThan(0.1, $state->uneatenFood);
        $this->assertLessThan(0.8, $guppy->hunger);
    }

    public function test_mid_water_fish_reach_food_before_bottom_feeders(): void
    {
        $guppies = array_map(fn (): mixed => $this->creature('guppy', ['hunger' => 1.0]), range(1, 4));
        $cory = $this->creature('corydoras', ['hunger' => 1.0]);
        $state = $this->tankState(['uneatenFood' => 0.05, 'creatures' => [$cory, ...$guppies]]);

        (new FeedingSystem)->apply($state, $this->context($state, dtSeconds: 900));

        $this->assertSame(0.0, $state->uneatenFood);
        $this->assertSame(1.0, $cory->hunger);
    }

    public function test_bottom_feeders_scavenge_detritus_when_no_food_is_left(): void
    {
        $cory = $this->creature('corydoras', ['hunger' => 0.8]);
        $state = $this->tankState(['detritus' => 1.0, 'creatures' => [$cory]]);

        (new FeedingSystem)->apply($state, $this->context($state));

        $this->assertLessThan(1.0, $state->detritus);
        $this->assertLessThan(0.8, $cory->hunger);
    }

    public function test_snails_graze_algae(): void
    {
        $snail = $this->creature('nerite-snail', ['hunger' => 0.8]);
        $state = $this->tankState(['algae' => 20.0, 'creatures' => [$snail]]);

        (new FeedingSystem)->apply($state, $this->context($state));

        $this->assertLessThan(20.0, $state->algae);
        $this->assertLessThan(0.8, $snail->hunger);
    }
}
