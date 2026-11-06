<?php

namespace Tests\Unit\Simulation\Systems;

use App\Enums\Sex;
use App\Enums\TankEventType;
use App\Simulation\CreatureState;
use App\Simulation\Systems\ReproductionSystem;
use PHPUnit\Framework\TestCase;
use Tests\Unit\Simulation\BuildsSimulationState;

class ReproductionSystemTest extends TestCase
{
    use BuildsSimulationState;

    public function test_pregnant_livebearer_gives_birth_when_gestation_completes(): void
    {
        $mother = $this->creature('guppy', ['id' => 1, 'sex' => Sex::Female, 'gestationSeconds' => 21 * 86400 - 60]);
        $father = $this->creature('guppy', ['id' => 2, 'sex' => Sex::Male]);
        $state = $this->tankState(['creatures' => [$mother, $father]]);
        $context = $this->context($state);

        (new ReproductionSystem)->apply($state, $context);

        $fry = array_slice($state->creatures, 2);
        $this->assertGreaterThanOrEqual(3, count($fry));
        $this->assertNull($mother->gestationSeconds);
        $this->assertSame(1, $fry[0]->motherId);
        $this->assertSame(2, $fry[0]->fatherId);
        $this->assertSame(2, $fry[0]->generation);
        $this->assertSame(0.6, $fry[0]->size);
        $this->assertSame(TankEventType::Birth, $context->events()[0]->type);
    }

    public function test_female_conceives_when_a_mature_male_is_present(): void
    {
        $female = $this->creature('guppy', ['sex' => Sex::Female, 'hunger' => 0.1]);
        $male = $this->creature('guppy', ['sex' => Sex::Male]);
        $state = $this->tankState([
            'species' => $this->catalogue(['guppy' => ['breeding' => ['chance_per_day' => 10_000]]]),
            'creatures' => [$female, $male],
        ]);

        (new ReproductionSystem)->apply($state, $this->context($state));

        $this->assertSame(0, $female->gestationSeconds);
    }

    public function test_female_does_not_conceive_without_a_male(): void
    {
        $female = $this->creature('guppy', ['sex' => Sex::Female, 'hunger' => 0.1]);
        $state = $this->tankState([
            'species' => $this->catalogue(['guppy' => ['breeding' => ['chance_per_day' => 10_000]]]),
            'creatures' => [$female],
        ]);

        (new ReproductionSystem)->apply($state, $this->context($state));

        $this->assertNull($female->gestationSeconds);
    }

    public function test_births_stop_at_the_population_cap(): void
    {
        $mother = $this->creature('guppy', ['sex' => Sex::Female, 'gestationSeconds' => 21 * 86400]);
        $males = array_map(fn (): CreatureState => $this->creature('guppy', ['sex' => Sex::Male]), range(1, 17));
        $state = $this->tankState(['creatures' => [$mother, ...$males]]);

        (new ReproductionSystem)->apply($state, $this->context($state));

        $this->assertCount(18, $state->creatures);
    }

    public function test_egg_layers_hatch_a_brood_when_a_pair_spawns(): void
    {
        $female = $this->creature('corydoras', ['sex' => Sex::Female, 'hunger' => 0.1]);
        $male = $this->creature('corydoras', ['sex' => Sex::Male]);
        $state = $this->tankState([
            'species' => $this->catalogue(['corydoras' => ['breeding' => ['chance_per_day' => 10_000]]]),
            'creatures' => [$female, $male],
        ]);

        (new ReproductionSystem)->apply($state, $this->context($state));

        $this->assertGreaterThanOrEqual(4, count($state->creatures));
    }
}
