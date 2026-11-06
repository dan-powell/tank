<?php

use App\Models\Tank;
use App\Models\User;
use Illuminate\Support\Facades\Broadcast;

Broadcast::channel('App.Models.User.{id}', function ($user, $id) {
    return (int) $user->id === (int) $id;
});

Broadcast::channel('tank.{tank}', function (User $user, Tank $tank) {
    return $user->can('view', $tank);
});
