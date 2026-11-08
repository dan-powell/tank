<?php

namespace App\Simulation\Systems;

use App\Enums\Habitat;
use App\Enums\PlantAnchorage;
use App\Enums\TankEventType;
use App\Simulation\PlantState;
use App\Simulation\StepContext;
use App\Simulation\TankGeometry;
use App\Simulation\TankState;

/**
 * Plants grow under light by taking up ammonia and nitrate, lose health in
 * poor conditions, and established plants spread new offshoots nearby.
 * Plants rooted where their habitat doesn't suit them (aquatic plants out of
 * the water, land plants drowned or in dry air, edge plants away from the
 * waterline) stop growing and wilt. Land plants feed on detritus in the
 * soil rather than dissolved nitrogen, and draw CO2 from the air.
 */
final class PlantGrowthSystem implements SimulationSystem
{
    /** Health lost per hour by a plant out of its habitat (dies in about two days). */
    private const float WILT_PER_HOUR = 0.02;

    /** Milligrams of nitrogen released by a gram of detritus (matches NitrogenCycleSystem). */
    private const float DETRITUS_NITROGEN_MG_PER_GRAM = 20.0;

    public function apply(TankState $state, StepContext $context): void
    {
        foreach ($state->livingPlants() as $plant) {
            $plant->ageSeconds += $context->dtSeconds;

            if (! $state->suitsPlant($plant)) {
                $plant->health = max(0.0, $plant->health - self::WILT_PER_HOUR * $context->hours);

                continue;
            }

            $this->grow($plant, $state, $context);
            $this->updateHealth($plant, $state, $context);
            $this->maybeSpread($plant, $state, $context);
        }
    }

    private function grow(PlantState $plant, TankState $state, StepContext $context): void
    {
        $species = $state->speciesOf($plant);

        if (! $state->isLit) {
            return;
        }

        $onLand = $species->habitat() === Habitat::Terrestrial;
        $nutrientFactor = $onLand
            ? $state->detritus / ($state->detritus + 0.3)
            : ($state->nitrate + $state->ammonia * 3) / ($state->nitrate + $state->ammonia * 3 + 3);
        $temperatureFactor = max(0.0, 1 - $species->distanceOutside('temperature', $state->temperature) / 5);
        $co2Factor = $species->habitat() === Habitat::Aquatic
            ? $state->co2 / ($state->co2 + 1)
            : $state->airCo2 / ($state->airCo2 + 400);
        $maxSize = $species->number('max_size', 5);

        $growth = $species->number('growth_per_hour') * $nutrientFactor * $temperatureFactor * $co2Factor
            * $plant->health * max(0.0, 1 - $plant->size / $maxSize) * $context->hours;

        $demandMg = $growth * $species->number('nitrate_per_size')
            + $plant->size * $species->number('upkeep_nitrate_per_hour') * $context->hours;
        $consumedMg = $onLand ? $this->takeSoilNitrogen($state, $demandMg) : $this->takeNitrogen($state, $demandMg);

        if ($demandMg > 0) {
            $growth *= $consumedMg / $demandMg;
        }

        $plant->size += $growth;
        $plant->segments = max(1, (int) ceil($plant->size * $species->number('segments_per_size', 2)));
    }

    /**
     * Take nitrogen for a land plant from decaying detritus. Returns milligrams taken.
     */
    private function takeSoilNitrogen(TankState $state, float $demandMg): float
    {
        $grams = min($state->detritus, $demandMg / self::DETRITUS_NITROGEN_MG_PER_GRAM);
        $state->detritus -= $grams;

        return $grams * self::DETRITUS_NITROGEN_MG_PER_GRAM;
    }

    /**
     * Remove up to the demanded mass of nitrogen, preferring ammonia (as real
     * plants do) and taking the remainder from nitrate. Returns milligrams taken.
     */
    private function takeNitrogen(TankState $state, float $demandMg): float
    {
        $fromAmmonia = min($state->ammonia * $state->volumeLitres * 0.5, $demandMg * 0.4);
        $state->ammonia -= $state->ppm($fromAmmonia);

        $fromNitrate = min($state->nitrate * $state->volumeLitres, $demandMg - $fromAmmonia);
        $state->nitrate -= $state->ppm($fromNitrate);

        return $fromAmmonia + $fromNitrate;
    }

    private function updateHealth(PlantState $plant, TankState $state, StepContext $context): void
    {
        $species = $state->speciesOf($plant);
        $damage = $species->distanceOutside('temperature', $state->temperature) * 0.02;

        if ($state->nitrate < 0.2 && $state->ammonia < 0.05) {
            $damage += 0.004;
        }

        if ($state->algae > 60) {
            $damage += 0.005;
        }

        $plant->health += $damage > 0 ? -$damage * $context->hours : 0.01 * $context->hours;
        $plant->health = min(1.0, max(0.0, $plant->health));
    }

    private function maybeSpread(PlantState $plant, TankState $state, StepContext $context): void
    {
        $species = $state->speciesOf($plant);
        $offshootSize = $species->number('spread.offshoot_size', 0.3);

        if ($plant->size < $species->number('max_size', 5) * 0.6 || $plant->health < 0.7) {
            return;
        }

        if (! $context->chancePerDay($species->number('spread.chance_per_day'))) {
            return;
        }

        $sameSpecies = count(array_filter(
            $state->livingPlants(),
            fn (PlantState $other): bool => $other->speciesId === $plant->speciesId,
        ));

        $capacity = $species->habitat() === Habitat::Terrestrial
            ? $species->number('max_per_100cm2') * $state->landAreaCm2 / 100
            : $species->number('max_per_100l') * $state->volumeLitres / 100;

        if ($sameSpecies >= $capacity) {
            return;
        }

        $offshoot = $this->offshootPosition($plant, $state, $context);

        if ($offshoot === null) {
            return;
        }

        $plant->size -= $offshootSize;
        $state->plants[] = new PlantState(
            id: null,
            speciesId: $plant->speciesId,
            parentId: $plant->id,
            rootX: $offshoot['rootX'],
            rootY: $plant->rootY,
            layer: $offshoot['layer'],
            size: $offshootSize,
            segments: 1,
            health: 1.0,
            ageSeconds: 0,
            decorationId: $offshoot['decorationId'],
            anchorIndex: $offshoot['anchorIndex'],
            rootHeight: $offshoot['rootHeight'],
        );

        $context->emit(
            TankEventType::PlantSpread,
            "A {$species->name} has sent out a new shoot.",
            ['species_id' => $species->id],
        );
    }

    /**
     * Where a new shoot takes root: a free anchor on the same decoration for an
     * attached plant, otherwise nearby substrate that no decoration covers.
     *
     * @return array{rootX: float, layer: int, decorationId: int|null, anchorIndex: int|null, rootHeight: int}|null
     */
    private function offshootPosition(PlantState $plant, TankState $state, StepContext $context): ?array
    {
        $species = $state->speciesOf($plant);
        $habitat = $species->habitat();

        if ($plant->decorationId !== null) {
            $freeAnchors = array_values(array_filter(
                $state->freeAnchors($plant->decorationId),
                fn (int $index): bool => $state->rootSuits($habitat, $state->decorationAnchors[$plant->decorationId][$index][1]),
            ));

            if ($freeAnchors !== []) {
                $anchorIndex = $freeAnchors[(int) floor($context->between(0, count($freeAnchors) - 0.001))];
                [$x, $y, $z] = $state->decorationAnchors[$plant->decorationId][$anchorIndex];

                return [
                    'rootX' => TankGeometry::normalisedX($x, $state->gridWidth),
                    'layer' => TankGeometry::layerAt($z, $state->layerCount, $state->gridDepth),
                    'decorationId' => $plant->decorationId,
                    'anchorIndex' => $anchorIndex,
                    'rootHeight' => $y,
                ];
            }
        }

        if (! PlantAnchorage::fromParams($species->params)->allowsSubstrate()) {
            return null;
        }

        $radius = $species->number('spread.radius', 0.15);
        $angle = $context->between(0, 2 * M_PI);
        $distance = $context->between($radius * 0.3, $radius);

        $depthOffset = sin($angle) * $distance;
        $layerShift = abs($depthOffset) > $radius * 0.7 ? ($depthOffset > 0 ? 1 : -1) : 0;

        $rootX = min(0.95, max(0.05, $plant->rootX + cos($angle) * $distance));
        $layer = min($state->layerCount - 1, max(0, $plant->layer + $layerShift));

        [$x, $z] = TankGeometry::plantColumn($rootX, $layer, $state->layerCount, $state->gridWidth, $state->gridDepth);
        $rootHeight = $state->substrateHeightAt($x, $z);

        if ($state->isSubstrateCovered($rootX, $layer) || ! $state->rootSuits($habitat, $rootHeight)) {
            return null;
        }

        return [
            'rootX' => $rootX,
            'layer' => $layer,
            'decorationId' => null,
            'anchorIndex' => null,
            'rootHeight' => $rootHeight,
        ];
    }
}
