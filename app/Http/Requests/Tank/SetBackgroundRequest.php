<?php

namespace App\Http\Requests\Tank;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class SetBackgroundRequest extends FormRequest
{
    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'colour' => ['required', 'string', 'hex_color', 'size:7'],
            'gradient_colour' => ['nullable', 'string', 'hex_color', 'size:7'],
        ];
    }
}
