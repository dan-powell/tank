<?php

namespace App\Policies;

use App\Models\Tank;
use App\Models\User;

class TankPolicy
{
    /**
     * Determine whether the user can view the tank.
     */
    public function view(User $user, Tank $tank): bool
    {
        return $user->id === $tank->user_id;
    }

    /**
     * Determine whether the user can interact with (maintain) the tank.
     */
    public function update(User $user, Tank $tank): bool
    {
        return $user->id === $tank->user_id;
    }
}
