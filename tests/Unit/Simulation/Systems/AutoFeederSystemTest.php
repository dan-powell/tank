<?php

namespace Tests\Unit\Simulation\Systems;

use App\Enums\TankEventType;
use App\Simulation\AutoFeederState;
use App\Simulation\SimEvent;
use App\Simulation\Systems\AutoFeederSystem;
use App\Simulation\TankState;
use PHPUnit\Framework\TestCase;
use Tests\Unit\Simulation\BuildsSimulationState;

class AutoFeederSystemTest extends TestCase
{
    use BuildsSimulationState;

    public function test_drops_a_portion_when_a_step_reaches_a_feeding_time(): void
    {
        $state = $this->tankWithFeeder(simSeconds: $this->at(8, 58), portions: 10);

        $events = $this->applyStep($state);

        $this->assertEqualsWithDelta(0.08, $state->uneatenFood, 1e-9);
        $this->assertSame(9, $state->autoFeeder->portions);
        $this->assertSame([TankEventType::AutoFeeding], array_map(fn (SimEvent $event): TankEventType => $event->type, $events));
    }

    public function test_does_not_feed_between_feeding_times(): void
    {
        $state = $this->tankWithFeeder(simSeconds: $this->at(10, 0), portions: 10);

        $events = $this->applyStep($state);

        $this->assertSame(0.0, $state->uneatenFood);
        $this->assertSame(10, $state->autoFeeder->portions);
        $this->assertSame([], $events);
    }

    public function test_feeds_exactly_once_across_consecutive_steps(): void
    {
        $state = $this->tankWithFeeder(simSeconds: 3 * 86400 + $this->at(8, 50), portions: 10);
        $events = [];

        for ($step = 0; $step < 4; $step++) {
            array_push($events, ...$this->applyStep($state));
            $state->simSeconds += 300;
        }

        $this->assertCount(1, $events);
        $this->assertSame(9, $state->autoFeeder->portions);
    }

    public function test_an_empty_hopper_drops_nothing(): void
    {
        $state = $this->tankWithFeeder(simSeconds: $this->at(8, 58), portions: 0);

        $events = $this->applyStep($state);

        $this->assertSame(0.0, $state->uneatenFood);
        $this->assertSame([], $events);
    }

    public function test_warns_when_the_last_portion_is_used(): void
    {
        $state = $this->tankWithFeeder(simSeconds: $this->at(8, 58), portions: 1);

        $events = $this->applyStep($state);

        $this->assertSame(0, $state->autoFeeder->portions);
        $this->assertSame(TankEventType::Warning, $events[1]->type);
        $this->assertSame('The auto-feeder hopper is empty. Refill it to keep your fish fed.', $events[1]->message);
    }

    public function test_unlimited_mode_feeds_without_using_the_hopper(): void
    {
        $state = $this->tankWithFeeder(simSeconds: $this->at(8, 58), portions: 0, unlimited: true);

        $this->applyStep($state);

        $this->assertEqualsWithDelta(0.08, $state->uneatenFood, 1e-9);
        $this->assertSame(0, $state->autoFeeder->portions);
    }

    private function tankWithFeeder(int $simSeconds, int $portions, bool $unlimited = false): TankState
    {
        return $this->tankState([
            'simSeconds' => $simSeconds,
            'autoFeeder' => new AutoFeederState(feedHours: [9, 18], portionGrams: 0.08, unlimited: $unlimited, portions: $portions),
        ]);
    }

    /**
     * Apply the system for one five-minute step.
     *
     * @return list<SimEvent>
     */
    private function applyStep(TankState $state): array
    {
        $context = $this->context($state);
        (new AutoFeederSystem)->apply($state, $context);

        return $context->events();
    }

    private function at(int $hour, int $minute): int
    {
        return $hour * 3600 + $minute * 60;
    }
}
