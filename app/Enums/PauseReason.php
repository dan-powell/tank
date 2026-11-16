<?php

namespace App\Enums;

/**
 * Why a tank's simulation is paused.
 */
enum PauseReason: string
{
    /** The owner paused it. */
    case Manual = 'manual';

    /** A watched animal came close to death. */
    case NearDeath = 'near_death';
}
