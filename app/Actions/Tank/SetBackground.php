<?php

namespace App\Actions\Tank;

use App\Models\Tank;

class SetBackground
{
    use MutatesTank;

    /**
     * Change the backdrop behind the tank: a solid colour, or a gradient
     * from the first colour at the top to the second at the bottom.
     */
    public function handle(Tank $tank, string $colour, ?string $gradientColour): void
    {
        $this->mutateQuietly($tank, function (Tank $locked) use ($tank, $colour, $gradientColour): void {
            $locked->background_colour = strtolower($colour);
            $locked->background_gradient_colour = $gradientColour === null ? null : strtolower($gradientColour);
            $locked->save();

            $tank->setRawAttributes($locked->getAttributes(), sync: true);
        });
    }
}
