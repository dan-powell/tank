<?php

namespace App\Simulation\Systems;

/**
 * Marks a system that only makes sense with water in the tank (dissolved
 * chemistry, fish, algae); the simulator skips it while the tank is empty.
 */
interface RequiresWater {}
