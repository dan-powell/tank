<?php

namespace App\Http\Controllers;

use App\Models\Creature;
use App\Models\Plant;
use App\Models\Species;
use App\Models\Tank;
use App\Simulation\ActiveWarnings;
use App\Simulation\TankGeometry;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\Request;
use Illuminate\Support\Collection as SupportCollection;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    /**
     * List the user's tanks.
     */
    public function __invoke(Request $request): Response
    {
        $tanks = $request->user()->tanks()->orderBy('id')->get();
        $populations = $this->populations($tanks);
        $species = Species::query()
            ->whereIn('id', $populations->flatten(1)->pluck('species_id')->unique())
            ->get()
            ->keyBy('id');

        return Inertia::render('dashboard', [
            'tanks' => $tanks->map(function (Tank $tank) use ($populations, $species): array {
                $population = $populations->get($tank->id, collect())
                    ->map(fn (object $row): array => ['species' => $species[$row->species_id], 'count' => (int) $row->count]);
                $isFauna = fn (array $entry): bool => $entry['species']->kind->isFauna();

                return [
                    'id' => $tank->id,
                    'name' => $tank->name,
                    'volume_litres' => $tank->volume_litres,
                    'dimensions_cm' => [
                        $tank->grid_width / TankGeometry::CELLS_PER_CM,
                        $tank->grid_height / TankGeometry::CELLS_PER_CM,
                        $tank->grid_depth / TankGeometry::CELLS_PER_CM,
                    ],
                    'background' => [
                        'colour' => $tank->background_colour,
                        'gradient_colour' => $tank->background_gradient_colour,
                    ],
                    'creatures_count' => $population->filter($isFauna)->sum('count'),
                    'plants_count' => $population->reject($isFauna)->sum('count'),
                    'temperature' => round($tank->temperature, 1),
                    'ammonia' => round($tank->ammonia, 2),
                    'nitrate' => round($tank->nitrate, 1),
                    'is_paused' => $tank->is_paused,
                    'pause_reason' => $tank->pause_reason,
                    'warnings' => ActiveWarnings::forTank($tank, $population->pluck('species')),
                    'species' => $population
                        ->sortBy([
                            fn (array $a, array $b): int => $isFauna($b) <=> $isFauna($a),
                            fn (array $a, array $b): int => $b['count'] <=> $a['count'],
                            fn (array $a, array $b): int => $a['species']->name <=> $b['species']->name,
                        ])
                        ->map(fn (array $entry): array => [
                            'id' => $entry['species']->id,
                            'slug' => $entry['species']->slug,
                            'name' => $entry['species']->name,
                            'kind' => $entry['species']->kind,
                            'count' => $entry['count'],
                        ])
                        ->values(),
                ];
            }),
            'sizeLimits' => [
                'width' => TankGeometry::WIDTH_CM,
                'height' => TankGeometry::HEIGHT_CM,
                'depth' => TankGeometry::DEPTH_CM,
            ],
        ]);
    }

    /**
     * How many living plants and animals of each species every tank holds,
     * grouped by tank id.
     *
     * @param  Collection<int, Tank>  $tanks
     * @return SupportCollection<int, SupportCollection<int, object{tank_id: int, species_id: int, count: int}>>
     */
    private function populations(Collection $tanks): SupportCollection
    {
        $count = fn (string $model) => $model::query()
            ->alive()
            ->whereIn('tank_id', $tanks->modelKeys())
            ->groupBy('tank_id', 'species_id')
            ->selectRaw('tank_id, species_id, count(*) as count')
            ->toBase()
            ->get();

        return $count(Creature::class)->concat($count(Plant::class))->groupBy('tank_id');
    }
}
