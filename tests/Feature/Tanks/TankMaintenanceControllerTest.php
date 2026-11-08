<?php

namespace Tests\Feature\Tanks;

use App\Enums\TankEventType;
use App\Events\TankUpdated;
use App\Models\Creature;
use App\Models\Species;
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

        for ($i = 0; $i < 40; $i++) {
            $this->actingAs($tank->user)->post(route('tanks.vacuum', $tank));
        }

        $this->actingAs($tank->user)->post(route('tanks.vacuum', $tank))->assertTooManyRequests();
    }

    public function test_draining_lowers_the_water_and_keeps_its_chemistry(): void
    {
        $tank = Tank::factory()->create(['nitrate' => 20.0, 'temperature' => 25.0]);

        $this->actingAs($tank->user)
            ->put(route('tanks.water-level', $tank), ['water_depth' => 10])
            ->assertRedirect();

        $tank->refresh();
        $this->assertSame(60, $tank->water_level);
        $this->assertSame(17, $tank->volume_litres);
        $this->assertSame(20.0, $tank->nitrate);
        $this->assertSame(25.0, $tank->temperature);
        $event = $tank->events()->sole();
        $this->assertSame(TankEventType::WaterLevel, $event->type);
        $this->assertSame('You drained the tank to 10 cm of water (17 L).', $event->message);
        Event::assertDispatched(TankUpdated::class);
    }

    public function test_topping_up_mixes_in_tap_water_in_proportion_to_what_is_added(): void
    {
        $tank = Tank::factory()->withWaterDepth(10)->create(['nitrate' => 20.0]);

        $this->actingAs($tank->user)
            ->put(route('tanks.water-level', $tank), ['water_depth' => 28.6])
            ->assertRedirect();

        $tank->refresh();
        $this->assertSame(153, $tank->water_level);
        $this->assertSame(47, $tank->volume_litres);
        $this->assertEqualsWithDelta(20.0 * 17 / 47, $tank->nitrate, 0.001);
        $this->assertSame('You topped the tank up to 28.6 cm of water (47 L).', $tank->events()->sole()->message);
    }

    public function test_emptying_a_tank_without_animals_leaves_it_dry(): void
    {
        $tank = Tank::factory()->create();

        $this->actingAs($tank->user)
            ->put(route('tanks.water-level', $tank), ['water_depth' => 0])
            ->assertRedirect();

        $tank->refresh();
        $this->assertSame(10, $tank->water_level);
        $this->assertSame(0, $tank->volume_litres);
        $this->assertSame('You emptied the tank.', $tank->events()->sole()->message);
    }

    public function test_refilling_an_empty_tank_starts_it_on_tap_water(): void
    {
        $tank = Tank::factory()->withWaterDepth(0)->create(['nitrate' => 30.0, 'temperature' => 25.0]);

        $this->actingAs($tank->user)
            ->put(route('tanks.water-level', $tank), ['water_depth' => 5])
            ->assertRedirect();

        $tank->refresh();
        $this->assertSame(0.0, $tank->nitrate);
        $this->assertSame(21.0, $tank->temperature);
    }

    public function test_cannot_empty_a_tank_with_water_animals_in_it(): void
    {
        $tank = Tank::factory()->create();
        Creature::factory()->for($tank)->create();

        $this->actingAs($tank->user)
            ->put(route('tanks.water-level', $tank), ['water_depth' => 0])
            ->assertSessionHasErrors(['water_depth' => 'Take the water animals out before emptying the tank.']);

        $this->assertSame(153, $tank->fresh()->water_level);
    }

    public function test_rejects_water_deeper_than_the_tank_allows(): void
    {
        $tank = Tank::factory()->create();

        $this->actingAs($tank->user)
            ->put(route('tanks.water-level', $tank), ['water_depth' => 29])
            ->assertSessionHasErrors(['water_depth' => 'The water depth field must be between 0 and 28.6.']);
    }

    public function test_rejects_water_depths_finer_than_two_millimetres(): void
    {
        $tank = Tank::factory()->create();

        $this->actingAs($tank->user)
            ->put(route('tanks.water-level', $tank), ['water_depth' => 10.3])
            ->assertSessionHasErrors(['water_depth' => 'The water depth field must be a multiple of 0.2.']);
    }

    public function test_an_empty_tank_cannot_be_fed(): void
    {
        $tank = Tank::factory()->withWaterDepth(0)->create(['uneaten_food' => 0]);

        $this->actingAs($tank->user)
            ->post(route('tanks.feed', $tank), ['x' => 0.5, 'z' => 0.5])
            ->assertSessionHasErrors(['x' => 'There is no water to feed into.']);

        $this->assertSame(0.0, $tank->fresh()->uneaten_food);
    }

    public function test_an_empty_tank_cannot_have_its_water_changed(): void
    {
        $tank = Tank::factory()->withWaterDepth(0)->create();

        $this->actingAs($tank->user)
            ->post(route('tanks.water-change', $tank), ['percent' => 25])
            ->assertSessionHasErrors(['percent' => 'There is no water to change.']);
    }

    public function test_animals_cannot_be_added_to_an_empty_tank(): void
    {
        $tank = Tank::factory()->withWaterDepth(0)->create();
        $species = Species::factory()->create();

        $this->actingAs($tank->user)
            ->post(route('tanks.stock', $tank), ['species_id' => $species->id, 'quantity' => 1])
            ->assertSessionHasErrors(['species_id' => 'There is no water for animals to live in.']);

        $this->assertSame(0, $tank->creatures()->count());
    }

    public function test_other_users_cannot_change_the_water_level(): void
    {
        $tank = Tank::factory()->create();

        $this->actingAs(User::factory()->create())
            ->put(route('tanks.water-level', $tank), ['water_depth' => 10])
            ->assertForbidden();

        $this->assertSame(153, $tank->fresh()->water_level);
    }

    public function test_sealing_the_lid_cuts_the_tank_off_and_logs_it(): void
    {
        $tank = Tank::factory()->create();

        $this->actingAs($tank->user)->post(route('tanks.lid', $tank))->assertRedirect();

        $this->assertTrue($tank->fresh()->is_sealed);
        $event = $tank->events()->sole();
        $this->assertSame(TankEventType::Lid, $event->type);
        $this->assertSame('You sealed the tank.', $event->message);
    }

    public function test_lifting_the_lid_opens_a_sealed_tank(): void
    {
        $tank = Tank::factory()->sealed()->create();

        $this->actingAs($tank->user)->post(route('tanks.lid', $tank))->assertRedirect();

        $this->assertFalse($tank->fresh()->is_sealed);
        $this->assertSame('You lifted the lid.', $tank->events()->sole()->message);
    }

    public function test_the_water_can_be_emptied_with_only_land_animals_in_the_tank(): void
    {
        $tank = Tank::factory()->create();
        Creature::factory()->for($tank)->for(Species::factory()->catalogue('springtail'))->create();

        $this->actingAs($tank->user)
            ->put(route('tanks.water-level', $tank), ['water_depth' => 0])
            ->assertSessionHasNoErrors();

        $this->assertSame(10, $tank->fresh()->water_level);
    }

    public function test_setting_a_gradient_background_stores_both_colours_without_logging(): void
    {
        $tank = Tank::factory()->sealed()->create();

        $this->actingAs($tank->user)
            ->put(route('tanks.background', $tank), ['colour' => '#1A2B3C', 'gradient_colour' => '#000000'])
            ->assertRedirect();

        $tank->refresh();
        $this->assertSame('#1a2b3c', $tank->background_colour);
        $this->assertSame('#000000', $tank->background_gradient_colour);
        $this->assertSame(0, $tank->events()->count());
        Event::assertDispatched(TankUpdated::class, fn (TankUpdated $update): bool => $update->tank->is($tank));
    }

    public function test_a_solid_background_clears_the_gradient(): void
    {
        $tank = Tank::factory()->create(['background_gradient_colour' => '#000000']);

        $this->actingAs($tank->user)
            ->put(route('tanks.background', $tank), ['colour' => '#ffeedd', 'gradient_colour' => null])
            ->assertSessionHasNoErrors();

        $tank->refresh();
        $this->assertSame('#ffeedd', $tank->background_colour);
        $this->assertNull($tank->background_gradient_colour);
    }

    public function test_rejects_a_background_that_is_not_a_six_digit_hex_colour(): void
    {
        $tank = Tank::factory()->create();

        $this->actingAs($tank->user)
            ->put(route('tanks.background', $tank), ['colour' => 'blue', 'gradient_colour' => '#fff'])
            ->assertSessionHasErrors([
                'colour' => 'The colour field must be a valid hexadecimal color.',
                'gradient_colour' => 'The gradient colour field must be 7 characters.',
            ]);

        $this->assertSame('#2c3e52', $tank->fresh()->background_colour);
    }

    public function test_only_the_owner_can_change_the_background(): void
    {
        $tank = Tank::factory()->create();

        $this->actingAs(User::factory()->create())
            ->put(route('tanks.background', $tank), ['colour' => '#ffffff'])
            ->assertForbidden();
    }
}
