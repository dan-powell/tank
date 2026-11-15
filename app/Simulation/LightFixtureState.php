<?php

namespace App\Simulation;

use App\Models\LightFixture;

/**
 * A light fixture as the simulation sees it: where it hangs (grid cells),
 * how much light it gives, and its daily timer.
 *
 * Tubes span `fromX` to `toX` over `slots` gantry slots; point fixtures
 * have both at their centre.
 */
final readonly class LightFixtureState
{
    /** Minutes in a day. */
    private const int DAY = 1440;

    /** Relative photosynthetic value of red, green and blue light (plants use little green). */
    private const array SPECTRUM_WEIGHTS = [0.9, 0.45, 1.0];

    public function __construct(
        public LightDefinition $definition,
        public float $fromX,
        public float $toX,
        public float $y,
        public float $z,
        public string $colour,
        public float $brightness,
        public int $onMinute,
        public int $offMinute,
        public int $rampMinutes,
        public int $slots = 1,
    ) {}

    public static function fromModel(LightFixture $fixture, Gantry $gantry): self
    {
        $definition = $fixture->definition();
        $isTube = $definition->isTube;

        return new self(
            definition: $definition,
            fromX: $gantry->x($isTube ? $fixture->column : $fixture->column + 0.5),
            toX: $gantry->x($isTube ? $fixture->column + $fixture->length : $fixture->column + 0.5),
            y: $gantry->y(),
            z: $gantry->z($fixture->row),
            colour: $fixture->colour,
            brightness: $fixture->brightness / 100,
            onMinute: $fixture->on_minute,
            offMinute: $fixture->off_minute,
            rampMinutes: $fixture->ramp_minutes,
            slots: $isTube ? $fixture->length : 1,
        );
    }

    /**
     * How far the timer has it turned up (0-1) at a moment of simulated time,
     * ramping linearly up after switching on and down before switching off.
     * An off time before the on time runs past midnight; equal times mean always on.
     */
    public function levelAt(int $simSeconds): float
    {
        $minute = fmod($simSeconds / 60, self::DAY);
        $duration = $this->onMinutes();
        $sinceOn = fmod($minute - $this->onMinute + self::DAY, self::DAY);

        if ($duration >= self::DAY) {
            return 1.0;
        }

        if ($sinceOn >= $duration) {
            return 0.0;
        }

        $ramp = min($this->rampMinutes, $duration / 2);

        if ($ramp <= 0) {
            return 1.0;
        }

        return min(1.0, $sinceOn / $ramp, ($duration - $sinceOn) / $ramp);
    }

    /**
     * Minutes per day the timer has it on, ramps included.
     */
    public function onMinutes(): int
    {
        $duration = ($this->offMinute - $this->onMinute + self::DAY) % self::DAY;

        return $duration === 0 ? self::DAY : $duration;
    }

    /**
     * Hours per day of light, counting the ramps at half strength.
     */
    public function fullPowerHours(): float
    {
        $duration = $this->onMinutes();

        return ($duration >= self::DAY ? $duration : $duration - min($this->rampMinutes, $duration / 2)) / 60;
    }

    /**
     * How useful its colour is to plants, relative to white light (0-1).
     */
    public function efficiency(): float
    {
        $channels = sscanf($this->colour, '#%02x%02x%02x');
        $weighted = 0.0;

        foreach (self::SPECTRUM_WEIGHTS as $index => $weight) {
            $weighted += ($channels[$index] ?? 0) / 255 * $weight;
        }

        return $weighted / array_sum(self::SPECTRUM_WEIGHTS);
    }

    /**
     * Light given at full level, before distance, angle and water.
     */
    public function output(): float
    {
        return $this->definition->output * $this->brightness * $this->efficiency() * $this->slots;
    }

    /**
     * Points the light comes from: one per gantry slot along a tube, or the fixture's centre.
     *
     * @return list<array{0: float, 1: float, 2: float}>
     */
    public function emitters(): array
    {
        if (! $this->definition->isTube) {
            return [[$this->fromX, $this->y, $this->z]];
        }

        $count = max(1, $this->slots);
        $points = [];

        for ($index = 0; $index < $count; $index++) {
            $points[] = [$this->fromX + ($index + 0.5) * ($this->toX - $this->fromX) / $count, $this->y, $this->z];
        }

        return $points;
    }
}
