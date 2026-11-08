<?php

namespace App\Actions\Tank;

use App\Enums\TankEventType;
use App\Models\Decoration;
use App\Models\Plant;
use App\Models\Tank;
use App\Simulation\SimEvent;
use App\Simulation\TankGeometry;

class RemoveDecoration
{
    use MutatesTank;

    /**
     * Take a decoration out of the tank. Plants growing on it drop to the
     * substrate directly beneath where they were attached.
     */
    public function handle(Tank $tank, Decoration $decoration): void
    {
        $this->mutate($tank, function (Tank $tank) use ($decoration): SimEvent {
            $decoration->plants()->each(function (Plant $plant) use ($tank, $decoration): void {
                [$x, , $z] = TankGeometry::anchorCell($decoration, $plant->anchor_index ?? 0);

                $plant->update([
                    'decoration_id' => null,
                    'anchor_index' => null,
                    'root_x' => TankGeometry::normalisedX($x, $tank->grid_width),
                    'layer' => TankGeometry::layerAt($z, $tank->layer_count, $tank->grid_depth),
                ]);
            });

            $decoration->delete();
            $name = $decoration->definition()->name;

            return $this->event(
                $tank,
                TankEventType::Aquascaping,
                "You removed the {$name} from the tank.",
                ['decoration_id' => $decoration->id],
            );
        });
    }
}
