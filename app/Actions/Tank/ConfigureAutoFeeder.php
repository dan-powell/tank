<?php

namespace App\Actions\Tank;

use App\Enums\TankEventType;
use App\Models\Tank;
use App\Simulation\SimEvent;

class ConfigureAutoFeeder
{
    use MutatesTank;

    /**
     * Install an auto-feeder (with a full hopper) or change its schedule and mode.
     */
    public function handle(Tank $tank, int $feedsPerDay, bool $unlimited): void
    {
        $this->mutate($tank, function (Tank $tank) use ($feedsPerDay, $unlimited): SimEvent {
            $isNew = ! $tank->auto_feeder_installed;

            $tank->auto_feeder_installed = true;
            $tank->auto_feeder_feeds_per_day = $feedsPerDay;
            $tank->auto_feeder_unlimited = $unlimited;

            if ($isNew) {
                $tank->auto_feeder_portions = config('simulation.auto_feeder.hopper_capacity');
            }

            $schedule = trans_choice('{1} once a day|[2,*] :count times a day', $feedsPerDay);
            $mode = $unlimited ? 'with unlimited food' : 'from its hopper';

            return $this->event(
                $tank,
                TankEventType::AutoFeederChanged,
                $isNew
                    ? "You installed an auto-feeder. It feeds {$schedule} {$mode}."
                    : "You set the auto-feeder to feed {$schedule} {$mode}.",
                ['feeds_per_day' => $feedsPerDay, 'unlimited' => $unlimited],
            );
        });
    }
}
