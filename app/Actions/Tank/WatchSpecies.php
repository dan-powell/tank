<?php

namespace App\Actions\Tank;

use App\Models\Species;
use App\Models\Tank;

class WatchSpecies
{
    use MutatesTank;

    /**
     * Choose whether animals of a species pause the tank when close to death
     * (animals with their own setting keep it).
     */
    public function handle(Tank $tank, Species $species, bool $watched): void
    {
        $this->mutateQuietly($tank, function (Tank $tank) use ($species, $watched): void {
            $tank->update([
                'alert_settings' => $tank->alertSettings()->withSpeciesWatched($species->id, $watched)->toArray(),
            ]);
        });
    }
}
