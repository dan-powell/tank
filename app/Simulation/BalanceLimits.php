<?php

namespace App\Simulation;

use App\Models\Creature;
use App\Models\Plant;
use App\Models\Species;
use App\Models\Tank;

/**
 * The healthy and harmful ranges of a tank's water and air, with hints on
 * bringing each back into balance.
 *
 * A value inside the `ideal` range is fine; outside it but inside `safe` it
 * needs attention; outside `safe` it is harmful and raises a warning.
 * Temperature, pH and humidity follow what the tank's living species
 * tolerate, where their ranges overlap.
 */
final readonly class BalanceLimits
{
    /** Readable names for every parameter that can go out of balance. */
    public const array LABELS = [
        'temperature' => 'Temperature',
        'ph' => 'pH',
        'ammonia' => 'Ammonia',
        'nitrite' => 'Nitrite',
        'nitrate' => 'Nitrate',
        'oxygen' => 'Oxygen',
        'algae' => 'Algae',
        'detritus' => 'Detritus',
        'humidity' => 'Humidity',
        'air_oxygen' => 'Air O₂',
        'air_co2' => 'Air CO₂',
    ];

    /** Parameters of the water itself (meaningless while the tank is empty). */
    public const array WATER_PARAMETERS = ['temperature', 'ph', 'ammonia', 'nitrite', 'nitrate', 'oxygen', 'algae', 'detritus'];

    private const array DEFAULT_TEMPERATURE = [22.0, 28.0];

    private const array DEFAULT_PH = [6.8, 7.9];

    private const array DEFAULT_HUMIDITY = [60.0, null];

    /** How far past the ideal range temperature, pH and humidity can go before they are harmful. */
    private const array SLACK = ['temperature' => 2.0, 'ph' => 0.4, 'humidity' => 20.0];

    /**
     * Ideal and safe ranges for the fixed-limit parameters, [min, max] (null = unbounded).
     *
     * @var array<string, array{ideal: array{0: ?float, 1: ?float}, safe: array{0: ?float, 1: ?float}}>
     */
    private const array FIXED = [
        'ammonia' => ['ideal' => [null, 0.25], 'safe' => [null, 0.5]],
        'nitrite' => ['ideal' => [null, 0.25], 'safe' => [null, 0.5]],
        'nitrate' => ['ideal' => [null, 25.0], 'safe' => [null, 40.0]],
        'oxygen' => ['ideal' => [5.5, null], 'safe' => [4.0, null]],
        'algae' => ['ideal' => [null, 25.0], 'safe' => [null, 50.0]],
        'detritus' => ['ideal' => [null, 2.0], 'safe' => [null, 4.0]],
        'air_oxygen' => ['ideal' => [18.0, null], 'safe' => [16.0, null]],
        'air_co2' => ['ideal' => [null, 2000.0], 'safe' => [null, 5000.0]],
    ];

    /**
     * What to do about each parameter when it is too low or too high.
     *
     * @var array<string, array{low?: string, high?: string}>
     */
    public const array HINTS = [
        'temperature' => [
            'low' => 'The heater warms the water back to its set point over a few hours. Fresh tap water is cooler, so change smaller amounts at a time.',
            'high' => 'The heater keeps the water at its set point. If your animals prefer it cooler, they may not suit this tank.',
        ],
        'ph' => [
            'low' => 'CO₂ and nitrate make the water acidic. Change some water, lift the lid so CO₂ can escape, and keep nitrate down.',
            'high' => 'Plants in bright light use up CO₂, which raises pH. Change some water or shorten the lights\' day.',
        ],
        'ammonia' => [
            'high' => 'Feed less, vacuum the gravel to clear waste, and change some water. Uncycled tanks need time for bacteria to grow.',
        ],
        'nitrite' => [
            'high' => 'Your bacteria are still catching up. Change some water and feed lightly until it falls.',
        ],
        'nitrate' => [
            'high' => 'Change some water. Plants also take nitrate up, and feeding less slows how fast it builds.',
        ],
        'oxygen' => [
            'low' => 'Keep the lights on for plants to make oxygen, lift the lid, change some water, or keep fewer animals.',
        ],
        'algae' => [
            'high' => 'Scrub the glass, shorten the lights\' day, and change some water to lower the nitrate it feeds on.',
        ],
        'detritus' => [
            'high' => 'Vacuum the gravel and feed less, so less food is left to rot.',
        ],
        'humidity' => [
            'low' => 'Put the lid on to hold moisture in, raise the water level, or add land plants.',
            'high' => 'Lift the lid to let the air dry out.',
        ],
        'air_oxygen' => [
            'low' => 'Lift the lid to let fresh air in, or add land plants and keep the lights on.',
        ],
        'air_co2' => [
            'high' => 'Lift the lid to let fresh air in, or add land plants and keep the lights on.',
        ],
    ];

    /**
     * @param  array<string, array{ideal: array{0: ?float, 1: ?float}, safe: array{0: ?float, 1: ?float}}>  $ranges
     */
    private function __construct(private array $ranges) {}

    /**
     * Limits for a tank holding the given species.
     *
     * @param  iterable<array<string, mixed>>  $speciesParams  The params of each living species.
     */
    public static function forSpecies(iterable $speciesParams): self
    {
        $temperature = self::DEFAULT_TEMPERATURE;
        $ph = self::DEFAULT_PH;
        $humidity = self::DEFAULT_HUMIDITY;
        $ranges = ['temperature' => [], 'ph' => [], 'humidity' => []];

        foreach ($speciesParams as $params) {
            foreach (array_keys($ranges) as $key) {
                if (isset($params[$key])) {
                    $ranges[$key][] = $params[$key];
                }
            }
        }

        $ideal = [
            'temperature' => self::overlap($ranges['temperature']) ?? $temperature,
            'ph' => self::overlap($ranges['ph']) ?? $ph,
            'humidity' => self::overlap($ranges['humidity']) ?? $humidity,
        ];

        // Humidity can't rise past the air's ceiling, so a range reaching it has no upper bound.
        if ($ideal['humidity'][1] !== null && $ideal['humidity'][1] >= Air::MAX_HUMIDITY) {
            $ideal['humidity'][1] = null;
        }

        $limits = self::FIXED;

        foreach ($ideal as $key => [$min, $max]) {
            $limits[$key] = [
                'ideal' => [$min, $max],
                'safe' => [
                    $min === null ? null : $min - self::SLACK[$key],
                    $max === null ? null : $max + self::SLACK[$key],
                ],
            ];
        }

        return new self($limits);
    }

    /**
     * Limits for a simulation state, from its living plants and animals.
     */
    public static function forState(TankState $state): self
    {
        $speciesIds = array_unique(array_map(
            fn (PlantState|CreatureState $entity): int => $entity->speciesId,
            [...$state->livingPlants(), ...$state->livingCreatures()],
        ));

        return self::forSpecies(array_map(fn (int $id): array => $state->species[$id]->params, $speciesIds));
    }

    /**
     * Limits for a stored tank, from its living plants and animals.
     */
    public static function forTank(Tank $tank): self
    {
        $speciesIds = [
            ...Creature::query()->whereBelongsTo($tank)->alive()->distinct()->pluck('species_id'),
            ...Plant::query()->whereBelongsTo($tank)->alive()->distinct()->pluck('species_id'),
        ];

        return self::forSpecies(Species::query()->whereIn('id', array_unique($speciesIds))->pluck('params'));
    }

    /**
     * Whether a value is harmfully `low` or `high` (outside the safe range), or null when it is safe.
     */
    public function harmful(string $parameter, float $value): ?string
    {
        return self::side($this->ranges[$parameter]['safe'], $value);
    }

    /**
     * The warning to raise when a parameter becomes harmfully low or high.
     */
    public static function warning(string $parameter, string $side): string
    {
        $label = self::LABELS[$parameter];
        $state = $side === 'low' ? 'too low' : 'too high';
        $hint = self::HINTS[$parameter][$side] ?? null;

        return $hint === null ? "{$label} is {$state}." : "{$label} is {$state}. {$hint}";
    }

    /**
     * Every parameter's ranges and hints, for the browser.
     *
     * @return array<string, array{label: string, ideal: array{0: ?float, 1: ?float}, safe: array{0: ?float, 1: ?float}, hints: array{low?: string, high?: string}}>
     */
    public function toArray(): array
    {
        $limits = [];

        foreach (self::LABELS as $key => $label) {
            $limits[$key] = [
                'label' => $label,
                ...$this->ranges[$key],
                'hints' => self::HINTS[$key] ?? [],
            ];
        }

        return $limits;
    }

    /**
     * @param  array{0: ?float, 1: ?float}  $range
     */
    private static function side(array $range, float $value): ?string
    {
        [$min, $max] = $range;

        return match (true) {
            $min !== null && $value < $min => 'low',
            $max !== null && $value > $max => 'high',
            default => null,
        };
    }

    /**
     * The range every species tolerates, or null when there is none.
     *
     * @param  list<array{0: float|int, 1: float|int}>  $ranges
     * @return array{0: float, 1: float}|null
     */
    private static function overlap(array $ranges): ?array
    {
        if ($ranges === []) {
            return null;
        }

        $min = (float) max(array_column($ranges, 0));
        $max = (float) min(array_column($ranges, 1));

        return $min <= $max ? [$min, $max] : null;
    }
}
