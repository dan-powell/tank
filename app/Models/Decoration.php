<?php

namespace App\Models;

use App\Simulation\DecorationCatalogue;
use App\Simulation\DecorationDefinition;
use Database\Factories\DecorationFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * A rock, wall or ornament placed in a tank.
 *
 * Positions are decoration grid cells (see TankGeometry): x, y and z are the
 * minimum corner of the rotated model's box, and rotation is a number of
 * quarter turns about the vertical axis.
 *
 * @property int $id
 * @property int $tank_id
 * @property string $type Catalogue slug.
 * @property int $x
 * @property int $y
 * @property int $z
 * @property int $rotation
 * @property int $seed Varies generated models (rocks) between placements.
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable(['type', 'x', 'y', 'z', 'rotation', 'seed'])]
class Decoration extends Model
{
    /** @use HasFactory<DecorationFactory> */
    use HasFactory;

    /**
     * @return BelongsTo<Tank, $this>
     */
    public function tank(): BelongsTo
    {
        return $this->belongsTo(Tank::class);
    }

    /**
     * @return HasMany<Plant, $this>
     */
    public function plants(): HasMany
    {
        return $this->hasMany(Plant::class);
    }

    public function definition(): DecorationDefinition
    {
        return DecorationCatalogue::find($this->type);
    }

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'x' => 'integer',
            'y' => 'integer',
            'z' => 'integer',
            'rotation' => 'integer',
            'seed' => 'integer',
        ];
    }
}
