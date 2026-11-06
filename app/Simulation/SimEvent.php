<?php

namespace App\Simulation;

use App\Enums\TankEventType;

/**
 * Something notable that happened during a simulation step.
 */
final readonly class SimEvent
{
    /**
     * @param  array<string, mixed>  $payload
     */
    public function __construct(
        public TankEventType $type,
        public string $message,
        public int $simTick,
        public array $payload = [],
    ) {}
}
