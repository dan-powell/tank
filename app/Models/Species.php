<?php

namespace App\Models;

use App\Enums\SpeciesKind;
use Database\Factories\SpeciesFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * A catalogue entry describing a kind of plant or animal and its simulation parameters.
 *
 * @property int $id
 * @property string $slug
 * @property SpeciesKind $kind
 * @property string $name
 * @property string|null $scientific_name
 * @property string $behaviour
 * @property string|null $description
 * @property array<string, mixed> $params
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable(['slug', 'kind', 'name', 'scientific_name', 'behaviour', 'description', 'params'])]
class Species extends Model
{
    /** @use HasFactory<SpeciesFactory> */
    use HasFactory;

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
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'kind' => SpeciesKind::class,
            'params' => 'array',
        ];
    }
}
