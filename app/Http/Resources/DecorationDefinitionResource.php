<?php

namespace App\Http\Resources;

use App\Simulation\DecorationDefinition;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * A catalogue decoration, as the browser needs it to build and place the model.
 *
 * @mixin DecorationDefinition
 */
class DecorationDefinitionResource extends JsonResource
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
            'source' => $this->source,
            'size' => $this->size,
            'anchors' => $this->anchors,
            'params' => (object) $this->params,
        ];
    }
}
