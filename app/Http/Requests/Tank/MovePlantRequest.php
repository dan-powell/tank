<?php

namespace App\Http\Requests\Tank;

use App\Enums\Habitat;
use App\Enums\PlantAnchorage;
use App\Models\Plant;
use App\Models\Tank;
use App\Simulation\GridBox;
use App\Simulation\TankGeometry;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;
use LogicException;

class MovePlantRequest extends FormRequest
{
    /**
     * Get the validation rules that apply to the request: a new spot on the
     * substrate, as normalised x and a depth layer.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'x' => ['required', 'numeric', 'between:0,1'],
            'layer' => ['required', 'integer', 'between:0,'.($this->tank()->layer_count - 1)],
        ];
    }

    /**
     * The new spot must be clear substrate that suits the plant.
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
                $species = $this->plant()->species;
                [$x, $z] = TankGeometry::plantColumn($this->float('x'), $this->integer('layer'), $tank->layer_count, $tank->grid_width, $tank->grid_depth);
                $footprints = TankGeometry::groundedFootprints($tank, $tank->decorations()->get());

                if (! PlantAnchorage::fromParams($species->params)->allowsSubstrate()) {
                    $validator->errors()->add('x', __(':name only grows on decorations.', ['name' => $species->name]));
                } elseif (array_any($footprints, fn (GridBox $box): bool => $box->coversColumn($x, $z))) {
                    $validator->errors()->add('x', __('Something is in the way there.'));
                } elseif (! TankGeometry::rootSuits(
                    Habitat::fromParams($species->params),
                    TankGeometry::substrateHeightAt($tank, $x, $z),
                    TankGeometry::waterLevel($tank),
                    ! TankGeometry::isDry($tank),
                )) {
                    $validator->errors()->add('x', __('That spot doesn\'t suit :name.', ['name' => $species->name]));
                }
            },
        ];
    }

    public function tank(): Tank
    {
        $tank = $this->route('tank');

        if (! $tank instanceof Tank) {
            throw new LogicException('MovePlantRequest requires a bound {tank} route parameter.');
        }

        return $tank;
    }

    public function plant(): Plant
    {
        $plant = $this->route('plant');

        if (! $plant instanceof Plant) {
            throw new LogicException('MovePlantRequest requires a bound {plant} route parameter.');
        }

        return $plant;
    }
}
