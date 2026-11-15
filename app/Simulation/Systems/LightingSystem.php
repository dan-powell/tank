<?php

namespace App\Simulation\Systems;

use App\Simulation\LightField;
use App\Simulation\PlantState;
use App\Simulation\StepContext;
use App\Simulation\TankGeometry;
use App\Simulation\TankState;

/**
 * Work out the light in the tank this step: each fixture follows its own
 * timer while the master switch is on. Every plant gets the light at its
 * crown (now, and over a whole day); the tank gets its average light on the
 * substrate and its photoperiod, which drive algae.
 */
final class LightingSystem implements SimulationSystem
{
    /** Below this average light the tank counts as dark. */
    public const float DARK = 0.02;

    /** Plant render heights are fractions of this many cm (the starter tank's height). */
    private const float PLANT_HEIGHT_UNIT_CM = 32.5;

    public function apply(TankState $state, StepContext $context): void
    {
        if (! $state->lightOn || $state->lightFixtures === []) {
            $this->darken($state);

            return;
        }

        $field = $state->lightField ??= LightField::forState($state);
        $midStep = $state->simSeconds + intdiv($context->dtSeconds, 2);

        $state->lightLevel = $field->floorAverage($state, $midStep);
        $state->isLit = $state->lightLevel > self::DARK;
        $state->photoperiodHours = $field->photoperiodHours();

        foreach ($state->livingPlants() as $plant) {
            [$x, $y, $z] = $this->crown($state, $plant);
            $plant->light = $field->at($x, $y, $z, $midStep, $plant->decorationId);
            $plant->dailyLight = $field->dailyLightAt($x, $y, $z, $plant->decorationId);
        }
    }

    private function darken(TankState $state): void
    {
        $state->isLit = false;
        $state->lightLevel = 0.0;
        $state->photoperiodHours = 0.0;

        foreach ($state->livingPlants() as $plant) {
            $plant->light = 0.0;
            $plant->dailyLight = 0.0;
        }
    }

    /**
     * The top of a plant, in grid cells: above its anchor or its spot on the substrate.
     *
     * @return array{0: float, 1: float, 2: float}
     */
    private function crown(TankState $state, PlantState $plant): array
    {
        $anchor = $plant->decorationId === null ? null : ($state->decorationAnchors[$plant->decorationId][$plant->anchorIndex] ?? null);

        [$x, $z] = $anchor === null
            ? TankGeometry::plantColumn($plant->rootX, $plant->layer, $state->layerCount, $state->gridWidth, $state->gridDepth)
            : [$anchor[0], $anchor[2]];

        $heightCm = $plant->segments * $state->speciesOf($plant)->number('render.segment_height', 0.05) * self::PLANT_HEIGHT_UNIT_CM;
        $y = min($state->gridHeight, $plant->rootHeight + $heightCm * TankGeometry::CELLS_PER_CM);

        return [$x + 0.5, $y, $z + 0.5];
    }
}
