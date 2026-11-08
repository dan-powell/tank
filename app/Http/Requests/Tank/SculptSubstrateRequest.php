<?php

namespace App\Http\Requests\Tank;

use App\Models\Tank;
use App\Simulation\TankGeometry;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;
use LogicException;

class SculptSubstrateRequest extends FormRequest
{
    /**
     * Get the validation rules that apply to the request: a full heightmap,
     * one height (in grid cells) per column, from bare glass to just below the rim.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $tank = $this->tank();
        [$columns, $rows] = TankGeometry::substrateColumns($tank);

        return [
            'heights' => ['required', 'array', 'size:'.$columns * $rows],
            'heights.*' => ['required', 'integer', 'between:0,'.TankGeometry::maxWaterLevel($tank->grid_height)],
        ];
    }

    /**
     * Gravel may not fill the tank's water entirely while animals live in it.
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
                $reshaped = $tank->replicate()->forceFill(['substrate_heights' => $this->heights()]);

                if (TankGeometry::isDry($reshaped) && $tank->hasAquaticAnimals()) {
                    $validator->errors()->add('heights', __('Leave some water for the water animals.'));
                }
            },
        ];
    }

    /**
     * @return list<int>
     */
    public function heights(): array
    {
        return array_map(intval(...), array_values($this->array('heights')));
    }

    public function tank(): Tank
    {
        $tank = $this->route('tank');

        if (! $tank instanceof Tank) {
            throw new LogicException('SculptSubstrateRequest requires a bound {tank} route parameter.');
        }

        return $tank;
    }
}
