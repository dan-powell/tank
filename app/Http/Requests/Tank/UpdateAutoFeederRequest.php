<?php

namespace App\Http\Requests\Tank;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateAutoFeederRequest extends FormRequest
{
    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'feeds_per_day' => ['required', 'integer', Rule::in(array_keys(config('simulation.auto_feeder.schedules')))],
            'unlimited' => ['required', 'boolean'],
        ];
    }
}
