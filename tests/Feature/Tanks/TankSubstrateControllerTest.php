<?php

namespace Tests\Feature\Tanks;

use App\Events\TankUpdated;
use App\Models\Creature;
use App\Models\Decoration;
use App\Models\Tank;
use App\Models\User;
use App\Simulation\TankGeometry;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Tests\TestCase;

class TankSubstrateControllerTest extends TestCase
{
    use RefreshDatabase;

    /** A starter-sized tank's grid has 300 x 138 columns. */
    private const int COLUMNS = 41400;

    protected function setUp(): void
    {
        parent::setUp();

        Event::fake([TankUpdated::class]);
    }

    public function test_sculpting_stores_the_heightmap_and_the_gravel_displaces_water(): void
    {
        $tank = Tank::factory()->create();
        $decoration = Decoration::factory()->for($tank)->at(10, 10, 0)->create();

        $this->actingAs($tank->user)
            ->put(route('tanks.substrate.update', $tank), ['runs' => [10, 300, 25, self::COLUMNS - 300]])
            ->assertRedirect();

        $tank->refresh();
        $this->assertSame([10, 300, 25, self::COLUMNS - 300], $tank->substrate_heights);
        $this->assertSame(10, TankGeometry::substrateHeightAt($tank, 299, 0));
        $this->assertSame(25, TankGeometry::substrateHeightAt($tank, 0, 1));
        $this->assertSame(42, $tank->volume_litres);
        $this->assertSame(10, $decoration->fresh()->y);
        $this->assertSame(0, $tank->events()->count());
        Event::assertDispatched(TankUpdated::class);
    }

    public function test_gravel_raised_above_the_water_everywhere_leaves_a_tank_without_water(): void
    {
        $tank = Tank::factory()->create();

        $this->actingAs($tank->user)
            ->put(route('tanks.substrate.update', $tank), ['runs' => [153, self::COLUMNS]])
            ->assertSessionHasNoErrors();

        $tank->refresh();
        $this->assertSame(0, $tank->volume_litres);
        $this->assertTrue(TankGeometry::isDry($tank));
    }

    public function test_cannot_fill_all_the_water_with_gravel_while_water_animals_live_in_it(): void
    {
        $tank = Tank::factory()->create();
        Creature::factory()->for($tank)->create();

        $this->actingAs($tank->user)
            ->put(route('tanks.substrate.update', $tank), ['runs' => [153, self::COLUMNS]])
            ->assertSessionHasErrors(['runs' => 'Leave some water for the water animals.']);

        $this->assertNull($tank->fresh()->substrate_heights);
    }

    public function test_rejects_a_heightmap_that_does_not_cover_the_tank_floor(): void
    {
        $tank = Tank::factory()->create();

        $this->actingAs($tank->user)
            ->put(route('tanks.substrate.update', $tank), ['runs' => [10, self::COLUMNS - 1]])
            ->assertSessionHasErrors(['runs' => 'The gravel must cover the whole tank floor.']);
    }

    public function test_rejects_runs_that_are_not_whole_height_and_count_pairs(): void
    {
        $tank = Tank::factory()->create();

        $this->actingAs($tank->user)
            ->put(route('tanks.substrate.update', $tank), ['runs' => [10, 0, 10, self::COLUMNS]])
            ->assertSessionHasErrors(['runs' => 'The gravel could not be read.']);
    }

    public function test_rejects_gravel_above_the_highest_water_level(): void
    {
        $tank = Tank::factory()->create();

        $this->actingAs($tank->user)
            ->put(route('tanks.substrate.update', $tank), ['runs' => [154, 1, 10, self::COLUMNS - 1]])
            ->assertSessionHasErrors(['runs' => 'The gravel must stay between the glass floor and 153 cells up.']);
    }

    public function test_other_users_cannot_sculpt_the_tank(): void
    {
        $tank = Tank::factory()->create();

        $this->actingAs(User::factory()->create())
            ->put(route('tanks.substrate.update', $tank), ['runs' => [25, self::COLUMNS]])
            ->assertForbidden();

        $this->assertNull($tank->fresh()->substrate_heights);
    }
}
