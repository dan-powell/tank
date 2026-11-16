<?php

namespace Tests\Unit\Simulation\Systems;

use App\Enums\CreatureIntent;
use App\Enums\CreatureMood;
use App\Simulation\Systems\BehaviourSystem;
use PHPUnit\Framework\TestCase;
use Tests\Unit\Simulation\BuildsSimulationState;

class BehaviourSystemTest extends TestCase
{
    use BuildsSimulationState;

    public function test_a_starving_toad_drops_what_it_is_doing_to_hunt(): void
    {
        $toad = $this->creature('fire-bellied-toad', ['hunger' => 1.0]);
        $state = $this->tankState(['creatures' => [$toad]]);

        (new BehaviourSystem)->apply($state, $this->context($state));

        $this->assertSame(CreatureIntent::Hunt, $toad->intent);
        $this->assertSame(0, $toad->intentSeconds);
    }

    public function test_healthy_fish_rest_once_the_lights_go_out(): void
    {
        $guppy = $this->creature('guppy', ['intentSeconds' => BehaviourSystem::MIN_INTENT_SECONDS]);
        $state = $this->tankState(['isLit' => false, 'creatures' => [$guppy]]);

        (new BehaviourSystem)->apply($state, $this->context($state));

        $this->assertSame(CreatureIntent::Rest, $guppy->intent);
    }

    public function test_fry_hide_from_fry_eating_adults(): void
    {
        $adult = $this->creature('guppy', ['hunger' => 0.0]);
        $fry = $this->creature('guppy', ['size' => 0.6, 'ageSeconds' => 0, 'hunger' => 0.0, 'intentSeconds' => BehaviourSystem::MIN_INTENT_SECONDS]);
        $state = $this->tankState(['creatures' => [$adult, $fry]]);

        (new BehaviourSystem)->apply($state, $this->context($state));

        $this->assertSame(CreatureIntent::Hide, $fry->intent);
    }

    public function test_animals_stick_with_an_intent_for_a_while_unless_something_is_far_more_pressing(): void
    {
        $guppy = $this->creature('guppy', ['hunger' => 0.6]);
        $state = $this->tankState(['creatures' => [$guppy]]);

        (new BehaviourSystem)->apply($state, $this->context($state));

        $this->assertSame(CreatureIntent::Wander, $guppy->intent);
        $this->assertSame(300, $guppy->intentSeconds);

        $guppy->intentSeconds = BehaviourSystem::MIN_INTENT_SECONDS;
        (new BehaviourSystem)->apply($state, $this->context($state));

        $this->assertSame(CreatureIntent::Hunt, $guppy->intent);
    }

    public function test_an_intent_that_no_longer_applies_is_dropped_at_once(): void
    {
        $cory = $this->creature('corydoras', ['intent' => CreatureIntent::Patrol]);
        $state = $this->tankState(['isLit' => false, 'creatures' => [$cory]]);

        (new BehaviourSystem)->apply($state, $this->context($state));

        $this->assertNotSame(CreatureIntent::Patrol, $cory->intent);
    }

    public function test_species_never_take_up_behaviours_they_have_no_weight_for(): void
    {
        $guppy = $this->creature('guppy', ['hunger' => 1.0]);
        $snail = $this->creature('nerite-snail', ['hunger' => 1.0]);
        $state = $this->tankState([
            'species' => $this->catalogue(['guppy' => ['behaviours' => ['hunt' => 0]]]),
            'creatures' => [$guppy, $snail],
        ]);

        foreach (range(1, 20) as $seed) {
            $guppy->intentSeconds = $snail->intentSeconds = BehaviourSystem::MIN_INTENT_SECONDS;
            (new BehaviourSystem)->apply($state, $this->context($state, seed: $seed));

            $this->assertNotSame(CreatureIntent::Hunt, $guppy->intent);
            $this->assertNotSame(CreatureIntent::Hunt, $snail->intent);
        }
    }

    public function test_cold_water_makes_animals_sluggish_until_it_warms_up(): void
    {
        $guppy = $this->creature('guppy');
        $state = $this->tankState(['temperature' => 18.0, 'creatures' => [$guppy]]);

        (new BehaviourSystem)->apply($state, $this->context($state));

        $this->assertTrue($guppy->hasMood(CreatureMood::Sluggish));

        $state->temperature = 25.0;
        (new BehaviourSystem)->apply($state, $this->context($state));

        $this->assertFalse($guppy->hasMood(CreatureMood::Sluggish));
    }

    public function test_unwell_animals_are_skittish(): void
    {
        $guppy = $this->creature('guppy', ['health' => 0.3]);
        $state = $this->tankState(['creatures' => [$guppy]]);

        (new BehaviourSystem)->apply($state, $this->context($state));

        $this->assertTrue($guppy->hasMood(CreatureMood::Skittish));
    }

    public function test_healthy_young_fish_get_the_zoomies(): void
    {
        $juvenile = $this->creature('guppy', ['size' => 2.0, 'ageSeconds' => 10 * 86400, 'hunger' => 0.1]);
        $state = $this->tankState(['creatures' => [$juvenile]]);

        (new BehaviourSystem)->apply($state, $this->context($state, dtSeconds: 86400));

        $this->assertTrue($juvenile->hasMood(CreatureMood::Zoomies));
    }

    public function test_zoomies_wear_off(): void
    {
        // Too hungry to start another bout.
        $guppy = $this->creature('guppy', ['hunger' => 0.9, 'moods' => [CreatureMood::Zoomies->value => 400]]);
        $state = $this->tankState(['creatures' => [$guppy]]);

        (new BehaviourSystem)->apply($state, $this->context($state));

        $this->assertSame(100, $guppy->moods[CreatureMood::Zoomies->value]);

        (new BehaviourSystem)->apply($state, $this->context($state));

        $this->assertFalse($guppy->hasMood(CreatureMood::Zoomies));
    }
}
