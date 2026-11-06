<?php

namespace App\Simulation;

use App\Enums\TankEventType;
use Random\Randomizer;

/**
 * Per-step inputs shared by every system: the time step, a deterministic
 * random source, the water parameters at the start of the step, and the
 * collector for emitted events.
 */
final class StepContext
{
    /** @var list<SimEvent> */
    private array $events = [];

    public readonly float $hours;

    public function __construct(
        public readonly int $dtSeconds,
        public readonly Randomizer $random,
        public readonly TankState $before,
    ) {
        $this->hours = $dtSeconds / 3600;
    }

    /**
     * Fraction of a quantity that changes over this step under first-order
     * kinetics with the given hourly rate constant.
     */
    public function decay(float $ratePerHour): float
    {
        return 1 - exp(-$ratePerHour * $this->hours);
    }

    /**
     * Roll for an event that happens on average `$perDay` times per simulated day.
     */
    public function chancePerDay(float $perDay): bool
    {
        $probability = 1 - exp(-$perDay * $this->hours / 24);

        return $this->random->getFloat(0, 1) < $probability;
    }

    public function between(float $min, float $max): float
    {
        return $min >= $max ? $min : $this->random->getFloat($min, $max);
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    public function emit(TankEventType $type, string $message, array $payload = []): void
    {
        $this->events[] = new SimEvent($type, $message, $this->before->simTick, $payload);
    }

    /**
     * @return list<SimEvent>
     */
    public function events(): array
    {
        return $this->events;
    }
}
