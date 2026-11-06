<?php

namespace Tests\Feature\Tanks;

use App\Models\Tank;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TankPolicyTest extends TestCase
{
    use RefreshDatabase;

    public function test_only_the_owner_can_view_and_update_a_tank(): void
    {
        $tank = Tank::factory()->create();
        $stranger = User::factory()->create();

        $this->assertTrue($tank->user->can('view', $tank));
        $this->assertTrue($tank->user->can('update', $tank));
        $this->assertFalse($stranger->can('view', $tank));
        $this->assertFalse($stranger->can('update', $tank));
    }
}
