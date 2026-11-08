# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- Laravel React starter kit (Inertia v3, React 19, Fortify, Wayfinder, Tailwind 4) with Reverb realtime and DDEV daemons.
- Tank simulation: species catalogue, deterministic simulator, scheduled ticks and live updates.
- Tank care: feeding, water changes, gravel vacuum, algae scrub, lamp, stocking and an auto-feeder.
- Starter tank for every new user, and a dashboard listing their tanks with their sizes.
- Tank view: 2.5D depth layers with voxel artwork from PNG sprites (detailed placeholder art included), and spotlights.
- 2D (default) and 3D view toggle, bottom left; left-drag pans, right-drag rotates. The 2D view hides the glass edge lines.
- Tabbed tank side panel with animated transitions: Summary (tank name and clock, water, inhabitants, latest activity that fits without scrolling), Activity (full log), Inhabitants, Management and Equipment (auto-feeder); icon tabs with tooltips.
- Searchable, sortable list of every inhabitant; choosing one selects it, as clicking it in the tank does.
- Full-window tank view with a frosted side panel that slides over the tank (pull tab on its edge or `P`); the choice is remembered.
- Unit and feature tests.
- Redis (DDEV add-on) for queue, cache and sessions; Horizon runs the queue workers.
- Octane (FrankenPHP) for production, installed on deploy by Deployer 8.
- Volumetric water: rippling surface (food drops send out rings), refraction, depth-tinted absorption, light shafts and total internal reflection from below.
- Caustics on the substrate, plants and creatures.
- Air stone with a rising bubble stream.
- Left-click a fish or plant to select it (brightened, with a halo around its silhouette): the side panel shows only its stats, a name field and a Remove button, with a Back button (or `Esc`) to deselect.
- Aquascaping tab: add fully 3D voxel decorations (generated rocks, plus coral wall, driftwood arch and chest from MagicaVoxel files); each is auto-placed in a free spot.
- Selected decorations show move arrows (depth only in 3D) and panel controls to turn, nudge, drop onto what's below, or remove them.
- Fish swim over or turn away from decorations, bottom dwellers walk over low ones, snails climb them, and food settles on them.
- Plants that can grow on decorations (Hornwort) can be planted on a decoration's plant spots and spread to its free spots.
- Shared 0.5 cm grid for the tank, with a substrate heightmap that plants, litter, food and bottom dwellers follow.
- Tanks have their own size: a New tank dialog on the dashboard sets the name, inside measurements (20–120 × 20–60 × 15–50 cm) and optional starter stock scaled to the water; each user may keep up to 6 tanks.
- Adjustable water level, set when a tank is created and from Management (fill to the top, a chosen depth, or empty): draining keeps the water as it is, topping up mixes in tap water.
- Empty tanks: water chemistry pauses; feeding, water changes and adding animals are refused, and a tank can't be emptied while animals live in it.
- Plants whose roots are out of the water stop growing and wilt, dying back after about two simulated days.
- Gravel sculpting (in 1 cm squares) in the Aquascaping tab: preset shapes (flat, slope, beaches, island, terraces) and a Raise / Lower / Smooth / Flatten brush in three sizes, with Undo. Raised gravel displaces water and becomes land above the waterline; decorations stay put.

### Changed

- Simulation runs at 60× real time by default.
- Project-specific README and changelog.
- Tank panels use shadcn/ui components throughout; removing an inhabitant now asks for confirmation in a dialog.
- New look from a shadcn preset: Lyra style, teal theme and Source Sans 3 font.
- Feeding is done from the Care panel only; clicking the water no longer drops food.
- A tank's litres now come from the water it holds (existing tanks: 60 L → 47 L) and its depth layers from its depth (about one per 5.5 cm).

### Fixed

- Z-fighting between creatures and plants sharing a depth layer.
- Assets blocked as mixed content behind an HTTPS reverse proxy (proxies are now trusted).

## 2026-11-06: Initial commits

- Laravel 13 skeleton with DDEV (PHP 8.5, MySQL 8.4) and Laravel Boost.
