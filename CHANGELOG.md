# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- Laravel React starter kit (Inertia v3, React 19, Fortify, Wayfinder, Tailwind 4) with Reverb realtime and DDEV daemons.
- Tank simulation: species catalogue, deterministic simulator, scheduled ticks and live updates.
- Tank care: feeding, water changes, gravel vacuum, algae scrub, stocking and an auto-feeder.
- Starter tank for every new user, and a dashboard listing their tanks with their sizes.
- Tank view: 2.5D depth layers with voxel artwork. Animals and plants are MagicaVoxel models (resources/models/species) at the shared voxel size.
- 2D (default) and 3D view toggle, bottom left; left-drag pans (in 3D along the camera's own axes, keeping the tank in view), right-drag rotates. The 2D view hides the glass edge lines.
- View cube above the 2D/3D toggle: click a face, edge or top corner to swing the camera to that side or a 45° view, fitted to the whole tank; in 2D it picks the side the flat view looks from. The 3D view can now look straight down.
- Fly mode (third view toggle option): click the tank to capture the mouse and look around, WASD/arrows to move, E/Space up, Q down, Shift faster; flies in and around the tank. The view cube switches back to 3D.
- Underwater view (any mode, e.g. a 3D close-up or flying): inside the water the camera sees tint, fog, light shafts and the surface from below.
- Follow button on a selected fish, plant or decoration: the camera zooms in and keeps it centred as it moves (2D or 3D), without the selection halo; in 3D it slowly circles it until you rotate or zoom, resuming after a few idle seconds. Panning, the view cube or deselecting stops following.
- Tabbed tank side panel with animated transitions: Summary (tank name and clock, water, inhabitants, latest activity that fits without scrolling), Activity (full log), Inhabitants, Management, Aquascaping, Lighting and Equipment (auto-feeder); icon tabs with tooltips.
- Searchable, sortable list of every inhabitant; choosing one selects it, as clicking it in the tank does.
- Full-window tank view with a frosted side panel that slides over the tank (pull tab on its edge or `P`); the choice is remembered.
- Per-tank backdrop (Equipment): a solid colour or top-to-bottom gradient, with presets and a live preview; dims with the light, and colours the tank's dashboard card.
- Unit and feature tests.
- Redis (DDEV add-on) for queue, cache and sessions; Horizon runs the queue workers.
- Octane (FrankenPHP) for production, installed on deploy by Deployer 8.
- Volumetric water: rippling surface with irregular, non-repeating ripples (food drops send out rings), refraction, depth-tinted absorption, light shafts and total internal reflection from below.
- Caustics on the substrate, plants and creatures.
- Air stone with a rising bubble stream.
- Left-click a fish or plant to select it (brightened, with a halo around its silhouette): the side panel shows only its stats, a name field and a Remove button, with a Back button (or `Esc`) to deselect.
- Aquascaping tab: add fully 3D voxel decorations (generated rocks, plus MagicaVoxel models: coral, slate, lava rock and sandstone walls, rock pillar, coral reef, driftwood arch and branch, treasure chest, glass bottle, skull, small castle, pirate ship and Mini Atlantis); each is auto-placed in a free spot.
- Selected decorations show move arrows (in 2D, not the one pointing at the viewer) and panel controls to turn, nudge, drop onto what's below, or remove them.
- Fish swim over or turn away from decorations, bottom dwellers walk over low ones, snails climb them, and food settles on them.
- Plants that can grow on decorations (Hornwort) can be planted on a decoration's plant spots and spread to its free spots.
- Shared 0.2 cm grid for the tank (the size of every voxel), with a substrate heightmap that plants, litter, food and bottom dwellers follow; existing tanks are converted, and gravel is shaded voxel by voxel.
- Tanks have their own size: a New tank dialog on the dashboard sets the name, inside measurements (20–120 × 20–60 × 15–50 cm) and optional starter stock scaled to the water; each user may keep up to 6 tanks.
- Adjustable water level, set when a tank is created and from Management (fill to the top, a chosen depth, or empty): draining keeps the water as it is, topping up mixes in tap water.
- Empty tanks: water chemistry pauses; feeding, water changes and adding water animals are refused, and a tank can't be emptied while water animals live in it.
- Plants whose roots are out of the water stop growing and wilt, dying back after about two simulated days.
- Lighting tab: hang LED tubes, spotlights and LED floods on a gantry above the tank (up to 8, picked from a top-down slot map or by clicking them in 3D), each with its own colour, brightness and timer with fade in/out; a master switch (timers, all on or all off, overriding the timers), a day timeline and the hours of light a day. New and existing tanks start with one full-length LED tube on 08:00–20:00.
- Light in the simulation: each plant gets the light at its crown (from the lights above, dimmed by water depth and shaded by decorations) and grows in proportion, up to its species' needs; plants short of daily light lose health (with a warning), and brighter light and days over 12 hours feed algae. Plant colour matters a little (green light is least useful). The plant panel shows whether it gets enough light.
- Decoration LEDs on every decoration, each lighting up one of its voxels (on generated rocks, a voxel set in a small niche in the face) that casts its own light, up to 16 per tank: switch on, pick a colour, and choose glow-after-dark or always on; purely decorative.
- Gantry lights and decoration LEDs fade in and out over a second and a half whenever they switch on or off, by timer or by hand (master switch, LED toggle or mode, brightness).
- Glow (bloom) on lit lights and LEDs; the water's shafts, glints and tint follow the lights, and fish catch a sheen in the lights' colour. The glass is open at the top, so lights shine straight into the water.
- Gravel sculpting (at 0.2 cm detail) in the Aquascaping tab: preset shapes (flat, slope, beaches, island, terraces) and a Raise / Lower / Smooth / Flatten brush in three sizes, with Undo; changes save in batches every 2 seconds (and when leaving the page). Raised gravel displaces water and becomes land above the waterline; decorations stay put.
- Land and edge life: cushion moss and maidenhair fern grow above the water, pothos and dwarf rush at the waterline; springtails, dwarf white isopods and garlic glass-snails live on land, and the fire-bellied toad moves between water and land, hunting the small invertebrates.
- Air above the water (humidity, oxygen, CO2) on the Summary tab: land plants and animals breathe it, open tanks share the room's air, and land plants feed on detritus.
- Seal the tank from Equipment to make it a closed ecosystem: a glass lid, no air from the room (it mists up as humidity rises); feeding, maintenance, stocking, aquascaping and the auto-feeder all still work with the lid on.
- The Add stock dialog groups species into water, edge and land, explaining why any can't go in yet.
- Animals grow through stages (e.g. fry, juvenile, adult), each its own model, instead of being scaled up; a short squash-and-stretch marks each new stage.
- Animals animate frame by frame from their models (swimming, crawling, hopping or idling), moving faster plays faster; the old whole-body wiggle is gone.
- Plants grow block by block from their model's parts: each growth segment adds a stem section (fanning blades for vallisneria and rush, whorls for hornwort, leaves for fern and pothos), moss spreads outwards over the ground patch by patch (shown as its spread), and new plants grow up from their roots (moss outwards).
- Placeholder animal models (with move and idle frames) and plant parts, generated by `scripts/voxels/generate-species.ts` (hand-edited files are kept).
- Move a selected animal or plant: choose Move, then click its new spot (swimmers in the water at their depth, everything else on the gravel or a decoration). Spots that don't suit it are refused, e.g. fish on dry land.
- The tank page remembers 2D/3D (fly mode as 3D) and the open side panel tab across reloads.
- Tank load-in animation: a spinner while models load, then the glass panels fly together, the light gantry lands and switches on, the gravel and decor dissolve in, the water fills, plants grow and the inhabitants appear. Skipped when the system asks for reduced motion.
- Creature behaviours: each animal has one intent (wandering, exploring, hunting, resting, hiding, shoaling, patrolling) plus moods (zoomies, skittish, sluggish), chosen by the simulation from species, age, hunger, health and the tank. They steer movement and colouring, change hunger, feeding, recovery and predation, and show live in the inhabitant panel.

### Changed

- The 3D view zooms in much further (down to single voxels).
- Gravel matches the 0.2 cm grid: every grid column has its own height (was 1 cm squares), so slopes step in single voxels; existing gravel is smoothed onto the finer grid.
- Coral wall rebuilt at full 0.2 cm detail: craggy strata with cracks, weathering and pink coralline algae, a cave at its foot, bracketed plant ledges, and staghorn, brain, sea-fan and tube corals (generated by `scripts/voxels/generate-decor.ts`).
- Treasure chest and driftwood arch rebuilt at full 0.2 cm detail (same size, plant spots and LEDs): a riveted chest with its lid ajar on a heap of coins, and a twisting, bleached bough with snapped ends, knots and moss.
- Animals move freely in 3D around their home instead of along fixed depth layers: they curve between spots (front to back too), pause now and then, school, and rise over or slip round decorations; ground dwellers walk in any direction. Their home zone and layer still come from the server.
- Simulation runs at 60× real time by default.
- Project-specific README and changelog.
- Tank panels use shadcn/ui components throughout; removing an inhabitant now asks for confirmation in a dialog.
- New look from a shadcn preset: Lyra style, teal theme and Source Sans 3 font.
- Feeding is done from the Care panel only; clicking the water no longer drops food.
- A tank's litres now come from the water it holds (existing tanks: 60 L → 47 L) and its depth layers from its depth (about one per 5.6 cm).

### Fixed

- Vite dev server works under DDEV (served at https://tank.ddev.site:5173 instead of 127.0.0.1).
- Z-fighting between creatures and plants sharing a depth layer.
- Assets blocked as mixed content behind an HTTPS reverse proxy (proxies are now trusted).
- New plants no longer show beneath the tank as they appear.
- Gradient backdrops no longer garble the tank behind the water.
- Condensation in a sealed tank now mists only the glass above the water and under the lid, not the whole tank.

## 2026-11-06: Initial commits

- Laravel 13 skeleton with DDEV (PHP 8.5, MySQL 8.4) and Laravel Boost.
