<?php

namespace Tests\Feature\Simulation;

use App\Jobs\SimulateTank;
use App\Models\Tank;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class TickTanksTest extends TestCase
{
    use RefreshDatabase;

    public function test_queues_a_simulation_for_each_active_tank_only(): void
    {
        Queue::fake();
        $active = Tank::factory()->count(2)->create();
        Tank::factory()->inactive()->create();

        $this->artisan('tank:tick')->assertSuccessful();

        Queue::assertPushedOn('simulation', SimulateTank::class);
        Queue::assertPushed(SimulateTank::class, 2);
        Queue::assertPushed(SimulateTank::class, fn (SimulateTank $job): bool => $active->contains($job->tank));
    }
}
