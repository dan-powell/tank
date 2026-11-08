<?php

namespace App\Actions\Tank;

use App\Enums\TankEventType;
use App\Models\Tank;
use App\Simulation\SimEvent;

class ToggleLid
{
    use MutatesTank;

    /**
     * Seal the tank, cutting it off from the room so it runs as its own
     * ecosystem, or lift the lid to tend it again.
     */
    public function handle(Tank $tank): void
    {
        $this->mutate($tank, function (Tank $tank): SimEvent {
            $tank->is_sealed = ! $tank->is_sealed;

            return $this->event(
                $tank,
                TankEventType::Lid,
                $tank->is_sealed ? 'You sealed the tank.' : 'You lifted the lid.',
                ['is_sealed' => $tank->is_sealed],
            );
        });
    }
}
