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
 * Plant `anchorage` says where a plant can grow: `substrate`, `decor` (on a
 * decoration's anchor points) or `any`. `habitat` (see Habitat) says whether a
 * species lives in the water (the default), at its edge, on land or both;
 * land species use `humidity` (%) ranges and `max_per_100cm2` of dry land.
 * Diets may include `prey`: the number of `prey` animals that make a full meal.
 *
 * `render` is presentation only and is read from here rather than the stored
 * copy (see SpeciesResource). Animals list growth `stages` (name => smallest
 * size in cm) and `animation` frame rates per clip (`move`, `idle`); their
 * models live in resources/models/species/{slug}.vox, one MagicaVoxel object
 * per frame named `stage.clip.frame` (e.g. `adult.move.2`).
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
                    'anchorage' => 'substrate',
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
                    'anchorage' => 'any',
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
                    'render' => [
                        'body' => '#b8c2cc', 'colorful_tail' => true, 'schooling' => 0.3, 'speed' => 0.35, 'layer_roam' => 0.25,
                        'stages' => ['fry' => 0, 'juvenile' => 1.4, 'adult' => 2.8],
                        'animation' => ['move' => 8, 'idle' => 3],
                    ],
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
                    'render' => [
                        'body' => '#c9b28f', 'schooling' => 0.6, 'speed' => 0.2, 'layer_roam' => 0.1,
                        'stages' => ['fry' => 0, 'juvenile' => 2.2, 'adult' => 4.4],
                        'animation' => ['move' => 7, 'idle' => 2],
                    ],
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
                    'render' => [
                        'shell' => '#6b4f2a', 'stripe' => '#e0b84a', 'speed' => 0.03, 'layer_roam' => 0.05,
                        'stages' => ['hatchling' => 0, 'juvenile' => 0.8, 'adult' => 1.6],
                        'animation' => ['move' => 3, 'idle' => 1],
                    ],
                ],
            ],
            'cushion-moss' => [
                'kind' => SpeciesKind::Plant,
                'name' => 'Cushion Moss',
                'scientific_name' => 'Leucobryum glaucum',
                'behaviour' => 'cushion',
                'description' => 'Soft domes of moss that carpet damp gravel and rock above the water. Needs humid air.',
                'params' => [
                    'habitat' => 'terrestrial',
                    'anchorage' => 'any',
                    'temperature' => [12, 28],
                    'humidity' => [70, 100],
                    'growth_per_hour' => 0.012,
                    'max_size' => 3,
                    'segments_per_size' => 8,
                    'nitrate_per_size' => 15,
                    'upkeep_nitrate_per_hour' => 0.03,
                    'algae_competition' => 0,
                    'max_per_100cm2' => 2,
                    'spread' => ['chance_per_day' => 0.2, 'radius' => 0.08, 'offshoot_size' => 0.4],
                    'starting_size' => 1.5,
                    'render' => ['color' => '#5d8f3a'],
                ],
            ],
            'maidenhair-fern' => [
                'kind' => SpeciesKind::Plant,
                'name' => 'Maidenhair Fern',
                'scientific_name' => 'Adiantum raddianum',
                'behaviour' => 'frond',
                'description' => 'Delicate fronds on wiry stems for the land area. Wilts quickly in dry air.',
                'params' => [
                    'habitat' => 'terrestrial',
                    'anchorage' => 'substrate',
                    'temperature' => [15, 27],
                    'humidity' => [65, 100],
                    'growth_per_hour' => 0.015,
                    'max_size' => 5,
                    'segments_per_size' => 2,
                    'nitrate_per_size' => 20,
                    'upkeep_nitrate_per_hour' => 0.04,
                    'algae_competition' => 0,
                    'max_per_100cm2' => 1,
                    'spread' => ['chance_per_day' => 0.04, 'radius' => 0.1, 'offshoot_size' => 0.5],
                    'starting_size' => 2.0,
                    'render' => ['color' => '#6fa548', 'segment_height' => 0.035],
                ],
            ],
            'pothos' => [
                'kind' => SpeciesKind::Plant,
                'name' => 'Pothos',
                'scientific_name' => 'Epipremnum aureum',
                'behaviour' => 'frond',
                'description' => 'A hardy trailing plant rooted at the waterline. Its roots drink nitrate from the water.',
                'params' => [
                    'habitat' => 'emergent',
                    'anchorage' => 'any',
                    'temperature' => [16, 30],
                    'growth_per_hour' => 0.03,
                    'max_size' => 8,
                    'segments_per_size' => 2,
                    'nitrate_per_size' => 25,
                    'upkeep_nitrate_per_hour' => 0.05,
                    'algae_competition' => 1.2,
                    'max_per_100l' => 6,
                    'spread' => ['chance_per_day' => 0.08, 'radius' => 0.15, 'offshoot_size' => 0.5],
                    'starting_size' => 2.0,
                    'render' => ['color' => '#4f9a3f', 'segment_height' => 0.05],
                ],
            ],
            'dwarf-rush' => [
                'kind' => SpeciesKind::Plant,
                'name' => 'Dwarf Rush',
                'scientific_name' => 'Juncus repens',
                'behaviour' => 'ribbon',
                'description' => 'Grassy tufts for the water\'s edge, happy with wet feet or a few centimetres under.',
                'params' => [
                    'habitat' => 'emergent',
                    'anchorage' => 'substrate',
                    'temperature' => [15, 28],
                    'growth_per_hour' => 0.02,
                    'max_size' => 5,
                    'segments_per_size' => 2,
                    'nitrate_per_size' => 20,
                    'upkeep_nitrate_per_hour' => 0.04,
                    'algae_competition' => 1.0,
                    'max_per_100l' => 12,
                    'spread' => ['chance_per_day' => 0.12, 'radius' => 0.1, 'offshoot_size' => 0.3],
                    'starting_size' => 1.5,
                    'render' => ['color' => '#3f7d34', 'segment_height' => 0.06, 'blades' => 3],
                ],
            ],
            'springtail' => [
                'kind' => SpeciesKind::Invertebrate,
                'name' => 'Springtail',
                'scientific_name' => 'Folsomia candida',
                'behaviour' => 'walker',
                'description' => 'Tiny hopping soil cleaners that eat mould and detritus. They breed fast and feed larger animals.',
                'params' => [
                    'habitat' => 'terrestrial',
                    'temperature' => [15, 28],
                    'humidity' => [70, 100],
                    'adult_size' => 0.2,
                    'birth_size' => 0.05,
                    'growth_per_day' => 0.3,
                    'hunger_per_hour' => 0.03,
                    'diet' => ['detritus' => 0.002],
                    'feeding_order' => 4,
                    'bioload' => 0.001,
                    'solid_waste' => 0.00005,
                    'oxygen_use' => 0.005,
                    'sensitivity' => 1.0,
                    'maturity_days' => 14,
                    'lifespan_days' => 120,
                    'max_per_100cm2' => 8,
                    'prey' => true,
                    'breeding' => ['mode' => BreedingMode::EggLayer->value, 'chance_per_day' => 0.3, 'brood' => [3, 8]],
                    'zone' => ['y' => [0.0, 0.0], 'radius' => 0.3],
                    'render' => [
                        'body' => '#e8e4d8', 'speed' => 0.06, 'layer_roam' => 0.4,
                        'stages' => ['young' => 0, 'adult' => 0.15],
                        'animation' => ['move' => 6, 'idle' => 1],
                    ],
                ],
            ],
            'dwarf-white-isopod' => [
                'kind' => SpeciesKind::Invertebrate,
                'name' => 'Dwarf White Isopod',
                'scientific_name' => 'Trichorhina tomentosa',
                'behaviour' => 'walker',
                'description' => 'Little white woodlice that break down leaf litter and waste. A favourite snack of amphibians.',
                'params' => [
                    'habitat' => 'terrestrial',
                    'temperature' => [18, 28],
                    'humidity' => [65, 100],
                    'adult_size' => 0.4,
                    'birth_size' => 0.08,
                    'growth_per_day' => 0.12,
                    'hunger_per_hour' => 0.025,
                    'diet' => ['detritus' => 0.004],
                    'feeding_order' => 4,
                    'bioload' => 0.002,
                    'solid_waste' => 0.0001,
                    'oxygen_use' => 0.01,
                    'sensitivity' => 0.9,
                    'maturity_days' => 30,
                    'lifespan_days' => 365,
                    'max_per_100cm2' => 4,
                    'prey' => true,
                    'breeding' => ['mode' => BreedingMode::Livebearer->value, 'chance_per_day' => 0.2, 'gestation_days' => 20, 'brood' => [3, 6]],
                    'zone' => ['y' => [0.0, 0.0], 'radius' => 0.3],
                    'render' => [
                        'body' => '#f0ece0', 'speed' => 0.03, 'layer_roam' => 0.3,
                        'stages' => ['young' => 0, 'adult' => 0.3],
                        'animation' => ['move' => 6, 'idle' => 1],
                    ],
                ],
            ],
            'glass-snail' => [
                'kind' => SpeciesKind::Invertebrate,
                'name' => 'Garlic Glass-snail',
                'scientific_name' => 'Oxychilus alliarius',
                'behaviour' => 'crawler',
                'description' => 'A small land snail with a glossy amber shell that grazes on decaying matter.',
                'params' => [
                    'habitat' => 'terrestrial',
                    'temperature' => [10, 26],
                    'humidity' => [75, 100],
                    'adult_size' => 0.6,
                    'birth_size' => 0.1,
                    'growth_per_day' => 0.03,
                    'hunger_per_hour' => 0.02,
                    'diet' => ['detritus' => 0.01],
                    'feeding_order' => 4,
                    'bioload' => 0.004,
                    'solid_waste' => 0.0002,
                    'oxygen_use' => 0.02,
                    'sensitivity' => 0.9,
                    'maturity_days' => 120,
                    'lifespan_days' => 700,
                    'max_per_100cm2' => 1,
                    'breeding' => ['mode' => BreedingMode::EggLayer->value, 'chance_per_day' => 0.05, 'brood' => [2, 4]],
                    'zone' => ['y' => [0.0, 0.0], 'radius' => 0.4],
                    'render' => [
                        'shell' => '#b8a17a', 'stripe' => '#d9c79d', 'speed' => 0.015, 'layer_roam' => 0.1,
                        'stages' => ['hatchling' => 0, 'juvenile' => 0.25, 'adult' => 0.45],
                        'animation' => ['move' => 3, 'idle' => 1],
                    ],
                ],
            ],
            'fire-bellied-toad' => [
                'kind' => SpeciesKind::Amphibian,
                'name' => 'Fire-bellied Toad',
                'scientific_name' => 'Bombina orientalis',
                'behaviour' => 'amphibian',
                'description' => 'A bright little toad that swims and basks. Needs both water and land, and hunts springtails and isopods.',
                'params' => [
                    'habitat' => 'amphibious',
                    'temperature' => [18, 26],
                    'ph' => [6.5, 8.0],
                    'humidity' => [60, 100],
                    'adult_size' => 5.0,
                    'birth_size' => 1.0,
                    'growth_per_day' => 0.02,
                    'hunger_per_hour' => 0.02,
                    'diet' => ['prey' => 6, 'food' => 0.03],
                    'feeding_order' => 1,
                    'bioload' => 0.05,
                    'solid_waste' => 0.0008,
                    'oxygen_use' => 0.6,
                    'sensitivity' => 0.9,
                    'maturity_days' => 365,
                    'lifespan_days' => 3650,
                    'max_per_100cm2' => 0.15,
                    'breeding' => ['mode' => BreedingMode::EggLayer->value, 'chance_per_day' => 0.01, 'brood' => [2, 5]],
                    'zone' => ['y' => [0.0, 0.2], 'radius' => 0.4],
                    'render' => [
                        'body' => '#4a7a3a', 'stripe' => '#e0562b', 'speed' => 0.12, 'layer_roam' => 0.3,
                        'stages' => ['froglet' => 0, 'juvenile' => 2.0, 'adult' => 4.0],
                        'animation' => ['move' => 6, 'idle' => 2],
                    ],
                ],
            ],
        ];
    }

    /**
     * A catalogue species' current render settings, or null for species not in the catalogue.
     *
     * @return array<string, mixed>|null
     */
    public static function render(string $slug): ?array
    {
        return self::definitions()[$slug]['params']['render'] ?? null;
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
