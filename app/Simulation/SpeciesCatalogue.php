<?php

namespace App\Simulation;

use App\Enums\BreedingMode;
use App\Enums\SpeciesKind;
use App\Models\Species;

/**
 * The built-in species and their tuned simulation parameters.
 *
 * Units: sizes in cm (fauna) or biomass units (plants); rates per hour unless
 * named otherwise; oxygen_use and bioload in mg per hour for an adult;
 * diet maps each food source to the amount that fully satisfies an adult
 * (food/detritus in grams, algae in % coverage). Zones and positions are
 * normalised to 0..1 of the tank (y = height above the substrate).
 */
final class SpeciesCatalogue
{
    /**
     * @return array<string, array{kind: SpeciesKind, name: string, scientific_name: string, behaviour: string, description: string, params: array<string, mixed>}>
     */
    public static function definitions(): array
    {
        return [
            'vallisneria' => [
                'kind' => SpeciesKind::Plant,
                'name' => 'Vallisneria',
                'scientific_name' => 'Vallisneria spiralis',
                'behaviour' => 'ribbon',
                'description' => 'Tall, grass-like ribbons that spread by runners. A strong nitrate consumer.',
                'params' => [
                    'temperature' => [18, 30],
                    'growth_per_hour' => 0.02,
                    'max_size' => 6,
                    'segments_per_size' => 2,
                    'nitrate_per_size' => 20,
                    'upkeep_nitrate_per_hour' => 0.05,
                    'algae_competition' => 1.0,
                    'max_per_100l' => 25,
                    'spread' => ['chance_per_day' => 0.15, 'radius' => 0.12, 'offshoot_size' => 0.3],
                    'starting_size' => 2.0,
                    'render' => ['color' => '#4f9d3a', 'segment_height' => 0.07, 'blades' => 4],
                ],
            ],
            'hornwort' => [
                'kind' => SpeciesKind::Plant,
                'name' => 'Hornwort',
                'scientific_name' => 'Ceratophyllum demersum',
                'behaviour' => 'whorl',
                'description' => 'Fast-growing bushy stems that soak up nutrients and starve out algae.',
                'params' => [
                    'temperature' => [15, 30],
                    'growth_per_hour' => 0.035,
                    'max_size' => 8,
                    'segments_per_size' => 2,
                    'nitrate_per_size' => 25,
                    'upkeep_nitrate_per_hour' => 0.05,
                    'algae_competition' => 1.5,
                    'max_per_100l' => 15,
                    'spread' => ['chance_per_day' => 0.1, 'radius' => 0.2, 'offshoot_size' => 0.5],
                    'starting_size' => 2.5,
                    'render' => ['color' => '#2f7a3b', 'segment_height' => 0.05],
                ],
            ],
            'guppy' => [
                'kind' => SpeciesKind::Fish,
                'name' => 'Guppy',
                'scientific_name' => 'Poecilia reticulata',
                'behaviour' => 'swimmer',
                'description' => 'Colourful livebearers that roam the upper water and breed readily. Adults will eat fry.',
                'params' => [
                    'temperature' => [22, 28],
                    'ph' => [6.8, 7.9],
                    'adult_size' => 3.5,
                    'birth_size' => 0.6,
                    'growth_per_day' => 0.08,
                    'hunger_per_hour' => 0.04,
                    'diet' => ['food' => 0.02],
                    'feeding_order' => 1,
                    'bioload' => 0.05,
                    'solid_waste' => 0.0005,
                    'oxygen_use' => 0.4,
                    'sensitivity' => 1.0,
                    'maturity_days' => 30,
                    'lifespan_days' => 540,
                    'max_per_100l' => 30,
                    'eats_fry' => true,
                    'breeding' => [
                        'mode' => BreedingMode::Livebearer->value,
                        'chance_per_day' => 0.3,
                        'gestation_days' => 21,
                        'brood' => [3, 8],
                    ],
                    'zone' => ['y' => [0.45, 0.9], 'radius' => 0.25],
                    'render' => ['body' => '#b8c2cc', 'colorful_tail' => true, 'schooling' => 0.3, 'speed' => 0.35, 'layer_roam' => 0.25],
                ],
            ],
            'corydoras' => [
                'kind' => SpeciesKind::Fish,
                'name' => 'Corydoras',
                'scientific_name' => 'Corydoras paleatus',
                'behaviour' => 'bottom_dweller',
                'description' => 'Peaceful catfish that shoal along the substrate, cleaning up sunken food and detritus.',
                'params' => [
                    'temperature' => [20, 27],
                    'ph' => [6.2, 7.8],
                    'adult_size' => 5.5,
                    'birth_size' => 0.8,
                    'growth_per_day' => 0.05,
                    'hunger_per_hour' => 0.03,
                    'diet' => ['food' => 0.04, 'detritus' => 0.3],
                    'feeding_order' => 2,
                    'bioload' => 0.07,
                    'solid_waste' => 0.0008,
                    'oxygen_use' => 0.5,
                    'sensitivity' => 1.2,
                    'maturity_days' => 60,
                    'lifespan_days' => 1500,
                    'max_per_100l' => 12,
                    'breeding' => [
                        'mode' => BreedingMode::EggLayer->value,
                        'chance_per_day' => 0.05,
                        'brood' => [2, 6],
                    ],
                    'zone' => ['y' => [0.02, 0.08], 'radius' => 0.35],
                    'render' => ['body' => '#c9b28f', 'schooling' => 0.6, 'speed' => 0.2, 'layer_roam' => 0.1],
                ],
            ],
            'nerite-snail' => [
                'kind' => SpeciesKind::Invertebrate,
                'name' => 'Nerite Snail',
                'scientific_name' => 'Neritina natalensis',
                'behaviour' => 'crawler',
                'description' => 'A tireless algae grazer. Cannot breed in fresh water.',
                'params' => [
                    'temperature' => [20, 28],
                    'ph' => [7.0, 8.4],
                    'adult_size' => 2.0,
                    'birth_size' => 0.4,
                    'growth_per_day' => 0.03,
                    'hunger_per_hour' => 0.02,
                    'diet' => ['algae' => 0.4, 'detritus' => 0.1],
                    'feeding_order' => 3,
                    'bioload' => 0.02,
                    'solid_waste' => 0.0003,
                    'oxygen_use' => 0.1,
                    'sensitivity' => 0.8,
                    'maturity_days' => 90,
                    'lifespan_days' => 900,
                    'max_per_100l' => 10,
                    'breeding' => ['mode' => BreedingMode::None->value],
                    'zone' => ['y' => [0.0, 0.03], 'radius' => 0.5],
                    'render' => ['shell' => '#6b4f2a', 'stripe' => '#e0b84a', 'speed' => 0.03, 'layer_roam' => 0.05],
                ],
            ],
        ];
    }

    /**
     * Find a catalogue species, creating its database record on first use.
     */
    public static function resolve(string $slug): Species
    {
        return Species::query()->firstOrCreate(['slug' => $slug], self::definitions()[$slug]);
    }

    /**
     * Create or update every catalogue species in the database.
     */
    public static function sync(): void
    {
        foreach (self::definitions() as $slug => $definition) {
            Species::query()->updateOrCreate(['slug' => $slug], $definition);
        }
    }
}
