<?php

namespace Tests\Feature\Tanks;

use App\Models\Tank;
use App\Simulation\TankGeometry;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CreateLightFixturesMigrationTest extends TestCase
{
    use RefreshDatabase;

    public function test_existing_tanks_get_an_led_tube_along_the_middle_of_the_gantry(): void
    {
        $migration = $this->migration();
        $migration->down();
        $starter = Tank::factory()->create();
        $wide = Tank::factory()->sized(120 * TankGeometry::CELLS_PER_CM, 200, 50 * TankGeometry::CELLS_PER_CM)->create();

        $migration->up();

        $tube = $starter->lightFixtures()->sole();
        $this->assertSame(['led-tube', 0, 1, 12, 480, 1200], [$tube->type, $tube->column, $tube->row, $tube->length, $tube->on_minute, $tube->off_minute]);
        $tube = $wide->lightFixtures()->sole();
        $this->assertSame([1, 24], [$tube->row, $tube->length]);
    }

    private function migration(): Migration
    {
        return require database_path('migrations/2026_11_15_140023_create_light_fixtures_table.php');
    }
}
