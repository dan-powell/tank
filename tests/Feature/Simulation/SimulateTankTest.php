<?php

namespace Tests\Feature\Simulation;

use App\Enums\CreatureIntent;
use App\Enums\CreatureMood;
use App\Enums\PauseReason;
use App\Enums\Sex;
use App\Enums\TankEventType;
use App\Events\TankUpdated;
use App\Jobs\SimulateTank;
use App\Models\Creature;
use App\Models\Plant;
use App\Models\Species;
use App\Models\Tank;
use App\Notifications\TankAlert;
use App\Simulation\SpeciesCatalogue;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class SimulateTankTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Event::fake([TankUpdated::class]);
        $this->freezeSecond();
        config(['simulation.time_scale' => 1]);
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

    public function test_the_auto_feeder_feeds_on_schedule_and_saves_its_hopper_level(): void
    {
        config(['simulation.time_scale' => 60]);
        $tank = Tank::factory()->withAutoFeeder()->create([
            'last_simulated_at' => now()->subMinutes(2),
            'sim_seconds' => 8 * 3600,
            'uneaten_food' => 0,
        ]);

        SimulateTank::dispatchSync($tank);

        $tank->refresh();
        $this->assertSame(27, $tank->auto_feeder_portions);
        $this->assertGreaterThan(0.0, $tank->uneaten_food);
        $this->assertSame(TankEventType::AutoFeeding, $tank->events()->sole()->type);
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

    public function test_skips_a_paused_tank(): void
    {
        $tank = Tank::factory()->paused()->create(['last_simulated_at' => now()->subHour(), 'sim_tick' => 3]);

        SimulateTank::dispatchSync($tank);

        $this->assertSame(3, $tank->fresh()->sim_tick);
        Event::assertNotDispatched(TankUpdated::class);
    }

    public function test_pauses_part_way_when_a_watched_animal_comes_close_to_death(): void
    {
        Notification::fake();
        $species = Species::factory()->catalogue('guppy')->create();
        $tank = Tank::factory()->create([
            'last_simulated_at' => now()->subMinutes(30),
            'sim_seconds' => 0,
            'ammonia' => 5,
            'alert_settings' => ['watched_species' => [$species->id]],
        ]);
        $creature = Creature::factory()->for($tank)->for($species)->create(['health' => 0.3]);

        SimulateTank::dispatchSync($tank);

        $tank->refresh();
        $this->assertTrue($tank->is_paused);
        $this->assertSame(PauseReason::NearDeath, $tank->pause_reason);
        $this->assertLessThan(1800, $tank->sim_seconds);
        $this->assertTrue($tank->last_simulated_at->equalTo(now()));
        $this->assertLessThan(0.25, $creature->fresh()->health);
        $this->assertNull($creature->fresh()->died_at);
        $this->assertTrue($tank->events()->where('type', TankEventType::NearDeath)->exists());
        Notification::assertSentTo($tank->user, TankAlert::class, fn (TankAlert $alert, array $channels): bool => $alert->type === TankEventType::NearDeath && $channels === ['database', 'broadcast']);
    }

    public function test_an_animal_set_not_to_pause_overrides_its_watched_species(): void
    {
        $species = Species::factory()->catalogue('guppy')->create();
        $tank = Tank::factory()->create([
            'last_simulated_at' => now()->subMinutes(30),
            'ammonia' => 5,
            'alert_settings' => ['watched_species' => [$species->id]],
        ]);
        Creature::factory()->for($tank)->for($species)->create(['health' => 0.3, 'pause_when_dying' => false]);

        SimulateTank::dispatchSync($tank);

        $this->assertFalse($tank->fresh()->is_paused);
    }

    public function test_notifies_the_owner_when_the_water_turns_harmful(): void
    {
        Notification::fake();
        $tank = Tank::factory()->uncycled()->create(['last_simulated_at' => now()->subHours(2), 'ammonia' => 0.45, 'uneaten_food' => 5, 'alert_settings' => ['mail' => true]]);
        Creature::factory()->for($tank)->create();

        SimulateTank::dispatchSync($tank);

        Notification::assertSentTo($tank->user, TankAlert::class, fn (TankAlert $alert, array $channels): bool => $alert->parameter === 'ammonia' && in_array('mail', $channels, true));
    }

    public function test_does_not_notify_about_a_parameter_the_owner_turned_off(): void
    {
        Notification::fake();
        $tank = Tank::factory()->uncycled()->create([
            'last_simulated_at' => now()->subHours(2),
            'ammonia' => 0.45,
            'uneaten_food' => 5,
            'alert_settings' => ['disabled_parameters' => ['ammonia']],
        ]);
        Creature::factory()->for($tank)->create();

        SimulateTank::dispatchSync($tank);

        $this->assertTrue($tank->events()->where('type', TankEventType::Warning)->exists());
        Notification::assertNothingSent();
    }

    public function test_plants_on_gravel_raised_above_the_water_wilt(): void
    {
        $tank = Tank::factory()->lit()->withWaterDepth(10)->withSubstrate(fn (int $x, int $z): int => $z < 40 ? 125 : 10)->create([
            'last_simulated_at' => now()->subHour(),
            'layer_count' => 5,
        ]);
        $onLand = Plant::factory()->for($tank)->create(['layer' => 0, 'health' => 1.0]);
        $underWater = Plant::factory()->for($tank)->create(['layer' => 4, 'health' => 1.0]);

        SimulateTank::dispatchSync($tank);

        $this->assertEqualsWithDelta(1.0 - 0.02, $onLand->fresh()->health, 0.0001);
        $this->assertSame(1.0, $underWater->fresh()->health);
    }

    public function test_persists_what_each_creature_is_busy_doing(): void
    {
        $tank = Tank::factory()->create(['last_simulated_at' => now()->subMinutes(10)]);
        $toad = Creature::factory()->for($tank)->for(SpeciesCatalogue::resolve('fire-bellied-toad'))
            ->create(['hunger' => 1.0, 'health' => 0.3]);

        SimulateTank::dispatchSync($tank);

        $toad->refresh();
        $this->assertSame(CreatureIntent::Hunt, $toad->intent);
        $this->assertArrayHasKey(CreatureMood::Skittish->value, $toad->moods);
    }
}
