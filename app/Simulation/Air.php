<?php

namespace App\Simulation;

/**
 * Room air, and conversions between the air's concentrations and masses.
 */
final class Air
{
    /** Room air: relative humidity (%), oxygen (% by volume), CO2 (ppm). */
    public const float ROOM_HUMIDITY = 50.0;

    public const float ROOM_OXYGEN = 20.9;

    public const float ROOM_CO2 = 420.0;

    /** Milligrams of oxygen per litre of air for each percent by volume. */
    public const float OXYGEN_MG_PER_LITRE_PER_PERCENT = 14.3;

    /** Milligrams of CO2 per litre of air for each ppm by volume. */
    public const float CO2_MG_PER_LITRE_PER_PPM = 0.00198;

    /** Most humid the air gets before water condenses back out of it. */
    public const float MAX_HUMIDITY = 98.0;
}
