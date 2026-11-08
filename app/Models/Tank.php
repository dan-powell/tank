<?php

namespace App\Models;

use App\Enums\Habitat;
use App\Enums\TankEventType;
use Database\Factories\TankFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Scope;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * A user's persistent aquarium and its water chemistry.
 *
 * Concentrations (ammonia, nitrite, nitrate, oxygen, co2) are in mg/L (ppm),
 * detritus and uneaten food in grams, algae as percentage coverage (0-100)
 * and bacteria as nitrifying capacity in ppm processed per hour.
 *
 * @property int $id
 * @property int $user_id
 * @property string $name
 * @property int $volume_litres Water held, derived from the dimensions (see TankGeometry::waterLitres()).
 * @property int $grid_width Interior width in 0.2 cm grid cells.
 * @property int $grid_height Interior height (glass floor to rim) in grid cells.
 * @property int $grid_depth Interior depth in grid cells.
 * @property int $water_level First grid cell row above the water (at or below the substrate when empty).
 * @property int $layer_count Number of depth layers the tank is divided into.
 * @property list<int>|null $substrate_heights Substrate depth per heightmap column, in grid cells (null = flat; see TankGeometry).
 * @property float $temperature
 * @property float $target_temperature
 * @property float $ph
 * @property float $ammonia
 * @property float $nitrite
 * @property float $nitrate
 * @property float $oxygen
 * @property float $co2
 * @property float $detritus
 * @property float $uneaten_food
 * @property float $algae
 * @property float $bacteria
 * @property float $humidity Relative humidity of the air above the water, %.
 * @property float $air_oxygen Oxygen in the air above the water, % by volume.
 * @property float $air_co2 CO2 in the air above the water, ppm.
 * @property bool $light_on
 * @property bool $is_sealed Whether the lid is sealed, cutting the tank off from the room.
 * @property string $background_colour Backdrop behind the tank as #rrggbb (the top of a gradient).
 * @property string|null $background_gradient_colour Bottom of the backdrop's gradient as #rrggbb (null = solid).
 * @property bool $auto_feeder_installed
 * @property int $auto_feeder_feeds_per_day
 * @property bool $auto_feeder_unlimited
 * @property int $auto_feeder_portions
 * @property bool $is_active
 * @property int $sim_tick
 * @property int $sim_seconds
 * @property int $rng_seed
 * @property Carbon|null $last_simulated_at
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable([
    'name', 'volume_litres', 'grid_width', 'grid_height', 'grid_depth', 'water_level', 'layer_count', 'substrate_heights', 'temperature', 'target_temperature', 'ph', 'ammonia', 'nitrite',
    'nitrate', 'oxygen', 'co2', 'detritus', 'uneaten_food', 'algae', 'bacteria', 'humidity', 'air_oxygen',
    'air_co2', 'light_on', 'is_sealed', 'background_colour', 'background_gradient_colour',
    'auto_feeder_installed', 'auto_feeder_feeds_per_day', 'auto_feeder_unlimited', 'auto_feeder_portions',
    'is_active', 'sim_tick', 'sim_seconds', 'rng_seed', 'last_simulated_at',
])]
class Tank extends Model
{
    /** @use HasFactory<TankFactory> */
    use HasFactory;

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @return HasMany<Plant, $this>
     */
    public function plants(): HasMany
    {
        return $this->hasMany(Plant::class);
    }

    /**
     * @return HasMany<Creature, $this>
     */
    public function creatures(): HasMany
    {
        return $this->hasMany(Creature::class);
    }

    /**
     * @return HasMany<Decoration, $this>
     */
    public function decorations(): HasMany
    {
        return $this->hasMany(Decoration::class);
    }

    /**
     * @return HasMany<TankEvent, $this>
     */
    public function events(): HasMany
    {
        return $this->hasMany(TankEvent::class);
    }

    /**
     * Whether any living animal here needs to live in the water.
     */
    public function hasAquaticAnimals(): bool
    {
        return $this->creatures()->alive()->with('species')->get()
            ->contains(fn (Creature $creature): bool => Habitat::fromParams($creature->species->params) === Habitat::Aquatic);
    }

    /**
     * Record an entry in the tank's event log.
     *
     * @param  array<string, mixed>  $payload
     */
    public function recordEvent(TankEventType $type, string $message, array $payload = []): TankEvent
    {
        return $this->events()->create([
            'type' => $type,
            'message' => $message,
            'payload' => $payload ?: null,
            'sim_tick' => $this->sim_tick,
        ]);
    }

    /**
     * Scope to tanks that the simulation should keep processing.
     *
     * @param  Builder<Tank>  $query
     */
    #[Scope]
    protected function active(Builder $query): void
    {
        $query->where('is_active', true);
    }

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'volume_litres' => 'integer',
            'grid_width' => 'integer',
            'grid_height' => 'integer',
            'grid_depth' => 'integer',
            'water_level' => 'integer',
            'layer_count' => 'integer',
            'substrate_heights' => 'array',
            'temperature' => 'float',
            'target_temperature' => 'float',
            'ph' => 'float',
            'ammonia' => 'float',
            'nitrite' => 'float',
            'nitrate' => 'float',
            'oxygen' => 'float',
            'co2' => 'float',
            'detritus' => 'float',
            'uneaten_food' => 'float',
            'algae' => 'float',
            'bacteria' => 'float',
            'humidity' => 'float',
            'air_oxygen' => 'float',
            'air_co2' => 'float',
            'is_sealed' => 'boolean',
            'light_on' => 'boolean',
            'auto_feeder_installed' => 'boolean',
            'auto_feeder_feeds_per_day' => 'integer',
            'auto_feeder_unlimited' => 'boolean',
            'auto_feeder_portions' => 'integer',
            'is_active' => 'boolean',
            'sim_tick' => 'integer',
            'sim_seconds' => 'integer',
            'rng_seed' => 'integer',
            'last_simulated_at' => 'datetime',
        ];
    }
}
