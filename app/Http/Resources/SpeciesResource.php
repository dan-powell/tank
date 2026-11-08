<?php

namespace App\Http\Resources;

use App\Enums\Habitat;
use App\Enums\PlantAnchorage;
use App\Enums\SpeciesKind;
use App\Models\Species;
use App\Simulation\SpeciesCatalogue;
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
            'habitat' => Habitat::fromParams($this->params),
            'anchorage' => $this->kind === SpeciesKind::Plant ? PlantAnchorage::fromParams($this->params) : null,
            'render' => SpeciesCatalogue::render($this->slug) ?? $this->params['render'] ?? [],
        ];
    }
}
