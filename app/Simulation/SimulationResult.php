<?php

namespace App\Simulation;

final readonly class SimulationResult
{
    /**
     * @param  list<SimEvent>  $events
     */
    public function __construct(
        public TankState $state,
        public array $events,
        public int $steps,
        public int $simulatedSeconds,
    ) {}
}
