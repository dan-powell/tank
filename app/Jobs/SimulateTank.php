<?php

namespace App\Jobs;

use App\Actions\Tank\NotifyOwner;
use App\Enums\PauseReason;
use App\Events\TankUpdated;
use App\Models\Tank;
use App\Simulation\SimulationResult;
use App\Simulation\TankSimulator;
use App\Simulation\TankStateRepository;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\DB;

/**
 * Advance one tank's simulation by the real time elapsed since it was last
 * simulated (scaled by the configured time scale), then notify viewers and
 * the owner. Paused tanks are left alone; a watched animal coming close to
 * death pauses the tank part-way through.
 */
class SimulateTank implements ShouldBeUnique, ShouldQueue
{
    use Queueable;

    public int $timeout = 50;

    public int $tries = 3;

    public int $uniqueFor = 300;

    public bool $deleteWhenMissingModels = true;

    public function __construct(public Tank $tank)
    {
        $this->onQueue('simulation');
    }

    public function uniqueId(): string
    {
        return (string) $this->tank->id;
    }

    public function handle(TankSimulator $simulator, TankStateRepository $repository, NotifyOwner $notifyOwner): void
    {
        $result = DB::transaction(function () use ($simulator, $repository): ?SimulationResult {
            $tank = Tank::query()->lockForUpdate()->find($this->tank->id);

            if ($tank === null || ! $tank->is_active || $tank->is_paused) {
                return null;
            }

            $now = now();
            $elapsedSeconds = $tank->last_simulated_at === null
                ? 60
                : (int) $tank->last_simulated_at->diffInSeconds($now, absolute: true);

            if ($elapsedSeconds < config('simulation.min_interval_seconds')) {
                return null;
            }

            $simSeconds = (int) round($elapsedSeconds * config('simulation.time_scale'));
            $result = $simulator->advance($repository->load($tank), $simSeconds);
            $repository->save($tank, $result, $now);

            if ($result->state->pauseRequested) {
                $tank->forceFill(['is_paused' => true, 'paused_at' => $now, 'pause_reason' => PauseReason::NearDeath])->save();
            }

            $this->tank = $tank;

            return $result;
        });

        if ($result !== null) {
            TankUpdated::dispatch($this->tank, $result->events);
            $notifyOwner->handle($this->tank, $result->events);
        }
    }
}
