<?php

namespace Tests\Feature\Tanks;

use App\Enums\TankEventType;
use App\Events\TankUpdated;
use App\Models\Creature;
use App\Models\Decoration;
use App\Models\Plant;
use App\Models\Species;
use App\Models\Tank;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Random\Engine\Mt19937;
use Random\Randomizer;
use Tests\TestCase;

class TankStockControllerTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Event::fake([TankUpdated::class]);
    }

    public function test_adds_animals_to_the_tank(): void
    {
        $tank = Tank::factory()->create();
        $species = Species::factory()->create(['name' => 'Guppy']);

        $this->actingAs($tank->user)
            ->post(route('tanks.stock', $tank), ['species_id' => $species->id, 'quantity' => 3])
            ->assertRedirect();

        $this->assertSame(3, $tank->creatures()->whereBelongsTo($species)->count());
        $event = $tank->events()->sole();
        $this->assertSame(TankEventType::LivestockAdded, $event->type);
        $this->assertSame('You added 3 Guppy to the tank.', $event->message);
        Event::assertDispatched(TankUpdated::class);
    }

    public function test_adds_plants_to_the_tank(): void
    {
        $tank = Tank::factory()->create();
        $species = Species::factory()->plant()->create();

        $this->actingAs($tank->user)
            ->post(route('tanks.stock', $tank), ['species_id' => $species->id, 'quantity' => 2])
            ->assertRedirect();

        $this->assertSame(2, $tank->plants()->count());
        $this->assertSame(0, $tank->creatures()->count());
    }

    public function test_new_stock_is_placed_within_the_tanks_depth_layers(): void
    {
        $tank = Tank::factory()->create(['layer_count' => 5]);
        $fish = Species::factory()->create();
        $plant = Species::factory()->plant()->create();

        $this->actingAs($tank->user)->post(route('tanks.stock', $tank), ['species_id' => $fish->id, 'quantity' => 5]);
        $this->actingAs($tank->user)->post(route('tanks.stock', $tank), ['species_id' => $plant->id, 'quantity' => 5]);

        $tank->creatures()->pluck('layer')->each(fn (int $layer) => $this->assertContains($layer, range(0, 4)));
        $tank->plants()->pluck('layer')->each(fn (int $layer) => $this->assertContains($layer, range(0, 2)));
    }

    public function test_rejects_stock_beyond_the_tank_limit(): void
    {
        config(['simulation.max_creatures_per_tank' => 4]);
        $tank = Tank::factory()->create();
        $species = Species::factory()->create();
        Creature::factory()->for($tank)->for($species)->count(3)->create();

        $this->actingAs($tank->user)
            ->post(route('tanks.stock', $tank), ['species_id' => $species->id, 'quantity' => 2])
            ->assertSessionHasErrors(['quantity' => 'This tank cannot hold any more animals.']);

        $this->assertSame(3, $tank->creatures()->count());
    }

    public function test_rejects_more_than_five_at_once(): void
    {
        $tank = Tank::factory()->create();
        $species = Species::factory()->create();

        $this->actingAs($tank->user)
            ->post(route('tanks.stock', $tank), ['species_id' => $species->id, 'quantity' => 6])
            ->assertSessionHasErrors(['quantity' => 'The quantity field must be between 1 and 5.']);
    }

    public function test_requires_a_species_and_quantity(): void
    {
        $tank = Tank::factory()->create();

        $this->actingAs($tank->user)
            ->post(route('tanks.stock', $tank), [])
            ->assertSessionHasErrors(['species_id', 'quantity']);
    }

    public function test_other_users_cannot_stock_the_tank(): void
    {
        $tank = Tank::factory()->create();
        $species = Species::factory()->create();

        $this->actingAs(User::factory()->create())
            ->post(route('tanks.stock', $tank), ['species_id' => $species->id, 'quantity' => 1])
            ->assertForbidden();

        $this->assertSame(0, $tank->creatures()->count());
    }

    public function test_attaches_a_plant_to_a_free_decoration_anchor(): void
    {
        $tank = Tank::factory()->create();
        $decoration = Decoration::factory()->for($tank)->at(40, 4, 0)->create();
        $species = Species::factory()->decorPlant()->create();

        $this->actingAs($tank->user)
            ->post(route('tanks.stock', $tank), ['species_id' => $species->id, 'quantity' => 1, 'decoration_id' => $decoration->id, 'anchor' => 1])
            ->assertSessionHasNoErrors();

        $plant = $tank->plants()->sole();
        $this->assertSame($decoration->id, $plant->decoration_id);
        $this->assertSame(1, $plant->anchor_index);
    }

    public function test_rejects_attaching_a_substrate_only_plant_to_a_decoration(): void
    {
        $tank = Tank::factory()->create();
        $decoration = Decoration::factory()->for($tank)->create();
        $species = Species::factory()->plant()->create(['name' => 'Vallisneria']);

        $this->actingAs($tank->user)
            ->post(route('tanks.stock', $tank), ['species_id' => $species->id, 'quantity' => 1, 'decoration_id' => $decoration->id, 'anchor' => 0])
            ->assertSessionHasErrors(['decoration_id' => 'Vallisneria cannot grow on decorations.']);

        $this->assertSame(0, $tank->plants()->count());
    }

    public function test_rejects_an_anchor_that_a_living_plant_already_occupies(): void
    {
        $tank = Tank::factory()->create();
        $decoration = Decoration::factory()->for($tank)->create();
        $species = Species::factory()->decorPlant()->create();
        Plant::factory()->for($tank)->for($species)->create(['decoration_id' => $decoration->id, 'anchor_index' => 0]);

        $this->actingAs($tank->user)
            ->post(route('tanks.stock', $tank), ['species_id' => $species->id, 'quantity' => 1, 'decoration_id' => $decoration->id, 'anchor' => 0])
            ->assertSessionHasErrors(['anchor' => 'Something is already growing there.']);
    }

    public function test_an_anchor_freed_by_a_dead_plant_can_be_replanted(): void
    {
        $tank = Tank::factory()->create();
        $decoration = Decoration::factory()->for($tank)->create();
        $species = Species::factory()->decorPlant()->create();
        Plant::factory()->for($tank)->for($species)->dead()->create(['decoration_id' => $decoration->id, 'anchor_index' => 0]);

        $this->actingAs($tank->user)
            ->post(route('tanks.stock', $tank), ['species_id' => $species->id, 'quantity' => 1, 'decoration_id' => $decoration->id, 'anchor' => 0])
            ->assertSessionHasNoErrors();

        $this->assertSame(1, $tank->plants()->alive()->count());
    }

    public function test_rejects_an_anchor_above_the_water(): void
    {
        $tank = Tank::factory()->create();
        $decoration = Decoration::factory()->for($tank)->at(100, 115, 0)->create();
        $species = Species::factory()->decorPlant()->create();

        $this->actingAs($tank->user)
            ->post(route('tanks.stock', $tank), ['species_id' => $species->id, 'quantity' => 1, 'decoration_id' => $decoration->id, 'anchor' => 0])
            ->assertSessionHasErrors(['anchor' => 'That spot doesn\'t suit Hornwort.']);
    }

    public function test_rejects_an_anchor_the_decoration_does_not_have(): void
    {
        $tank = Tank::factory()->create();
        $decoration = Decoration::factory()->for($tank)->create();
        $species = Species::factory()->decorPlant()->create();

        $this->actingAs($tank->user)
            ->post(route('tanks.stock', $tank), ['species_id' => $species->id, 'quantity' => 1, 'decoration_id' => $decoration->id, 'anchor' => 3])
            ->assertSessionHasErrors(['anchor' => 'That decoration has no such anchor.']);
    }

    public function test_rejects_attaching_to_another_tanks_decoration(): void
    {
        $tank = Tank::factory()->create();
        $decoration = Decoration::factory()->create();
        $species = Species::factory()->decorPlant()->create();

        $this->actingAs($tank->user)
            ->post(route('tanks.stock', $tank), ['species_id' => $species->id, 'quantity' => 1, 'decoration_id' => $decoration->id, 'anchor' => 0])
            ->assertSessionHasErrors(['decoration_id' => 'The selected decoration id is invalid.']);
    }

    public function test_new_substrate_plants_do_not_root_beneath_decorations(): void
    {
        $this->app->instance(Randomizer::class, new Randomizer(new Mt19937(7)));
        $tank = Tank::factory()->create(['layer_count' => 5]);
        foreach ([0, 20, 35] as $z) {
            Decoration::factory()->for($tank)->at(0, 4, $z)->create(['type' => 'slate-slab']);
            Decoration::factory()->for($tank)->at(24, 4, $z)->create(['type' => 'slate-slab']);
        }
        $species = Species::factory()->plant()->create();

        $this->actingAs($tank->user)
            ->post(route('tanks.stock', $tank), ['species_id' => $species->id, 'quantity' => 5])
            ->assertSessionHasNoErrors();

        $tank->plants()->pluck('root_x')->each(fn (float $rootX) => $this->assertGreaterThanOrEqual(0.5, $rootX));
    }

    public function test_land_animals_need_dry_land(): void
    {
        $tank = Tank::factory()->create();
        $springtail = Species::factory()->catalogue('springtail')->create(['name' => 'Springtail']);

        $this->actingAs($tank->user)
            ->post(route('tanks.stock', $tank), ['species_id' => $springtail->id, 'quantity' => 2])
            ->assertSessionHasErrors(['species_id' => 'There is no dry land for Springtail.']);
    }

    public function test_land_animals_are_put_on_the_dry_land(): void
    {
        $tank = $this->tankWithLandOnTheLeft();
        $springtail = Species::factory()->catalogue('springtail')->create();

        $this->actingAs($tank->user)
            ->post(route('tanks.stock', $tank), ['species_id' => $springtail->id, 'quantity' => 5])
            ->assertRedirect()
            ->assertSessionHasNoErrors();

        $this->assertSame(5, $tank->creatures()->count());
        $tank->creatures()->pluck('zone_x')->each(fn (float $zoneX) => $this->assertLessThan(0.5, $zoneX));
    }

    public function test_amphibians_need_both_water_and_land(): void
    {
        $tank = Tank::factory()->withWaterDepth(0)->create();
        $toad = Species::factory()->catalogue('fire-bellied-toad')->create(['name' => 'Fire-bellied Toad']);

        $this->actingAs($tank->user)
            ->post(route('tanks.stock', $tank), ['species_id' => $toad->id, 'quantity' => 1])
            ->assertSessionHasErrors(['species_id' => 'Fire-bellied Toad needs both water and dry land.']);
    }

    public function test_land_plants_root_above_the_water(): void
    {
        $tank = $this->tankWithLandOnTheLeft();
        $moss = Species::factory()->catalogue('cushion-moss')->create();

        $this->actingAs($tank->user)
            ->post(route('tanks.stock', $tank), ['species_id' => $moss->id, 'quantity' => 5])
            ->assertRedirect()
            ->assertSessionHasNoErrors();

        $this->assertSame(5, $tank->plants()->count());
        $tank->plants()->pluck('root_x')->each(fn (float $rootX) => $this->assertLessThan(0.5, $rootX));
    }

    public function test_land_plants_need_somewhere_dry_to_grow(): void
    {
        $tank = Tank::factory()->create();
        $moss = Species::factory()->catalogue('cushion-moss')->create(['name' => 'Cushion Moss']);

        $this->actingAs($tank->user)
            ->post(route('tanks.stock', $tank), ['species_id' => $moss->id, 'quantity' => 1])
            ->assertSessionHasErrors(['species_id' => 'There is nowhere in the tank for Cushion Moss to grow.']);
    }

    /**
     * A tank with gravel raised above the water on its left half.
     */
    private function tankWithLandOnTheLeft(): Tank
    {
        return Tank::factory()->withSubstrate(fn (int $x): int => $x < 150 ? 153 : 10)->create();
    }
}
