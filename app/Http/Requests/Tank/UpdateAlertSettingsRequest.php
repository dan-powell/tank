<?php

namespace App\Http\Requests\Tank;

use App\Simulation\AlertSettings;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateAlertSettingsRequest extends FormRequest
{
    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'near_death_health' => ['required', 'numeric', 'between:'.AlertSettings::MIN_NEAR_DEATH_HEALTH.','.AlertSettings::MAX_NEAR_DEATH_HEALTH],
            'disabled_parameters' => ['present', 'array'],
            'disabled_parameters.*' => ['string', Rule::in(array_keys(AlertSettings::parameters()))],
            'mail' => ['required', 'boolean'],
            'browser' => ['required', 'boolean'],
        ];
    }
}
