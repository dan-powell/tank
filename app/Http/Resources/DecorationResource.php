<?php

namespace App\Http\Resources;

use App\Models\Decoration;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * A placed decoration. Positions are grid cells (see TankGeometry).
 *
 * @mixin Decoration
 */
class DecorationResource extends JsonResource
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
            'type' => $this->type,
            'position' => [$this->x, $this->y, $this->z],
            'rotation' => $this->rotation,
            'seed' => $this->seed,
        ];
    }
}
