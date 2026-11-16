<?php

namespace App\Actions\Tank;

use App\Enums\PauseReason;
use App\Enums\TankEventType;
use App\Models\Tank;
use App\Simulation\SimEvent;

class SetPaused
{
    use MutatesTank;

    /**
     * Pause the simulation, or resume it. Resuming starts the clock afresh
     * from now, so the time spent paused is never caught up on.
     */
    public function handle(Tank $tank, bool $paused): void
    {
        if ($tank->is_paused === $paused) {
            return;
        }

        $this->mutate($tank, function (Tank $tank) use ($paused): SimEvent {
            $tank->is_paused = $paused;
            $tank->paused_at = $paused ? now() : null;
            $tank->pause_reason = $paused ? PauseReason::Manual : null;

            if (! $paused) {
                $tank->last_simulated_at = now();
            }

            return $this->event(
                $tank,
                TankEventType::Pause,
                $paused ? 'You paused the tank.' : 'You set the tank running again.',
                ['is_paused' => $paused],
            );
        });
    }
}
