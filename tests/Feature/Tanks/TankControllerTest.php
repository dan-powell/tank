<?php

namespace Tests\Feature\Tanks;

use App\Models\Creature;
use App\Models\Decoration;
use App\Models\Plant;
use App\Models\Tank;
use App\Models\User;
use App\Simulation\SpeciesCatalogue;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

class TankControllerTest extends TestCase
{
    use RefreshDatabase;

    public function test_guests_are_redirected_to_the_login_page(): void
    {
        $tank = Tank::factory()->create();

        $this->get(route('tanks.show', $tank))->assertRedirect(route('login'));
    }

    public function test_owner_sees_living_plants_and_creatures_in_the_snapshot(): void
    {
        $tank = Tank::factory()->create();
        Creature::factory()->for($tank)->count(2)->create();
        Creature::factory()->for($tank)->dead()->create();
        Plant::factory()->for($tank)->create();

        $this->actingAs($tank->user)
            ->get(route('tanks.show', $tank))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('tanks/show')
                ->where('tank.id', $tank->id)
                ->where('tank.layer_count', 5)
                ->has('tank.creatures', 2)
                ->where('tank.creatures.0.zone.layer', 2)
                ->has('tank.creatures.0.zone.center', 2)
                ->has('tank.plants', 1)
                ->has('tank.plants.0.layer')
                ->has('tank.plants.0.root', 2)
                ->has('species')
                ->has('events'));
    }

    public function test_snapshot_includes_decorations_attachments_and_the_tank_layout(): void
    {
        $tank = Tank::factory()->create();
        $decoration = Decoration::factory()->for($tank)->at(10, 4, 2, rotation: 3)->create(['seed' => 99]);
        Plant::factory()->for($tank)->create(['decoration_id' => $decoration->id, 'anchor_index' => 1]);

        $this->actingAs($tank->user)
            ->get(route('tanks.show', $tank))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->where('tank.decorations.0', [
                    'id' => $decoration->id,
                    'type' => 'boulder',
                    'position' => [10, 4, 2],
                    'rotation' => 3,
                    'seed' => 99,
                ])
                ->where('tank.plants.0.attachment', ['decoration_id' => $decoration->id, 'anchor' => 1])
                ->where('tank.grid', ['width' => 300, 'height' => 163, 'depth' => 138, 'water_level' => 153, 'max_water_level' => 153])
                ->where('tank.has_water', true)
                ->where('tank.is_sealed', false)
                ->where('tank.air', ['humidity' => 70, 'oxygen' => 20.9, 'co2' => 420])
                ->where('tank.land_area_cm2', 0)
                ->where('species', fn ($species): bool => collect($species)->every(fn (array $entry): bool => isset($entry['habitat'])))
                ->where('tank.substrate', [10, 300 * 138])
                ->has('decorationCatalogue', 10)
                ->where('decorationCatalogue.1.slug', 'boulder')
                ->where('decorationCatalogue.1.anchors.0', [33, 43, 28]));
    }

    public function test_species_render_settings_come_from_the_catalogue_not_the_stored_copy(): void
    {
        $tank = Tank::factory()->create();
        $guppy = SpeciesCatalogue::resolve('guppy');
        $guppy->update(['params' => [...$guppy->params, 'render' => ['body' => '#000000']]]);
        Creature::factory()->for($tank)->for($guppy)->create();

        $this->actingAs($tank->user)
            ->get(route('tanks.show', $tank))
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->where('species', fn ($species): bool => collect($species)->firstWhere('slug', 'guppy')['render']
                    === SpeciesCatalogue::render('guppy')));
    }

    public function test_other_users_cannot_view_the_tank(): void
    {
        $tank = Tank::factory()->create();

        $this->actingAs(User::factory()->create())
            ->get(route('tanks.show', $tank))
            ->assertForbidden();
    }

    public function test_creating_a_tank_gives_it_the_chosen_size_and_matching_water_and_layers(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->post(route('tanks.store'), [
            'name' => 'Big Tank',
            'width' => 90,
            'height' => 45,
            'depth' => 40,
            'stocked' => false,
        ]);

        $tank = $user->tanks()->sole();
        $response->assertRedirect(route('tanks.show', $tank));
        $this->assertSame('Big Tank', $tank->name);
        $this->assertSame([450, 225, 200], [$tank->grid_width, $tank->grid_height, $tank->grid_depth]);
        $this->assertSame(7, $tank->layer_count);
        $this->assertSame(148, $tank->volume_litres);
        $this->assertSame(0, $tank->creatures()->count());
        $this->assertSame(0, $tank->plants()->count());
    }

    public function test_a_stocked_tank_gets_stock_in_proportion_to_its_water(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)->post(route('tanks.store'), [
            'name' => 'Nano',
            'width' => 30,
            'height' => 25,
            'depth' => 20,
            'stocked' => true,
        ]);

        $tank = $user->tanks()->sole();
        $this->assertSame(13, $tank->volume_litres);
        $this->assertSame(4, $tank->creatures()->count());
        $this->assertSame(2, $tank->plants()->count());
    }

    public function test_a_new_tank_can_be_filled_to_a_chosen_depth(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)->post(route('tanks.store'), [
            'name' => 'Shallow', 'width' => 60, 'height' => 40, 'depth' => 30, 'water_depth' => 6, 'stocked' => false,
        ])->assertSessionHasNoErrors();

        $tank = $user->tanks()->sole();
        $this->assertSame(40, $tank->water_level);
        $this->assertSame(11, $tank->volume_litres);
    }

    public function test_rejects_water_deeper_than_the_new_tank_can_hold(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->post(route('tanks.store'), ['name' => 'Deep', 'width' => 60, 'height' => 30, 'depth' => 30, 'water_depth' => 27])
            ->assertSessionHasErrors(['water_depth' => 'A tank this tall holds at most 26 cm of water.']);
    }

    public function test_an_empty_new_tank_cannot_start_stocked(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->post(route('tanks.store'), ['name' => 'Dry', 'width' => 60, 'height' => 30, 'depth' => 30, 'water_depth' => 0, 'stocked' => true])
            ->assertSessionHasErrors(['stocked' => 'An empty tank cannot start with plants and fish.']);
    }

    public function test_rejects_a_tank_outside_the_allowed_size(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->post(route('tanks.store'), ['name' => 'Huge', 'width' => 200, 'height' => 45, 'depth' => 40])
            ->assertSessionHasErrors(['width' => 'The width field must be between 20 and 120.']);

        $this->assertSame(0, $user->tanks()->count());
    }

    public function test_rejects_a_tank_beyond_the_per_user_limit(): void
    {
        config(['simulation.max_tanks_per_user' => 1]);
        $tank = Tank::factory()->create();

        $this->actingAs($tank->user)
            ->post(route('tanks.store'), ['name' => 'Second', 'width' => 60, 'height' => 30, 'depth' => 30])
            ->assertSessionHasErrors(['name' => 'You cannot keep any more tanks.']);

        $this->assertSame(1, $tank->user->tanks()->count());
    }
}
