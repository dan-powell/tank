<?php

namespace Tests\Feature\Tanks;

use App\Models\Creature;
use App\Models\Decoration;
use App\Models\Plant;
use App\Models\Tank;
use App\Models\User;
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
                ->where('tank.grid', ['width' => 120, 'height' => 65, 'depth' => 55, 'water_level' => 61, 'substrate_column' => 4])
                ->has('tank.substrate', 30 * 14)
                ->where('tank.substrate.0', 4)
                ->has('decorationCatalogue', 6)
                ->where('decorationCatalogue.1.slug', 'boulder')
                ->where('decorationCatalogue.1.anchors.0', [13, 17, 11]));
    }

    public function test_other_users_cannot_view_the_tank(): void
    {
        $tank = Tank::factory()->create();

        $this->actingAs(User::factory()->create())
            ->get(route('tanks.show', $tank))
            ->assertForbidden();
    }

    public function test_user_without_a_tank_gets_a_starter_tank(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->post(route('tanks.store'));

        $tank = $user->tanks()->sole();
        $response->assertRedirect(route('tanks.show', $tank));
        $this->assertSame(11, $tank->creatures()->count());
    }

    public function test_user_with_a_tank_is_sent_to_it_instead_of_getting_another(): void
    {
        $tank = Tank::factory()->create();

        $this->actingAs($tank->user)
            ->post(route('tanks.store'))
            ->assertRedirect(route('tanks.show', $tank));

        $this->assertSame(1, $tank->user->tanks()->count());
    }
}
