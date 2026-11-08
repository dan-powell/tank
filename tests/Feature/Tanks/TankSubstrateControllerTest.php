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

    /** A starter-sized tank's heightmap has 60 x 28 columns. */
    private const int COLUMNS = 1680;

    protected function setUp(): void
    {
        parent::setUp();

        Event::fake([TankUpdated::class]);
    }

    public function test_sculpting_stores_the_heightmap_and_the_gravel_displaces_water(): void
    {
        $tank = Tank::factory()->create();
        $decoration = Decoration::factory()->for($tank)->at(4, 4, 0)->create();

        $this->actingAs($tank->user)
            ->put(route('tanks.substrate.update', $tank), ['heights' => array_fill(0, self::COLUMNS, 10)])
            ->assertRedirect();

        $tank->refresh();
        $this->assertSame(array_fill(0, self::COLUMNS, 10), $tank->substrate_heights);
        $this->assertSame(42, $tank->volume_litres);
        $this->assertSame(4, $decoration->fresh()->y);
        $this->assertSame(0, $tank->events()->count());
        Event::assertDispatched(TankUpdated::class);
    }

    public function test_gravel_raised_above_the_water_everywhere_leaves_a_tank_without_water(): void
    {
        $tank = Tank::factory()->create();

        $this->actingAs($tank->user)
            ->put(route('tanks.substrate.update', $tank), ['heights' => array_fill(0, self::COLUMNS, 61)])
            ->assertSessionHasNoErrors();

        $tank->refresh();
        $this->assertSame(0, $tank->volume_litres);
        $this->assertTrue(TankGeometry::isDry($tank));
    }

    public function test_cannot_fill_all_the_water_with_gravel_while_animals_live_in_it(): void
    {
        $tank = Tank::factory()->create();
        Creature::factory()->for($tank)->create();

        $this->actingAs($tank->user)
            ->put(route('tanks.substrate.update', $tank), ['heights' => array_fill(0, self::COLUMNS, 61)])
            ->assertSessionHasErrors(['heights' => 'Leave some water for the animals.']);

        $this->assertNull($tank->fresh()->substrate_heights);
    }

    public function test_rejects_a_heightmap_of_the_wrong_size(): void
    {
        $tank = Tank::factory()->create();

        $this->actingAs($tank->user)
            ->put(route('tanks.substrate.update', $tank), ['heights' => array_fill(0, 10, 4)])
            ->assertSessionHasErrors(['heights' => 'The heights field must contain 1680 items.']);
    }

    public function test_rejects_gravel_above_the_highest_water_level(): void
    {
        $tank = Tank::factory()->create();
        $heights = array_fill(0, self::COLUMNS, 4);
        $heights[0] = 62;

        $this->actingAs($tank->user)
            ->put(route('tanks.substrate.update', $tank), ['heights' => $heights])
            ->assertSessionHasErrors(['heights.0' => 'The heights.0 field must be between 0 and 61.']);
    }

    public function test_other_users_cannot_sculpt_the_tank(): void
    {
        $tank = Tank::factory()->create();

        $this->actingAs(User::factory()->create())
            ->put(route('tanks.substrate.update', $tank), ['heights' => array_fill(0, self::COLUMNS, 10)])
            ->assertForbidden();

        $this->assertNull($tank->fresh()->substrate_heights);
    }
}
