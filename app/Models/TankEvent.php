<?php

namespace App\Models;

use App\Enums\TankEventType;
use Database\Factories\TankEventFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * An entry in a tank's activity log (births, deaths, maintenance, warnings).
 *
 * @property int $id
 * @property int $tank_id
 * @property TankEventType $type
 * @property string $message
 * @property array<string, mixed>|null $payload
 * @property int $sim_tick
 * @property Carbon|null $created_at
 */
#[Fillable(['type', 'message', 'payload', 'sim_tick'])]
class TankEvent extends Model
{
    /** @use HasFactory<TankEventFactory> */
    use HasFactory;

    public const UPDATED_AT = null;

    /**
     * @return BelongsTo<Tank, $this>
     */
    public function tank(): BelongsTo
    {
        return $this->belongsTo(Tank::class);
    }

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'type' => TankEventType::class,
            'payload' => 'array',
            'sim_tick' => 'integer',
        ];
    }
}
