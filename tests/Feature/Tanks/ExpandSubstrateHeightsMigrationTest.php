<?php

namespace Tests\Feature\Tanks;

use App\Models\Tank;
use App\Simulation\TankGeometry;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ExpandSubstrateHeightsMigrationTest extends TestCase
{
    use RefreshDatabase;

    public function test_one_centimetre_squares_become_a_height_per_grid_column_and_back(): void
    {
        $squares = array_fill(0, 60 * 28, 10);
        $squares[1] = 20;
        $tank = Tank::factory()->create(['substrate_heights' => $squares]);
        $migration = $this->migration();

        $migration->up();

        $tank->refresh();
        $this->assertSame(
            [10, 10, 10, 12, 14, 16, 18, 20, 18, 16],
            array_map(fn (int $x): int => TankGeometry::substrateHeightAt($tank, $x, 2), range(0, 9)),
        );
        $this->assertSame(10, TankGeometry::substrateHeightAt($tank, 299, 137));

        $migration->down();

        $this->assertSame($squares, $tank->fresh()->substrate_heights);
    }

    public function test_unsculpted_tanks_are_left_alone(): void
    {
        $tank = Tank::factory()->create();

        $this->migration()->up();

        $this->assertNull($tank->fresh()->substrate_heights);
    }

    private function migration(): Migration
    {
        return require database_path('migrations/2026_11_08_202002_expand_substrate_heights_to_every_grid_column.php');
    }
}
