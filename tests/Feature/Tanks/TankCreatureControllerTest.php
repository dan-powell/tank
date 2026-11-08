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

class TankCreatureControllerTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Event::fake([TankUpdated::class]);
    }

    public function test_naming_an_animal_stores_the_trimmed_name(): void
    {
        $creature = Creature::factory()->create();

        $this->actingAs($creature->tank->user)
            ->patch(route('tanks.creatures.update', [$creature->tank, $creature]), ['nickname' => '  Bubbles  '])
            ->assertRedirect();

        $this->assertSame('Bubbles', $creature->fresh()->nickname);
    }

    public function test_an_empty_name_clears_it(): void
    {
        $creature = Creature::factory()->create(['nickname' => 'Bubbles']);

        $this->actingAs($creature->tank->user)
            ->patch(route('tanks.creatures.update', [$creature->tank, $creature]), ['nickname' => ''])
            ->assertRedirect();

        $this->assertNull($creature->fresh()->nickname);
    }

    public function test_rejects_a_name_longer_than_40_characters(): void
    {
        $creature = Creature::factory()->create();

        $this->actingAs($creature->tank->user)
            ->patch(route('tanks.creatures.update', [$creature->tank, $creature]), ['nickname' => str_repeat('a', 41)])
            ->assertSessionHasErrors(['nickname' => 'The nickname field must not be greater than 40 characters.']);

        $this->assertNull($creature->fresh()->nickname);
    }

    public function test_removing_an_animal_takes_it_out_of_the_tank_and_logs_it(): void
    {
        $species = Species::factory()->create(['name' => 'Guppy']);
        $creature = Creature::factory()->for($species)->create(['nickname' => 'Bubbles']);

        $this->actingAs($creature->tank->user)
            ->delete(route('tanks.creatures.destroy', [$creature->tank, $creature]))
            ->assertRedirect();

        $creature->refresh();
        $this->assertNotNull($creature->died_at);
        $this->assertSame('removed', $creature->death_cause);
        $event = $creature->tank->events()->sole();
        $this->assertSame(TankEventType::Removed, $event->type);
        $this->assertSame('You removed Bubbles the Guppy from the tank.', $event->message);
        Event::assertDispatched(TankUpdated::class);
    }

    public function test_cannot_remove_an_animal_that_has_already_died(): void
    {
        $creature = Creature::factory()->dead()->create();

        $this->actingAs($creature->tank->user)
            ->delete(route('tanks.creatures.destroy', [$creature->tank, $creature]))
            ->assertNotFound();

        $this->assertSame('old age', $creature->fresh()->death_cause);
    }

    public function test_cannot_reach_an_animal_through_another_tank(): void
    {
        $tank = Tank::factory()->create();
        $creature = Creature::factory()->create(['nickname' => 'Bubbles']);

        $this->actingAs($tank->user)
            ->patch(route('tanks.creatures.update', [$tank, $creature]), ['nickname' => 'Stolen'])
            ->assertNotFound();

        $this->assertSame('Bubbles', $creature->fresh()->nickname);
    }

    public function test_other_users_cannot_remove_an_animal(): void
    {
        $creature = Creature::factory()->create();

        $this->actingAs(User::factory()->create())
            ->delete(route('tanks.creatures.destroy', [$creature->tank, $creature]))
            ->assertForbidden();

        $this->assertNull($creature->fresh()->died_at);
    }
}
