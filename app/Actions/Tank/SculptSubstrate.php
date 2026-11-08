<?php

namespace App\Actions\Tank;

use App\Models\Tank;
use App\Simulation\TankGeometry;

class SculptSubstrate
{
    use MutatesTank;

    /**
     * Reshape the substrate. Decorations stay where they are (so raised
     * gravel can bury them), plants follow the surface, and the water held
     * changes with the gravel it now has to make room for.
     *
     * @param  list<int>  $heights  One height per heightmap column, in grid cells.
     */
    public function handle(Tank $tank, array $heights): void
    {
        $this->mutateQuietly($tank, function (Tank $locked) use ($tank, $heights): void {
            $locked->substrate_heights = $heights;
            $locked->volume_litres = TankGeometry::waterLitres($locked);
            $locked->save();

            $tank->setRawAttributes($locked->getAttributes(), sync: true);
        });
    }
}
