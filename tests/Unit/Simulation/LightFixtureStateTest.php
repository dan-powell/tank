<?php

namespace Tests\Unit\Simulation;

use App\Simulation\LightCatalogue;
use App\Simulation\LightFixtureState;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

class LightFixtureStateTest extends TestCase
{
    /**
     * @return array<string, array{0: int, 1: int, 2: int, 3: float, 4: float}>
     */
    public static function timerMoments(): array
    {
        return [
            'before switching on' => [480, 1200, 30, 7 * 60 + 59, 0.0],
            'half way up the morning ramp' => [480, 1200, 30, 8 * 60 + 15, 0.5],
            'midday' => [480, 1200, 30, 12 * 60, 1.0],
            'half way down the evening ramp' => [480, 1200, 30, 19 * 60 + 45, 0.5],
            'after switching off' => [480, 1200, 30, 20 * 60, 0.0],
            'overnight timer before midnight' => [1320, 120, 0, 23 * 60, 1.0],
            'overnight timer after midnight' => [1320, 120, 0, 60, 1.0],
            'overnight timer at midday' => [1320, 120, 0, 12 * 60, 0.0],
            'equal times stay on' => [600, 600, 30, 3 * 60, 1.0],
        ];
    }

    #[DataProvider('timerMoments')]
    public function test_level_follows_the_timer(int $on, int $off, int $ramp, int $minute, float $expected): void
    {
        $this->assertEqualsWithDelta($expected, $this->fixture(on: $on, off: $off, ramp: $ramp)->levelAt($minute * 60 + 2 * 86400), 0.001);
    }

    public function test_ramps_count_as_half_strength_hours(): void
    {
        $this->assertEqualsWithDelta(11.5, $this->fixture(on: 480, off: 1200, ramp: 30)->fullPowerHours(), 0.001);
        $this->assertEqualsWithDelta(24.0, $this->fixture(on: 0, off: 0, ramp: 30)->fullPowerHours(), 0.001);
    }

    public function test_green_light_feeds_plants_less_than_white_or_grow_lights(): void
    {
        $white = $this->fixture(colour: '#ffffff')->efficiency();
        $green = $this->fixture(colour: '#00ff00')->efficiency();
        $grow = $this->fixture(colour: '#ff00ff')->efficiency();

        $this->assertEqualsWithDelta(1.0, $white, 0.001);
        $this->assertLessThan(0.25, $green);
        $this->assertGreaterThan(0.75, $grow);
    }

    private function fixture(int $on = 480, int $off = 1200, int $ramp = 30, string $colour = '#ffffff'): LightFixtureState
    {
        return new LightFixtureState(LightCatalogue::find('spotlight'), 150, 150, 203, 69, $colour, 1.0, $on, $off, $ramp);
    }
}
