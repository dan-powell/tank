<?php

namespace Tests\Unit\Simulation\Systems;

use App\Enums\CreatureIntent;
use App\Enums\TankEventType;
use App\Simulation\Systems\MortalitySystem;
use PHPUnit\Framework\TestCase;
use Tests\Unit\Simulation\BuildsSimulationState;

class MortalitySystemTest extends TestCase
{
    use BuildsSimulationState;

    public function test_creature_with_no_health_dies_of_its_main_stressor_and_becomes_detritus(): void
    {
        $guppy = $this->creature('guppy', ['health' => 0.0]);
        $guppy->mainStressor = 'ammonia poisoning';
        $state = $this->tankState(['creatures' => [$guppy]]);
        $context = $this->context($state);

        (new MortalitySystem)->apply($state, $context);

        $this->assertTrue($guppy->isDead);
        $this->assertSame('ammonia poisoning', $guppy->deathCause);
        $this->assertGreaterThan(0.0, $state->detritus);
        $this->assertSame(TankEventType::Death, $context->events()[0]->type);
        $this->assertSame('A Guppy died of ammonia poisoning.', $context->events()[0]->message);
    }

    public function test_unplanted_tank_with_adult_guppies_eats_fry(): void
    {
        $adults = array_map(fn (): mixed => $this->creature('guppy'), range(1, 6));
        $fry = $this->creature('guppy', ['size' => 0.6, 'ageSeconds' => 0]);
        $state = $this->tankState(['creatures' => [...$adults, $fry]]);

        (new MortalitySystem)->apply($state, $this->context($state, dtSeconds: 10 * 86400));

        $this->assertTrue($fry->isDead);
        $this->assertSame('eaten', $fry->deathCause);
    }

    public function test_healthy_adults_survive(): void
    {
        $guppy = $this->creature('guppy', ['ageSeconds' => 100 * 86400]);
        $state = $this->tankState(['creatures' => [$guppy]]);

        (new MortalitySystem)->apply($state, $this->context($state, dtSeconds: 3600));

        $this->assertFalse($guppy->isDead);
    }

    public function test_plant_with_no_health_dies_back(): void
    {
        $plant = $this->plant(overrides: ['health' => 0.0, 'size' => 2.0]);
        $state = $this->tankState(['plants' => [$plant]]);

        (new MortalitySystem)->apply($state, $this->context($state));

        $this->assertTrue($plant->isDead);
        $this->assertSame(1.0, $state->detritus);
    }

    public function test_fry_hiding_among_plants_are_eaten_less_often(): void
    {
        $hiddenEaten = 0;
        $openEaten = 0;

        foreach (range(1, 100) as $seed) {
            $adults = array_map(fn (): mixed => $this->creature('guppy'), range(1, 6));
            $hiding = $this->creature('guppy', ['size' => 0.6, 'ageSeconds' => 0, 'intent' => CreatureIntent::Hide]);
            $inTheOpen = $this->creature('guppy', ['size' => 0.6, 'ageSeconds' => 0]);
            $plants = array_map(fn (): mixed => $this->plant('vallisneria', ['size' => 20.0]), range(1, 4));
            $state = $this->tankState(['creatures' => [...$adults, $hiding, $inTheOpen], 'plants' => $plants]);

            (new MortalitySystem)->apply($state, $this->context($state, dtSeconds: 86400, seed: $seed));

            $hiddenEaten += (int) $hiding->isDead;
            $openEaten += (int) $inTheOpen->isDead;
        }

        $this->assertGreaterThan($hiddenEaten, $openEaten);
    }
}
