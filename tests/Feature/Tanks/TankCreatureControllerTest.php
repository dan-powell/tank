<?php

namespace Tests\Feature\Tanks;

use App\Enums\TankEventType;
use App\Events\TankUpdated;
use App\Models\Creature;
use App\Models\Species;
use App\Models\Tank;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Tests\TestCase;

class TankCreatureControllerTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Event::fake([TankUpdated::class]);
    }

    public function test_naming_an_animal_stores_the_trimmed_name(): void
    {
        $creature = Creature::factory()->create();

        $this->actingAs($creature->tank->user)
            ->patch(route('tanks.creatures.update', [$creature->tank, $creature]), ['nickname' => '  Bubbles  '])
            ->assertRedirect();

        $this->assertSame('Bubbles', $creature->fresh()->nickname);
    }

    public function test_an_empty_name_clears_it(): void
    {
        $creature = Creature::factory()->create(['nickname' => 'Bubbles']);

        $this->actingAs($creature->tank->user)
            ->patch(route('tanks.creatures.update', [$creature->tank, $creature]), ['nickname' => ''])
            ->assertRedirect();

        $this->assertNull($creature->fresh()->nickname);
    }

    public function test_rejects_a_name_longer_than_40_characters(): void
    {
        $creature = Creature::factory()->create();

        $this->actingAs($creature->tank->user)
            ->patch(route('tanks.creatures.update', [$creature->tank, $creature]), ['nickname' => str_repeat('a', 41)])
            ->assertSessionHasErrors(['nickname' => 'The nickname field must not be greater than 40 characters.']);

        $this->assertNull($creature->fresh()->nickname);
    }

    public function test_removing_an_animal_takes_it_out_of_the_tank_and_logs_it(): void
    {
        $species = Species::factory()->create(['name' => 'Guppy']);
        $creature = Creature::factory()->for($species)->create(['nickname' => 'Bubbles']);

        $this->actingAs($creature->tank->user)
            ->delete(route('tanks.creatures.destroy', [$creature->tank, $creature]))
            ->assertRedirect();

        $creature->refresh();
        $this->assertNotNull($creature->died_at);
        $this->assertSame('removed', $creature->death_cause);
        $event = $creature->tank->events()->sole();
        $this->assertSame(TankEventType::Removed, $event->type);
        $this->assertSame('You removed Bubbles the Guppy from the tank.', $event->message);
        Event::assertDispatched(TankUpdated::class);
    }

    public function test_cannot_remove_an_animal_that_has_already_died(): void
    {
        $creature = Creature::factory()->dead()->create();

        $this->actingAs($creature->tank->user)
            ->delete(route('tanks.creatures.destroy', [$creature->tank, $creature]))
            ->assertNotFound();

        $this->assertSame('old age', $creature->fresh()->death_cause);
    }

    public function test_cannot_reach_an_animal_through_another_tank(): void
    {
        $tank = Tank::factory()->create();
        $creature = Creature::factory()->create(['nickname' => 'Bubbles']);

        $this->actingAs($tank->user)
            ->patch(route('tanks.creatures.update', [$tank, $creature]), ['nickname' => 'Stolen'])
            ->assertNotFound();

        $this->assertSame('Bubbles', $creature->fresh()->nickname);
    }

    public function test_other_users_cannot_remove_an_animal(): void
    {
        $creature = Creature::factory()->create();

        $this->actingAs(User::factory()->create())
            ->delete(route('tanks.creatures.destroy', [$creature->tank, $creature]))
            ->assertForbidden();

        $this->assertNull($creature->fresh()->died_at);
    }

    public function test_moving_an_animal_gives_it_a_new_home(): void
    {
        $creature = Creature::factory()->create();

        $this->actingAs($creature->tank->user)
            ->patch(route('tanks.creatures.move', [$creature->tank, $creature]), ['x' => 0.7, 'y' => 0.4, 'layer' => 3])
            ->assertRedirect()
            ->assertSessionHasNoErrors();

        $creature->refresh();
        $this->assertSame([0.7, 0.4, 3], [$creature->zone_x, $creature->zone_y, $creature->layer]);
        $this->assertSame(0, $creature->tank->events()->count());
        Event::assertDispatched(TankUpdated::class);
    }

    public function test_a_water_animal_cannot_be_moved_onto_dry_land(): void
    {
        $tank = Tank::factory()->create(['substrate_heights' => $this->landOnTheLeft()]);
        $creature = Creature::factory()->for($tank)->create(['zone_x' => 0.8]);

        $this->actingAs($tank->user)
            ->patch(route('tanks.creatures.move', [$tank, $creature]), ['x' => 0.2, 'y' => 0.5, 'layer' => 2])
            ->assertSessionHasErrors(['x' => 'That spot is out of the water.']);

        $this->assertSame(0.8, $creature->fresh()->zone_x);
    }

    public function test_a_land_animal_can_be_rescued_onto_dry_land_but_not_put_in_the_water(): void
    {
        $tank = Tank::factory()->create(['substrate_heights' => $this->landOnTheLeft()]);
        $springtail = Creature::factory()->for($tank)->for(Species::factory()->catalogue('springtail'))->create(['zone_x' => 0.8]);

        $this->actingAs($tank->user)
            ->patch(route('tanks.creatures.move', [$tank, $springtail]), ['x' => 0.9, 'y' => 0, 'layer' => 2])
            ->assertSessionHasErrors(['x' => 'That spot is under water.']);

        $this->actingAs($tank->user)
            ->patch(route('tanks.creatures.move', [$tank, $springtail]), ['x' => 0.2, 'y' => 0, 'layer' => 2])
            ->assertSessionHasNoErrors();

        $this->assertSame(0.2, $springtail->fresh()->zone_x);
    }

    public function test_rejects_a_layer_the_tank_does_not_have(): void
    {
        $creature = Creature::factory()->create();

        $this->actingAs($creature->tank->user)
            ->patch(route('tanks.creatures.move', [$creature->tank, $creature]), ['x' => 0.5, 'y' => 0.5, 'layer' => 9])
            ->assertSessionHasErrors(['layer' => 'The layer field must be between 0 and 4.']);
    }

    public function test_cannot_move_an_animal_through_a_sealed_lid(): void
    {
        $tank = Tank::factory()->sealed()->create();
        $creature = Creature::factory()->for($tank)->create(['zone_x' => 0.5]);

        $this->actingAs($tank->user)
            ->patch(route('tanks.creatures.move', [$tank, $creature]), ['x' => 0.7, 'y' => 0.4, 'layer' => 3])
            ->assertSessionHasErrors(['lid' => 'Lift the lid first.']);

        $this->assertSame(0.5, $creature->fresh()->zone_x);
    }

    public function test_cannot_move_an_animal_that_has_died(): void
    {
        $creature = Creature::factory()->dead()->create();

        $this->actingAs($creature->tank->user)
            ->patch(route('tanks.creatures.move', [$creature->tank, $creature]), ['x' => 0.7, 'y' => 0.4, 'layer' => 3])
            ->assertNotFound();
    }

    public function test_cannot_move_an_animal_through_another_tank(): void
    {
        $tank = Tank::factory()->create();
        $creature = Creature::factory()->create();

        $this->actingAs($tank->user)
            ->patch(route('tanks.creatures.move', [$tank, $creature]), ['x' => 0.7, 'y' => 0.4, 'layer' => 3])
            ->assertNotFound();
    }

    /**
     * A heightmap (60 x 28 columns) with gravel above the water on the left half.
     *
     * @return list<int>
     */
    private function landOnTheLeft(): array
    {
        $heights = [];

        for ($row = 0; $row < 28; $row++) {
            for ($column = 0; $column < 60; $column++) {
                $heights[] = $column < 30 ? 153 : 10;
            }
        }

        return $heights;
    }
}
