<?php

namespace App\Actions\Tank;

use App\Models\Tank;
use App\Models\User;
use App\Simulation\SpeciesCatalogue;
use App\Simulation\TankGeometry;
use Illuminate\Support\Facades\DB;

class CreateTank
{
    /** Species slug => specimens in a stocked starter-sized (47 litre) tank. */
    private const array STOCK = [
        'vallisneria' => 5,
        'hornwort' => 2,
        'guppy' => 6,
        'corydoras' => 4,
        'nerite-snail' => 1,
    ];

    /** The water a starter-sized tank holds, which the stock list is sized for. */
    private const int STOCK_LITRES = 47;

    public function __construct(private StockTank $stockTank) {}

    /**
     * Set up a cycled tank with the given interior size (in 0.2 cm grid
     * cells), filled to `$waterLevel` (or the top), optionally planted and
     * stocked in proportion to the water it holds.
     */
    public function handle(
        User $user,
        string $name,
        int $width,
        int $height,
        int $depth,
        bool $stocked = true,
        ?int $waterLevel = null,
    ): Tank {
        return DB::transaction(function () use ($user, $name, $width, $height, $depth, $stocked, $waterLevel): Tank {
            $tank = $user->tanks()->make([
                'name' => $name,
                'grid_width' => $width,
                'grid_height' => $height,
                'grid_depth' => $depth,
                'water_level' => $waterLevel ?? TankGeometry::maxWaterLevel($height),
                'layer_count' => TankGeometry::layerCountFor($depth),
                'temperature' => 25,
                'target_temperature' => 25,
                'ph' => 7.4,
                'nitrate' => 5,
                'oxygen' => 8.3,
                'co2' => 2,
                'algae' => 2,
                'bacteria' => 0.3,
                'rng_seed' => random_int(1, 2_147_483_647),
                'sim_seconds' => 8 * 3600,
                'last_simulated_at' => now(),
            ]);
            $tank->volume_litres = TankGeometry::waterLitres($tank);
            $tank->save();

            if ($stocked && ! TankGeometry::isDry($tank)) {
                $this->stock($tank);
            }

            return $tank;
        });
    }

    private function stock(Tank $tank): void
    {
        $scale = $tank->volume_litres / self::STOCK_LITRES;

        foreach (self::STOCK as $slug => $quantity) {
            $this->stockTank->addSpecimens(
                $tank,
                SpeciesCatalogue::resolve($slug),
                max(1, (int) round($quantity * $scale)),
            );
        }
    }
}
