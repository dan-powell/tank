<?php

namespace App\Actions\Tank;

use App\Enums\Sex;
use App\Enums\SpeciesKind;
use App\Enums\TankEventType;
use App\Models\Decoration;
use App\Models\Species;
use App\Models\Tank;
use App\Simulation\GridBox;
use App\Simulation\SimEvent;
use App\Simulation\TankGeometry;
use Random\Randomizer;

class StockTank
{
    use MutatesTank;

    public function __construct(private Randomizer $random = new Randomizer) {}

    /** Attempts at finding substrate that no decoration is resting on. */
    private const int ROOTING_ATTEMPTS = 12;

    /**
     * Add shop-bought plants or animals to the tank, optionally attaching a
     * plant to one of a decoration's anchors.
     */
    public function handle(Tank $tank, Species $species, int $quantity, ?Decoration $decoration = null, ?int $anchor = null): void
    {
        $this->mutate($tank, function (Tank $tank) use ($species, $quantity, $decoration, $anchor): SimEvent {
            if ($decoration !== null && $anchor !== null) {
                $this->attachPlant($tank, $species, $decoration, $anchor);
            } else {
                $this->addSpecimens($tank, $species, $quantity);
            }

            $label = $quantity === 1 ? "a {$species->name}" : "{$quantity} {$species->name}";

            return $this->event(
                $tank,
                TankEventType::LivestockAdded,
                "You added {$label} to the tank.",
                ['species_id' => $species->id, 'count' => $quantity],
            );
        });
    }

    /**
     * Create young-adult specimens of a species in the tank.
     */
    public function addSpecimens(Tank $tank, Species $species, int $quantity): void
    {
        for ($i = 0; $i < $quantity; $i++) {
            $species->kind === SpeciesKind::Plant
                ? $this->addPlant($tank, $species)
                : $this->addCreature($tank, $species, $i % 2 === 0 ? Sex::Female : Sex::Male);
        }
    }

    private function addPlant(Tank $tank, Species $species): void
    {
        [$rootX, $layer] = $this->chooseRoot($tank);

        $tank->plants()->create([
            ...$this->youngPlant($species),
            'root_x' => $rootX,
            'layer' => $layer,
        ]);
    }

    private function attachPlant(Tank $tank, Species $species, Decoration $decoration, int $anchor): void
    {
        [$x, , $z] = TankGeometry::anchorCell($decoration, $anchor);

        $tank->plants()->create([
            ...$this->youngPlant($species),
            'root_x' => TankGeometry::normalisedX($x),
            'layer' => TankGeometry::layerAt($z, $tank->layer_count),
            'decoration_id' => $decoration->id,
            'anchor_index' => $anchor,
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function youngPlant(Species $species): array
    {
        $size = (float) ($species->params['starting_size'] ?? 1.0);

        return [
            'species_id' => $species->id,
            'root_y' => 0.0,
            'size' => $size,
            'segments' => max(1, (int) ceil($size * ($species->params['segments_per_size'] ?? 2))),
            'health' => 1.0,
        ];
    }

    /**
     * A random substrate position (normalised x, layer), avoiding the floor
     * beneath decorations where possible.
     *
     * @return array{0: float, 1: int}
     */
    private function chooseRoot(Tank $tank): array
    {
        $footprints = TankGeometry::groundedFootprints($tank, $tank->decorations()->get());

        for ($attempt = 0; ; $attempt++) {
            $rootX = $this->random->getFloat(0.08, 0.92);
            $layer = $this->random->getInt(0, $this->backLayerLimit($tank));
            [$x, $z] = TankGeometry::plantColumn($rootX, $layer, $tank->layer_count);

            $isCovered = array_any($footprints, fn (GridBox $box): bool => $box->coversColumn($x, $z));

            if (! $isCovered || $attempt >= self::ROOTING_ATTEMPTS) {
                return [$rootX, $layer];
            }
        }
    }

    private function addCreature(Tank $tank, Species $species, Sex $sex): void
    {
        $params = $species->params;
        [$zoneYMin, $zoneYMax] = $params['zone']['y'];

        $tank->creatures()->create([
            'species_id' => $species->id,
            'sex' => $sex,
            'size' => $params['adult_size'] * $this->random->getFloat(0.6, 0.85),
            'hunger' => 0.3,
            'health' => 0.9,
            'age_seconds' => (int) ($params['maturity_days'] * 86400 * $this->random->getFloat(0.6, 1.2)),
            'zone_x' => $this->random->getFloat(0.2, 0.8),
            'zone_y' => $this->random->getFloat($zoneYMin, $zoneYMax),
            'layer' => $this->random->getInt(0, $tank->layer_count - 1),
            'zone_radius' => $params['zone']['radius'],
            'generation' => 1,
        ]);
    }

    /**
     * The front-most layer plants may be planted in, keeping them in the back
     * ~60% of the tank so the foreground stays open for viewing.
     */
    private function backLayerLimit(Tank $tank): int
    {
        return max(0, (int) ceil($tank->layer_count * 0.6) - 1);
    }
}
