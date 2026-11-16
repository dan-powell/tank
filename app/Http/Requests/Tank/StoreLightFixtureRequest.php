<?php

namespace App\Http\Requests\Tank;

use App\Models\Tank;
use App\Simulation\LightCatalogue;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;
use LogicException;

class StoreLightFixtureRequest extends FormRequest
{
    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'type' => ['required', 'string', Rule::in(array_keys(LightCatalogue::definitions()))],
            'column' => ['required', 'integer', 'min:0'],
            'row' => ['required', 'integer', 'min:0'],
            'length' => ['sometimes', 'integer', 'min:1'],
        ];
    }

    /**
     * Reject hanging more lights than a gantry takes.
     *
     * @return array<int, Closure(Validator): void>
     */
    public function after(): array
    {
        return [
            function (Validator $validator): void {
                if ($this->tank()->lightFixtures()->count() >= config('simulation.lighting.max_fixtures')) {
                    $validator->errors()->add('type', __('The gantry cannot take any more lights.'));
                }
            },
        ];
    }

    public function tank(): Tank
    {
        $tank = $this->route('tank');

        if (! $tank instanceof Tank) {
            throw new LogicException('StoreLightFixtureRequest requires a bound {tank} route parameter.');
        }

        return $tank;
    }
}
