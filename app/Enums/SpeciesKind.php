<?php

namespace App\Enums;

enum SpeciesKind: string
{
    case Plant = 'plant';
    case Fish = 'fish';
    case Invertebrate = 'invertebrate';
    case Amphibian = 'amphibian';

    /**
     * Whether this kind of species is animal life (fauna).
     */
    public function isFauna(): bool
    {
        return $this !== self::Plant;
    }
}
