<?php

namespace App\Http\Resources;

use App\Models\Creature;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Creature
 */
class CreatureResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'species_id' => $this->species_id,
            'nickname' => $this->nickname,
            'sex' => $this->sex,
            'size' => round($this->size, 2),
            'hunger' => round($this->hunger, 2),
            'health' => round($this->health, 2),
            'age_days' => round($this->age_seconds / 86400, 1),
            'is_pregnant' => $this->gestation_seconds !== null,
            'generation' => $this->generation,
            'zone' => [
                'center' => [round($this->zone_x, 3), round($this->zone_y, 3), round($this->zone_z, 3)],
                'radius' => round($this->zone_radius, 3),
            ],
        ];
    }
}
