<?php

namespace Tests\Feature\Tanks;

use App\Enums\TankEventType;
use App\Events\TankUpdated;
use App\Models\LightFixture;
use App\Models\Tank;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Tests\TestCase;

class TankLightFixtureControllerTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Event::fake([TankUpdated::class]);
    }

    public function test_hanging_a_light_uses_its_catalogue_colour_and_the_default_timer(): void
    {
        $tank = Tank::factory()->create();

        $this->actingAs($tank->user)
            ->post(route('tanks.lights.store', $tank), ['type' => 'spotlight', 'column' => 3, 'row' => 2])
            ->assertRedirect();

        $fixture = $tank->lightFixtures()->sole();
        $this->assertSame(['spotlight', 3, 2, 1], [$fixture->type, $fixture->column, $fixture->row, $fixture->length]);
        $this->assertSame(['#fff1d6', 80, 480, 1200, 30], [
            $fixture->colour, $fixture->brightness, $fixture->on_minute, $fixture->off_minute, $fixture->ramp_minutes,
        ]);
        $event = $tank->events()->sole();
        $this->assertSame(TankEventType::Lighting, $event->type);
        $this->assertSame('You hung a new Spotlight from the gantry.', $event->message);
        Event::assertDispatched(TankUpdated::class);
    }

    public function test_tubes_span_at_least_two_slots(): void
    {
        $tank = Tank::factory()->create();

        $this->actingAs($tank->user)
            ->post(route('tanks.lights.store', $tank), ['type' => 'led-tube', 'column' => 0, 'row' => 0, 'length' => 1])
            ->assertRedirect();

        $this->assertSame(2, $tank->lightFixtures()->sole()->length);
    }

    public function test_rejects_a_light_over_one_already_hanging(): void
    {
        $tank = Tank::factory()->create();
        LightFixture::factory()->for($tank)->tube(column: 2, row: 1, length: 4)->create();

        $this->actingAs($tank->user)
            ->post(route('tanks.lights.store', $tank), ['type' => 'flood', 'column' => 5, 'row' => 1])
            ->assertSessionHasErrors(['column' => 'Another light is already hanging there.']);

        $this->assertSame(1, $tank->lightFixtures()->count());
    }

    public function test_rejects_a_light_off_the_end_of_the_gantry(): void
    {
        $tank = Tank::factory()->create();

        $this->actingAs($tank->user)
            ->post(route('tanks.lights.store', $tank), ['type' => 'led-tube', 'column' => 10, 'row' => 0, 'length' => 3])
            ->assertSessionHasErrors(['column' => 'That light would hang off the end of the gantry.']);

        $this->assertSame(0, $tank->lightFixtures()->count());
    }

    public function test_rejects_more_lights_than_the_gantry_takes(): void
    {
        config(['simulation.lighting.max_fixtures' => 1]);
        $tank = Tank::factory()->create();
        LightFixture::factory()->for($tank)->at(0, 0)->create();

        $this->actingAs($tank->user)
            ->post(route('tanks.lights.store', $tank), ['type' => 'spotlight', 'column' => 5, 'row' => 0])
            ->assertSessionHasErrors(['type' => 'The gantry cannot take any more lights.']);
    }

    public function test_adjusting_a_light_changes_only_the_settings_sent_without_logging(): void
    {
        $tank = Tank::factory()->create();
        $fixture = LightFixture::factory()->for($tank)->create();

        $this->actingAs($tank->user)
            ->patch(route('tanks.lights.update', [$tank, $fixture]), ['colour' => '#ff00aa', 'brightness' => 40, 'off_minute' => 60])
            ->assertRedirect();

        $fixture->refresh();
        $this->assertSame(['#ff00aa', 40, 480, 60], [$fixture->colour, $fixture->brightness, $fixture->on_minute, $fixture->off_minute]);
        $this->assertSame(0, $tank->events()->count());
        Event::assertDispatched(TankUpdated::class);
    }

    public function test_rejects_moving_a_light_onto_another(): void
    {
        $tank = Tank::factory()->create();
        LightFixture::factory()->for($tank)->at(4, 0)->create();
        $fixture = LightFixture::factory()->for($tank)->at(0, 0)->create();

        $this->actingAs($tank->user)
            ->patch(route('tanks.lights.update', [$tank, $fixture]), ['column' => 4])
            ->assertSessionHasErrors(['column' => 'Another light is already hanging there.']);

        $this->assertSame(0, $fixture->fresh()->column);
    }

    public function test_rejects_invalid_settings(): void
    {
        $tank = Tank::factory()->create();
        $fixture = LightFixture::factory()->for($tank)->create();

        $this->actingAs($tank->user)
            ->patch(route('tanks.lights.update', [$tank, $fixture]), ['colour' => 'red', 'brightness' => 0, 'on_minute' => 1440])
            ->assertSessionHasErrors(['colour', 'brightness', 'on_minute']);
    }

    public function test_taking_a_light_down(): void
    {
        $tank = Tank::factory()->create();
        $fixture = LightFixture::factory()->for($tank)->create();

        $this->actingAs($tank->user)->delete(route('tanks.lights.destroy', [$tank, $fixture]))->assertRedirect();

        $this->assertModelMissing($fixture);
        $this->assertSame('You took the Spotlight down from the gantry.', $tank->events()->sole()->message);
    }

    public function test_lights_can_be_changed_while_the_lid_is_sealed(): void
    {
        $tank = Tank::factory()->sealed()->create();

        $this->actingAs($tank->user)
            ->post(route('tanks.lights.store', $tank), ['type' => 'flood', 'column' => 0, 'row' => 0])
            ->assertSessionHasNoErrors();

        $this->assertSame(1, $tank->lightFixtures()->count());
    }

    public function test_cannot_change_a_light_on_another_tank(): void
    {
        $tank = Tank::factory()->create();
        $otherFixture = LightFixture::factory()->create();

        $this->actingAs($tank->user)
            ->patch(route('tanks.lights.update', [$tank, $otherFixture]), ['brightness' => 10])
            ->assertNotFound();
    }

    public function test_other_users_cannot_hang_lights(): void
    {
        $tank = Tank::factory()->create();

        $this->actingAs(User::factory()->create())
            ->post(route('tanks.lights.store', $tank), ['type' => 'spotlight', 'column' => 0, 'row' => 0])
            ->assertForbidden();

        $this->assertSame(0, $tank->lightFixtures()->count());
    }
}
