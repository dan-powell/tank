<?php

namespace App\Http\Requests\Tank;

use App\Models\Tank;
use App\Simulation\DecorationCatalogue;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;
use LogicException;

class StoreDecorationRequest extends FormRequest
{
    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'type' => ['required', 'string', Rule::in(array_keys(DecorationCatalogue::definitions()))],
        ];
    }

    /**
     * Reject decorating beyond the tank's hard limit.
     *
     * @return array<int, Closure(Validator): void>
     */
    public function after(): array
    {
        return [
            function (Validator $validator): void {
                if ($this->tank()->decorations()->count() >= config('simulation.max_decorations_per_tank')) {
                    $validator->errors()->add('type', __('This tank cannot hold any more decorations.'));
                }
            },
        ];
    }

    public function tank(): Tank
    {
        $tank = $this->route('tank');

        if (! $tank instanceof Tank) {
            throw new LogicException('StoreDecorationRequest requires a bound {tank} route parameter.');
        }

        return $tank;
    }
}
