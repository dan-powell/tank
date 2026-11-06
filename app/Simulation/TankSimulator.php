<?php

namespace App\Simulation;

use App\Simulation\Systems\AlgaeSystem;
use App\Simulation\Systems\FeedingSystem;
use App\Simulation\Systems\HealthSystem;
use App\Simulation\Systems\LightingSystem;
use App\Simulation\Systems\MetabolismSystem;
use App\Simulation\Systems\MortalitySystem;
use App\Simulation\Systems\NitrogenCycleSystem;
use App\Simulation\Systems\PhotosynthesisSystem;
use App\Simulation\Systems\PlantGrowthSystem;
use App\Simulation\Systems\ReproductionSystem;
use App\Simulation\Systems\SimulationSystem;
use App\Simulation\Systems\WarningSystem;
use App\Simulation\Systems\WaterQualitySystem;
use Random\Engine\Xoshiro256StarStar;
use Random\Randomizer;

/**
 * Advances a tank through simulated time by running each system in order.
 *
 * Pure and deterministic: no database or framework access, and the random
 * source for each step is seeded from the tank's seed and tick number.
 */
final class TankSimulator
{
    /**
     * @param  list<SimulationSystem>  $systems
     */
    public function __construct(
        private readonly array $systems,
        private readonly int $maxStepSeconds = 300,
        private readonly int $maxSteps = 1440,
    ) {}

    /**
     * The standard ecosystem pipeline, in execution order.
     *
     * @return list<SimulationSystem>
     */
    public static function defaultSystems(): array
    {
        return [
            new LightingSystem,
            new WaterQualitySystem,
            new NitrogenCycleSystem,
            new PhotosynthesisSystem,
            new PlantGrowthSystem,
            new AlgaeSystem,
            new MetabolismSystem,
            new FeedingSystem,
            new HealthSystem,
            new ReproductionSystem,
            new MortalitySystem,
            new WarningSystem,
        ];
    }

    /**
     * Simulate the given number of seconds, split into bounded steps.
     */
    public function advance(TankState $state, int $simSeconds): SimulationResult
    {
        $working = $state->copy();

        if ($simSeconds <= 0) {
            return new SimulationResult($working, [], 0, 0);
        }

        $steps = min($this->maxSteps, (int) ceil($simSeconds / $this->maxStepSeconds));
        $dtSeconds = intdiv(min($simSeconds, $steps * $this->maxStepSeconds), $steps);
        $events = [];

        for ($i = 0; $i < $steps; $i++) {
            array_push($events, ...$this->step($working, $dtSeconds));
        }

        return new SimulationResult($working, $events, $steps, $steps * $dtSeconds);
    }

    /**
     * Run a single step in place.
     *
     * @return list<SimEvent>
     */
    private function step(TankState $state, int $dtSeconds): array
    {
        $context = new StepContext($dtSeconds, $this->randomFor($state), $state->copy());

        foreach ($this->systems as $system) {
            $system->apply($state, $context);
        }

        $state->normalise();
        $state->simTick++;
        $state->simSeconds += $dtSeconds;

        return $context->events();
    }

    private function randomFor(TankState $state): Randomizer
    {
        $seed = hash('xxh3', $state->rngSeed.':'.$state->simTick, true);

        return new Randomizer(new Xoshiro256StarStar(str_repeat($seed, 4)));
    }
}
