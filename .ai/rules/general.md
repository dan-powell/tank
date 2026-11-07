---
paths:
  - '**'
---

# General

## Run PHP, Artisan, Composer and npm via DDEV
This project runs in DDEV. Never run php, artisan, composer, npm/npx or test runners on the host; prefix them with ddev instead: `ddev artisan ...`, `ddev php ...`, `ddev composer ...`, `ddev npm ...`, `ddev exec vendor/bin/pint --dirty --format agent`, `ddev exec vendor/bin/phpunit ...`. This applies to every command shown elsewhere in the guidelines (e.g. `php artisan test` → `ddev artisan test`).

## Update CHANGELOG.md with every change
Whenever a change adds, changes or removes user-facing behaviour, features or setup, update CHANGELOG.md under `## [Unreleased]` (Keep a Changelog sections: Added / Changed / Removed / Fixed) in the same piece of work, before committing. Keep entries to one short line each with minimal detail; edit or remove existing entries that the change makes outdated rather than piling up history.
