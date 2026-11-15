<?php

namespace Tests\Unit\Simulation\Systems;

use App\Enums\CreatureIntent;
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

    public function test_a_hungry_toad_catches_and_eats_prey(): void
    {
        $toad = $this->creature('fire-bellied-toad', ['hunger' => 0.8]);
        $springtail = $this->creature('springtail');
        $state = $this->tankState(['creatures' => [$toad, $springtail]]);

        (new FeedingSystem)->apply($state, $this->context($state, dtSeconds: 3600));

        $this->assertTrue($springtail->isDead);
        $this->assertSame('eaten', $springtail->deathCause);
        $this->assertLessThan(0.8, $toad->hunger);
    }

    public function test_food_in_the_water_is_out_of_reach_once_the_tank_is_empty(): void
    {
        $toad = $this->creature('fire-bellied-toad', ['hunger' => 0.8]);
        $state = $this->tankState(['creatures' => [$toad], 'hasWater' => false, 'uneatenFood' => 0.5]);

        (new FeedingSystem)->apply($state, $this->context($state, dtSeconds: 3600));

        $this->assertSame(0.5, $state->uneatenFood);
        $this->assertSame(0.8, $toad->hunger);
    }

    public function test_hunting_animals_reach_scarce_food_first(): void
    {
        $wandering = array_map(fn (): mixed => $this->creature('guppy', ['hunger' => 1.0]), range(1, 3));
        $hunter = $this->creature('guppy', ['hunger' => 1.0, 'intent' => CreatureIntent::Hunt]);
        $state = $this->tankState(['uneatenFood' => 0.005, 'creatures' => [...$wandering, $hunter]]);

        (new FeedingSystem)->apply($state, $this->context($state, dtSeconds: 900));

        $this->assertLessThan(1.0, $hunter->hunger);
        $this->assertSame([1.0, 1.0, 1.0], array_map(fn (mixed $guppy): float => $guppy->hunger, $wandering));
    }

    public function test_hunting_animals_eat_faster_than_resting_ones(): void
    {
        $hunter = $this->creature('guppy', ['hunger' => 0.8, 'intent' => CreatureIntent::Hunt]);
        $resting = $this->creature('guppy', ['hunger' => 0.8, 'intent' => CreatureIntent::Rest]);
        $state = $this->tankState(['uneatenFood' => 1.0, 'creatures' => [$hunter, $resting]]);

        (new FeedingSystem)->apply($state, $this->context($state, dtSeconds: 60));

        $this->assertLessThan($resting->hunger, $hunter->hunger);
    }

    public function test_prey_that_is_hiding_is_caught_less_often(): void
    {
        $hiddenCaught = 0;
        $openCaught = 0;

        foreach (range(1, 100) as $seed) {
            $toad = $this->creature('fire-bellied-toad', ['hunger' => 0.8]);
            $hiding = $this->creature('springtail', ['intent' => CreatureIntent::Hide]);
            $inTheOpen = $this->creature('springtail');
            $state = $this->tankState(['creatures' => [$toad, $hiding, $inTheOpen]]);

            (new FeedingSystem)->apply($state, $this->context($state, dtSeconds: 60, seed: $seed));

            $hiddenCaught += (int) $hiding->isDead;
            $openCaught += (int) $inTheOpen->isDead;
        }

        $this->assertGreaterThan($hiddenCaught * 2, $openCaught);
    }
}
