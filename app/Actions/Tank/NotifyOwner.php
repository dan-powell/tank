<?php

namespace App\Actions\Tank;

use App\Enums\TankEventType;
use App\Models\Tank;
use App\Notifications\TankAlert;
use App\Simulation\SimEvent;
use Illuminate\Support\Facades\RateLimiter;

/**
 * Notify a tank's owner about the warnings and near deaths in a batch of
 * simulation events, as their alert settings ask.
 */
class NotifyOwner
{
    /** A warning about the same parameter going the same way is sent at most once in this many real seconds. */
    public const int WARNING_COOLDOWN_SECONDS = 3600;

    /**
     * @param  list<SimEvent>  $events
     */
    public function handle(Tank $tank, array $events): void
    {
        $settings = $tank->alertSettings();
        $owner = $tank->user;

        foreach ($events as $event) {
            $parameter = $event->payload['parameter'] ?? null;

            $shouldNotify = match ($event->type) {
                TankEventType::NearDeath => true,
                TankEventType::Warning => $parameter !== null
                    && $settings->notifiesAbout($parameter)
                    && $this->outsideCooldown($tank, $parameter, $event->payload['side'] ?? ''),
                default => false,
            };

            if ($shouldNotify) {
                $owner->notify(new TankAlert($tank, $event->type, $event->message, $parameter, $settings->mail, $settings->browser));
            }
        }
    }

    /**
     * Whether this warning hasn't been sent recently, starting its cooldown if so.
     */
    private function outsideCooldown(Tank $tank, string $parameter, string $side): bool
    {
        $key = "tank-alert:{$tank->id}:{$parameter}:{$side}";

        if (RateLimiter::tooManyAttempts($key, 1)) {
            return false;
        }

        RateLimiter::hit($key, self::WARNING_COOLDOWN_SECONDS);

        return true;
    }
}
