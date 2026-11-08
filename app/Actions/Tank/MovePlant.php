<?php

namespace App\Actions\Tank;

use App\Models\Plant;
use App\Models\Tank;

class MovePlant
{
    use MutatesTank;

    /**
     * Replant a plant somewhere else on the substrate (taking it off any
     * decoration it was growing on).
     */
    public function handle(Tank $tank, Plant $plant, float $x, int $layer): void
    {
        $this->mutateQuietly($tank, function () use ($plant, $x, $layer): void {
            $plant->update(['root_x' => $x, 'layer' => $layer, 'decoration_id' => null, 'anchor_index' => null]);
        });
    }
}
