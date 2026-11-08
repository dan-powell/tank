<?php

namespace Tests\Feature\Tanks;

use App\Enums\TankEventType;
use App\Events\TankUpdated;
use App\Models\Plant;
use App\Models\Species;
use App\Models\Tank;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Tests\TestCase;

class TankPlantControllerTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Event::fake([TankUpdated::class]);
    }

    public function test_naming_a_plant_stores_the_name(): void
    {
        $plant = Plant::factory()->create();

        $this->actingAs($plant->tank->user)
            ->patch(route('tanks.plants.update', [$plant->tank, $plant]), ['nickname' => 'Fern'])
            ->assertRedirect();

        $this->assertSame('Fern', $plant->fresh()->nickname);
    }

    public function test_removing_a_plant_uproots_it_and_logs_it(): void
    {
        $species = Species::factory()->plant()->create(['name' => 'Java Fern']);
        $plant = Plant::factory()->for($species)->create();

        $this->actingAs($plant->tank->user)
            ->delete(route('tanks.plants.destroy', [$plant->tank, $plant]))
            ->assertRedirect();

        $this->assertNotNull($plant->fresh()->died_at);
        $event = $plant->tank->events()->sole();
        $this->assertSame(TankEventType::Removed, $event->type);
        $this->assertSame('You removed a Java Fern from the tank.', $event->message);
        Event::assertDispatched(TankUpdated::class);
    }

    public function test_cannot_rename_a_plant_that_has_died(): void
    {
        $plant = Plant::factory()->dead()->create();

        $this->actingAs($plant->tank->user)
            ->patch(route('tanks.plants.update', [$plant->tank, $plant]), ['nickname' => 'Fern'])
            ->assertNotFound();

        $this->assertNull($plant->fresh()->nickname);
    }

    public function test_cannot_reach_a_plant_through_another_tank(): void
    {
        $tank = Tank::factory()->create();
        $plant = Plant::factory()->create();

        $this->actingAs($tank->user)
            ->delete(route('tanks.plants.destroy', [$tank, $plant]))
            ->assertNotFound();

        $this->assertNull($plant->fresh()->died_at);
    }
}
