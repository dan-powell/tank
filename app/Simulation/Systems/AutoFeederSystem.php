<?php

namespace App\Simulation\Systems;

use App\Enums\TankEventType;
use App\Simulation\StepContext;
use App\Simulation\TankState;

/**
 * An installed auto-feeder drops a portion of food at each scheduled hour,
 * drawing from its hopper unless it is in unlimited mode.
 */
final class AutoFeederSystem implements SimulationSystem
{
    private const int SECONDS_PER_DAY = 86400;

    public function apply(TankState $state, StepContext $context): void
    {
        $feeder = $state->autoFeeder;

        // A sealed lid covers the feeder's drop chute.
        if ($feeder === null || $state->isSealed) {
            return;
        }

        $feeds = array_sum(array_map(
            fn (int $hour): int => $this->timesReached($hour * 3600, $state->simSeconds, $context->dtSeconds),
            $feeder->feedHours,
        ));

        for ($feed = 0; $feed < $feeds && $feeder->canFeed(); $feed++) {
            $state->uneatenFood += $feeder->portionGrams;
            $context->emit(TankEventType::AutoFeeding, 'The auto-feeder dropped in some food.');

            if ($feeder->unlimited) {
                continue;
            }

            $feeder->portions--;

            if ($feeder->portions === 0) {
                $context->emit(TankEventType::Warning, 'The auto-feeder hopper is empty. Refill it to keep your fish fed.', ['parameter' => 'auto_feeder']);
            }
        }
    }

    /**
     * How many times a daily time of day falls within the step [start, start + duration).
     */
    private function timesReached(int $timeOfDay, int $start, int $duration): int
    {
        $occurrencesBefore = fn (int $moment): int => (int) ceil(($moment - $timeOfDay) / self::SECONDS_PER_DAY);

        return $occurrencesBefore($start + $duration) - $occurrencesBefore($start);
    }
}
