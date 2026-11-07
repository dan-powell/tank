# Tank

An experimental website where every user owns a persistent virtual aquarium. The server runs a simple ecosystem simulation: water chemistry, plant growth, hunger, health, breeding and death. The simulation keeps running whether or not anyone is watching. In the browser, a 3D scene shows a rough, animated picture of what the simulation says is happening.

## How it works

The project is split into two halves.

**Backend: the persistent simulation (Laravel).** Each tank's state lives in MySQL. Every minute the scheduler queues one `SimulateTank` job per active tank. The job advances the tank by however much time has passed since it last ran, saves the result and broadcasts a notification. The simulation is coarse on purpose: it tracks *what* is in the tank and *how it is doing*, not exact positions.

**Frontend: the visualisation (React + three.js).** The tank page renders the latest snapshot with react-three-fiber. Fish have no stored position, only a preferred *zone*. Their moment-to-moment movement (wandering, schooling, chasing food, gasping at the surface when oxygen is low) is local steering that runs in the browser. When the server broadcasts an update over websockets (Laravel Reverb), the page re-fetches the snapshot and reconciles it: new fish fade in, dead ones float up, and plants grow.

```
Browser (Inertia + React + R3F)            Laravel
 ├─ tanks/show page  ◄── snapshot props ── TankController@show
 ├─ local steering, sway, food particles
 ├─ POST /tanks/{tank}/feed, … ───────────► Actions (row-locked transaction)
 └─ private channel tank.{id} ◄── Reverb ◄── TankUpdated event
                                                  ▲
 Scheduler (every minute) → tank:tick → SimulateTank job (queue: simulation)
                                          └─ TankSimulator (pure PHP)
```

### The simulation engine

The engine in `app/Simulation` is plain PHP with no Eloquent or facades. `TankSimulator::advance()` takes a `TankState` and a number of seconds, splits the time into steps of at most 5 simulated minutes, and runs a pipeline of systems in order:

| System | What it does |
| --- | --- |
| Lighting | The lamp follows an 08:00–20:00 timer while the user's switch is on |
| Water quality | Heater, surface gas exchange (oxygen and CO₂) and pH buffering |
| Nitrogen cycle | Food and detritus rot into ammonia; bacteria convert ammonia → nitrite → nitrate and grow with the load |
| Photosynthesis | Plants and algae produce oxygen in light and respire in the dark |
| Plant growth | Plants grow on nitrogen, sicken in poor conditions and spread new shoots |
| Algae | Algae bloom on light and nutrients unless plants out-compete them |
| Metabolism | Animals get hungry, use oxygen, excrete waste and grow |
| Auto-feeder | An installed feeder drops a pinch of food at each scheduled hour, from its hopper or in unlimited mode |
| Feeding | Mid-water fish reach food first; bottom feeders get what sinks; snails graze algae |
| Health | Ammonia (worse at high pH), nitrite, nitrate, low oxygen, wrong temperature or pH, and starvation all damage health |
| Reproduction | Livebearers and egg-layers breed when healthy, fed and paired, up to a population cap |
| Mortality | Deaths from poor health, old age, or fry being eaten (less often in planted tanks) |
| Warnings | Logs an event when a water parameter crosses into a harmful range |

Each step's random numbers are seeded from the tank's seed and tick number, so a run is deterministic and the systems can be unit-tested directly. `TankStateRepository` is the only part that touches the database.

Species and their tuned parameters are defined in `App\Simulation\SpeciesCatalogue`. To add a species, add an entry there and run the species seeder. There are five at the moment:

- **Plants:** Vallisneria and Hornwort
- **Fauna:** Guppy (livebearer, eats fry), Corydoras (egg-layer, bottom feeder) and Nerite snail (algae grazer, doesn't breed)

### Units and conventions

- **Concentrations:** ammonia, nitrite, nitrate, oxygen and CO₂ are in mg/L (ppm).
- **Other tank quantities:** detritus and uneaten food in grams, algae as percentage coverage, bacteria as nitrifying capacity in ppm per hour.
- **Positions:** `x` and `y` are normalised to 0..1 within the tank, with `y` as height above the substrate. Depth is a whole-number layer from `0` (the back glass) to `layer_count - 1`.
- **Animal sizes:** centimetres. Plant sizes are abstract biomass units, and `segments` is derived from size for rendering.

### User interactions

Owners can feed (click the water surface to choose where food lands), vacuum the gravel, scrub algae, change 10–75% of the water, toggle the lamp, and add plants or animals. They can also add an auto-feeder that feeds 1–3 times a simulated day. It runs either from a 28-portion hopper they refill or in unlimited mode. Each interaction is an action class in `app/Actions/Tank`. It takes the same row lock as the simulation job, logs a `TankEvent` and broadcasts `TankUpdated`. Interactions are rate-limited to 30 per minute per user.

New users get a cycled, planted and stocked 60 litre starter tank when they register.

## Tech stack

- PHP 8.5, Laravel 13, MySQL 8.4
- Laravel React starter kit: Inertia v3, React 19, Fortify auth, Wayfinder, Tailwind 4
- Laravel Reverb and `@laravel/echo-react` for websockets
- Redis for queue, cache and sessions; Laravel Horizon runs the queue workers
- Laravel Octane (FrankenPHP) in production
- three.js, @react-three/fiber and @react-three/drei for the 3D scene
- DDEV for local development

## Local development

The project runs in [DDEV](https://ddev.com). Run every PHP, Composer and npm command through it, never directly on the host.

```bash
ddev start
ddev composer install
ddev npm install
ddev artisan migrate --seed   # creates test@example.com / password with a starter tank
ddev npm run build            # or `ddev npm run dev` while working on the frontend
```

Then open <https://tank.ddev.site>.

`.ddev/config.tank.yaml` starts three background processes with the web container:

| Daemon | Command |
| --- | --- |
| `reverb` | `php artisan reverb:start` on port 8080 (exposed as `wss://tank.ddev.site:8080`) |
| `horizon` | `php artisan horizon:listen --poll` (queues `simulation` and `default`, dashboard at `/horizon`) |
| `scheduler` | `php artisan schedule:work` (runs `tank:tick` every minute and `horizon:snapshot` every five) |

Redis runs as a DDEV service (`ddev/ddev-redis` add-on). `horizon:listen` restarts Horizon when PHP files change. Restart DDEV after changing the daemon configuration.

### Configuration

Simulation settings are in `config/simulation.php`:

| Env variable | Default | Purpose |
| --- | --- | --- |
| `SIMULATION_TIME_SCALE` | `60` | Simulated seconds per real second. The default runs one simulated hour per real minute (a day every 24 minutes). Set it to `1` to follow real time. |
| `SIMULATION_MAX_STEP_SECONDS` | `300` | Longest single simulation step |
| `SIMULATION_MAX_STEPS` | `1440` | Catch-up limit per job (5 simulated days, about 2 real hours at the default time scale); any time beyond it is skipped |
| `SIMULATION_MIN_INTERVAL_SECONDS` | `30` | Ticks closer together than this are ignored |

Reverb needs `REVERB_HOST="tank.ddev.site"`, `REVERB_PORT=8080` and `REVERB_SCHEME=https`, as shown in `.env.example`.

### Useful commands

```bash
ddev artisan tank:tick                         # queue a simulation step for every active tank now
ddev artisan db:seed --class=SpeciesSeeder     # sync catalogue changes to the database
ddev artisan test --compact                    # run the test suite
ddev exec vendor/bin/pint --dirty --format agent
ddev npm run check                             # frontend lint + format
ddev npm run types:check
```

## Production

In production the app runs on Laravel Octane (FrankenPHP) over plain HTTP on port 8080, behind a reverse proxy that terminates TLS. `bootstrap/app.php` trusts every proxy (`trustProxies(at: '*')`), so Laravel uses the `X-Forwarded-*` headers to generate `https://` URLs. Without that, the browser blocks asset URLs as mixed content.

- **Port 8080 must only be reachable through the proxy.** Otherwise clients could forge the forwarded headers. If it has to be exposed, restrict `trustProxies` to the proxy's IP range.
- **Set `APP_URL` to the public `https://` URL.** Queued jobs and the scheduler build URLs from it outside web requests.
- **Build the frontend with the public Reverb settings** (`VITE_REVERB_HOST`, `VITE_REVERB_PORT`, `VITE_REVERB_SCHEME=https`). They are compiled into the assets, and getting them wrong blocks websockets as mixed content too.

## Project layout

| Path | Contents |
| --- | --- |
| `app/Simulation` | Simulation engine, state classes, species catalogue, repository |
| `app/Simulation/Systems` | One class per ecosystem system |
| `app/Actions/Tank` | User interactions and starter tank creation |
| `app/Jobs/SimulateTank.php`, `app/Console/Commands/TickTanks.php` | Scheduled simulation |
| `app/Events/TankUpdated.php` | Broadcast on `private-tank.{id}` (a small payload; clients re-fetch the snapshot) |
| `app/Http/Resources` | Snapshot shape sent to the browser |
| `resources/js/pages/tanks/show.tsx` | Tank page |
| `resources/js/components/tank` | 3D scene, models, and HUD panels |
| `resources/js/lib/tank` | Coordinate mapping, client-side world (food and positions), steering |
| `tests/Unit/Simulation` | Unit tests for each system and the simulator |
| `tests/Feature/Tanks`, `tests/Feature/Simulation` | HTTP, job and command tests |

## Roadmap ideas

- More species: cherry shrimp (eat detritus, breed in planted tanks), pea puffers (eat snails), neon tetras, duckweed (blocks light), Java fern
- Pest snail booms when the tank is overfed
- Disease outbreaks such as ich, triggered by temperature swings
- Heaters and filters as equipment the user manages
- Inherited guppy colour genetics
- Multiple tanks per user, and a terrarium mode built on the same engine
- Splitting the three.js bundle out of the main tank page chunk
