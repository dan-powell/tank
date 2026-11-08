<?php

namespace Database\Factories;

use App\Models\Species;
use App\Simulation\SpeciesCatalogue;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Species>
 */
class SpeciesFactory extends Factory
{
    /**
     * Define the model's default state: a fish based on the catalogue guppy.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return $this->fromCatalogue('guppy');
    }

    /**
     * A plant based on the catalogue Vallisneria.
     */
    public function plant(): static
    {
        return $this->state(fn (array $attributes): array => $this->fromCatalogue('vallisneria'));
    }

    /**
     * A plant that can grow on decorations as well as the substrate, based on the catalogue Hornwort.
     */
    public function decorPlant(): static
    {
        return $this->state(fn (array $attributes): array => $this->fromCatalogue('hornwort'));
    }

    /**
     * Copy a catalogue entry under a unique slug.
     *
     * @return array<string, mixed>
     */
    private function fromCatalogue(string $slug): array
    {
        return [
            ...SpeciesCatalogue::definitions()[$slug],
            'slug' => $slug.'-'.fake()->unique()->numberBetween(1, 1_000_000),
        ];
    }
}
