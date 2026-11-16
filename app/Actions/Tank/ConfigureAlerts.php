<?php

namespace App\Actions\Tank;

use App\Models\Tank;
use App\Simulation\AlertSettings;

class ConfigureAlerts
{
    use MutatesTank;

    /**
     * Save which warnings the owner hears about, how, and how close to death a
     * watched animal gets before the tank pauses. The species watch list is
     * kept as it is.
     *
     * @param  list<string>  $disabledParameters
     */
    public function handle(Tank $tank, float $nearDeathHealth, array $disabledParameters, bool $mail, bool $browser): void
    {
        $this->mutateQuietly($tank, function (Tank $tank) use ($nearDeathHealth, $disabledParameters, $mail, $browser): void {
            $tank->update(['alert_settings' => (new AlertSettings(
                nearDeathHealth: $nearDeathHealth,
                disabledParameters: array_values(array_unique($disabledParameters)),
                watchedSpecies: $tank->alertSettings()->watchedSpecies,
                mail: $mail,
                browser: $browser,
            ))->toArray()]);
        });
    }
}
