<?php

namespace App\Enums;

/**
 * Where a plant species can grow.
 */
enum PlantAnchorage: string
{
    case Substrate = 'substrate';

    /** Only on a decoration's anchor points (e.g. epiphytes such as anubias). */
    case Decor = 'decor';

    case Any = 'any';

    public function allowsSubstrate(): bool
    {
        return $this !== self::Decor;
    }

    public function allowsDecor(): bool
    {
        return $this !== self::Substrate;
    }

    /**
     * @param  array<string, mixed>  $params  A species' simulation parameters.
     */
    public static function fromParams(array $params): self
    {
        return self::tryFrom($params['anchorage'] ?? '') ?? self::Substrate;
    }
}
