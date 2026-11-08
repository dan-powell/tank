<?php

namespace App\Actions\Tank;

use App\Enums\TankEventType;
use App\Models\Creature;
use App\Models\Tank;
use App\Simulation\SimEvent;

class RemoveCreature
{
    use MutatesTank;

    /**
     * Take a living animal out of the tank. It is kept on record (for lineage)
     * as no longer alive, with "removed" as the cause.
     */
    public function handle(Tank $tank, Creature $creature): void
    {
        $this->mutate($tank, function (Tank $tank) use ($creature): SimEvent {
            $living = $tank->creatures()->alive()->with('species')->findOrFail($creature->id);

            $living->forceFill(['died_at' => now(), 'death_cause' => 'removed'])->save();

            $name = $living->nickname === null
                ? "a {$living->species->name}"
                : "{$living->nickname} the {$living->species->name}";

            return $this->event(
                $tank,
                TankEventType::Removed,
                "You removed {$name} from the tank.",
                ['creature_id' => $living->id],
            );
        });
    }
}
