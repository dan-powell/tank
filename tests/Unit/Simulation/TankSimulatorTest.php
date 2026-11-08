<?php

namespace Tests\Unit\Simulation;

use App\Enums\Sex;
use App\Simulation\TankSimulator;
use App\Simulation\TankState;
use PHPUnit\Framework\TestCase;

class TankSimulatorTest extends TestCase
{
    use BuildsSimulationState;

    public function test_same_seed_and_tick_produce_identical_results(): void
    {
        $state = $this->populatedTank();
        $simulator = new TankSimulator(TankSimulator::defaultSystems());

        $first = $simulator->advance($state, 86400);
        $second = $simulator->advance($state, 86400);

        $this->assertEquals($first->state, $second->state);
        $this->assertEquals($first->events, $second->events);
    }

    public function test_splits_elapsed_time_into_bounded_steps_and_advances_the_clock(): void
    {
        $state = $this->tankState(['simTick' => 10, 'simSeconds' => 1000]);
        $simulator = new TankSimulator(TankSimulator::defaultSystems(), maxStepSeconds: 300);

        $result = $simulator->advance($state, 3600);

        $this->assertSame(12, $result->steps);
        $this->assertSame(3600, $result->simulatedSeconds);
        $this->assertSame(22, $result->state->simTick);
        $this->assertSame(4600, $result->state->simSeconds);
    }

    public function test_skips_time_beyond_the_catch_up_limit(): void
    {
        $simulator = new TankSimulator(TankSimulator::defaultSystems(), maxStepSeconds: 300, maxSteps: 10);

        $result = $simulator->advance($this->tankState(), 86400);

        $this->assertSame(10, $result->steps);
        $this->assertSame(3000, $result->simulatedSeconds);
    }

    public function test_an_empty_tank_pauses_the_water_chemistry_but_plants_still_wilt(): void
    {
        $plant = $this->plant(overrides: ['health' => 1.0]);
        $state = $this->tankState([
            'hasWater' => false,
            'waterLevel' => 10,
            'ammonia' => 1.0,
            'temperature' => 18.0,
            'uneatenFood' => 0.5,
            'plants' => [$plant],
        ]);

        $result = (new TankSimulator(TankSimulator::defaultSystems()))->advance($state, 3600);

        $this->assertSame(1.0, $result->state->ammonia);
        $this->assertSame(18.0, $result->state->temperature);
        $this->assertSame(0.5, $result->state->uneatenFood);
        $this->assertEqualsWithDelta(0.98, $result->state->plants[0]->health, 0.0001);
    }

    public function test_does_not_mutate_the_input_state(): void
    {
        $state = $this->populatedTank();
        $before = $state->copy();

        (new TankSimulator(TankSimulator::defaultSystems()))->advance($state, 86400);

        $this->assertEquals($before, $state);
    }

    public function test_balanced_starter_tank_stays_healthy_for_a_week(): void
    {
        $state = $this->populatedTank();
        $simulator = new TankSimulator(TankSimulator::defaultSystems());

        for ($day = 0; $day < 7; $day++) {
            $state->uneatenFood += 0.16;
            $state = $simulator->advance($state, 43200)->state;
            $state->uneatenFood += 0.16;
            $state = $simulator->advance($state, 43200)->state;
        }

        $this->assertLessThan(0.25, $state->ammonia);
        $this->assertLessThan(0.25, $state->nitrite);
        $this->assertGreaterThan(6.0, $state->oxygen);
        $this->assertCount(11, array_filter($state->livingCreatures(), fn ($creature): bool => $creature->size > 1.5));
    }

    private function populatedTank(): TankState
    {
        return $this->tankState([
            'plants' => [
                ...array_map(fn (): mixed => $this->plant('vallisneria'), range(1, 5)),
                ...array_map(fn (): mixed => $this->plant('hornwort'), range(1, 2)),
            ],
            'creatures' => [
                ...array_map(fn (int $i): mixed => $this->creature('guppy', ['sex' => $i % 2 ? Sex::Male : Sex::Female]), range(1, 6)),
                ...array_map(fn (int $i): mixed => $this->creature('corydoras', ['sex' => $i % 2 ? Sex::Male : Sex::Female]), range(1, 4)),
                $this->creature('nerite-snail'),
            ],
        ]);
    }

    public function test_a_sealed_dry_terrarium_runs_on_its_own_air(): void
    {
        $state = $this->tankState([
            'hasWater' => false,
            'isSealed' => true,
            'waterLevel' => 10,
            'humidity' => 90.0,
            'detritus' => 2.0,
            'landAreaCm2' => 1600.0,
            'plants' => [$this->plant('cushion-moss', ['rootHeight' => 10]), $this->plant('cushion-moss', ['rootHeight' => 10])],
            'creatures' => [
                $this->creature('springtail', ['ageSeconds' => 30 * 86400]),
                $this->creature('springtail', ['sex' => Sex::Male, 'ageSeconds' => 30 * 86400]),
            ],
        ]);

        $result = (new TankSimulator(TankSimulator::defaultSystems()))->advance($state, 86400);

        $this->assertNotSame(420.0, $result->state->airCo2);
        $this->assertCount(2, array_filter($result->state->plants, fn ($plant): bool => ! $plant->isDead));
        $this->assertGreaterThanOrEqual(2, count($result->state->livingCreatures()));
    }
}
