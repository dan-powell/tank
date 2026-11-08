<?php

namespace App\Actions\Tank;

use App\Enums\TankEventType;
use App\Models\Decoration;
use App\Models\Plant;
use App\Models\Tank;
use App\Simulation\DecorationCatalogue;
use App\Simulation\GridBox;
use App\Simulation\SimEvent;
use App\Simulation\TankGeometry;
use Illuminate\Validation\ValidationException;
use Random\Randomizer;

class PlaceDecoration
{
    use MutatesTank;

    /** Spacing between candidate positions, in grid cells. */
    private const int STEP = 4;

    /** Gap below which neighbouring decorations count as crowded, in grid cells. */
    private const int COMFORTABLE_GAP = 6;

    public function __construct(private Randomizer $random = new Randomizer) {}

    /**
     * Add a catalogue decoration to the tank, choosing a free spot for it.
     *
     * Spots on the substrate that keep clear of other decorations come first,
     * favouring the back of the tank. When the floor is full the decoration is
     * stacked on whatever is lowest, as long as it stays below the rim.
     *
     * @throws ValidationException When there is no room left.
     */
    public function handle(Tank $tank, string $type): Decoration
    {
        $definition = DecorationCatalogue::find($type);
        $decoration = null;

        $this->mutate($tank, function (Tank $tank) use ($definition, &$decoration): SimEvent {
            $box = $this->chooseSpot($tank, $definition->rotatedSize(0))
                ?? throw ValidationException::withMessages([
                    'type' => __('There is no room in the tank for the :name.', ['name' => $definition->name]),
                ]);

            $decoration = $tank->decorations()->create([
                'type' => $definition->slug,
                'x' => $box->x,
                'y' => $box->y,
                'z' => $box->z,
                'rotation' => 0,
                'seed' => $this->random->getInt(1, 2_147_483_647),
            ]);

            return $this->event(
                $tank,
                TankEventType::Aquascaping,
                "You added a {$definition->name} to the tank.",
                ['decoration_id' => $decoration->id],
            );
        });

        return $decoration;
    }

    /**
     * @param  array{0: int, 1: int, 2: int}  $size
     */
    private function chooseSpot(Tank $tank, array $size): ?GridBox
    {
        [$width, $height, $depth] = $size;
        $others = $tank->decorations()->get()->map(fn (Decoration $decoration): GridBox => TankGeometry::footprint($decoration))->all();
        $plantColumns = $tank->plants()->alive()->whereNull('decoration_id')->get()
            ->map(fn (Plant $plant): array => TankGeometry::plantColumn($plant->root_x, $plant->layer, $tank->layer_count))
            ->all();

        $best = null;
        $bestScore = INF;

        foreach ($this->candidateCorners(TankGeometry::WIDTH - $width) as $x) {
            foreach ($this->candidateCorners(TankGeometry::DEPTH - $depth) as $z) {
                $floorPlan = new GridBox($x, 0, $z, $width, $height, $depth);
                $substrate = TankGeometry::highestSubstrateUnder($tank, $floorPlan);
                $restingOn = $substrate;
                $nearestGap = PHP_INT_MAX;

                foreach ($others as $other) {
                    if ($floorPlan->overlapsFootprint($other)) {
                        $restingOn = max($restingOn, $other->maxY());
                    }

                    $nearestGap = min($nearestGap, $floorPlan->footprintGap($other));
                }

                if ($restingOn + $height > TankGeometry::HEIGHT) {
                    continue;
                }

                $isStacked = $restingOn > $substrate;
                $coveredPlants = $isStacked ? 0 : count(array_filter(
                    $plantColumns,
                    fn (array $column): bool => $floorPlan->coversColumn($column[0], $column[1]),
                ));

                $score = ($isStacked ? 10 + $restingOn / TankGeometry::HEIGHT : 0)
                    + $z / TankGeometry::DEPTH
                    + max(0, self::COMFORTABLE_GAP - $nearestGap) / self::COMFORTABLE_GAP * 0.5
                    + $coveredPlants * 0.3
                    + $this->random->getFloat(0, 0.35);

                if ($score < $bestScore) {
                    $bestScore = $score;
                    $best = new GridBox($x, $restingOn, $z, $width, $height, $depth);
                }
            }
        }

        return $best;
    }

    /**
     * Corner positions along one axis, always including the far edge.
     *
     * @return list<int>
     */
    private function candidateCorners(int $max): array
    {
        if ($max < 0) {
            return [];
        }

        $corners = range(0, $max, self::STEP);

        if (end($corners) !== $max) {
            $corners[] = $max;
        }

        return $corners;
    }
}
