<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Time Scale
    |--------------------------------------------------------------------------
    |
    | How many simulated seconds pass for every real second. The default of
    | 60 runs one simulated hour per real minute (a simulated day every 24
    | minutes), so tanks need looking after like a virtual pet. Set it to 1
    | to keep tanks in step with the real world.
    |
    */

    'time_scale' => (float) env('SIMULATION_TIME_SCALE', 60),

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

    /*
    |--------------------------------------------------------------------------
    | Auto-feeder
    |--------------------------------------------------------------------------
    |
    | An installed auto-feeder drops one pinch of food at each scheduled hour
    | (simulated time). In hopper mode each feed uses one portion and the
    | user refills the hopper; in unlimited mode it never runs out.
    |
    */

    'auto_feeder' => [
        'hopper_capacity' => 28,
        'schedules' => [
            1 => [9],
            2 => [9, 18],
            3 => [8, 13, 18],
        ],
    ],

    'max_creatures_per_tank' => 150,

    'max_plants_per_tank' => 60,

    'max_decorations_per_tank' => 24,

];
