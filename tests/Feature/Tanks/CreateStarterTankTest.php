<?php

namespace Tests\Feature\Tanks;

use App\Actions\Tank\CreateStarterTank;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CreateStarterTankTest extends TestCase
{
    use RefreshDatabase;

    public function test_creates_a_cycled_planted_and_stocked_tank(): void
    {
        $user = User::factory()->create(['name' => 'Ada Lovelace']);

        $tank = app(CreateStarterTank::class)->handle($user);

        $this->assertSame("Ada's Tank", $tank->name);
        $this->assertSame(0.3, $tank->bacteria);
        $this->assertSame([120, 65, 55], [$tank->grid_width, $tank->grid_height, $tank->grid_depth]);
        $this->assertSame(47, $tank->volume_litres);
        $this->assertSame(5, $tank->layer_count);
        $this->assertSame(7, $tank->plants()->count());
        $this->assertSame(
            ['corydoras' => 4, 'guppy' => 6, 'nerite-snail' => 1],
            $tank->creatures()->join('species', 'species.id', '=', 'creatures.species_id')
                ->selectRaw('species.slug, count(*) as total')->groupBy('species.slug')->orderBy('species.slug')
                ->pluck('total', 'slug')->map(fn ($total): int => (int) $total)->all(),
        );
    }

    public function test_new_users_get_a_starter_tank_on_registration(): void
    {
        $this->post(route('register.store'), [
            'name' => 'Test User',
            'email' => 'test@example.com',
            'password' => 'password',
            'password_confirmation' => 'password',
        ]);

        $this->assertSame(1, User::query()->sole()->tanks()->count());
    }
}
