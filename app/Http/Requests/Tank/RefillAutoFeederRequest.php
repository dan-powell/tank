<?php

namespace App\Http\Requests\Tank;

use App\Models\Tank;
use Closure;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class RefillAutoFeederRequest extends FormRequest
{
    /**
     * Only a tank with an auto-feeder in hopper mode has anything to refill.
     *
     * @return array<int, Closure(Validator): void>
     */
    public function after(): array
    {
        return [
            function (Validator $validator): void {
                /** @var Tank $tank */
                $tank = $this->route('tank');

                if (! $tank->auto_feeder_installed || $tank->auto_feeder_unlimited) {
                    $validator->errors()->add('auto_feeder', 'This tank has no auto-feeder hopper to refill.');
                }
            },
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [];
    }
}
