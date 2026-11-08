<?php

namespace App\Actions\Tank;

use App\Enums\TankEventType;
use App\Models\Plant;
use App\Models\Tank;
use App\Simulation\SimEvent;

class RemovePlant
{
    use MutatesTank;

    /**
     * Uproot a living plant. It is kept on record (for lineage) as no longer alive.
     */
    public function handle(Tank $tank, Plant $plant): void
    {
        $this->mutate($tank, function (Tank $tank) use ($plant): SimEvent {
            $living = $tank->plants()->alive()->with('species')->findOrFail($plant->id);

            $living->forceFill(['died_at' => now()])->save();

            $name = $living->nickname === null
                ? "a {$living->species->name}"
                : "{$living->nickname} the {$living->species->name}";

            return $this->event(
                $tank,
                TankEventType::Removed,
                "You removed {$name} from the tank.",
                ['plant_id' => $living->id],
            );
        });
    }
}
