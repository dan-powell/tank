<?php

namespace App\Http\Requests\Tank;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class FeedTankRequest extends FormRequest
{
    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'x' => ['required', 'numeric', 'between:0,1'],
            'z' => ['required', 'numeric', 'between:0,1'],
        ];
    }
}
