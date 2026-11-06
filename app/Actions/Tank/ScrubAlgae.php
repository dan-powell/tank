<?php

namespace App\Actions\Tank;

use App\Enums\TankEventType;
use App\Models\Tank;
use App\Simulation\SimEvent;

class ScrubAlgae
{
    use MutatesTank;

    /**
     * Scrape algae off the glass. Some always remains on plants and decor.
     */
    public function handle(Tank $tank): void
    {
        $this->mutate($tank, function (Tank $tank): SimEvent {
            $tank->algae *= 0.35;

            return $this->event($tank, TankEventType::AlgaeScrub, 'You scrubbed the algae off the glass.');
        });
    }
}
