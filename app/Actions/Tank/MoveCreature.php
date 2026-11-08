<?php

namespace App\Actions\Tank;

use App\Models\Creature;
use App\Models\Tank;

class MoveCreature
{
    use MutatesTank;

    /**
     * Give an animal a new home, e.g. to rescue it from the wrong side of
     * the waterline. It wanders around its new spot from then on.
     */
    public function handle(Tank $tank, Creature $creature, float $x, float $y, int $layer): void
    {
        $this->mutateQuietly($tank, function () use ($creature, $x, $y, $layer): void {
            $creature->update(['zone_x' => $x, 'zone_y' => $y, 'layer' => $layer]);
        });
    }
}
