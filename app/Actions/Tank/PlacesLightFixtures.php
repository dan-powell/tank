<?php

namespace App\Actions\Tank;

use App\Models\LightFixture;
use App\Models\Tank;
use App\Simulation\Gantry;
use Illuminate\Validation\ValidationException;

/**
 * Checks that a light fixture fits on the gantry without sharing a slot.
 */
trait PlacesLightFixtures
{
    /**
     * @throws ValidationException When it would hang off the gantry or overlap another light.
     */
    protected function ensureSlotsAreFree(Tank $tank, int $column, int $row, int $length, ?LightFixture $ignore = null): void
    {
        if (! Gantry::of($tank)->fits($column, $row, $length)) {
            throw ValidationException::withMessages([
                'column' => __('That light would hang off the end of the gantry.'),
            ]);
        }

        $isTaken = $tank->lightFixtures()
            ->when($ignore !== null, fn ($query) => $query->whereKeyNot($ignore->id))
            ->get()
            ->contains(fn (LightFixture $fixture): bool => $fixture->overlaps($column, $row, $length));

        if ($isTaken) {
            throw ValidationException::withMessages([
                'column' => __('Another light is already hanging there.'),
            ]);
        }
    }
}
