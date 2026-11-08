<?php

namespace App\Http\Requests\Tank;

use App\Models\Decoration;
use App\Models\Tank;
use App\Simulation\GridBox;
use App\Simulation\TankGeometry;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;
use LogicException;

class MoveDecorationRequest extends FormRequest
{
    /**
     * Get the validation rules that apply to the request. Positions are grid cells.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'x' => ['required', 'integer', 'min:0'],
            'y' => ['required', 'integer', 'min:0'],
            'z' => ['required', 'integer', 'min:0'],
            'rotation' => ['required', 'integer', 'between:0,3'],
        ];
    }

    /**
     * Keep the rotated decoration inside the tank.
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

                [$width, $height, $depth] = $this->decoration()->definition()->rotatedSize($this->integer('rotation'));
                $box = new GridBox($this->integer('x'), $this->integer('y'), $this->integer('z'), $width, $height, $depth);

                if (! TankGeometry::contains($this->tank(), $box)) {
                    $validator->errors()->add('x', __('The decoration must stay inside the tank.'));
                }
            },
        ];
    }

    public function tank(): Tank
    {
        $tank = $this->route('tank');

        if (! $tank instanceof Tank) {
            throw new LogicException('MoveDecorationRequest requires a bound {tank} route parameter.');
        }

        return $tank;
    }

    public function decoration(): Decoration
    {
        $decoration = $this->route('decoration');

        if (! $decoration instanceof Decoration) {
            throw new LogicException('MoveDecorationRequest requires a bound {decoration} route parameter.');
        }

        return $decoration;
    }
}
