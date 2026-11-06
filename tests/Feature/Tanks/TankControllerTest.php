<?php

namespace Tests\Feature\Tanks;

use App\Models\Creature;
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
                ->has('tank.creatures', 2)
                ->has('tank.plants', 1)
                ->has('species')
                ->has('events'));
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
