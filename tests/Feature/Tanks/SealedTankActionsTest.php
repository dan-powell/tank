<?php

namespace Tests\Feature\Tanks;

use App\Events\TankUpdated;
use App\Models\Species;
use App\Models\Tank;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class SealedTankActionsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Event::fake([TankUpdated::class]);
    }

    /**
     * @return iterable<string, array{0: string, 1: string, 2: array<string, mixed>}>
     */
    public static function handsInActions(): iterable
    {
        yield 'feeding' => ['post', 'tanks.feed', ['x' => 0.5, 'z' => 0.5]];
        yield 'a water change' => ['post', 'tanks.water-change', ['percent' => 25]];
        yield 'changing the water level' => ['put', 'tanks.water-level', ['water_depth' => 10]];
        yield 'adding a decoration' => ['post', 'tanks.decorations.store', ['type' => 'pebble']];
    }

    /**
     * @param  array<string, mixed>  $data
     */
    #[DataProvider('handsInActions')]
    public function test_a_sealed_tank_still_accepts_hands_in_work(string $method, string $route, array $data): void
    {
        $tank = Tank::factory()->sealed()->create();

        $this->actingAs($tank->user)
            ->{$method}(route($route, $tank), $data)
            ->assertSessionHasNoErrors();

        $this->assertTrue($tank->fresh()->is_sealed);
    }

    public function test_a_sealed_tank_can_be_stocked(): void
    {
        $tank = Tank::factory()->sealed()->create();
        $species = Species::factory()->create();

        $this->actingAs($tank->user)
            ->post(route('tanks.stock', $tank), ['species_id' => $species->id, 'quantity' => 1])
            ->assertSessionHasNoErrors();

        $this->assertSame(1, $tank->creatures()->count());
    }
}
