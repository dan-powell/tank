<?php

namespace App\Http\Requests\Tank;

use App\Models\Tank;
use App\Simulation\SubstrateHeightmap;
use App\Simulation\TankGeometry;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;
use LogicException;

class SculptSubstrateRequest extends FormRequest
{
    /**
     * Get the validation rules that apply to the request: a full heightmap as
     * run-length pairs (see SubstrateHeightmap). The pairs themselves are
     * checked in after(), as a large tank can send tens of thousands.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $tank = $this->tank();

        return [
            'runs' => ['required', 'array', 'list', 'max:'.(2 * $tank->grid_width * $tank->grid_depth)],
        ];
    }

    /**
     * Every run must be whole cells from bare glass to just below the rim, the
     * runs must cover the tank exactly, and gravel may not fill the tank's
     * water entirely while animals live in it.
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
                $error = $this->runsError($tank);

                if ($error !== null) {
                    $validator->errors()->add('runs', $error);

                    return;
                }

                $reshaped = $tank->replicate()->forceFill(['substrate_heights' => $this->heightmap()->toRuns()]);

                if (TankGeometry::isDry($reshaped) && $tank->hasAquaticAnimals()) {
                    $validator->errors()->add('runs', __('Leave some water for the water animals.'));
                }
            },
        ];
    }

    /**
     * The sculpted heightmap.
     */
    public function heightmap(): SubstrateHeightmap
    {
        $tank = $this->tank();

        return SubstrateHeightmap::fromRuns($this->array('runs'), $tank->grid_width, $tank->grid_depth);
    }

    public function tank(): Tank
    {
        $tank = $this->route('tank');

        if (! $tank instanceof Tank) {
            throw new LogicException('SculptSubstrateRequest requires a bound {tank} route parameter.');
        }

        return $tank;
    }

    /**
     * What is wrong with the submitted runs, if anything.
     */
    private function runsError(Tank $tank): ?string
    {
        $runs = $this->array('runs');
        $highest = TankGeometry::maxWaterLevel($tank->grid_height);
        $cells = $tank->grid_width * $tank->grid_depth;
        $covered = 0;

        if (count($runs) % 2 !== 0) {
            return __('The gravel could not be read.');
        }

        for ($index = 0; $index < count($runs); $index += 2) {
            [$height, $count] = [$runs[$index], $runs[$index + 1]];

            if (! is_int($height) || ! is_int($count) || $count < 1) {
                return __('The gravel could not be read.');
            }

            if ($height < 0 || $height > $highest) {
                return __('The gravel must stay between the glass floor and :highest cells up.', ['highest' => $highest]);
            }

            $covered += $count;
        }

        return $covered === $cells ? null : __('The gravel must cover the whole tank floor.');
    }
}
