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
        $this->assertLessThanOrEqual(50, $decoration->z);
        $this->assertLessThanOrEqual(300, $decoration->x + 65);
        $event = $tank->events()->sole();
        $this->assertSame(TankEventType::Aquascaping, $event->type);
        $this->assertSame('You added a Boulder to the tank.', $event->message);
        Event::assertDispatched(TankUpdated::class);
    }

    public function test_new_decorations_keep_clear_of_existing_ones_while_there_is_floor_space(): void
    {
        $tank = Tank::factory()->create();
        $existing = Decoration::factory()->for($tank)->at(100, 10, 0)->create();

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
        $this->coverFloorWithSlabs($tank, y: 10);

        $this->actingAs($tank->user)
            ->post(route('tanks.decorations.store', $tank), ['type' => 'pebble'])
            ->assertRedirect();

        $this->assertSame(30, $tank->decorations()->where('type', 'pebble')->sole()->y);
    }

    public function test_stacked_decorations_may_rise_above_the_water(): void
    {
        $tank = Tank::factory()->create();
        $this->coverFloorWithSlabs($tank, y: 50);

        $this->actingAs($tank->user)
            ->post(route('tanks.decorations.store', $tank), ['type' => 'coral-wall'])
            ->assertRedirect();

        $wall = $tank->decorations()->where('type', 'coral-wall')->sole();
        $this->assertSame(70, $wall->y);
        $this->assertGreaterThan(153, $wall->y + 90);
    }

    public function test_adding_a_decoration_that_would_poke_out_of_the_tank_is_rejected(): void
    {
        $tank = Tank::factory()->create();
        $this->coverFloorWithSlabs($tank, y: 75);

        $this->actingAs($tank->user)
            ->post(route('tanks.decorations.store', $tank), ['type' => 'coral-wall'])
            ->assertSessionHasErrors(['type' => 'There is no room in the tank for the Coral wall.']);

        $this->assertSame(0, $tank->decorations()->where('type', 'coral-wall')->count());
        $this->assertSame(0, $tank->events()->count());
    }

    public function test_decorations_rest_on_raised_substrate(): void
    {
        $tank = Tank::factory()->withSubstrate(fn (): int => 25)->create();

        $this->actingAs($tank->user)
            ->post(route('tanks.decorations.store', $tank), ['type' => 'pebble'])
            ->assertRedirect();

        $this->assertSame(25, $tank->decorations()->sole()->y);
    }

    public function test_decorations_too_big_for_the_tank_are_rejected(): void
    {
        $tank = Tank::factory()->sized(100, 100, 75)->create();

        $this->actingAs($tank->user)
            ->post(route('tanks.decorations.store', $tank), ['type' => 'coral-wall'])
            ->assertSessionHasErrors(['type' => 'There is no room in the tank for the Coral wall.']);
    }

    public function test_moving_a_decoration_is_bounded_by_its_own_tanks_size(): void
    {
        $tank = Tank::factory()->sized(500, 250, 250)->create();
        $decoration = Decoration::factory()->for($tank)->at(10, 10, 0)->create();

        $this->actingAs($tank->user)
            ->patch(route('tanks.decorations.update', [$tank, $decoration]), ['x' => 435, 'y' => 10, 'z' => 195, 'rotation' => 0])
            ->assertSessionHasNoErrors();

        $this->actingAs($tank->user)
            ->patch(route('tanks.decorations.update', [$tank, $decoration]), ['x' => 436, 'y' => 10, 'z' => 0, 'rotation' => 0])
            ->assertSessionHasErrors(['x' => 'The decoration must stay inside the tank.']);

        $this->assertSame(435, $decoration->fresh()->x);
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
        $decoration = Decoration::factory()->at(10, 10, 0)->create();

        $this->actingAs($decoration->tank->user)
            ->patch(route('tanks.decorations.update', [$decoration->tank, $decoration]), ['x' => 50, 'y' => 20, 'z' => 10, 'rotation' => 1])
            ->assertRedirect();

        $decoration->refresh();
        $this->assertSame([50, 20, 10, 1], [$decoration->x, $decoration->y, $decoration->z, $decoration->rotation]);
        $this->assertSame(0, $decoration->tank->events()->count());
        Event::assertDispatched(TankUpdated::class);
    }

    /**
     * A boulder is 65 cells wide and 55 deep; a quarter turn swaps the two.
     */
    #[TestWith([236, 0])]
    #[TestWith([246, 1])]
    public function test_rejects_moving_a_decoration_outside_the_tank(int $x, int $rotation): void
    {
        $decoration = Decoration::factory()->at(10, 10, 0)->create();

        $this->actingAs($decoration->tank->user)
            ->patch(route('tanks.decorations.update', [$decoration->tank, $decoration]), ['x' => $x, 'y' => 10, 'z' => 0, 'rotation' => $rotation])
            ->assertSessionHasErrors(['x' => 'The decoration must stay inside the tank.']);

        $this->assertSame(10, $decoration->fresh()->x);
    }

    public function test_a_quarter_turn_lets_a_decoration_fit_where_it_otherwise_would_not(): void
    {
        $decoration = Decoration::factory()->at(10, 10, 0)->create();

        $this->actingAs($decoration->tank->user)
            ->patch(route('tanks.decorations.update', [$decoration->tank, $decoration]), ['x' => 240, 'y' => 10, 'z' => 0, 'rotation' => 1])
            ->assertSessionHasNoErrors();

        $this->assertSame(240, $decoration->fresh()->x);
    }

    public function test_rejects_an_invalid_rotation(): void
    {
        $decoration = Decoration::factory()->create();

        $this->actingAs($decoration->tank->user)
            ->patch(route('tanks.decorations.update', [$decoration->tank, $decoration]), ['x' => 10, 'y' => 10, 'z' => 0, 'rotation' => 4])
            ->assertSessionHasErrors(['rotation' => 'The rotation field must be between 0 and 3.']);
    }

    public function test_cannot_move_a_decoration_through_another_tank(): void
    {
        $tank = Tank::factory()->create();
        $decoration = Decoration::factory()->at(10, 10, 0)->create();

        $this->actingAs($tank->user)
            ->patch(route('tanks.decorations.update', [$tank, $decoration]), ['x' => 50, 'y' => 10, 'z' => 0, 'rotation' => 0])
            ->assertNotFound();

        $this->assertSame(10, $decoration->fresh()->x);
    }

    public function test_removing_a_decoration_drops_its_plants_to_the_substrate_beneath_them(): void
    {
        $tank = Tank::factory()->create(['layer_count' => 5]);
        $decoration = Decoration::factory()->for($tank)->at(100, 10, 0)->create();
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
        $this->assertEqualsWithDelta(133.5 / 300, $plant->root_x, 0.0001);
        $this->assertSame(0, $plant->layer);
        $this->assertSame('You removed the Boulder from the tank.', $tank->events()->sole()->message);
    }

    /**
     * Cover the whole floor with slate slabs (90 x 20 x 50 cells) at a given height.
     */
    private function coverFloorWithSlabs(Tank $tank, int $y): void
    {
        foreach ([0, 90, 180, 210] as $x) {
            foreach ([0, 50, 88] as $z) {
                Decoration::factory()->for($tank)->at($x, $y, $z)->create(['type' => 'slate-slab']);
            }
        }
    }
}
