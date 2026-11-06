<?php

namespace Tests\Feature\Tanks;

use App\Enums\TankEventType;
use App\Events\TankUpdated;
use App\Models\Tank;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Tests\TestCase;

class TankAutoFeederControllerTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Event::fake([TankUpdated::class]);
    }

    public function test_installing_an_auto_feeder_fills_its_hopper(): void
    {
        $tank = Tank::factory()->create();

        $this->actingAs($tank->user)
            ->put(route('tanks.auto-feeder.update', $tank), ['feeds_per_day' => 3, 'unlimited' => false])
            ->assertRedirect();

        $tank->refresh();
        $this->assertTrue($tank->auto_feeder_installed);
        $this->assertSame(3, $tank->auto_feeder_feeds_per_day);
        $this->assertFalse($tank->auto_feeder_unlimited);
        $this->assertSame(28, $tank->auto_feeder_portions);
        $event = $tank->events()->sole();
        $this->assertSame(TankEventType::AutoFeederChanged, $event->type);
        $this->assertSame('You installed an auto-feeder. It feeds 3 times a day from its hopper.', $event->message);
        Event::assertDispatched(TankUpdated::class);
    }

    public function test_changing_the_schedule_keeps_the_hopper_level(): void
    {
        $tank = Tank::factory()->withAutoFeeder()->create(['auto_feeder_portions' => 5]);

        $this->actingAs($tank->user)
            ->put(route('tanks.auto-feeder.update', $tank), ['feeds_per_day' => 1, 'unlimited' => true])
            ->assertRedirect();

        $tank->refresh();
        $this->assertSame(1, $tank->auto_feeder_feeds_per_day);
        $this->assertTrue($tank->auto_feeder_unlimited);
        $this->assertSame(5, $tank->auto_feeder_portions);
        $this->assertSame('You set the auto-feeder to feed once a day with unlimited food.', $tank->events()->sole()->message);
    }

    public function test_rejects_an_unsupported_feeding_schedule(): void
    {
        $tank = Tank::factory()->create();

        $this->actingAs($tank->user)
            ->put(route('tanks.auto-feeder.update', $tank), ['feeds_per_day' => 4, 'unlimited' => false])
            ->assertSessionHasErrors(['feeds_per_day' => 'The selected feeds per day is invalid.']);

        $this->assertFalse($tank->fresh()->auto_feeder_installed);
    }

    public function test_removing_the_auto_feeder_empties_the_hopper(): void
    {
        $tank = Tank::factory()->withAutoFeeder()->create();

        $this->actingAs($tank->user)->delete(route('tanks.auto-feeder.destroy', $tank))->assertRedirect();

        $tank->refresh();
        $this->assertFalse($tank->auto_feeder_installed);
        $this->assertSame(0, $tank->auto_feeder_portions);
        $this->assertSame('You removed the auto-feeder.', $tank->events()->sole()->message);
    }

    public function test_refilling_tops_the_hopper_up_to_capacity(): void
    {
        $tank = Tank::factory()->withAutoFeeder()->create(['auto_feeder_portions' => 3]);

        $this->actingAs($tank->user)->post(route('tanks.auto-feeder.refill', $tank))->assertRedirect();

        $this->assertSame(28, $tank->fresh()->auto_feeder_portions);
        $this->assertSame('You refilled the auto-feeder hopper.', $tank->events()->sole()->message);
    }

    public function test_cannot_refill_a_tank_without_a_hopper(): void
    {
        $tank = Tank::factory()->withAutoFeeder()->create(['auto_feeder_unlimited' => true, 'auto_feeder_portions' => 0]);

        $this->actingAs($tank->user)
            ->post(route('tanks.auto-feeder.refill', $tank))
            ->assertSessionHasErrors(['auto_feeder' => 'This tank has no auto-feeder hopper to refill.']);

        $this->assertSame(0, $tank->fresh()->auto_feeder_portions);
    }

    public function test_other_users_cannot_configure_the_auto_feeder(): void
    {
        $tank = Tank::factory()->create();

        $this->actingAs(User::factory()->create())
            ->put(route('tanks.auto-feeder.update', $tank), ['feeds_per_day' => 2, 'unlimited' => false])
            ->assertForbidden();

        $this->assertFalse($tank->fresh()->auto_feeder_installed);
    }
}
