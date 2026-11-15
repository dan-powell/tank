<?php

namespace App\Simulation;

/**
 * How much light from a tank's fixtures reaches any point inside it.
 *
 * Light units are scaled so 1.0 is "medium light": what the default LED
 * tube gives a plant's crown halfway down the starter tank. Each fixture's
 * contribution falls off with distance squared and with angle (tubes like a
 * bare bulb, spotlights and floods within their cone), dims through the
 * water, and is cut where a decoration stands between it and the point.
 *
 * The geometry never changes during a simulation run, so each point's
 * per-fixture contributions are worked out once and reused every step.
 */
final class LightField
{
    /** Scales raw irradiance so the reference set-up gives 1.0 (see the class docblock). */
    public const float CALIBRATION = 167.0;

    /** Share of light that gets through the water's surface. */
    private const float SURFACE_TRANSMISSION = 0.9;

    /** Fraction of light absorbed per cm of water it passes down through. */
    private const float WATER_ABSORPTION_PER_CM = 0.02;

    /** Share of a fixture's light that gets past a decoration in the way. */
    private const float SHADE = 0.3;

    /** Average light on the substrate under the default tube (see floorAverage()); algae are tuned to it. */
    public const float REFERENCE_FLOOR_LIGHT = 0.33;

    /** Hours of full light per day that count as a full day's light (see dailyLightAt()). */
    public const float REFERENCE_DAY_HOURS = 10.0;

    /** @var array<string, list<float>> */
    private array $contributionCache = [];

    /**
     * @param  list<LightFixtureState>  $fixtures
     * @param  array<int, GridBox>  $obstacles  Decoration boxes, keyed by decoration id.
     */
    public function __construct(
        private readonly array $fixtures,
        private readonly int $waterLevel,
        private readonly bool $hasWater,
        private readonly array $obstacles = [],
    ) {}

    public static function forState(TankState $state): self
    {
        return new self($state->lightFixtures, $state->waterLevel, $state->hasWater, $state->decorationBoxes);
    }

    /**
     * Light at a point (grid cells) with each fixture at its timer level for a moment in time.
     *
     * @param  int|null  $ignoreObstacle  A decoration that does not shade this point (the one a plant grows on).
     */
    public function at(float $x, float $y, float $z, int $simSeconds, ?int $ignoreObstacle = null): float
    {
        $light = 0.0;

        foreach ($this->contributions($x, $y, $z, $ignoreObstacle) as $index => $contribution) {
            $light += $contribution * $this->fixtures[$index]->levelAt($simSeconds);
        }

        return $light;
    }

    /**
     * A day's light at a point, relative to `REFERENCE_DAY_HOURS` at that point's full light:
     * 1.0 is ten hours of medium light.
     */
    public function dailyLightAt(float $x, float $y, float $z, ?int $ignoreObstacle = null): float
    {
        $light = 0.0;

        foreach ($this->contributions($x, $y, $z, $ignoreObstacle) as $index => $contribution) {
            $light += $contribution * $this->fixtures[$index]->fullPowerHours() / self::REFERENCE_DAY_HOURS;
        }

        return $light;
    }

    /**
     * Average light across the substrate at a moment in time, sampled on a 4 × 3 grid.
     */
    public function floorAverage(TankState $state, int $simSeconds): float
    {
        $total = 0.0;
        $samples = 0;

        for ($i = 0; $i < 4; $i++) {
            for ($j = 0; $j < 3; $j++) {
                $x = ($i + 0.5) * $state->gridWidth / 4;
                $z = ($j + 0.5) * $state->gridDepth / 3;
                $total += $this->at($x, $state->substrateHeightAt((int) $x, (int) $z) + 1, $z, $simSeconds);
                $samples++;
            }
        }

        return $total / $samples;
    }

    /**
     * Hours per day the lighting is on at a quarter or more of its peak,
     * sampled every 15 minutes; dim extras such as moonlights don't count.
     */
    public function photoperiodHours(): float
    {
        $totals = [];

        for ($sample = 0; $sample < 96; $sample++) {
            $total = 0.0;

            foreach ($this->fixtures as $fixture) {
                $total += $fixture->output() * $fixture->levelAt($sample * 900 + 450);
            }

            $totals[] = $total;
        }

        $peak = max($totals);

        if ($peak <= 0) {
            return 0.0;
        }

        return count(array_filter($totals, fn (float $total): bool => $total >= $peak * 0.25)) / 4;
    }

    /**
     * Each fixture's light at a point when fully on, in fixture order.
     *
     * @return list<float>
     */
    public function contributions(float $x, float $y, float $z, ?int $ignoreObstacle = null): array
    {
        $key = sprintf('%d|%d|%d|%d', round($x / 2), round($y / 2), round($z / 2), $ignoreObstacle ?? -1);

        return $this->contributionCache[$key] ??= array_map(
            fn (LightFixtureState $fixture): float => $this->fixtureLight($fixture, [$x, $y, $z], $ignoreObstacle),
            $this->fixtures,
        );
    }

    /**
     * @param  array{0: float, 1: float, 2: float}  $point
     */
    private function fixtureLight(LightFixtureState $fixture, array $point, ?int $ignoreObstacle): float
    {
        $emitters = $fixture->emitters();
        $outputPerEmitter = $fixture->output() / count($emitters);
        $definition = $fixture->definition;
        $light = 0.0;

        foreach ($emitters as $emitter) {
            $dx = $point[0] - $emitter[0];
            $dy = $emitter[1] - $point[1];
            $dz = $point[2] - $emitter[2];
            $distance = sqrt($dx * $dx + $dy * $dy + $dz * $dz);

            if ($dy <= 0 || $distance <= 0) {
                continue;
            }

            $cosAngle = $dy / $distance;
            $distanceCm = max(1.0, $distance / TankGeometry::CELLS_PER_CM);
            $beam = $definition->isTube
                ? $cosAngle
                : self::smoothstep($definition->cosOuter(), $definition->cosInner(), $cosAngle);

            if ($beam <= 0) {
                continue;
            }

            $light += $outputPerEmitter * $beam * $cosAngle / ($distanceCm * $distanceCm)
                * $this->shading($point, $emitter, $ignoreObstacle);
        }

        return $light * $this->waterTransmission($point[1]) * self::CALIBRATION;
    }

    /**
     * Share of light that gets down through the water to a height.
     */
    private function waterTransmission(float $y): float
    {
        if (! $this->hasWater || $y >= $this->waterLevel) {
            return 1.0;
        }

        $depthCm = ($this->waterLevel - $y) / TankGeometry::CELLS_PER_CM;

        return self::SURFACE_TRANSMISSION * exp(-self::WATER_ABSORPTION_PER_CM * $depthCm);
    }

    /**
     * @param  array{0: float, 1: float, 2: float}  $point
     * @param  array{0: float, 1: float, 2: float}  $emitter
     */
    private function shading(array $point, array $emitter, ?int $ignoreObstacle): float
    {
        $share = 1.0;

        foreach ($this->obstacles as $id => $box) {
            if ($id !== $ignoreObstacle && $box->intersectsSegment($point, $emitter)) {
                $share *= self::SHADE;
            }
        }

        return $share;
    }

    private static function smoothstep(float $edge0, float $edge1, float $value): float
    {
        $t = min(1.0, max(0.0, ($value - $edge0) / ($edge1 - $edge0)));

        return $t * $t * (3 - 2 * $t);
    }
}
