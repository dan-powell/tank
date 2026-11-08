<?php

namespace App\Actions\Tank;

use App\Models\Tank;
use App\Models\User;
use App\Simulation\TankGeometry;
use Illuminate\Support\Str;

class CreateStarterTank
{
    public function __construct(private CreateTank $createTank) {}

    /**
     * Give a user a cycled, planted and stocked tank of the standard size (60 x 32.5 x 27.5 cm).
     */
    public function handle(User $user): Tank
    {
        return $this->createTank->handle(
            $user,
            Str::of($user->name)->before(' ')->append("'s Tank")->toString(),
            TankGeometry::DEFAULT_WIDTH,
            TankGeometry::DEFAULT_HEIGHT,
            TankGeometry::DEFAULT_DEPTH,
        );
    }
}
