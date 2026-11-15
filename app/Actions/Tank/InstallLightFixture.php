<?php

namespace App\Actions\Tank;

use App\Enums\TankEventType;
use App\Models\LightFixture;
use App\Models\Tank;
use App\Simulation\LightCatalogue;
use App\Simulation\SimEvent;
use Illuminate\Validation\ValidationException;

class InstallLightFixture
{
    use MutatesTank, PlacesLightFixtures;

    /**
     * Hang a new light from the gantry, in its catalogue colour, on the default timer.
     *
     * @throws ValidationException When the slots are taken or off the gantry.
     */
    public function handle(Tank $tank, string $type, int $column, int $row, int $length = 1): LightFixture
    {
        $definition = LightCatalogue::find($type);
        $length = $definition->isTube ? max($definition->minLength, $length) : 1;
        $fixture = null;

        $this->mutate($tank, function (Tank $tank) use ($definition, $column, $row, $length, &$fixture): SimEvent {
            $this->ensureSlotsAreFree($tank, $column, $row, $length);

            $fixture = $tank->lightFixtures()->create([
                'type' => $definition->slug,
                'column' => $column,
                'row' => $row,
                'length' => $length,
                'colour' => $definition->defaultColour,
                'brightness' => config('simulation.lighting.default_brightness'),
                ...config('simulation.lighting.default_schedule'),
            ]);

            return $this->event(
                $tank,
                TankEventType::Lighting,
                "You hung a new {$definition->name} from the gantry.",
                ['light_fixture_id' => $fixture->id],
            );
        });

        return $fixture;
    }
}
