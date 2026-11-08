<?php

namespace Tests\Feature\Tanks;

use App\Enums\TankEventType;
use App\Events\TankUpdated;
use App\Models\Decoration;
use App\Models\Plant;
use App\Models\Species;
use App\Models\Tank;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Tests\TestCase;

class TankPlantControllerTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Event::fake([TankUpdated::class]);
    }

    public function test_naming_a_plant_stores_the_name(): void
    {
        $plant = Plant::factory()->create();

        $this->actingAs($plant->tank->user)
            ->patch(route('tanks.plants.update', [$plant->tank, $plant]), ['nickname' => 'Fern'])
            ->assertRedirect();

        $this->assertSame('Fern', $plant->fresh()->nickname);
    }

    public function test_removing_a_plant_uproots_it_and_logs_it(): void
    {
        $species = Species::factory()->plant()->create(['name' => 'Java Fern']);
        $plant = Plant::factory()->for($species)->create();

        $this->actingAs($plant->tank->user)
            ->delete(route('tanks.plants.destroy', [$plant->tank, $plant]))
            ->assertRedirect();

        $this->assertNotNull($plant->fresh()->died_at);
        $event = $plant->tank->events()->sole();
        $this->assertSame(TankEventType::Removed, $event->type);
        $this->assertSame('You removed a Java Fern from the tank.', $event->message);
        Event::assertDispatched(TankUpdated::class);
    }

    public function test_cannot_rename_a_plant_that_has_died(): void
    {
        $plant = Plant::factory()->dead()->create();

        $this->actingAs($plant->tank->user)
            ->patch(route('tanks.plants.update', [$plant->tank, $plant]), ['nickname' => 'Fern'])
            ->assertNotFound();

        $this->assertNull($plant->fresh()->nickname);
    }

    public function test_cannot_reach_a_plant_through_another_tank(): void
    {
        $tank = Tank::factory()->create();
        $plant = Plant::factory()->create();

        $this->actingAs($tank->user)
            ->delete(route('tanks.plants.destroy', [$tank, $plant]))
            ->assertNotFound();

        $this->assertNull($plant->fresh()->died_at);
    }

    public function test_moving_a_plant_replants_it_and_takes_it_off_its_decoration(): void
    {
        $tank = Tank::factory()->create();
        $decoration = Decoration::factory()->for($tank)->at(4, 4, 0)->create();
        $plant = Plant::factory()->for($tank)->for(Species::factory()->decorPlant())->create(['decoration_id' => $decoration->id, 'anchor_index' => 0]);

        $this->actingAs($tank->user)
            ->patch(route('tanks.plants.move', [$tank, $plant]), ['x' => 0.8, 'layer' => 1])
            ->assertRedirect()
            ->assertSessionHasNoErrors();

        $plant->refresh();
        $this->assertSame([0.8, 1, null, null], [$plant->root_x, $plant->layer, $plant->decoration_id, $plant->anchor_index]);
    }

    public function test_a_plant_cannot_be_moved_where_it_would_not_grow(): void
    {
        $tank = $this->tankWithLandOnTheLeft();
        $plant = Plant::factory()->for($tank)->for(Species::factory()->plant()->state(['name' => 'Vallisneria']))->create(['root_x' => 0.8]);

        $this->actingAs($tank->user)
            ->patch(route('tanks.plants.move', [$tank, $plant]), ['x' => 0.2, 'layer' => 1])
            ->assertSessionHasErrors(['x' => "That spot doesn't suit Vallisneria."]);

        $this->assertSame(0.8, $plant->fresh()->root_x);
    }

    public function test_a_plant_cannot_be_moved_under_a_decoration(): void
    {
        $tank = Tank::factory()->create();
        Decoration::factory()->for($tank)->at(0, 4, 0)->create(['type' => 'slate-slab']);
        $plant = Plant::factory()->for($tank)->create(['root_x' => 0.8]);

        $this->actingAs($tank->user)
            ->patch(route('tanks.plants.move', [$tank, $plant]), ['x' => 0.1, 'layer' => 1])
            ->assertSessionHasErrors(['x' => 'Something is in the way there.']);
    }

    /**
     * A tank with gravel raised above the water on its left half.
     */
    private function tankWithLandOnTheLeft(): Tank
    {
        return Tank::factory()->withSubstrate(fn (int $x): int => $x < 150 ? 153 : 10)->create();
    }
}
