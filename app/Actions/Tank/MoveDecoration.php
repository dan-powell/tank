<?php

namespace App\Actions\Tank;

use App\Models\Decoration;
use App\Models\Tank;

class MoveDecoration
{
    use MutatesTank;

    /**
     * Reposition and/or turn a decoration. Attached plants move with it.
     *
     * Overlapping and floating are allowed so decorations can be piled and
     * part-buried freely; the request has already checked the tank's bounds.
     */
    public function handle(Tank $tank, Decoration $decoration, int $x, int $y, int $z, int $rotation): void
    {
        $this->mutateQuietly($tank, function () use ($decoration, $x, $y, $z, $rotation): void {
            $decoration->update(['x' => $x, 'y' => $y, 'z' => $z, 'rotation' => $rotation]);
        });
    }
}
