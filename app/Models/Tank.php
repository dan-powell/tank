<?php

namespace App\Models;

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
 * @property int $volume_litres
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
 * @property bool $light_on
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
    'name', 'volume_litres', 'temperature', 'target_temperature', 'ph', 'ammonia', 'nitrite',
    'nitrate', 'oxygen', 'co2', 'detritus', 'uneaten_food', 'algae', 'bacteria', 'light_on',
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
     * @return HasMany<TankEvent, $this>
     */
    public function events(): HasMany
    {
        return $this->hasMany(TankEvent::class);
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
