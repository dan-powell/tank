# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- **Accounts:** Laravel React starter kit with Inertia v3, React 19, Fortify authentication (registration, login, password reset, email verification, two-factor and passkeys), Wayfinder and Tailwind 4.
- **Realtime:** Laravel Reverb broadcasting, with the `@laravel/echo-react` client.
- **DDEV daemons:** `.ddev/config.tank.yaml` runs Reverb (port 8080), a queue worker and the scheduler.
- **Data model:** `species`, `tanks`, `plants`, `creatures` and `tank_events` tables, with models, factories, a policy (owner only) and enums.
- **Species catalogue:** Vallisneria, Hornwort, Guppy, Corydoras and Nerite snail, each with tuned simulation parameters.
- **Simulation engine (`app/Simulation`):**
  - A deterministic, pure-PHP `TankSimulator` that runs twelve systems in order: lighting, water quality, nitrogen cycle, photosynthesis, plant growth, algae, metabolism, feeding, health, reproduction, mortality and warnings.
  - It splits elapsed time into steps of at most 5 simulated minutes and catches up on up to 1,440 steps (5 simulated days).
  - Emergent behaviours include:
    - a bacterial nitrogen cycle
    - ammonia that is more toxic at high pH
    - plants out-competing algae
    - livebearer and egg-layer breeding with population caps
    - adult guppies eating fry, less often in densely planted tanks
    - bottom feeders scavenging leftover food
- **Scheduled simulation:** the `tank:tick` command runs every minute and queues one unique `SimulateTank` job per active tank on the `simulation` queue. A configurable time scale is available through `SIMULATION_TIME_SCALE`.
- **Live updates:** a `TankUpdated` broadcast on the private channel `tank.{id}`. Clients re-fetch the snapshot with an Inertia partial reload.
- **Tank interactions:**
  - Actions: feed at a chosen point, water change (5–90%), vacuum the gravel, scrub algae, toggle the lamp, and add plants or animals.
  - Each action runs under a row lock and is logged to the tank's activity feed.
  - Actions are rate-limited to 30 per minute.
- **Starter tank:** each new user gets a cycled, planted and stocked 60 litre tank when they register. Users without a tank can create one from the dashboard.
- **3D tank page:**
  - Built with react-three-fiber and shows glass, water tinted by algae and detritus, substrate, detritus specks, and day and night lighting.
  - Plants sway (Vallisneria as ribbons, Hornwort as whorled stems) and fade towards brown as their health drops.
  - Fish and snails are drawn procedurally and steer locally: wandering, zone attraction, schooling, food seeking, and surface gasping when oxygen is low.
  - Food particles sink when dropped, and dead animals float up and fade away.
- **Tank page panels:** water readings, inhabitants (counts, health, fry and pregnancies), care controls, an add-stock dialog, an activity log, and toasts for births, deaths and warnings.
- **Dashboard:** lists the user's tanks.
- **Tests:** unit tests for every simulation system and for the simulator, plus feature tests for the tank page, interactions, stocking, the policy, starter tanks, the simulation job and the tick command.

- **Auto-feeder:** owners can add an auto-feeder to a tank. It feeds 1, 2 or 3 times a simulated day and runs either from a 28-portion hopper (with a refill button and a warning when it runs empty) or in unlimited mode. The 3D view shows the feeder on the back glass with its hopper level, and fish chase the food it drops.
- **Tank lighting:** three spotlights hang on a rail above the tank. They are warm by day and dimmer and moonlit at night, so the tank stays visible.

### Changed

- **Simulation speed:** the default `SIMULATION_TIME_SCALE` is now `60` (one simulated hour per real minute), so tanks play like a virtual pet rather than following real time. New tanks start at 08:00 on day 1 instead of the current time of day.
- **Camera:** the tank view can now be orbited a full 360°.
- Replaced the default Laravel README and changelog with project-specific documents.
- Excluded tooling and agent configuration files from the frontend formatter, so `npm run check:fix` no longer rewrites them.

## 2026-11-06: Initial commits

- Created the Laravel 13 skeleton project with DDEV (PHP 8.5, MySQL 8.4).
- Installed Laravel Boost and the project AI guidelines.
