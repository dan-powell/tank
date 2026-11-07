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
- Unit and feature tests.

### Changed

- Simulation runs at 60× real time by default.
- Project-specific README and changelog.

### Fixed

- Z-fighting between creatures and plants sharing a depth layer.

## 2026-11-06: Initial commits

- Laravel 13 skeleton with DDEV (PHP 8.5, MySQL 8.4) and Laravel Boost.
