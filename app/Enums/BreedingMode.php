<?php

namespace App\Enums;

enum BreedingMode: string
{
    /** The species does not reproduce in the tank. */
    case None = 'none';

    /** Females carry young internally and give birth to free-swimming fry. */
    case Livebearer = 'livebearer';

    /** A pair spawns eggs which hatch into a small brood. */
    case EggLayer = 'egg_layer';
}
