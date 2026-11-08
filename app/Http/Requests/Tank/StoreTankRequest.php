<?php

namespace App\Http\Requests\Tank;

use App\Simulation\TankGeometry;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class StoreTankRequest extends FormRequest
{
    /**
     * Get the validation rules that apply to the request. Dimensions are the
     * tank's interior in whole centimetres.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:40'],
            'width' => ['required', 'integer', 'between:'.implode(',', TankGeometry::WIDTH_CM)],
            'height' => ['required', 'integer', 'between:'.implode(',', TankGeometry::HEIGHT_CM)],
            'depth' => ['required', 'integer', 'between:'.implode(',', TankGeometry::DEPTH_CM)],
            'stocked' => ['boolean'],
        ];
    }

    /**
     * Every tank is simulated continuously, so each user may only keep a few.
     *
     * @return array<int, Closure(Validator): void>
     */
    public function after(): array
    {
        return [
            function (Validator $validator): void {
                if ($this->user()->tanks()->count() >= config('simulation.max_tanks_per_user')) {
                    $validator->errors()->add('name', __('You cannot keep any more tanks.'));
                }
            },
        ];
    }

    /**
     * A dimension converted from centimetres to grid cells.
     */
    public function cells(string $dimension): int
    {
        return $this->integer($dimension) * TankGeometry::CELLS_PER_CM;
    }
}
