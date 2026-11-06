<?php

namespace Tests\Unit\Simulation\Systems;

use App\Simulation\Systems\HealthSystem;
use PHPUnit\Framework\TestCase;
use Tests\Unit\Simulation\BuildsSimulationState;

class HealthSystemTest extends TestCase
{
    use BuildsSimulationState;

    public function test_ammonia_damages_health_and_is_recorded_as_the_main_stressor(): void
    {
        $guppy = $this->creature('guppy', ['health' => 1.0]);
        $state = $this->tankState(['ammonia' => 2.0, 'creatures' => [$guppy]]);

        (new HealthSystem)->apply($state, $this->context($state, dtSeconds: 3600));

        $this->assertLessThan(1.0, $guppy->health);
        $this->assertSame('ammonia poisoning', $guppy->mainStressor);
    }

    public function test_ammonia_is_more_toxic_at_higher_ph(): void
    {
        $acidic = $this->creature('guppy');
        $alkaline = $this->creature('guppy');
        $acidicTank = $this->tankState(['ammonia' => 1.0, 'ph' => 7.0, 'creatures' => [$acidic]]);
        $alkalineTank = $this->tankState(['ammonia' => 1.0, 'ph' => 7.8, 'creatures' => [$alkaline]]);

        (new HealthSystem)->apply($acidicTank, $this->context($acidicTank, dtSeconds: 3600));
        (new HealthSystem)->apply($alkalineTank, $this->context($alkalineTank, dtSeconds: 3600));

        $this->assertLessThan($acidic->health, $alkaline->health);
    }

    public function test_starving_creatures_lose_health(): void
    {
        $guppy = $this->creature('guppy', ['hunger' => 1.0]);
        $state = $this->tankState(['creatures' => [$guppy]]);

        (new HealthSystem)->apply($state, $this->context($state, dtSeconds: 3600));

        $this->assertSame('starvation', $guppy->mainStressor);
        $this->assertLessThan(1.0, $guppy->health);
    }

    public function test_creatures_recover_in_good_conditions(): void
    {
        $guppy = $this->creature('guppy', ['health' => 0.5, 'hunger' => 0.1]);
        $state = $this->tankState(['creatures' => [$guppy]]);

        (new HealthSystem)->apply($state, $this->context($state, dtSeconds: 3600));

        $this->assertGreaterThan(0.5, $guppy->health);
        $this->assertNull($guppy->mainStressor);
    }
}
