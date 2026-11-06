<?php

namespace App\Models;

use App\Enums\Sex;
use Database\Factories\CreatureFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Scope;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * A fish or invertebrate. It has no fixed position, only a preferred zone
 * (centre and radius, normalised to 0..1) that the frontend steers it around.
 *
 * Hunger and health are both in the range 0..1 (hunger 1 = starving).
 *
 * @property int $id
 * @property int $tank_id
 * @property int $species_id
 * @property int|null $mother_id
 * @property int|null $father_id
 * @property string|null $nickname
 * @property Sex $sex
 * @property float $size
 * @property float $hunger
 * @property float $health
 * @property int $age_seconds
 * @property int|null $gestation_seconds
 * @property float $zone_x
 * @property float $zone_y
 * @property float $zone_z
 * @property float $zone_radius
 * @property int $generation
 * @property Carbon|null $died_at
 * @property string|null $death_cause
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable([
    'species_id', 'mother_id', 'father_id', 'nickname', 'sex', 'size', 'hunger', 'health',
    'age_seconds', 'gestation_seconds', 'zone_x', 'zone_y', 'zone_z', 'zone_radius', 'generation',
    'died_at', 'death_cause',
])]
class Creature extends Model
{
    /** @use HasFactory<CreatureFactory> */
    use HasFactory;

    /**
     * @return BelongsTo<Tank, $this>
     */
    public function tank(): BelongsTo
    {
        return $this->belongsTo(Tank::class);
    }

    /**
     * @return BelongsTo<Species, $this>
     */
    public function species(): BelongsTo
    {
        return $this->belongsTo(Species::class);
    }

    /**
     * @return BelongsTo<Creature, $this>
     */
    public function mother(): BelongsTo
    {
        return $this->belongsTo(Creature::class, 'mother_id');
    }

    /**
     * @return BelongsTo<Creature, $this>
     */
    public function father(): BelongsTo
    {
        return $this->belongsTo(Creature::class, 'father_id');
    }

    /**
     * Scope to creatures that are still alive.
     *
     * @param  Builder<Creature>  $query
     */
    #[Scope]
    protected function alive(Builder $query): void
    {
        $query->whereNull('died_at');
    }

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'sex' => Sex::class,
            'size' => 'float',
            'hunger' => 'float',
            'health' => 'float',
            'age_seconds' => 'integer',
            'gestation_seconds' => 'integer',
            'zone_x' => 'float',
            'zone_y' => 'float',
            'zone_z' => 'float',
            'zone_radius' => 'float',
            'generation' => 'integer',
            'died_at' => 'datetime',
        ];
    }
}
