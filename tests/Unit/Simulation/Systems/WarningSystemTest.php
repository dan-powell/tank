<?php

namespace Tests\Unit\Simulation\Systems;

use App\Enums\TankEventType;
use App\Simulation\Systems\WarningSystem;
use PHPUnit\Framework\TestCase;
use Tests\Unit\Simulation\BuildsSimulationState;

class WarningSystemTest extends TestCase
{
    use BuildsSimulationState;

    public function test_warns_once_when_ammonia_crosses_the_threshold(): void
    {
        $state = $this->tankState(['ammonia' => 0.4]);
        $context = $this->context($state);
        $state->ammonia = 0.6;

        (new WarningSystem)->apply($state, $context);

        $this->assertCount(1, $context->events());
        $this->assertSame(TankEventType::Warning, $context->events()[0]->type);
        $this->assertSame(['parameter' => 'ammonia'], $context->events()[0]->payload);
    }

    public function test_does_not_repeat_a_warning_while_the_parameter_stays_high(): void
    {
        $state = $this->tankState(['ammonia' => 0.6]);
        $context = $this->context($state);
        $state->ammonia = 0.7;

        (new WarningSystem)->apply($state, $context);

        $this->assertSame([], $context->events());
    }

    public function test_warns_when_oxygen_falls_too_low(): void
    {
        $state = $this->tankState(['oxygen' => 4.5]);
        $context = $this->context($state);
        $state->oxygen = 3.5;

        (new WarningSystem)->apply($state, $context);

        $this->assertSame(['parameter' => 'oxygen'], $context->events()[0]->payload);
    }
}
