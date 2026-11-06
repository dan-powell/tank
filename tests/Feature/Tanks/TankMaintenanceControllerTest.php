<?php

namespace Tests\Feature\Tanks;

use App\Enums\TankEventType;
use App\Events\TankUpdated;
use App\Models\Tank;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Tests\TestCase;

class TankMaintenanceControllerTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Event::fake([TankUpdated::class]);
    }

    public function test_feeding_adds_food_logs_the_drop_point_and_notifies_viewers(): void
    {
        $tank = Tank::factory()->create(['uneaten_food' => 0]);

        $this->actingAs($tank->user)
            ->post(route('tanks.feed', $tank), ['x' => 0.25, 'z' => 0.75])
            ->assertRedirect();

        $this->assertSame(0.08, $tank->fresh()->uneaten_food);
        $event = $tank->events()->sole();
        $this->assertSame(TankEventType::Feeding, $event->type);
        $this->assertSame(['x' => 0.25, 'z' => 0.75], $event->payload);
        Event::assertDispatched(TankUpdated::class, fn (TankUpdated $update): bool => $update->tank->is($tank));
    }

    public function test_feeding_rejects_a_drop_point_outside_the_tank(): void
    {
        $tank = Tank::factory()->create();

        $this->actingAs($tank->user)
            ->post(route('tanks.feed', $tank), ['x' => 1.5, 'z' => 0.5])
            ->assertSessionHasErrors(['x' => 'The x field must be between 0 and 1.']);

        $this->assertSame(0, $tank->events()->count());
    }

    public function test_water_change_dilutes_waste_and_mixes_in_tap_water(): void
    {
        $tank = Tank::factory()->dirty()->create(['temperature' => 25]);

        $this->actingAs($tank->user)
            ->post(route('tanks.water-change', $tank), ['percent' => 50])
            ->assertRedirect();

        $tank->refresh();
        $this->assertEqualsWithDelta(0.75, $tank->ammonia, 0.0001);
        $this->assertEqualsWithDelta(30, $tank->nitrate, 0.0001);
        $this->assertEqualsWithDelta(23, $tank->temperature, 0.0001);
        $this->assertSame('You changed 50% of the water.', $tank->events()->sole()->message);
    }

    public function test_water_change_rejects_replacing_almost_all_the_water(): void
    {
        $tank = Tank::factory()->create();

        $this->actingAs($tank->user)
            ->post(route('tanks.water-change', $tank), ['percent' => 100])
            ->assertSessionHasErrors(['percent' => 'The percent field must be between 5 and 90.']);
    }

    public function test_vacuuming_removes_detritus_and_a_little_bacteria(): void
    {
        $tank = Tank::factory()->dirty()->create(['bacteria' => 1.0]);

        $this->actingAs($tank->user)->post(route('tanks.vacuum', $tank))->assertRedirect();

        $tank->refresh();
        $this->assertEqualsWithDelta(1.2, $tank->detritus, 0.0001);
        $this->assertEqualsWithDelta(0.95, $tank->bacteria, 0.0001);
    }

    public function test_scrubbing_removes_most_of_the_algae(): void
    {
        $tank = Tank::factory()->dirty()->create();

        $this->actingAs($tank->user)->post(route('tanks.scrub', $tank))->assertRedirect();

        $this->assertEqualsWithDelta(14, $tank->fresh()->algae, 0.0001);
    }

    public function test_light_switch_toggles_the_lamp(): void
    {
        $tank = Tank::factory()->create(['light_on' => true]);

        $this->actingAs($tank->user)->post(route('tanks.light', $tank))->assertRedirect();

        $this->assertFalse($tank->fresh()->light_on);
        $this->assertSame('You switched the lamp off.', $tank->events()->sole()->message);
    }

    public function test_other_users_cannot_maintain_the_tank(): void
    {
        $tank = Tank::factory()->create(['uneaten_food' => 0]);

        $this->actingAs(User::factory()->create())
            ->post(route('tanks.feed', $tank), ['x' => 0.5, 'z' => 0.5])
            ->assertForbidden();

        $this->assertSame(0.0, $tank->fresh()->uneaten_food);
        Event::assertNotDispatched(TankUpdated::class);
    }

    public function test_actions_are_rate_limited(): void
    {
        $tank = Tank::factory()->create();

        for ($i = 0; $i < 30; $i++) {
            $this->actingAs($tank->user)->post(route('tanks.vacuum', $tank));
        }

        $this->actingAs($tank->user)->post(route('tanks.vacuum', $tank))->assertTooManyRequests();
    }
}
