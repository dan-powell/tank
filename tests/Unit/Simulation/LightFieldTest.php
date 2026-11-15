<?php

namespace Tests\Unit\Simulation;

use App\Simulation\Gantry;
use App\Simulation\GridBox;
use App\Simulation\LightCatalogue;
use App\Simulation\LightField;
use App\Simulation\LightFixtureState;
use PHPUnit\Framework\TestCase;

class LightFieldTest extends TestCase
{
    private const int MIDDAY = 12 * 3600;

    private const int MIDNIGHT = 0;

    /** Water surface of the starter tank, in grid rows. */
    private const int WATER_LEVEL = 153;

    public function test_the_default_tube_gives_medium_light_half_way_down_the_starter_tank(): void
    {
        $field = new LightField([$this->tube()], self::WATER_LEVEL, true);

        $this->assertEqualsWithDelta(1.0, $field->at(150, 81.5, 69, self::MIDDAY), 0.05);
        $this->assertSame(0.0, $field->at(150, 81.5, 69, self::MIDNIGHT));
    }

    public function test_light_is_brightest_under_a_spotlight_and_fades_away_from_it(): void
    {
        $field = new LightField([$this->point('spotlight', column: 6)], self::WATER_LEVEL, true);

        $beneath = $field->at(162.5, 80, 69, self::MIDDAY);

        $this->assertGreaterThan(1.5, $beneath);
        $this->assertLessThan($beneath / 4, $field->at(212.5, 80, 69, self::MIDDAY));
    }

    public function test_light_dims_deeper_in_the_water(): void
    {
        $field = new LightField([$this->tube()], self::WATER_LEVEL, true);

        $this->assertGreaterThan($field->at(150, 30, 69, self::MIDDAY) * 2, $field->at(150, 140, 69, self::MIDDAY));
    }

    public function test_decorations_shade_what_is_beneath_them_except_their_own_plants(): void
    {
        $overhang = new GridBox(120, 100, 40, 60, 20, 60);
        $open = new LightField([$this->point('flood', column: 6)], self::WATER_LEVEL, true);
        $shaded = new LightField([$this->point('flood', column: 6)], self::WATER_LEVEL, true, [7 => $overhang]);

        $this->assertLessThan($open->at(150, 50, 69, self::MIDDAY) * 0.5, $shaded->at(150, 50, 69, self::MIDDAY));
        $this->assertSame($open->at(150, 50, 69, self::MIDDAY), $shaded->at(150, 50, 69, self::MIDDAY, ignoreObstacle: 7));
    }

    public function test_a_daily_dose_counts_ten_hours_of_light_as_a_full_day(): void
    {
        $field = new LightField([$this->tube()], self::WATER_LEVEL, true);

        $this->assertEqualsWithDelta(
            $field->at(150, 81.5, 69, self::MIDDAY) * 1.15,
            $field->dailyLightAt(150, 81.5, 69),
            0.001,
        );
    }

    public function test_photoperiod_ignores_dim_moonlights(): void
    {
        $moonlight = $this->point('flood', column: 3, brightness: 0.1, on: 20 * 60, off: 23 * 60);
        $field = new LightField([$this->tube(), $moonlight], self::WATER_LEVEL, true);

        $this->assertEqualsWithDelta(12.0, $field->photoperiodHours(), 0.25);
        $this->assertSame(0.0, (new LightField([], self::WATER_LEVEL, true))->photoperiodHours());
    }

    public function test_segments_through_a_box_are_detected(): void
    {
        $box = new GridBox(10, 10, 10, 10, 10, 10);

        $this->assertTrue($box->intersectsSegment([15, 0, 15], [15, 50, 15]));
        $this->assertTrue($box->intersectsSegment([0, 0, 0], [30, 30, 30]));
        $this->assertFalse($box->intersectsSegment([0, 0, 15], [5, 50, 15]));
        $this->assertFalse($box->intersectsSegment([15, 21, 15], [15, 50, 15]));
    }

    private function tube(): LightFixtureState
    {
        $gantry = Gantry::forGrid(300, 163, 138);

        return new LightFixtureState(LightCatalogue::find('led-tube'), 0, 300, $gantry->y(), $gantry->z(1), '#f4f7ff', 0.8, 480, 1200, 30, slots: 12);
    }

    private function point(string $type, int $column, float $brightness = 0.8, int $on = 480, int $off = 1200): LightFixtureState
    {
        $gantry = Gantry::forGrid(300, 163, 138);
        $x = $gantry->x($column + 0.5);

        return new LightFixtureState(LightCatalogue::find($type), $x, $x, $gantry->y(), $gantry->z(1), '#ffffff', $brightness, $on, $off, 0);
    }
}
