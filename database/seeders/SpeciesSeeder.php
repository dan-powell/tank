<?php

namespace Database\Seeders;

use App\Simulation\SpeciesCatalogue;
use Illuminate\Database\Seeder;

class SpeciesSeeder extends Seeder
{
    /**
     * Create or update the built-in species catalogue.
     */
    public function run(): void
    {
        SpeciesCatalogue::sync();
    }
}
