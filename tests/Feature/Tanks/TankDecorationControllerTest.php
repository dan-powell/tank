<?php

namespace Tests\Feature\Tanks;

use App\Enums\TankEventType;
use App\Events\TankUpdated;
use App\Models\Decoration;
use App\Models\Plant;
use App\Models\Species;
use App\Models\Tank;
use App\Simulation\TankGeometry;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use PHPUnit\Framework\Attributes\TestWith;
use Random\Engine\Mt19937;
use Random\Randomizer;
use Tests\TestCase;

class TankDecorationControllerTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Event::fake([TankUpdated::class]);
        $this->app->instance(Randomizer::class, new Randomizer(new Mt19937(42)));
    }

    public function test_adding_a_decoration_places_it_on_the_substrate_towards_the_back_and_logs_it(): void
    {
        $tank = Tank::factory()->create();

        $this->actingAs($tank->user)
            ->post(route('tanks.decorations.store', $tank), ['type' => 'boulder'])
            ->assertRedirect();

        $decoration = $tank->decorations()->sole();
        $this->assertSame('boulder', $decoration->type);
        $this->assertSame(0, $decoration->rotation);
        $this->assertSame(TankGeometry::DEFAULT_SUBSTRATE, $decoration->y);
        $this->assertLessThanOrEqual(20, $decoration->z);
        $this->assertLessThanOrEqual(120, $decoration->x + 26);
        $event = $tank->events()->sole();
        $this->assertSame(TankEventType::Aquascaping, $event->type);
        $this->assertSame('You added a Boulder to the tank.', $event->message);
        Event::assertDispatched(TankUpdated::class);
    }

    public function test_new_decorations_keep_clear_of_existing_ones_while_there_is_floor_space(): void
    {
        $tank = Tank::factory()->create();
        $existing = Decoration::factory()->for($tank)->at(40, 4, 0)->create();

        $this->actingAs($tank->user)
            ->post(route('tanks.decorations.store', $tank), ['type' => 'boulder'])
            ->assertRedirect();

        $placed = $tank->decorations()->whereKeyNot($existing->id)->sole();
        $this->assertFalse(TankGeometry::footprint($placed)->overlapsFootprint(TankGeometry::footprint($existing)));
        $this->assertSame(TankGeometry::DEFAULT_SUBSTRATE, $placed->y);
    }

    public function test_decorations_are_stacked_once_the_floor_is_full(): void
    {
        $tank = Tank::factory()->create();
        $this->coverFloorWithSlabs($tank, y: 4);

        $this->actingAs($tank->user)
            ->post(route('tanks.decorations.store', $tank), ['type' => 'pebble'])
            ->assertRedirect();

        $this->assertSame(12, $tank->decorations()->where('type', 'pebble')->sole()->y);
    }

    public function test_stacked_decorations_may_rise_above_the_water(): void
    {
        $tank = Tank::factory()->create();
        $this->coverFloorWithSlabs($tank, y: 20);

        $this->actingAs($tank->user)
            ->post(route('tanks.decorations.store', $tank), ['type' => 'coral-wall'])
            ->assertRedirect();

        $wall = $tank->decorations()->where('type', 'coral-wall')->sole();
        $this->assertSame(28, $wall->y);
        $this->assertGreaterThan(61, $wall->y + 36);
    }

    public function test_adding_a_decoration_that_would_poke_out_of_the_tank_is_rejected(): void
    {
        $tank = Tank::factory()->create();
        $this->coverFloorWithSlabs($tank, y: 30);

        $this->actingAs($tank->user)
            ->post(route('tanks.decorations.store', $tank), ['type' => 'coral-wall'])
            ->assertSessionHasErrors(['type' => 'There is no room in the tank for the Coral wall.']);

        $this->assertSame(0, $tank->decorations()->where('type', 'coral-wall')->count());
        $this->assertSame(0, $tank->events()->count());
    }

    public function test_decorations_rest_on_raised_substrate(): void
    {
        $tank = Tank::factory()->create(['substrate_heights' => array_fill(0, 60 * 28, 10)]);

        $this->actingAs($tank->user)
            ->post(route('tanks.decorations.store', $tank), ['type' => 'pebble'])
            ->assertRedirect();

        $this->assertSame(10, $tank->decorations()->sole()->y);
    }

    public function test_decorations_too_big_for_the_tank_are_rejected(): void
    {
        $tank = Tank::factory()->sized(40, 40, 30)->create();

        $this->actingAs($tank->user)
            ->post(route('tanks.decorations.store', $tank), ['type' => 'coral-wall'])
            ->assertSessionHasErrors(['type' => 'There is no room in the tank for the Coral wall.']);
    }

    public function test_moving_a_decoration_is_bounded_by_its_own_tanks_size(): void
    {
        $tank = Tank::factory()->sized(200, 100, 100)->create();
        $decoration = Decoration::factory()->for($tank)->at(4, 4, 0)->create();

        $this->actingAs($tank->user)
            ->patch(route('tanks.decorations.update', [$tank, $decoration]), ['x' => 174, 'y' => 4, 'z' => 78, 'rotation' => 0])
            ->assertSessionHasNoErrors();

        $this->actingAs($tank->user)
            ->patch(route('tanks.decorations.update', [$tank, $decoration]), ['x' => 175, 'y' => 4, 'z' => 0, 'rotation' => 0])
            ->assertSessionHasErrors(['x' => 'The decoration must stay inside the tank.']);

        $this->assertSame(174, $decoration->fresh()->x);
    }

    public function test_rejects_an_unknown_decoration(): void
    {
        $tank = Tank::factory()->create();

        $this->actingAs($tank->user)
            ->post(route('tanks.decorations.store', $tank), ['type' => 'shipwreck'])
            ->assertSessionHasErrors(['type' => 'The selected type is invalid.']);
    }

    public function test_rejects_decorations_beyond_the_tank_limit(): void
    {
        config(['simulation.max_decorations_per_tank' => 1]);
        $tank = Tank::factory()->create();
        Decoration::factory()->for($tank)->create();

        $this->actingAs($tank->user)
            ->post(route('tanks.decorations.store', $tank), ['type' => 'pebble'])
            ->assertSessionHasErrors(['type' => 'This tank cannot hold any more decorations.']);

        $this->assertSame(1, $tank->decorations()->count());
    }

    public function test_other_users_cannot_decorate_the_tank(): void
    {
        $tank = Tank::factory()->create();

        $this->actingAs(Tank::factory()->create()->user)
            ->post(route('tanks.decorations.store', $tank), ['type' => 'pebble'])
            ->assertForbidden();

        $this->assertSame(0, $tank->decorations()->count());
    }

    public function test_moving_a_decoration_updates_its_position_and_rotation_without_logging(): void
    {
        $decoration = Decoration::factory()->at(4, 4, 0)->create();

        $this->actingAs($decoration->tank->user)
            ->patch(route('tanks.decorations.update', [$decoration->tank, $decoration]), ['x' => 50, 'y' => 20, 'z' => 10, 'rotation' => 1])
            ->assertRedirect();

        $decoration->refresh();
        $this->assertSame([50, 20, 10, 1], [$decoration->x, $decoration->y, $decoration->z, $decoration->rotation]);
        $this->assertSame(0, $decoration->tank->events()->count());
        Event::assertDispatched(TankUpdated::class);
    }

    /**
     * A boulder is 26 cells wide and 22 deep; a quarter turn swaps the two.
     */
    #[TestWith([96, 0])]
    #[TestWith([100, 1])]
    public function test_rejects_moving_a_decoration_outside_the_tank(int $x, int $rotation): void
    {
        $decoration = Decoration::factory()->at(4, 4, 0)->create();

        $this->actingAs($decoration->tank->user)
            ->patch(route('tanks.decorations.update', [$decoration->tank, $decoration]), ['x' => $x, 'y' => 4, 'z' => 0, 'rotation' => $rotation])
            ->assertSessionHasErrors(['x' => 'The decoration must stay inside the tank.']);

        $this->assertSame(4, $decoration->fresh()->x);
    }

    public function test_a_quarter_turn_lets_a_decoration_fit_where_it_otherwise_would_not(): void
    {
        $decoration = Decoration::factory()->at(4, 4, 0)->create();

        $this->actingAs($decoration->tank->user)
            ->patch(route('tanks.decorations.update', [$decoration->tank, $decoration]), ['x' => 96, 'y' => 4, 'z' => 0, 'rotation' => 1])
            ->assertSessionHasNoErrors();

        $this->assertSame(96, $decoration->fresh()->x);
    }

    public function test_rejects_an_invalid_rotation(): void
    {
        $decoration = Decoration::factory()->create();

        $this->actingAs($decoration->tank->user)
            ->patch(route('tanks.decorations.update', [$decoration->tank, $decoration]), ['x' => 4, 'y' => 4, 'z' => 0, 'rotation' => 4])
            ->assertSessionHasErrors(['rotation' => 'The rotation field must be between 0 and 3.']);
    }

    public function test_cannot_move_a_decoration_through_another_tank(): void
    {
        $tank = Tank::factory()->create();
        $decoration = Decoration::factory()->at(4, 4, 0)->create();

        $this->actingAs($tank->user)
            ->patch(route('tanks.decorations.update', [$tank, $decoration]), ['x' => 50, 'y' => 4, 'z' => 0, 'rotation' => 0])
            ->assertNotFound();

        $this->assertSame(4, $decoration->fresh()->x);
    }

    public function test_removing_a_decoration_drops_its_plants_to_the_substrate_beneath_them(): void
    {
        $tank = Tank::factory()->create(['layer_count' => 5]);
        $decoration = Decoration::factory()->for($tank)->at(40, 4, 0)->create();
        $plant = Plant::factory()->for($tank)->for(Species::factory()->decorPlant())->create([
            'decoration_id' => $decoration->id,
            'anchor_index' => 0,
            'root_x' => 0.1,
            'layer' => 3,
        ]);

        $this->actingAs($tank->user)
            ->delete(route('tanks.decorations.destroy', [$tank, $decoration]))
            ->assertRedirect();

        $this->assertModelMissing($decoration);
        $plant->refresh();
        $this->assertNull($plant->decoration_id);
        $this->assertNull($plant->anchor_index);
        $this->assertNull($plant->died_at);
        $this->assertEqualsWithDelta(53.5 / 120, $plant->root_x, 0.0001);
        $this->assertSame(0, $plant->layer);
        $this->assertSame('You removed the Boulder from the tank.', $tank->events()->sole()->message);
    }

    /**
     * Cover the whole floor with slate slabs (36 x 8 x 20 cells) at a given height.
     */
    private function coverFloorWithSlabs(Tank $tank, int $y): void
    {
        foreach ([0, 36, 72, 84] as $x) {
            foreach ([0, 20, 35] as $z) {
                Decoration::factory()->for($tank)->at($x, $y, $z)->create(['type' => 'slate-slab']);
            }
        }
    }
}
