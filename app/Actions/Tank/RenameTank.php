<?php

namespace App\Actions\Tank;

use App\Models\Tank;

class RenameTank
{
    use MutatesTank;

    /**
     * Give the tank a new name.
     */
    public function handle(Tank $tank, string $name): void
    {
        $this->mutateQuietly($tank, function (Tank $locked) use ($name): void {
            $locked->update(['name' => $name]);
        });

        $tank->name = $name;
        $tank->syncOriginalAttribute('name');
    }
}
