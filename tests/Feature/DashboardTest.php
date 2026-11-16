<?php

namespace Tests\Feature;

use App\Models\Creature;
use App\Models\Plant;
use App\Models\Species;
use App\Models\Tank;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

class DashboardTest extends TestCase
{
    use RefreshDatabase;

    public function test_guests_are_redirected_to_the_login_page()
    {
        $response = $this->get(route('dashboard'));
        $response->assertRedirect(route('login'));
    }

    public function test_authenticated_users_can_visit_the_dashboard()
    {
        $user = User::factory()->create();
        $this->actingAs($user);

        $response = $this->get(route('dashboard'));
        $response->assertOk();
    }

    public function test_dashboard_lists_only_the_users_own_tanks()
    {
        $tank = Tank::factory()->create();
        Tank::factory()->create();

        $this->actingAs($tank->user)
            ->get(route('dashboard'))
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('dashboard')
                ->has('tanks', 1)
                ->where('tanks.0.id', $tank->id));
    }

    public function test_dashboard_shows_each_tanks_size_and_the_sizes_a_new_tank_may_have(): void
    {
        $tank = Tank::factory()->sized(450, 225, 203)->create();

        $this->actingAs($tank->user)
            ->get(route('dashboard'))
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->where('tanks.0.dimensions_cm', [90, 45, 40.6])
                ->where('sizeLimits', ['width' => [20, 120], 'height' => [20, 60], 'depth' => [15, 50]]));
    }

    public function test_dashboard_shows_each_tanks_backdrop(): void
    {
        $tank = Tank::factory()->create(['background_colour' => '#3a7bb8', 'background_gradient_colour' => '#0b1a33']);

        $this->actingAs($tank->user)
            ->get(route('dashboard'))
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->where('tanks.0.background', ['colour' => '#3a7bb8', 'gradient_colour' => '#0b1a33']));
    }

    public function test_dashboard_shows_whether_each_tank_is_paused_and_its_active_warnings(): void
    {
        $healthy = Tank::factory()->create();
        $troubled = Tank::factory()->for($healthy->user)->dirty()->paused()->create();

        $this->actingAs($healthy->user)
            ->get(route('dashboard'))
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->where('tanks.0.is_paused', false)
                ->where('tanks.0.pause_reason', null)
                ->where('tanks.0.warnings', [])
                ->where('tanks.1.id', $troubled->id)
                ->where('tanks.1.is_paused', true)
                ->where('tanks.1.pause_reason', 'manual')
                ->where('tanks.1.warnings.0', ['parameter' => 'ammonia', 'label' => 'Ammonia', 'side' => 'high'])
                ->where('tanks.1.warnings.1.parameter', 'nitrite')
                ->where('tanks.1.warnings.2.parameter', 'nitrate'));
    }

    public function test_dashboard_lists_each_tanks_living_species_animals_first_and_most_numerous_first(): void
    {
        $tank = Tank::factory()->create();
        $guppy = Species::factory()->create(['name' => 'Guppy']);
        $snail = Species::factory()->catalogue('nerite-snail')->create(['name' => 'Nerite snail']);
        $plant = Species::factory()->plant()->create(['name' => 'Vallisneria']);
        Creature::factory()->for($tank)->for($guppy)->create();
        Creature::factory()->for($tank)->for($snail)->count(2)->create();
        Creature::factory()->for($tank)->for($guppy)->dead()->count(3)->create();
        Plant::factory()->for($tank)->for($plant)->count(5)->create();

        $this->actingAs($tank->user)
            ->get(route('dashboard'))
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->where('tanks.0.creatures_count', 3)
                ->where('tanks.0.plants_count', 5)
                ->where('tanks.0.species', [
                    ['id' => $snail->id, 'slug' => $snail->slug, 'name' => 'Nerite snail', 'kind' => 'invertebrate', 'count' => 2],
                    ['id' => $guppy->id, 'slug' => $guppy->slug, 'name' => 'Guppy', 'kind' => 'fish', 'count' => 1],
                    ['id' => $plant->id, 'slug' => $plant->slug, 'name' => 'Vallisneria', 'kind' => 'plant', 'count' => 5],
                ]));
    }
}
