<?php

namespace Database\Seeders;

use App\Actions\Tank\CreateStarterTank;
use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(CreateStarterTank $createStarterTank): void
    {
        $this->call(SpeciesSeeder::class);

        $user = User::factory()->create([
            'name' => 'Test User',
            'email' => 'test@example.com',
        ]);

        $createStarterTank->handle($user);
    }
}
