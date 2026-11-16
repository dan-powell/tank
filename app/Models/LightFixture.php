<?php

namespace App\Models;

use App\Simulation\LightCatalogue;
use App\Simulation\LightDefinition;
use Database\Factories\LightFixtureFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * A light hanging from a tank's gantry (see Gantry).
 *
 * It occupies `length` slots of one row from `column` rightwards. Its timer
 * runs from `on_minute` to `off_minute` of the simulated day (wrapping past
 * midnight when off comes before on), ramping over `ramp_minutes`.
 *
 * @property int $id
 * @property int $tank_id
 * @property string $type Catalogue slug.
 * @property int $column
 * @property int $row
 * @property int $length
 * @property string $colour #rrggbb
 * @property int $brightness Percent.
 * @property int $on_minute
 * @property int $off_minute
 * @property int $ramp_minutes
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable(['type', 'column', 'row', 'length', 'colour', 'brightness', 'on_minute', 'off_minute', 'ramp_minutes'])]
class LightFixture extends Model
{
    /** @use HasFactory<LightFixtureFactory> */
    use HasFactory;

    /**
     * @return BelongsTo<Tank, $this>
     */
    public function tank(): BelongsTo
    {
        return $this->belongsTo(Tank::class);
    }

    public function definition(): LightDefinition
    {
        return LightCatalogue::find($this->type);
    }

    /**
     * Whether this fixture shares a gantry slot with a fixture at the given slots.
     */
    public function overlaps(int $column, int $row, int $length): bool
    {
        return $this->row === $row
            && $this->column < $column + $length
            && $column < $this->column + $this->length;
    }

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'column' => 'integer',
            'row' => 'integer',
            'length' => 'integer',
            'brightness' => 'integer',
            'on_minute' => 'integer',
            'off_minute' => 'integer',
            'ramp_minutes' => 'integer',
        ];
    }
}
