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

class TankStockControllerTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Event::fake([TankUpdated::class]);
    }

    public function test_adds_animals_to_the_tank(): void
    {
        $tank = Tank::factory()->create();
        $species = Species::factory()->create(['name' => 'Guppy']);

        $this->actingAs($tank->user)
            ->post(route('tanks.stock', $tank), ['species_id' => $species->id, 'quantity' => 3])
            ->assertRedirect();

        $this->assertSame(3, $tank->creatures()->whereBelongsTo($species)->count());
        $event = $tank->events()->sole();
        $this->assertSame(TankEventType::LivestockAdded, $event->type);
        $this->assertSame('You added 3 Guppy to the tank.', $event->message);
        Event::assertDispatched(TankUpdated::class);
    }

    public function test_adds_plants_to_the_tank(): void
    {
        $tank = Tank::factory()->create();
        $species = Species::factory()->plant()->create();

        $this->actingAs($tank->user)
            ->post(route('tanks.stock', $tank), ['species_id' => $species->id, 'quantity' => 2])
            ->assertRedirect();

        $this->assertSame(2, $tank->plants()->count());
        $this->assertSame(0, $tank->creatures()->count());
    }

    public function test_rejects_stock_beyond_the_tank_limit(): void
    {
        config(['simulation.max_creatures_per_tank' => 4]);
        $tank = Tank::factory()->create();
        $species = Species::factory()->create();
        Creature::factory()->for($tank)->for($species)->count(3)->create();

        $this->actingAs($tank->user)
            ->post(route('tanks.stock', $tank), ['species_id' => $species->id, 'quantity' => 2])
            ->assertSessionHasErrors(['quantity' => 'This tank cannot hold any more animals.']);

        $this->assertSame(3, $tank->creatures()->count());
    }

    public function test_rejects_more_than_five_at_once(): void
    {
        $tank = Tank::factory()->create();
        $species = Species::factory()->create();

        $this->actingAs($tank->user)
            ->post(route('tanks.stock', $tank), ['species_id' => $species->id, 'quantity' => 6])
            ->assertSessionHasErrors(['quantity' => 'The quantity field must be between 1 and 5.']);
    }

    public function test_requires_a_species_and_quantity(): void
    {
        $tank = Tank::factory()->create();

        $this->actingAs($tank->user)
            ->post(route('tanks.stock', $tank), [])
            ->assertSessionHasErrors(['species_id', 'quantity']);
    }

    public function test_other_users_cannot_stock_the_tank(): void
    {
        $tank = Tank::factory()->create();
        $species = Species::factory()->create();

        $this->actingAs(User::factory()->create())
            ->post(route('tanks.stock', $tank), ['species_id' => $species->id, 'quantity' => 1])
            ->assertForbidden();

        $this->assertSame(0, $tank->creatures()->count());
    }
}
