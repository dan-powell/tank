<?php

namespace App\Http\Requests\Tank;

use App\Models\Tank;
use App\Simulation\TankGeometry;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;
use LogicException;

class SetWaterLevelRequest extends FormRequest
{
    /**
     * Get the validation rules that apply to the request. The depth is the
     * water's height above the substrate, in centimetres (0 empties the tank).
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'water_depth' => [
                'required',
                'numeric',
                'multiple_of:0.5',
                'between:0,'.TankGeometry::maxWaterDepthCm($this->tank()->grid_height),
            ],
        ];
    }

    /**
     * Animals cannot be left without water.
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

                if ($this->waterLevel() <= TankGeometry::DEFAULT_SUBSTRATE && $tank->creatures()->alive()->exists()) {
                    $validator->errors()->add('water_depth', __('Take the animals out before emptying the tank.'));
                }
            },
        ];
    }

    public function waterLevel(): int
    {
        return TankGeometry::waterLevelForDepth($this->float('water_depth'));
    }

    public function tank(): Tank
    {
        $tank = $this->route('tank');

        if (! $tank instanceof Tank) {
            throw new LogicException('SetWaterLevelRequest requires a bound {tank} route parameter.');
        }

        return $tank;
    }
}
