<?php

namespace App\Http\Requests\Tank;

use App\Enums\SpeciesKind;
use App\Models\Species;
use App\Models\Tank;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class StockTankRequest extends FormRequest
{
    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'species_id' => ['required', 'integer', 'exists:species,id'],
            'quantity' => ['required', 'integer', 'between:1,5'],
        ];
    }

    /**
     * Reject stocking beyond the tank's hard entity limits.
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
            },
        ];
    }

    public function species(): Species
    {
        return Species::query()->findOrFail($this->integer('species_id'));
    }

    public function tank(): Tank
    {
        return $this->route('tank');
    }
}
