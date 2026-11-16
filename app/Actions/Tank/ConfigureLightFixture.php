<?php

namespace App\Actions\Tank;

use App\Models\LightFixture;
use App\Models\Tank;
use Illuminate\Validation\ValidationException;

class ConfigureLightFixture
{
    use MutatesTank, PlacesLightFixtures;

    /**
     * Move, resize, recolour, dim or reschedule a light. Adjustments are
     * frequent (sliders), so they are not logged.
     *
     * @param  array{column?: int, row?: int, length?: int, colour?: string, brightness?: int, on_minute?: int, off_minute?: int, ramp_minutes?: int}  $settings
     *
     * @throws ValidationException When moved onto taken slots or off the gantry.
     */
    public function handle(Tank $tank, LightFixture $fixture, array $settings): void
    {
        $this->mutateQuietly($tank, function (Tank $tank) use ($fixture, $settings): void {
            $fixture->fill($settings);
            $definition = $fixture->definition();
            $fixture->length = $definition->isTube ? max($definition->minLength, $fixture->length) : 1;

            if ($fixture->isDirty(['column', 'row', 'length'])) {
                $this->ensureSlotsAreFree($tank, $fixture->column, $fixture->row, $fixture->length, $fixture);
            }

            $fixture->save();
        });
    }
}
