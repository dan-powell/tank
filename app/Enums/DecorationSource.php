<?php

namespace App\Enums;

enum DecorationSource: string
{
    /** A hand-made MagicaVoxel model in resources/models/decor. */
    case Vox = 'vox';

    /** A rock generated in the browser from the decoration's seed. */
    case Rock = 'rock';
}
