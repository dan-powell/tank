<?php

namespace App\Enums;

/**
 * Where a species lives: in the water, at the water's edge, on land, or both.
 */
enum Habitat: string
{
    case Aquatic = 'aquatic';

    /** Plants rooted at the waterline that grow up into the air. */
    case Emergent = 'emergent';

    case Terrestrial = 'terrestrial';

    /** Animals that move between water and land, breathing air. */
    case Amphibious = 'amphibious';

    /**
     * @param  array<string, mixed>  $params  A species' simulation parameters.
     */
    public static function fromParams(array $params): self
    {
        return self::tryFrom($params['habitat'] ?? '') ?? self::Aquatic;
    }

    /**
     * Whether an animal breathes the air above the water rather than dissolved oxygen.
     */
    public function breathesAir(): bool
    {
        return $this === self::Terrestrial || $this === self::Amphibious;
    }

    /**
     * Whether an animal needs dry land to live on.
     */
    public function needsLand(): bool
    {
        return $this === self::Terrestrial || $this === self::Amphibious;
    }

    /**
     * Whether an animal can reach the water (to eat sinking food or swim).
     */
    public function reachesWater(): bool
    {
        return $this !== self::Terrestrial;
    }
}
