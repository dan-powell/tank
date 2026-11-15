<?php

namespace Tests\Feature\Tanks;

use App\Events\TankUpdated;
use App\Models\Decoration;
use App\Models\Tank;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Tests\TestCase;

class TankDecorationLightControllerTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Event::fake([TankUpdated::class]);
    }

    public function test_switching_on_a_decorations_leds_in_a_new_colour(): void
    {
        $tank = Tank::factory()->sealed()->create();
        $chest = Decoration::factory()->for($tank)->create(['type' => 'treasure-chest']);

        $this->actingAs($tank->user)
            ->patch(route('tanks.decorations.lights', [$tank, $chest]), ['lights_on' => true, 'light_colour' => '#ff0000', 'light_mode' => 'always'])
            ->assertRedirect();

        $chest->refresh();
        $this->assertTrue($chest->lights_on);
        $this->assertSame('#ff0000', $chest->light_colour);
        $this->assertSame('always', $chest->light_mode);
        $this->assertSame(0, $tank->events()->count());
    }
}
