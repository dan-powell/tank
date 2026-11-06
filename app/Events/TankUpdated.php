<?php

namespace App\Events;

use App\Models\Tank;
use App\Simulation\SimEvent;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * Tells viewers of a tank that its state has changed.
 *
 * The payload is deliberately small (websocket messages are size-limited);
 * clients re-fetch the full snapshot with an Inertia partial reload.
 */
class TankUpdated implements ShouldBroadcastNow, ShouldDispatchAfterCommit
{
    use Dispatchable, InteractsWithSockets;

    /** Maximum number of event messages sent with a single update. */
    private const int MAX_EVENTS = 10;

    /**
     * @param  list<SimEvent>  $events
     */
    public function __construct(
        public Tank $tank,
        public array $events = [],
    ) {}

    /**
     * @return array<int, PrivateChannel>
     */
    public function broadcastOn(): array
    {
        return [new PrivateChannel('tank.'.$this->tank->id)];
    }

    public function broadcastAs(): string
    {
        return 'tank.updated';
    }

    /**
     * @return array{tank_id: int, sim_tick: int, events: list<array{type: string, message: string}>}
     */
    public function broadcastWith(): array
    {
        return [
            'tank_id' => $this->tank->id,
            'sim_tick' => $this->tank->sim_tick,
            'events' => array_map(fn (SimEvent $event): array => [
                'type' => $event->type->value,
                'message' => $event->message,
            ], array_slice($this->events, -self::MAX_EVENTS)),
        ];
    }
}
