<?php

namespace App\Simulation\Systems;

use App\Enums\BreedingMode;
use App\Enums\Sex;
use App\Enums\TankEventType;
use App\Simulation\CreatureState;
use App\Simulation\SpeciesDefinition;
use App\Simulation\StepContext;
use App\Simulation\TankState;

/**
 * Healthy, well-fed adults breed when a mate is present, up to a population
 * cap that scales with tank volume.
 */
final class ReproductionSystem implements SimulationSystem
{
    public function apply(TankState $state, StepContext $context): void
    {
        $bySpecies = [];

        foreach ($state->livingCreatures() as $creature) {
            $bySpecies[$creature->speciesId][] = $creature;
        }

        foreach ($bySpecies as $speciesId => $members) {
            $species = $state->species[$speciesId];

            match ($species->breedingMode()) {
                BreedingMode::Livebearer => $this->breedLivebearers($species, $members, $state, $context),
                BreedingMode::EggLayer => $this->breedEggLayers($species, $members, $state, $context),
                BreedingMode::None => null,
            };
        }
    }

    /**
     * @param  list<CreatureState>  $members
     */
    private function breedLivebearers(SpeciesDefinition $species, array $members, TankState $state, StepContext $context): void
    {
        $males = $this->matureOfSex($members, $species, Sex::Male);
        $gestationSeconds = $species->number('breeding.gestation_days') * 86400;

        foreach ($this->matureOfSex($members, $species, Sex::Female) as $female) {
            if ($female->gestationSeconds === null) {
                if ($males !== [] && $this->isInCondition($female) && $context->chancePerDay($species->number('breeding.chance_per_day'))) {
                    $female->gestationSeconds = 0;
                }

                continue;
            }

            $female->gestationSeconds += $context->dtSeconds;

            if ($female->gestationSeconds >= $gestationSeconds) {
                $female->gestationSeconds = null;
                $born = $this->giveBirth($species, $female, $males, $state, $context);

                if ($born > 0) {
                    $context->emit(
                        TankEventType::Birth,
                        $born === 1 ? "A {$species->name} gave birth to a single fry." : "A {$species->name} gave birth to {$born} fry.",
                        ['species_id' => $species->id, 'count' => $born],
                    );
                }
            }
        }
    }

    /**
     * @param  list<CreatureState>  $members
     */
    private function breedEggLayers(SpeciesDefinition $species, array $members, TankState $state, StepContext $context): void
    {
        $males = $this->matureOfSex($members, $species, Sex::Male);

        if ($males === []) {
            return;
        }

        foreach ($this->matureOfSex($members, $species, Sex::Female) as $female) {
            if (! $this->isInCondition($female) || ! $context->chancePerDay($species->number('breeding.chance_per_day'))) {
                continue;
            }

            $born = $this->giveBirth($species, $female, $males, $state, $context);

            if ($born > 0) {
                $context->emit(
                    TankEventType::Birth,
                    "{$species->name} eggs have hatched into {$born} fry.",
                    ['species_id' => $species->id, 'count' => $born],
                );
            }
        }
    }

    /**
     * Add a brood to the tank, limited by the population cap. Returns the number born.
     *
     * @param  list<CreatureState>  $males
     */
    private function giveBirth(SpeciesDefinition $species, CreatureState $mother, array $males, TankState $state, StepContext $context): int
    {
        $population = count(array_filter(
            $state->livingCreatures(),
            fn (CreatureState $creature): bool => $creature->speciesId === $species->id,
        ));
        $room = (int) floor($species->number('max_per_100l') * $state->volumeLitres / 100) - $population;
        [$min, $max] = $species->param('breeding.brood', [1, 3]);
        $brood = min($room, $context->random->getInt($min, $max));
        $father = $males === [] ? null : $males[$context->random->getInt(0, count($males) - 1)];

        for ($i = 0; $i < $brood; $i++) {
            $state->creatures[] = new CreatureState(
                id: null,
                speciesId: $species->id,
                motherId: $mother->id,
                fatherId: $father?->id,
                nickname: null,
                sex: $context->random->getInt(0, 1) === 0 ? Sex::Male : Sex::Female,
                size: $species->number('birth_size', 0.5),
                hunger: 0.3,
                health: 1.0,
                ageSeconds: 0,
                gestationSeconds: null,
                zoneX: $this->jitter($mother->zoneX, 0.1, $context),
                zoneY: $this->jitter($mother->zoneY, 0.05, $context),
                layer: $mother->layer,
                zoneRadius: $mother->zoneRadius,
                generation: $mother->generation + 1,
            );
        }

        return max(0, $brood);
    }

    /**
     * @param  list<CreatureState>  $members
     * @return list<CreatureState>
     */
    private function matureOfSex(array $members, SpeciesDefinition $species, Sex $sex): array
    {
        return array_values(array_filter(
            $members,
            fn (CreatureState $creature): bool => $creature->sex === $sex && $creature->isMature($species),
        ));
    }

    private function isInCondition(CreatureState $creature): bool
    {
        return $creature->health > 0.7 && $creature->hunger < 0.5;
    }

    private function jitter(float $value, float $amount, StepContext $context): float
    {
        return min(0.95, max(0.05, $value + $context->between(-$amount, $amount)));
    }
}
