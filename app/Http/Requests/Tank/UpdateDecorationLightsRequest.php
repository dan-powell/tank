<?php

namespace App\Http\Requests\Tank;

use App\Models\Decoration;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;
use LogicException;

class UpdateDecorationLightsRequest extends FormRequest
{
    /**
     * Get the validation rules that apply to the request. Any subset of the settings may be sent.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'lights_on' => ['sometimes', 'boolean'],
            'light_colour' => ['sometimes', 'nullable', 'string', 'hex_color', 'size:7'],
            'light_mode' => ['sometimes', 'string', 'in:timer,always'],
        ];
    }

    /**
     * Only decorations with LEDs built in can have them configured.
     *
     * @return array<int, Closure(Validator): void>
     */
    public function after(): array
    {
        return [
            function (Validator $validator): void {
                if (! $this->decoration()->definition()->hasLights()) {
                    $validator->errors()->add('lights_on', __('This decoration has no lights.'));
                }
            },
        ];
    }

    public function decoration(): Decoration
    {
        $decoration = $this->route('decoration');

        if (! $decoration instanceof Decoration) {
            throw new LogicException('UpdateDecorationLightsRequest requires a bound {decoration} route parameter.');
        }

        return $decoration;
    }
}
