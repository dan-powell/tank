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
        $this->assertSame(['parameter' => 'ammonia', 'side' => 'high'], $context->events()[0]->payload);
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

        $this->assertSame(['parameter' => 'oxygen', 'side' => 'low'], $context->events()[0]->payload);
    }

    public function test_warns_when_plants_start_going_short_of_light(): void
    {
        $plant = $this->plant();
        $state = $this->tankState(['plants' => [$plant]]);
        $context = $this->context($state);
        $plant->dailyLight = 0.1;

        (new WarningSystem)->apply($state, $context);

        $this->assertSame(['parameter' => 'light'], $context->events()[0]->payload);
    }

    public function test_warns_when_the_water_turns_too_cold_for_the_animals_in_it(): void
    {
        $state = $this->tankState(['temperature' => 21.0, 'creatures' => [$this->creature('guppy')]]);
        $context = $this->context($state);
        $state->temperature = 19.5;

        (new WarningSystem)->apply($state, $context);

        $event = $context->events()[0];
        $this->assertSame(['parameter' => 'temperature', 'side' => 'low'], $event->payload);
        $this->assertStringStartsWith('Temperature is too low. The heater warms the water', $event->message);
    }

    public function test_warns_about_stale_air_even_in_an_empty_tank(): void
    {
        $state = $this->tankState(['airCo2' => 4000.0, 'hasWater' => false]);
        $context = $this->context($state);
        $state->airCo2 = 5500.0;

        (new WarningSystem)->apply($state, $context);

        $this->assertSame(['parameter' => 'air_co2', 'side' => 'high'], $context->events()[0]->payload);
    }

    public function test_dry_air_only_matters_with_land_life_in_the_tank(): void
    {
        $state = $this->tankState(['humidity' => 45.0]);
        $context = $this->context($state);
        $state->humidity = 35.0;

        (new WarningSystem)->apply($state, $context);

        $this->assertSame([], $context->events());
    }
}
