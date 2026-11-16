<?php

namespace Tests\Unit\Simulation\Systems;

use App\Enums\TankEventType;
use App\Simulation\Systems\NearDeathSystem;
use PHPUnit\Framework\TestCase;
use Tests\Unit\Simulation\BuildsSimulationState;

class NearDeathSystemTest extends TestCase
{
    use BuildsSimulationState;

    public function test_pauses_when_a_watched_animal_drops_below_the_line(): void
    {
        $creature = $this->creature('guppy', ['id' => 7, 'health' => 0.3, 'nickname' => 'Goldie']);
        $creature->watched = true;
        $state = $this->tankState(['creatures' => [$creature]]);
        $context = $this->context($state);
        $creature->health = 0.2;
        $creature->mainStressor = 'ammonia poisoning';

        (new NearDeathSystem)->apply($state, $context);

        $this->assertTrue($state->pauseRequested);
        $event = $context->events()[0];
        $this->assertSame(TankEventType::NearDeath, $event->type);
        $this->assertSame('Goldie the Guppy is close to death (20% health from ammonia poisoning). The tank has been paused.', $event->message);
        $this->assertSame(7, $event->payload['creature_id']);
    }

    public function test_follows_the_tanks_own_line(): void
    {
        $creature = $this->creature('guppy', ['id' => 7, 'health' => 0.45]);
        $creature->watched = true;
        $state = $this->tankState(['creatures' => [$creature]]);
        $state->nearDeathHealth = 0.4;
        $context = $this->context($state);
        $creature->health = 0.35;

        (new NearDeathSystem)->apply($state, $context);

        $this->assertTrue($state->pauseRequested);
    }

    public function test_ignores_animals_that_are_not_watched(): void
    {
        $creature = $this->creature('guppy', ['id' => 7, 'health' => 0.3]);
        $state = $this->tankState(['creatures' => [$creature]]);
        $context = $this->context($state);
        $creature->health = 0.2;

        (new NearDeathSystem)->apply($state, $context);

        $this->assertFalse($state->pauseRequested);
        $this->assertSame([], $context->events());
    }

    public function test_does_not_pause_again_for_an_animal_already_below_the_line(): void
    {
        $creature = $this->creature('guppy', ['id' => 7, 'health' => 0.2]);
        $creature->watched = true;
        $state = $this->tankState(['creatures' => [$creature]]);
        $context = $this->context($state);
        $creature->health = 0.15;

        (new NearDeathSystem)->apply($state, $context);

        $this->assertFalse($state->pauseRequested);
    }
}
