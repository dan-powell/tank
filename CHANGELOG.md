# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- Laravel React starter kit (Inertia v3, React 19, Fortify, Wayfinder, Tailwind 4) with Reverb realtime and DDEV daemons.
- Tank simulation: species catalogue, deterministic simulator, scheduled ticks and live updates.
- Tank care: feeding, water changes, gravel vacuum, algae scrub, lamp, stocking and an auto-feeder.
- Starter tank for every new user, and a dashboard listing their tanks.
- Tank view: 2.5D depth layers with voxel artwork from PNG sprites (detailed placeholder art included), and spotlights.
- 2D (default) and 3D view toggle; left-drag pans, right-drag rotates. The 2D view hides the glass edge lines.
- Tank page panels: water, inhabitants, care, activity log.
- Full-window tank view with a frosted side panel that slides over the tank (toggle button or `P`); the choice is remembered.
- Unit and feature tests.
- Redis (DDEV add-on) for queue, cache and sessions; Horizon runs the queue workers.
- Octane (FrankenPHP) for production, installed on deploy by Deployer 8.
- Volumetric water: rippling surface (food drops send out rings), refraction, depth-tinted absorption, light shafts and total internal reflection from below.
- Caustics on the substrate, plants and creatures.
- Air stone with a rising bubble stream.
- Left-click a fish or plant to select it (brightened, with a halo around its silhouette): the side panel shows only its stats, a name field and a Remove button, with a Back button (or `Esc`) to deselect.

### Changed

- Simulation runs at 60× real time by default.
- Project-specific README and changelog.
- Tank panels use shadcn/ui components throughout; removing an inhabitant now asks for confirmation in a dialog.
- Feeding is done from the Care panel only; clicking the water no longer drops food.

### Fixed

- Z-fighting between creatures and plants sharing a depth layer.
- Assets blocked as mixed content behind an HTTPS reverse proxy (proxies are now trusted).

## 2026-11-06: Initial commits

- Laravel 13 skeleton with DDEV (PHP 8.5, MySQL 8.4) and Laravel Boost.
