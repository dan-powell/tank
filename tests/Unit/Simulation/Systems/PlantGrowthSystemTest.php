<?php

namespace Tests\Unit\Simulation\Systems;

use App\Enums\TankEventType;
use App\Simulation\Systems\PlantGrowthSystem;
use PHPUnit\Framework\TestCase;
use Tests\Unit\Simulation\BuildsSimulationState;

class PlantGrowthSystemTest extends TestCase
{
    use BuildsSimulationState;

    public function test_lit_plants_grow_by_taking_up_nitrate(): void
    {
        $plant = $this->plant(overrides: ['size' => 2.0]);
        $state = $this->tankState(['nitrate' => 20.0, 'plants' => [$plant]]);

        (new PlantGrowthSystem)->apply($state, $this->context($state, dtSeconds: 3600));

        $this->assertGreaterThan(2.0, $plant->size);
        $this->assertLessThan(20.0, $state->nitrate);
    }

    public function test_plants_do_not_grow_in_the_dark(): void
    {
        $plant = $this->plant(overrides: ['size' => 2.0]);
        $state = $this->tankState(['isLit' => false, 'plants' => [$plant]]);

        (new PlantGrowthSystem)->apply($state, $this->context($state, dtSeconds: 3600));

        $this->assertSame(2.0, $plant->size);
    }

    public function test_plants_lose_health_without_nutrients(): void
    {
        $plant = $this->plant(overrides: ['health' => 0.8]);
        $state = $this->tankState(['nitrate' => 0.0, 'ammonia' => 0.0, 'plants' => [$plant]]);

        (new PlantGrowthSystem)->apply($state, $this->context($state, dtSeconds: 3600));

        $this->assertLessThan(0.8, $plant->health);
    }

    public function test_established_plants_spread_a_new_shoot_nearby(): void
    {
        $plant = $this->plant(overrides: ['id' => 7, 'size' => 6.0]);
        $state = $this->tankState([
            'species' => $this->catalogue(['vallisneria' => ['spread' => ['chance_per_day' => 10_000]]]),
            'plants' => [$plant],
        ]);
        $context = $this->context($state, dtSeconds: 3600);

        (new PlantGrowthSystem)->apply($state, $context);

        $this->assertCount(2, $state->plants);
        $offshoot = $state->plants[1];
        $this->assertNull($offshoot->id);
        $this->assertSame(7, $offshoot->parentId);
        $this->assertEqualsWithDelta(0.5, $offshoot->rootX, 0.12);
        $this->assertSame(TankEventType::PlantSpread, $context->events()[0]->type);
    }
}
