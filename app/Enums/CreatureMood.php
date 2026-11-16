<?php

namespace App\Enums;

/**
 * Passing states that stack on top of an animal's intent, changing how it moves and looks.
 */
enum CreatureMood: string
{
    /** Bursts of manic speed. */
    case Zoomies = 'zoomies';

    /** Nervous and quick to dart away. */
    case Skittish = 'skittish';

    /** Slowed down by cold or stale water. */
    case Sluggish = 'sluggish';

    /**
     * How busy it keeps the animal, as a multiplier on its metabolism (1 = ordinary).
     */
    public function activity(): float
    {
        return match ($this) {
            self::Zoomies => 1.5,
            self::Sluggish => 0.7,
            self::Skittish => 1.0,
        };
    }
}
