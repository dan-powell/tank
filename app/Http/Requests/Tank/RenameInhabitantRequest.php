<?php

namespace App\Http\Requests\Tank;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class RenameInhabitantRequest extends FormRequest
{
    /**
     * Get the validation rules that apply to the request. An empty name clears it.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'nickname' => ['nullable', 'string', 'max:40'],
        ];
    }

    public function nickname(): ?string
    {
        return $this->string('nickname')->trim()->toString() ?: null;
    }
}
