<?php

namespace App\Http\Resources;

use App\Simulation\LightDefinition;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * A light fixture in the catalogue.
 *
 * @mixin LightDefinition
 */
class LightDefinitionResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'slug' => $this->slug,
            'name' => $this->name,
            'description' => $this->description,
            'is_tube' => $this->isTube,
            'beam_angle' => $this->beamAngle,
            'default_colour' => $this->defaultColour,
            'min_length' => $this->minLength,
        ];
    }
}
