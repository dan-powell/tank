<?php

namespace App\Models;

use Database\Factories\PlantFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Scope;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * A rooted plant. Root coordinates are normalised to 0..1 within the tank.
 * A plant attached to a decoration grows from one of its anchors instead,
 * and its root and layer only matter if it is later dropped to the substrate.
 *
 * @property int $id
 * @property int $tank_id
 * @property int $species_id
 * @property int|null $parent_id
 * @property string|null $nickname
 * @property float $root_x
 * @property float $root_y
 * @property int $layer Depth layer the plant is rooted in (0 = back glass).
 * @property int|null $decoration_id
 * @property int|null $anchor_index Which of the decoration's anchors the plant grows from.
 * @property float $size
 * @property int $segments
 * @property float $health
 * @property int $age_seconds
 * @property Carbon|null $died_at
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable([
    'species_id', 'parent_id', 'nickname', 'root_x', 'root_y', 'layer', 'decoration_id', 'anchor_index', 'size', 'segments', 'health',
    'age_seconds', 'died_at',
])]
class Plant extends Model
{
    /** @use HasFactory<PlantFactory> */
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
     * @return BelongsTo<Decoration, $this>
     */
    public function decoration(): BelongsTo
    {
        return $this->belongsTo(Decoration::class);
    }

    /**
     * @return BelongsTo<Plant, $this>
     */
    public function parent(): BelongsTo
    {
        return $this->belongsTo(Plant::class, 'parent_id');
    }

    /**
     * Scope to plants that are still alive.
     *
     * @param  Builder<Plant>  $query
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
            'root_x' => 'float',
            'root_y' => 'float',
            'layer' => 'integer',
            'decoration_id' => 'integer',
            'anchor_index' => 'integer',
            'size' => 'float',
            'segments' => 'integer',
            'health' => 'float',
            'age_seconds' => 'integer',
            'died_at' => 'datetime',
        ];
    }
}
