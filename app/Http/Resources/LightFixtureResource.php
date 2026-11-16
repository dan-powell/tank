<?php

namespace App\Http\Resources;

use App\Models\LightFixture;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * A light on the gantry. `column`, `row` and `length` are gantry slots;
 * times are minutes of the simulated day.
 *
 * @mixin LightFixture
 */
class LightFixtureResource extends JsonResource
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
            'column' => $this->column,
            'row' => $this->row,
            'length' => $this->length,
            'colour' => $this->colour,
            'brightness' => $this->brightness,
            'on_minute' => $this->on_minute,
            'off_minute' => $this->off_minute,
            'ramp_minutes' => $this->ramp_minutes,
        ];
    }
}
