<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Time Scale
    |--------------------------------------------------------------------------
    |
    | How many simulated seconds pass for every real second. 1 keeps the tank
    | in step with the real world; raise it locally (e.g. 60 = one simulated
    | hour per real minute) to watch the ecosystem evolve quickly.
    |
    */

    'time_scale' => (float) env('SIMULATION_TIME_SCALE', 1),

    /*
    |--------------------------------------------------------------------------
    | Stepping
    |--------------------------------------------------------------------------
    |
    | Elapsed simulated time is split into steps no longer than
    | max_step_seconds. If a tank has fallen far behind (for example while
    | the queue was down) at most max_steps are run and the rest is skipped.
    | Ticks closer together than min_interval_seconds are ignored.
    |
    */

    'max_step_seconds' => (int) env('SIMULATION_MAX_STEP_SECONDS', 300),

    'max_steps' => (int) env('SIMULATION_MAX_STEPS', 1440),

    'min_interval_seconds' => (int) env('SIMULATION_MIN_INTERVAL_SECONDS', 30),

    /*
    |--------------------------------------------------------------------------
    | Maintenance
    |--------------------------------------------------------------------------
    */

    'feed_pinch_grams' => 0.08,

    'tap_water' => [
        'temperature' => 21.0,
        'ph' => 7.4,
        'oxygen' => 9.0,
        'co2' => 2.0,
    ],

    'max_creatures_per_tank' => 150,

    'max_plants_per_tank' => 60,

];
