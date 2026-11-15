<?php

namespace App\Actions\Tank;

use App\Models\Decoration;
use App\Models\Tank;

class ConfigureDecorationLights
{
    use MutatesTank;

    /**
     * Switch a decoration's LEDs on or off, change their colour, or choose
     * whether they follow the tank's lights or stay on. They are purely
     * decorative, so this isn't logged.
     *
     * @param  array{lights_on?: bool, light_colour?: string|null, light_mode?: string}  $settings
     */
    public function handle(Tank $tank, Decoration $decoration, array $settings): void
    {
        $this->mutateQuietly($tank, function () use ($decoration, $settings): void {
            $decoration->update($settings);
        });
    }
}
