<?php

namespace App\Simulation;

use App\Enums\Habitat;
use App\Models\Species;
use App\Models\Tank;

/**
 * The warnings a stored tank is under right now: each reading the simulation
 * would warn about (see WarningSystem) that is currently harmfully low or high.
 */
final class ActiveWarnings
{
    /**
     * @param  iterable<Species>  $livingSpecies  The species of the tank's living plants and animals.
     * @return list<array{parameter: string, label: string, side: string}>
     */
    public static function forTank(Tank $tank, iterable $livingSpecies): array
    {
        $params = [];
        $hasLandLife = false;

        foreach ($livingSpecies as $species) {
            $params[] = $species->params;
            $hasLandLife = $hasLandLife || Habitat::fromParams($species->params) !== Habitat::Aquatic;
        }

        $limits = BalanceLimits::forSpecies($params);
        $warnings = [];

        foreach (self::readings($tank, $hasLandLife) as $parameter => $value) {
            $side = $limits->harmful($parameter, $value);

            if ($side !== null) {
                $warnings[] = ['parameter' => $parameter, 'label' => BalanceLimits::LABELS[$parameter], 'side' => $side];
            }
        }

        return $warnings;
    }

    /**
     * The readings worth watching, keyed by parameter, as WarningSystem picks them.
     *
     * @return array<string, float>
     */
    private static function readings(Tank $tank, bool $hasLandLife): array
    {
        $readings = [
            'air_oxygen' => $tank->air_oxygen,
            'air_co2' => $tank->air_co2,
        ];

        if ($hasLandLife) {
            $readings['humidity'] = $tank->humidity;
        }

        if (! TankGeometry::isDry($tank)) {
            foreach (BalanceLimits::WATER_PARAMETERS as $parameter) {
                $readings[$parameter] = $tank->{$parameter};
            }
        }

        return $readings;
    }
}
