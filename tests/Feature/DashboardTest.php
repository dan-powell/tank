<?php

namespace Tests\Feature;

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
        $tank = Tank::factory()->sized(180, 90, 81)->create();

        $this->actingAs($tank->user)
            ->get(route('dashboard'))
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->where('tanks.0.dimensions_cm', [90, 45, 40.5])
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
}
