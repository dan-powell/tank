<?php

namespace App\Enums;

/**
 * What an animal is busy doing: one at a time, it decides where it heads.
 */
enum CreatureIntent: string
{
    /** Potter about its home zone. */
    case Wander = 'wander';

    /** Head off to other parts of the tank. */
    case Explore = 'explore';

    /** Actively track down food or prey. */
    case Hunt = 'hunt';

    /** Settle down and keep still, mostly at night. */
    case Rest = 'rest';

    /** Tuck in by decorations and plants. */
    case Hide = 'hide';

    /** Bunch up tightly with its own kind. */
    case Shoal = 'shoal';

    /** Sweep back and forth along the bottom. */
    case Patrol = 'patrol';

    /**
     * How busy it keeps the animal, as a multiplier on its metabolism (1 = ordinary).
     */
    public function activity(): float
    {
        return match ($this) {
            self::Rest => 0.6,
            self::Hide => 0.8,
            self::Explore, self::Patrol => 1.15,
            self::Hunt => 1.2,
            default => 1.0,
        };
    }
}
