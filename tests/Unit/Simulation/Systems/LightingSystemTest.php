<?php

namespace Tests\Unit\Simulation\Systems;

use App\Simulation\Gantry;
use App\Simulation\GridBox;
use App\Simulation\LightCatalogue;
use App\Simulation\LightFixtureState;
use App\Simulation\Systems\LightingSystem;
use PHPUnit\Framework\TestCase;
use Tests\Unit\Simulation\BuildsSimulationState;

class LightingSystemTest extends TestCase
{
    use BuildsSimulationState;

    public function test_plants_get_the_light_at_their_crown_while_the_timer_is_on(): void
    {
        $short = $this->plant(overrides: ['segments' => 1, 'rootHeight' => 10]);
        $tall = $this->plant(overrides: ['segments' => 12, 'rootHeight' => 10]);
        $state = $this->tankState(['gridWidth' => 300, 'gridDepth' => 138, 'plants' => [$short, $tall], 'lightFixtures' => [$this->tube()]]);

        (new LightingSystem)->apply($state, $this->context($state));

        $this->assertTrue($state->isLit);
        $this->assertGreaterThan(0.1, $state->lightLevel);
        $this->assertEqualsWithDelta(12.0, $state->photoperiodHours, 0.25);
        $this->assertGreaterThan($short->light, $tall->light);
        $this->assertGreaterThan(0.0, $short->dailyLight);
    }

    public function test_the_tank_is_dark_at_night_but_plants_keep_their_daily_light(): void
    {
        $plant = $this->plant();
        $state = $this->tankState(['simSeconds' => 2 * 3600, 'plants' => [$plant], 'lightFixtures' => [$this->tube()]]);

        (new LightingSystem)->apply($state, $this->context($state));

        $this->assertFalse($state->isLit);
        $this->assertSame(0.0, $plant->light);
        $this->assertGreaterThan(0.0, $plant->dailyLight);
    }

    public function test_the_master_switch_turns_every_light_off(): void
    {
        $plant = $this->plant();
        $state = $this->tankState(['lightOn' => false, 'plants' => [$plant], 'lightFixtures' => [$this->tube()]]);

        (new LightingSystem)->apply($state, $this->context($state));

        $this->assertFalse($state->isLit);
        $this->assertSame(0.0, $state->lightLevel);
        $this->assertSame([0.0, 0.0], [$plant->light, $plant->dailyLight]);
    }

    public function test_plants_under_a_decoration_get_less_light(): void
    {
        $sheltered = $this->plant(overrides: ['rootX' => 0.5, 'layer' => 2]);
        $open = $this->plant(overrides: ['rootX' => 0.1, 'layer' => 2]);
        $state = $this->tankState([
            'gridWidth' => 300,
            'gridDepth' => 138,
            'plants' => [$sheltered, $open],
            'lightFixtures' => [$this->tube()],
            'decorationBoxes' => [3 => new GridBox(120, 80, 30, 60, 10, 80)],
        ]);

        (new LightingSystem)->apply($state, $this->context($state));

        $this->assertLessThan($open->light * 0.6, $sheltered->light);
    }

    private function tube(): LightFixtureState
    {
        $gantry = Gantry::forGrid(300, 163, 138);

        return new LightFixtureState(LightCatalogue::find('led-tube'), 0, 300, $gantry->y(), $gantry->z(1), '#f4f7ff', 0.8, 480, 1200, 30, slots: 12);
    }
}
