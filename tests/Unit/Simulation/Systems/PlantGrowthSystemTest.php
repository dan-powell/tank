<?php

namespace Tests\Unit\Simulation\Systems;

use App\Enums\TankEventType;
use App\Simulation\GridBox;
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
        $plant = $this->plant(overrides: ['id' => 7, 'size' => 6.0, 'layer' => 0]);
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
        $this->assertContains($offshoot->layer, [0, 1]);
        $this->assertSame(TankEventType::PlantSpread, $context->events()[0]->type);
    }

    public function test_attached_plants_spread_onto_a_free_anchor_of_the_same_decoration(): void
    {
        $plant = $this->plant('hornwort', ['id' => 7, 'size' => 8.0, 'decorationId' => 3, 'anchorIndex' => 0]);
        $state = $this->tankState([
            'species' => $this->catalogue(['hornwort' => ['spread' => ['chance_per_day' => 10_000]]]),
            'plants' => [$plant],
            'decorationAnchors' => [3 => [0 => [133, 53, 28], 2 => [118, 38, 33]]],
        ]);

        (new PlantGrowthSystem)->apply($state, $this->context($state, dtSeconds: 3600));

        $offshoot = $state->plants[1];
        $this->assertSame(3, $offshoot->decorationId);
        $this->assertSame(2, $offshoot->anchorIndex);
        $this->assertEqualsWithDelta(118.5 / 300, $offshoot->rootX, 0.0001);
    }

    public function test_plants_do_not_spread_beneath_a_decoration_resting_on_the_substrate(): void
    {
        $plant = $this->plant(overrides: ['id' => 7, 'size' => 6.0, 'layer' => 0]);
        $state = $this->tankState([
            'species' => $this->catalogue(['vallisneria' => ['spread' => ['chance_per_day' => 10_000]]]),
            'plants' => [$plant],
            'groundedFootprints' => [new GridBox(0, 10, 0, 300, 25, 138)],
        ]);

        (new PlantGrowthSystem)->apply($state, $this->context($state, dtSeconds: 3600));

        $this->assertCount(1, $state->plants);
        $this->assertSame(6.0, $plant->size);
    }

    public function test_plants_out_of_the_water_wilt_instead_of_growing(): void
    {
        $plant = $this->plant(overrides: ['size' => 2.0, 'rootHeight' => 75]);
        $state = $this->tankState(['plants' => [$plant], 'waterLevel' => 50, 'nitrate' => 10.0]);

        (new PlantGrowthSystem)->apply($state, $this->context($state, dtSeconds: 3600));

        $this->assertSame(2.0, $plant->size);
        $this->assertEqualsWithDelta(0.98, $plant->health, 0.0001);
        $this->assertSame(10.0, $state->nitrate);
    }

    public function test_land_plants_drown_with_their_roots_under_water(): void
    {
        $moss = $this->plant('cushion-moss', ['rootHeight' => 25]);
        $state = $this->tankState(['plants' => [$moss], 'humidity' => 90.0]);

        (new PlantGrowthSystem)->apply($state, $this->context($state, dtSeconds: 3600));

        $this->assertEqualsWithDelta(0.98, $moss->health, 0.0001);
    }

    public function test_land_plants_dry_out_in_dry_air(): void
    {
        $moss = $this->plant('cushion-moss', ['rootHeight' => 153]);
        $state = $this->tankState(['plants' => [$moss], 'humidity' => 40.0]);

        (new PlantGrowthSystem)->apply($state, $this->context($state, dtSeconds: 3600));

        $this->assertEqualsWithDelta(0.98, $moss->health, 0.0001);
    }

    public function test_land_plants_grow_on_detritus_in_humid_air(): void
    {
        $moss = $this->plant('cushion-moss', ['rootHeight' => 153, 'size' => 1.0]);
        $state = $this->tankState(['plants' => [$moss], 'humidity' => 90.0, 'detritus' => 1.0, 'nitrate' => 10.0]);

        (new PlantGrowthSystem)->apply($state, $this->context($state, dtSeconds: 3600));

        $this->assertGreaterThan(1.0, $moss->size);
        $this->assertLessThan(1.0, $state->detritus);
        $this->assertSame(10.0, $state->nitrate);
    }

    public function test_edge_plants_thrive_only_near_the_waterline(): void
    {
        $atEdge = $this->plant('dwarf-rush', ['rootHeight' => 145]);
        $deep = $this->plant('dwarf-rush', ['rootHeight' => 50]);
        $state = $this->tankState(['plants' => [$atEdge, $deep]]);

        (new PlantGrowthSystem)->apply($state, $this->context($state, dtSeconds: 3600));

        $this->assertSame(1.0, $atEdge->health);
        $this->assertEqualsWithDelta(0.98, $deep->health, 0.0001);
    }
}
