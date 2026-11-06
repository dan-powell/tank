<?php

namespace Tests\Feature\Simulation;

use App\Enums\Sex;
use App\Enums\TankEventType;
use App\Events\TankUpdated;
use App\Jobs\SimulateTank;
use App\Models\Creature;
use App\Models\Species;
use App\Models\Tank;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Tests\TestCase;

class SimulateTankTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Event::fake([TankUpdated::class]);
        $this->freezeSecond();
    }

    public function test_advances_the_tank_by_the_elapsed_time_and_notifies_viewers(): void
    {
        $tank = Tank::factory()->create(['last_simulated_at' => now()->subMinutes(10), 'sim_seconds' => 0]);
        $creature = Creature::factory()->for($tank)->create(['hunger' => 0.2, 'age_seconds' => 0]);

        SimulateTank::dispatchSync($tank);

        $tank->refresh();
        $this->assertSame(600, $tank->sim_seconds);
        $this->assertSame(2, $tank->sim_tick);
        $this->assertTrue($tank->last_simulated_at->equalTo(now()));
        $this->assertGreaterThan(0.2, $creature->fresh()->hunger);
        $this->assertSame(600, $creature->fresh()->age_seconds);
        Event::assertDispatched(TankUpdated::class);
    }

    public function test_applies_the_configured_time_scale(): void
    {
        config(['simulation.time_scale' => 60]);
        $tank = Tank::factory()->create(['last_simulated_at' => now()->subMinute(), 'sim_seconds' => 0]);

        SimulateTank::dispatchSync($tank);

        $this->assertSame(3600, $tank->fresh()->sim_seconds);
    }

    public function test_records_deaths_and_keeps_the_body_for_history(): void
    {
        $tank = Tank::factory()->create(['last_simulated_at' => now()->subMinutes(5)]);
        $creature = Creature::factory()->for($tank)->dying()->create();

        SimulateTank::dispatchSync($tank);

        $creature->refresh();
        $this->assertNotNull($creature->died_at);
        $this->assertSame('starvation', $creature->death_cause);
        $this->assertSame(TankEventType::Death, $tank->events()->sole()->type);
    }

    public function test_persists_newborn_fry(): void
    {
        $tank = Tank::factory()->create(['last_simulated_at' => now()->subMinutes(5)]);
        $species = Species::factory()->create();
        $mother = Creature::factory()->for($tank)->for($species)->create([
            'sex' => Sex::Female,
            'gestation_seconds' => 21 * 86400,
        ]);
        Creature::factory()->for($tank)->for($species)->male()->create();

        SimulateTank::dispatchSync($tank);

        $fry = Creature::query()->where('mother_id', $mother->id)->get();
        $this->assertGreaterThanOrEqual(3, $fry->count());
        $this->assertSame(2, $fry->first()->generation);
        $this->assertNull($mother->fresh()->gestation_seconds);
        $this->assertSame(TankEventType::Birth, $tank->events()->sole()->type);
    }

    public function test_skips_a_tank_that_was_simulated_moments_ago(): void
    {
        $tank = Tank::factory()->create(['last_simulated_at' => now()->subSeconds(5), 'sim_tick' => 3]);

        SimulateTank::dispatchSync($tank);

        $this->assertSame(3, $tank->fresh()->sim_tick);
        Event::assertNotDispatched(TankUpdated::class);
    }

    public function test_skips_an_inactive_tank(): void
    {
        $tank = Tank::factory()->inactive()->create(['last_simulated_at' => now()->subHour(), 'sim_tick' => 3]);

        SimulateTank::dispatchSync($tank);

        $this->assertSame(3, $tank->fresh()->sim_tick);
    }
}
