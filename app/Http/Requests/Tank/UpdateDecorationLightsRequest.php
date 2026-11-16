<?php

namespace App\Http\Requests\Tank;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

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
}
