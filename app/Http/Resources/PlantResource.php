<?php

namespace App\Http\Resources;

use App\Models\Plant;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Plant
 */
class PlantResource extends JsonResource
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
            'root' => [round($this->root_x, 3), round($this->root_y, 3), round($this->root_z, 3)],
            'size' => round($this->size, 2),
            'segments' => $this->segments,
            'health' => round($this->health, 2),
        ];
    }
}
