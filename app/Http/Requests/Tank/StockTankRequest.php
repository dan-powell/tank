<?php

namespace App\Http\Requests\Tank;

use App\Enums\PlantAnchorage;
use App\Enums\SpeciesKind;
use App\Models\Decoration;
use App\Models\Species;
use App\Models\Tank;
use App\Simulation\TankGeometry;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;
use LogicException;

class StockTankRequest extends FormRequest
{
    /**
     * Get the validation rules that apply to the request. A plant may be
     * attached to one of a decoration's anchors instead of the substrate.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'species_id' => ['required', 'integer', 'exists:species,id'],
            'quantity' => ['required', 'integer', 'between:1,5'],
            'decoration_id' => [
                'nullable',
                'integer',
                Rule::exists('decorations', 'id')->where('tank_id', $this->tank()->id),
            ],
            'anchor' => ['required_with:decoration_id', 'nullable', 'integer', 'min:0'],
        ];
    }

    /**
     * Reject stocking beyond the tank's hard entity limits, and invalid attachments.
     *
     * @return array<int, Closure(Validator): void>
     */
    public function after(): array
    {
        return [
            function (Validator $validator): void {
                if ($validator->errors()->isNotEmpty()) {
                    return;
                }

                $tank = $this->tank();
                $species = $this->species();
                $isPlant = $species->kind === SpeciesKind::Plant;

                $living = $isPlant
                    ? $tank->plants()->alive()->count()
                    : $tank->creatures()->alive()->count();
                $limit = config($isPlant ? 'simulation.max_plants_per_tank' : 'simulation.max_creatures_per_tank');

                if ($living + $this->integer('quantity') > $limit) {
                    $validator->errors()->add('quantity', __('This tank cannot hold any more :kind.', [
                        'kind' => $isPlant ? 'plants' : 'animals',
                    ]));
                }

                $decoration = $this->decoration();

                if ($decoration === null) {
                    if ($isPlant && ! PlantAnchorage::fromParams($species->params)->allowsSubstrate()) {
                        $validator->errors()->add('decoration_id', __(':name must be attached to a decoration.', ['name' => $species->name]));
                    }

                    return;
                }

                $this->validateAttachment($validator, $tank, $species, $decoration);
            },
        ];
    }

    public function species(): Species
    {
        return Species::query()->findOrFail($this->integer('species_id'));
    }

    public function decoration(): ?Decoration
    {
        return $this->filled('decoration_id')
            ? $this->tank()->decorations()->findOrFail($this->integer('decoration_id'))
            : null;
    }

    public function anchor(): ?int
    {
        return $this->filled('anchor') ? $this->integer('anchor') : null;
    }

    public function tank(): Tank
    {
        $tank = $this->route('tank');

        if (! $tank instanceof Tank) {
            throw new LogicException('StockTankRequest requires a bound {tank} route parameter.');
        }

        return $tank;
    }

    private function validateAttachment(Validator $validator, Tank $tank, Species $species, Decoration $decoration): void
    {
        $anchor = $this->integer('anchor');

        if ($species->kind !== SpeciesKind::Plant || ! PlantAnchorage::fromParams($species->params)->allowsDecor()) {
            $validator->errors()->add('decoration_id', __(':name cannot grow on decorations.', ['name' => $species->name]));
        } elseif ($this->integer('quantity') !== 1) {
            $validator->errors()->add('quantity', __('Only one plant fits on each anchor.'));
        } elseif ($anchor >= count($decoration->definition()->anchors)) {
            $validator->errors()->add('anchor', __('That decoration has no such anchor.'));
        } elseif ($decoration->plants()->alive()->where('anchor_index', $anchor)->exists()) {
            $validator->errors()->add('anchor', __('Something is already growing there.'));
        } elseif (! TankGeometry::isSubmerged($tank, TankGeometry::anchorCell($decoration, $anchor)[1])) {
            $validator->errors()->add('anchor', __('That spot is above the water.'));
        }
    }
}
