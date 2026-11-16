<?php

namespace App\Http\Requests\Tank;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class UpdateCreatureRequest extends FormRequest
{
    /**
     * Get the validation rules that apply to the request. An empty name clears
     * it; a null pause setting follows the animal's species.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'nickname' => ['sometimes', 'nullable', 'string', 'max:40'],
            'pause_when_dying' => ['sometimes', 'nullable', 'boolean'],
        ];
    }

    /**
     * The changes to make, holding only the fields that were sent.
     *
     * @return array{nickname?: string|null, pause_when_dying?: bool|null}
     */
    public function changes(): array
    {
        $changes = [];

        if ($this->has('nickname')) {
            $changes['nickname'] = $this->string('nickname')->trim()->toString() ?: null;
        }

        if ($this->has('pause_when_dying')) {
            $changes['pause_when_dying'] = $this->input('pause_when_dying') === null ? null : $this->boolean('pause_when_dying');
        }

        return $changes;
    }
}
