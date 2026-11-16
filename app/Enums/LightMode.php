<?php

namespace App\Enums;

use App\Simulation\LightFixtureState;

/**
 * The master switch for every light on a tank's gantry.
 */
enum LightMode: string
{
    /** Each light follows its own timer. */
    case Timer = 'timer';

    /** Every light is on at its full brightness, whatever its timer says. */
    case On = 'on';

    /** Every light is off, whatever its timer says. */
    case Off = 'off';

    /**
     * The lights as this mode runs them: as they are, all switched to always on, or none.
     *
     * @param  list<LightFixtureState>  $fixtures
     * @return list<LightFixtureState>
     */
    public function fixturesInEffect(array $fixtures): array
    {
        return match ($this) {
            self::Timer => $fixtures,
            self::On => array_map(fn (LightFixtureState $fixture): LightFixtureState => $fixture->alwaysOn(), $fixtures),
            self::Off => [],
        };
    }
}
