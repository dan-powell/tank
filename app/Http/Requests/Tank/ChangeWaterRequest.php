<?php

namespace App\Http\Requests\Tank;

use App\Models\Tank;
use App\Simulation\TankGeometry;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class ChangeWaterRequest extends FormRequest
{
    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'percent' => ['required', 'integer', 'between:5,90'],
        ];
    }

    /**
     * Reject the request while the tank is empty.
     *
     * @return array<int, Closure(Validator): void>
     */
    public function after(): array
    {
        return [
            function (Validator $validator): void {
                $tank = $this->route('tank');

                if ($tank instanceof Tank && TankGeometry::isDry($tank)) {
                    $validator->errors()->add('percent', __('There is no water to change.'));
                }
            },
        ];
    }
}
