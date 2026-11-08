<?php

namespace App\Actions\Tank;

use App\Enums\TankEventType;
use App\Events\TankUpdated;
use App\Models\Tank;
use App\Simulation\SimEvent;
use Closure;
use Illuminate\Support\Facades\DB;

/**
 * Apply a user interaction to a tank while holding the same row lock the
 * simulation job uses, log it, and notify viewers.
 */
trait MutatesTank
{
    /**
     * @param  Closure(Tank): SimEvent  $mutation  Mutates the locked tank and describes what happened.
     */
    protected function mutate(Tank $tank, Closure $mutation): void
    {
        $event = DB::transaction(function () use ($tank, $mutation): SimEvent {
            $locked = Tank::query()->lockForUpdate()->findOrFail($tank->id);
            $event = $mutation($locked);

            $locked->save();
            $locked->recordEvent($event->type, $event->message, $event->payload);
            $tank->setRawAttributes($locked->getAttributes(), sync: true);

            return $event;
        });

        TankUpdated::dispatch($tank, [$event]);
    }

    /**
     * Like mutate(), for small adjustments not worth an entry in the event log.
     *
     * @param  Closure(Tank): void  $mutation
     */
    protected function mutateQuietly(Tank $tank, Closure $mutation): void
    {
        DB::transaction(function () use ($tank, $mutation): void {
            $mutation(Tank::query()->lockForUpdate()->findOrFail($tank->id));
        });

        TankUpdated::dispatch($tank);
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    protected function event(Tank $tank, TankEventType $type, string $message, array $payload = []): SimEvent
    {
        return new SimEvent($type, $message, $tank->sim_tick, $payload);
    }
}
