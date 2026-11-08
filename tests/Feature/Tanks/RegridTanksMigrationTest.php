<?php

namespace Tests\Feature\Tanks;

use App\Models\Decoration;
use App\Models\Tank;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RegridTanksMigrationTest extends TestCase
{
    use RefreshDatabase;

    public function test_tanks_and_decorations_move_between_half_centimetre_and_two_millimetre_cells(): void
    {
        $heights = array_fill(0, 60 * 28, 25);
        $heights[0] = 10;
        $tank = Tank::factory()->create(['substrate_heights' => $heights]);
        $decoration = Decoration::factory()->for($tank)->at(100, 10, 50)->create();
        $migration = $this->migration();

        $migration->down();

        $tank->refresh();
        $this->assertSame([120, 65, 55, 61], [$tank->grid_width, $tank->grid_height, $tank->grid_depth, $tank->water_level]);
        $this->assertSame([4, 10], array_slice($tank->substrate_heights, 0, 2));
        $this->assertSame([40, 4, 20], [$decoration->fresh()->x, $decoration->fresh()->y, $decoration->fresh()->z]);

        $migration->up();

        $tank->refresh();
        $this->assertSame([300, 163, 138, 152], [$tank->grid_width, $tank->grid_height, $tank->grid_depth, $tank->water_level]);
        $this->assertSame([10, 25], array_slice($tank->substrate_heights, 0, 2));
        $this->assertSame([100, 10, 50], [$decoration->fresh()->x, $decoration->fresh()->y, $decoration->fresh()->z]);
        $this->assertSame(42, $tank->volume_litres);
    }

    private function migration(): Migration
    {
        return require database_path('migrations/2026_11_08_191314_regrid_tanks_to_two_millimetre_cells.php');
    }
}
