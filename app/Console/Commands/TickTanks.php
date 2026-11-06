<?php

namespace App\Console\Commands;

use App\Jobs\SimulateTank;
use App\Models\Tank;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Signature('tank:tick')]
#[Description('Queue a simulation step for every active tank')]
class TickTanks extends Command
{
    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $queued = 0;

        Tank::query()->active()->chunkById(500, function ($tanks) use (&$queued): void {
            foreach ($tanks as $tank) {
                SimulateTank::dispatch($tank);
                $queued++;
            }
        });

        $this->components->info("Queued {$queued} tank simulation(s).");

        return self::SUCCESS;
    }
}
