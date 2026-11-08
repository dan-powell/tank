<?php

namespace App\Http\Requests\Tank;

use App\Enums\Habitat;
use App\Models\Creature;
use App\Models\Tank;
use App\Simulation\TankGeometry;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;
use LogicException;

class MoveCreatureRequest extends FormRequest
{
    /**
     * Get the validation rules that apply to the request: a new home, as
     * normalised x and height (0..1) within a depth layer.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'x' => ['required', 'numeric', 'between:0,1'],
            'y' => ['required', 'numeric', 'between:0,1'],
            'layer' => ['required', 'integer', 'between:0,'.($this->tank()->layer_count - 1)],
        ];
    }

    /**
     * Water animals must stay in the water, land animals on dry ground.
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
                $habitat = Habitat::fromParams($this->creature()->species->params);
                [$x, $z] = TankGeometry::plantColumn($this->float('x'), $this->integer('layer'), $tank->layer_count, $tank->grid_width, $tank->grid_depth);
                $surface = TankGeometry::surfaceAt($tank, $tank->decorations()->get(), $x, $z);
                $isLand = TankGeometry::isDry($tank) || $surface >= TankGeometry::waterLevel($tank);

                if ($habitat === Habitat::Aquatic && $isLand) {
                    $validator->errors()->add('x', __('That spot is out of the water.'));
                } elseif ($habitat === Habitat::Terrestrial && ! $isLand) {
                    $validator->errors()->add('x', __('That spot is under water.'));
                }
            },
        ];
    }

    public function tank(): Tank
    {
        $tank = $this->route('tank');

        if (! $tank instanceof Tank) {
            throw new LogicException('MoveCreatureRequest requires a bound {tank} route parameter.');
        }

        return $tank;
    }

    public function creature(): Creature
    {
        $creature = $this->route('creature');

        if (! $creature instanceof Creature) {
            throw new LogicException('MoveCreatureRequest requires a bound {creature} route parameter.');
        }

        return $creature;
    }
}
