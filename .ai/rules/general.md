---
paths:
  - '**'
---

# General

## Run PHP, Artisan, Composer and npm via DDEV
This project runs in DDEV. Never run php, artisan, composer, npm/npx or test runners on the host; prefix them with ddev instead: `ddev artisan ...`, `ddev php ...`, `ddev composer ...`, `ddev npm ...`, `ddev exec vendor/bin/pint --dirty --format agent`, `ddev exec vendor/bin/phpunit ...`. This applies to every command shown elsewhere in the guidelines (e.g. `php artisan test` → `ddev artisan test`).
