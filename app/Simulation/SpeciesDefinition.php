<?php

namespace App\Simulation;

use App\Enums\BreedingMode;
use App\Enums\Habitat;
use App\Enums\SpeciesKind;
use Illuminate\Support\Arr;

/**
 * Immutable view of a species' simulation parameters.
 */
final readonly class SpeciesDefinition
{
    /**
     * @param  array<string, mixed>  $params
     */
    public function __construct(
        public int $id,
        public string $slug,
        public SpeciesKind $kind,
        public string $name,
        public array $params,
    ) {}

    /**
     * Read a parameter using "dot" notation.
     */
    public function param(string $key, mixed $default = null): mixed
    {
        return Arr::get($this->params, $key, $default);
    }

    /**
     * Read a numeric parameter using "dot" notation.
     */
    public function number(string $key, float $default = 0.0): float
    {
        return (float) $this->param($key, $default);
    }

    public function habitat(): Habitat
    {
        return Habitat::fromParams($this->params);
    }

    public function breedingMode(): BreedingMode
    {
        return BreedingMode::from($this->param('breeding.mode', BreedingMode::None->value));
    }

    /**
     * How far a value lies outside the species' tolerated range (0 when inside).
     */
    public function distanceOutside(string $rangeKey, float $value): float
    {
        [$min, $max] = $this->param($rangeKey, [-INF, INF]);

        return max(0.0, $min - $value, $value - $max);
    }
}
