<?php

namespace App\Http\Requests\Tank;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class UpdateLightFixtureRequest extends FormRequest
{
    /**
     * Get the validation rules that apply to the request. Any subset of the settings may be sent.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'column' => ['sometimes', 'integer', 'min:0'],
            'row' => ['sometimes', 'integer', 'min:0'],
            'length' => ['sometimes', 'integer', 'min:1'],
            'colour' => ['sometimes', 'string', 'hex_color', 'size:7'],
            'brightness' => ['sometimes', 'integer', 'between:5,100'],
            'on_minute' => ['sometimes', 'integer', 'between:0,1439'],
            'off_minute' => ['sometimes', 'integer', 'between:0,1439'],
            'ramp_minutes' => ['sometimes', 'integer', 'between:0,120'],
        ];
    }
}
