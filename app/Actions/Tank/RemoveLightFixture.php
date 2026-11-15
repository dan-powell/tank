<?php

namespace App\Actions\Tank;

use App\Enums\TankEventType;
use App\Models\LightFixture;
use App\Models\Tank;
use App\Simulation\SimEvent;

class RemoveLightFixture
{
    use MutatesTank;

    /**
     * Take a light down from the gantry.
     */
    public function handle(Tank $tank, LightFixture $fixture): void
    {
        $this->mutate($tank, function (Tank $tank) use ($fixture): SimEvent {
            $fixture->delete();

            return $this->event(
                $tank,
                TankEventType::Lighting,
                "You took the {$fixture->definition()->name} down from the gantry.",
                ['light_fixture_id' => $fixture->id],
            );
        });
    }
}
