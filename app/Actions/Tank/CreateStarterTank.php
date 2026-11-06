<?php

namespace App\Actions\Tank;

use App\Models\Tank;
use App\Models\User;
use App\Simulation\SpeciesCatalogue;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class CreateStarterTank
{
    /** Species slug => number of specimens in a new tank. */
    private const array STOCK = [
        'vallisneria' => 5,
        'hornwort' => 2,
        'guppy' => 6,
        'corydoras' => 4,
        'nerite-snail' => 1,
    ];

    public function __construct(private StockTank $stockTank) {}

    /**
     * Give a user a cycled, planted and stocked 60 litre tank.
     */
    public function handle(User $user): Tank
    {
        return DB::transaction(function () use ($user): Tank {
            $tank = $user->tanks()->create([
                'name' => Str::of($user->name)->before(' ')->append("'s Tank")->toString(),
                'volume_litres' => 60,
                'temperature' => 25,
                'target_temperature' => 25,
                'ph' => 7.4,
                'nitrate' => 5,
                'oxygen' => 8.3,
                'co2' => 2,
                'algae' => 2,
                'bacteria' => 0.3,
                'rng_seed' => random_int(1, 2_147_483_647),
                'sim_seconds' => (int) now()->secondsSinceMidnight(),
                'last_simulated_at' => now(),
            ]);

            foreach (self::STOCK as $slug => $quantity) {
                $this->stockTank->addSpecimens($tank, SpeciesCatalogue::resolve($slug), $quantity);
            }

            return $tank;
        });
    }
}
