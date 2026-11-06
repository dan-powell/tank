<?php

namespace App\Http\Resources;

use App\Models\Species;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Species
 */
class SpeciesResource extends JsonResource
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
            'slug' => $this->slug,
            'kind' => $this->kind,
            'name' => $this->name,
            'scientific_name' => $this->scientific_name,
            'behaviour' => $this->behaviour,
            'description' => $this->description,
            'adult_size' => $this->params['adult_size'] ?? null,
            'max_size' => $this->params['max_size'] ?? null,
            'render' => $this->params['render'] ?? [],
        ];
    }
}
