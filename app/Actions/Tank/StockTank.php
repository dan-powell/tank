<?php

namespace App\Actions\Tank;

use App\Enums\Sex;
use App\Enums\SpeciesKind;
use App\Enums\TankEventType;
use App\Models\Species;
use App\Models\Tank;
use App\Simulation\SimEvent;
use Random\Randomizer;

class StockTank
{
    use MutatesTank;

    public function __construct(private Randomizer $random = new Randomizer) {}

    /**
     * Add shop-bought plants or animals to the tank.
     */
    public function handle(Tank $tank, Species $species, int $quantity): void
    {
        $this->mutate($tank, function (Tank $tank) use ($species, $quantity): SimEvent {
            $this->addSpecimens($tank, $species, $quantity);

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
        $size = (float) ($species->params['starting_size'] ?? 1.0);

        $tank->plants()->create([
            'species_id' => $species->id,
            'root_x' => $this->random->getFloat(0.08, 0.92),
            'root_y' => 0.0,
            'layer' => $this->random->getInt(0, $this->backLayerLimit($tank)),
            'size' => $size,
            'segments' => max(1, (int) ceil($size * ($species->params['segments_per_size'] ?? 2))),
            'health' => 1.0,
        ]);
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
