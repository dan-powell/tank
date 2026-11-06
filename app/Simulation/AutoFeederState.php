<?php

namespace App\Simulation;

/**
 * An installed auto-feeder: when it feeds, how much, and what is left in its hopper.
 */
final class AutoFeederState
{
    /**
     * @param  list<int>  $feedHours  Simulated hours of the day (0-23) at which it feeds.
     */
    public function __construct(
        public array $feedHours,
        public float $portionGrams,
        public bool $unlimited,
        public int $portions,
    ) {}

    public function canFeed(): bool
    {
        return $this->unlimited || $this->portions > 0;
    }
}
