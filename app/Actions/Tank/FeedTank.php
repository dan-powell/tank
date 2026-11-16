<?php

namespace App\Actions\Tank;

use App\Enums\TankEventType;
use App\Models\Tank;
use App\Simulation\SimEvent;
use Illuminate\Validation\ValidationException;

class FeedTank
{
    use MutatesTank;

    /**
     * Sprinkle a pinch of food at a point on the water surface (x and z normalised 0..1).
     *
     * @throws ValidationException While the tank is paused, since nothing could eat it.
     */
    public function handle(Tank $tank, float $x, float $z): void
    {
        $this->mutate($tank, function (Tank $tank) use ($x, $z): SimEvent {
            if ($tank->is_paused) {
                throw ValidationException::withMessages([
                    'food' => __('The tank is paused. Resume it before adding food.'),
                ]);
            }

            $tank->uneaten_food += config('simulation.feed_pinch_grams');

            return $this->event($tank, TankEventType::Feeding, 'You sprinkled in some food.', ['x' => $x, 'z' => $z]);
        });
    }
}
