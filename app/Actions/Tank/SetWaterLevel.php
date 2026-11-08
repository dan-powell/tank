<?php

namespace App\Actions\Tank;

use App\Enums\TankEventType;
use App\Models\Tank;
use App\Simulation\SimEvent;
use App\Simulation\TankGeometry;

class SetWaterLevel
{
    use MixesTapWater;
    use MutatesTank;

    /**
     * Drain or top up the tank to a new water level (grid cells). Draining
     * leaves the water's chemistry as it was; topping up mixes in tap water
     * in proportion to how much is added, and refilling an empty tank starts
     * it on tap water alone.
     */
    public function handle(Tank $tank, int $waterLevel): void
    {
        $this->mutate($tank, function (Tank $tank) use ($waterLevel): SimEvent {
            $before = TankGeometry::waterLitres($tank);
            $wasDry = TankGeometry::isDry($tank);

            $tank->water_level = $waterLevel;
            $tank->volume_litres = TankGeometry::waterLitres($tank);

            if ($wasDry && ! TankGeometry::isDry($tank)) {
                $this->mixInTapWater($tank, 1.0);
            } elseif ($tank->volume_litres > $before) {
                $this->mixInTapWater($tank, ($tank->volume_litres - $before) / $tank->volume_litres);
            }

            return $this->event($tank, TankEventType::WaterLevel, $this->describe($tank, $before), [
                'water_level' => $waterLevel,
                'litres' => $tank->volume_litres,
            ]);
        });
    }

    private function describe(Tank $tank, int $litresBefore): string
    {
        if (TankGeometry::isDry($tank)) {
            return 'You emptied the tank.';
        }

        $depth = rtrim(rtrim(number_format(($tank->water_level - TankGeometry::DEFAULT_SUBSTRATE) / TankGeometry::CELLS_PER_CM, 1), '0'), '.');
        $verb = $tank->volume_litres >= $litresBefore ? 'topped the tank up' : 'drained the tank';

        return "You {$verb} to {$depth} cm of water ({$tank->volume_litres} L).";
    }
}
