<?php

namespace Tests\Unit\Simulation;

use App\Simulation\BalanceLimits;
use PHPUnit\Framework\TestCase;

class BalanceLimitsTest extends TestCase
{
    public function test_temperature_follows_the_range_every_species_tolerates(): void
    {
        $limits = BalanceLimits::forSpecies([
            ['temperature' => [22, 28]],
            ['temperature' => [20, 26]],
        ])->toArray();

        $this->assertSame([22.0, 26.0], $limits['temperature']['ideal']);
        $this->assertSame([20.0, 28.0], $limits['temperature']['safe']);
    }

    public function test_falls_back_to_the_defaults_when_the_species_ranges_do_not_overlap(): void
    {
        $limits = BalanceLimits::forSpecies([
            ['ph' => [6.0, 6.5]],
            ['ph' => [7.5, 8.0]],
        ])->toArray();

        $this->assertSame([6.8, 7.9], $limits['ph']['ideal']);
    }

    public function test_humidity_reaching_the_airs_ceiling_has_no_upper_limit(): void
    {
        $limits = BalanceLimits::forSpecies([['humidity' => [70, 100]]]);

        $this->assertSame([70.0, null], $limits->toArray()['humidity']['ideal']);
        $this->assertSame('low', $limits->harmful('humidity', 45.0));
        $this->assertNull($limits->harmful('humidity', 98.0));
    }

    public function test_a_value_is_only_harmful_once_it_leaves_the_safe_range(): void
    {
        $limits = BalanceLimits::forSpecies([]);

        $this->assertNull($limits->harmful('nitrate', 30.0));
        $this->assertSame('high', $limits->harmful('nitrate', 41.0));
        $this->assertSame('low', $limits->harmful('oxygen', 3.9));
    }
}
