# Haunted House Environment Generation Guide for Codex

## Purpose

Use this file as the main Codex instruction for building the haunted-house environment for my web-based first-person survival horror game.

Codex must use these project references together:

1. `HauntedHouse-Blueprint.md` — the authoritative layout, room, connection, atmosphere, and acceptance plan.
2. `haunted_house_all_frames/` — the extracted interior video frames already uploaded to Codex. These are the main visual references for the real interior appearance.
3. Optional reusable 3D props from `https://github.com/boytchev/3d-assets` or the npm package installed with `npm i 3d-assets`.

The result must not be a random generic haunted house. It should follow the blueprint while visually taking inspiration from the provided interior frames.

---

# Main Goal

Create the complete **two-storey haunted-house environment** inside the existing `WebBased-Horror-Games` project.

Focus on the house/environment itself:

- room geometry
- walls, floors, ceilings, doors, windows, stairs, and terrace
- room-to-room connections
- furniture and props
- abandoned materials and visual damage
- local lighting
- visual atmosphere
- safe first-person navigation
- web-performance optimization

Do not expand into unrelated gameplay systems such as ghost AI, chase logic, combat, full inventory, final puzzle logic, or story progression unless needed only to validate the environment.

---

# Source Priority

## 1. `HauntedHouse-Blueprint.md`

Read the **entire file before building**. Treat it as the main authority for:

- floor layout
- room placement
- connections and doors
- staircase alignment
- required furniture
- windows and curtains
- lighting rules
- required objects
- room IDs
- approximate scale
- navigation clearance
- build order
- acceptance checklist

Do not silently change blueprint requirements.

## 2. `haunted_house_all_frames/`

Inspect the uploaded frame folder before detailed modeling. Use the frames as the visual reference for:

- wall colors and deterioration
- floors and ceilings
- door/window appearance
- curtains
- furniture style
- cabinets and shelving
- room proportions where visible
- clutter and abandoned belongings
- lighting mood
- architectural details

When multiple frames show the same area from different angles, compare them together. Do not rely on a single ambiguous frame if other frames provide more context.

If a visual detail in the frames does not conflict with the blueprint, reproduce it. If the frames are unclear, follow the blueprint instead of inventing an unrelated layout.

## 3. Optional `3d-assets` Library

Codex may inspect and use:

```text
https://github.com/boytchev/3d-assets
```

or install:

```bash
npm i 3d-assets
```

Use this only for suitable generic props such as bookshelves, cabinets, tables, chairs, beds, sofas, desks, shelves, lamps, containers, or similar objects.

Before using it:

- inspect the current `package.json`
- do not reinstall if already present
- inspect the package/repository first
- verify actual asset names/import paths instead of inventing them
- verify licensing/usage
- use only assets compatible with the project's existing renderer

**Do not replace the current game engine with Three.js just to use this library.** If the existing project uses Babylon.js, keep Babylon.js and only reuse compatible models/data/assets where practical.

---

# Existing Project Rules

Inspect the current project before editing.

Do not:

- create a second game project
- replace the existing renderer
- delete existing ghost/3D generation work
- delete `AGENTS.md`, `SKILL.md`, TypeSafe/Jev files, or unrelated assets
- restructure unrelated folders without a real need
- overwrite working files unnecessarily

Reuse the current project's existing folders and conventions.

---

# Non-Negotiable House Requirements

Preserve these requirements from `HauntedHouse-Blueprint.md`:

- two connected floors
- one real staircase with aligned ground-floor and upstairs positions
- large living room near the main entrance
- staircase beside the living room
- garage directly across from the stair approach
- kitchen opposite the dining room
- dining table with **exactly eight chairs**
- separate TV room
- ground-floor CR reached through/past a large bookshelf/book passage
- glass-filled bar cabinet opposite a separate escape exit
- garage with old car, antique mirror, and abandoned objects
- six main upstairs rooms
- master bedroom 1 with private CR
- terrace connecting master bedroom 1 to the study
- exterior windows and curtains in upstairs main rooms
- exterior windows and old curtains in ground-floor living and TV rooms
- **exactly two electric hallway light fixtures upstairs**
- breaker near master bedroom 1, approached past unsettling cabinets

---

# Ground Floor

## F01 — Entrance Foyer

Include the heavy weathered front door, rusty latch, muddy mat/slippers, and sightlines toward the living room, stairs, and garage junction.

## F02 — Large Living Room

Include:

- two worn sofas
- one armchair
- scratched coffee table
- creepy porcelain doll
- antique figurines/display cabinet
- old upright piano
- exterior windows
- torn/heavy curtains
- clear walking route to stairs

## F03 — Staircase

Include dark worn wooden stairs, banister, loose wallpaper, crooked portraits, cobwebs, and safe first-person collision/navigation.

## F04 — Dining Room

Include a long table with **exactly eight chairs**:

- three chairs on each long side
- one chair at each end

Also include old plates, cloudy glasses, tarnished cutlery, spoiled food, and stains.

## F05 — Kitchen

Include rusting stove, stained sink, dirty dishes, damaged cupboards, cracked tiles, old refrigerator, abandoned food details, and a small exterior window where appropriate.

## F06 — TV Room

Include two sagging sofas, old CRT television, dusty remote, damaged side table, tangled cables, faded rug, exterior windows, and dirty curtains.

## F07 — Book Passage + Ground-Floor CR

Include the tall bookshelf, old/fallen books, frames/figurines, and a walkable route into the CR. The CR should contain stained fixtures, cracked sink, cloudy mirror, water marks, and dirty shower curtain.

## F08 — Bar Cabinet + Escape Exit

Place the dark wooden glass cabinet directly opposite the separate escape door. Keep a clear lane between them.

## F09 — Garage

Include:

- old dusty car
- antique full-length mirror
- boxes
- tools
- tires
- covered furniture
- damaged cabinet
- dim entrance
- dark rear area
- enough clearance to walk around the vehicle

---

# Second Floor

## U00 — Landing and Hallway

Create the landing and long hallway with warped wood, peeling wallpaper, water stains, portraits, cabinets, and breaker approach.

There must be **exactly two electric hallway fixtures**:

```text
H1 — at the landing
H2 — near master bedroom 1 / breaker
```

Do not add extra electric hallway fixtures.

## U01 — Master Bedroom 1

Internal order:

```text
hallway entrance
→ short book-lined corridor
→ large sleeping area
```

Include:

- private CR
- terrace door beside the CR
- large old bed
- bedside furniture
- wardrobe
- old beige computer + CRT monitor
- keyboard and desk
- bookshelves
- exterior windows
- long faded curtains

## U02 — Study Room

Include exactly two beds, old computer desk, bookshelves, sofa, notebooks/papers, abandoned belongings, exterior window/curtain, hallway door, and terrace door.

## U03 — Guest Bedroom

Include large bed, large antique mirror above the headboard, wardrobe, tall bookshelf, bedside table, dusty bedding, exterior window, and curtain.

## U04 — Twin Bedroom

Include two old beds, abandoned belongings, dresser, scattered personal items, exterior window, and long curtain.

## U05 — Shared Upstairs CR

Include stained tiles, old toilet, cracked basin, fogged mirror, rusty fixtures, dirty shower curtain, and small frosted exterior window with short worn curtain.

## U06 — Master Bedroom 2

Include large bed, eerie doll sitting upright on it, antique standing mirror, side table, scattered belongings, large wardrobes with old clothes, exterior windows, and damaged curtains.

## U07 — Terrace

Create the weathered terrace with cracked tiles, damp leaves, dead plants, safe rusty railings, and two connections:

```text
Master Bedroom 1 ↔ Terrace ↔ Study Room
```

The complete loop must work:

```text
Main Hallway → Master 1 → Terrace → Study → Main Hallway
```

---

# Orientation and Scale

Follow the blueprint orientation:

```text
South = front/main entrance
North = rear
West = left when entering
East = right when entering
```

Use the blueprint's approximate dimensions as starting proportions, not strict construction measurements. Preserve enough clearance for:

- first-person camera movement
- collision volumes
- doors
- large furniture
- future enemy navigation
- inspecting objects

Do not shrink rooms until furniture blocks required paths.

---

# Visual Matching from the Frame Folder

Before detailed placement:

1. Inspect `haunted_house_all_frames/`.
2. Group similar frames by visible room/area where practical.
3. Identify repeated landmarks.
4. Compare those landmarks with the blueprint.
5. Use the frames to guide the environment's visual identity.

Look for:

- wall color
- stains/peeling paint
- tile/wood floor pattern
- ceiling details
- door and window shape
- curtains
- shelves
- cabinets
- sofas
- beds
- mirrors
- appliances
- stairs/rails
- clutter
- lighting fixtures

Do not claim a frame proves a layout detail if it does not clearly show it.

---

# Asset Strategy

Prefer this order:

1. reuse existing project assets
2. use suitable assets from `3d-assets`
3. use simple optimized primitives/procedural geometry
4. create custom low/medium-poly objects only when needed

Important visually distinctive objects should match the references as closely as practical. Generic props may use reusable library assets.

Do not use unnecessarily high-poly assets.

---

# Materials and Atmosphere

Use the blueprint's material language:

- faded cream walls
- stained wood
- dirty gray tiles
- peeling paint
- water stains
- rusty metal
- dusty glass
- cobwebs
- mold in damp corners
- worn fabrics
- old curtains

Damage must be believable. Do not make every surface equally dirty.

Keep paths readable even when the house is dark and cluttered.

---

# Lighting

Use dim local lighting instead of uniform brightness.

Rules:

- lights should not all flicker together
- keep doors/routes readable
- garage entrance can be dim while the rear stays dark
- preserve exactly two upstairs hallway electric lights
- do not add unnecessary hallway fixtures
- avoid aggressive rapid strobing
- keep the future player flashlight useful

---

# Web Performance

Optimize for real-time browser rendering.

Use where appropriate:

- instancing for repeated objects
- shared materials/textures
- reasonable texture sizes
- low/medium-poly furniture
- limited dynamic lights
- limited expensive shadows
- floor/room visibility management
- inactive-floor hiding or reduced processing

Avoid excessive 4K textures, dense meshes, expensive reflections, and too many simultaneous dynamic lights.

---

# Mirrors

Use low-cost mirror approaches unless a special effect is later required.

Prefer:

- dark/static reflective material
- environment/cube reflection
- staged reflection effect later

Do not add expensive real-time reflections to every mirror.

---

# Build Order

## Phase 1 — Read and Inspect

- Read the complete `HauntedHouse-Blueprint.md`.
- Inspect relevant frames in `haunted_house_all_frames/`.
- Inspect the existing project architecture and rendering engine.

## Phase 2 — Blockout

Build both floors first using plain geometry:

- outer shell
- internal walls
- doors/openings
- passages
- staircase
- landing
- terrace

Do not decorate heavily before the layout works.

## Phase 3 — Validate Layout

Check:

- staircase alignment
- room connections
- hallway widths
- window locations
- terrace loop
- door clearance
- first-person movement

## Phase 4 — Major Furniture

Place required major props such as sofas, beds, dining table, eight chairs, bookshelves, cabinets, wardrobes, CRT TV, piano, computers, car, and antique mirrors.

## Phase 5 — Materials and Abandoned Details

Add old materials, curtains, stains, books, papers, clutter, damaged furniture, and frame-inspired details.

## Phase 6 — Lighting

Add local lighting and verify the two-light upstairs hallway rule.

## Phase 7 — Optimization

Optimize repeated assets, meshes, materials, textures, lighting, and inactive areas.

## Phase 8 — Walkthrough and Validation

Walk this route in first person:

```text
Front Entrance
→ Living Room
→ Ground-Floor Rooms
→ Garage
→ Staircase
→ Upstairs Landing
→ Master 1
→ Terrace
→ Study
→ Guest Room
→ Twin Room
→ Shared CR
→ Master 2
→ Back Downstairs
→ Escape-Exit Area
```

Fix clipping, blocked paths, floating props, wrong doors, missing windows, scale problems, and lighting problems.

---

# Acceptance Checklist

## Layout

- [ ] Two floors connect with aligned staircase positions.
- [ ] Living room is near entrance and beside stairs.
- [ ] Garage is across from the stairs.
- [ ] Kitchen faces dining room.
- [ ] Dining table has exactly eight chairs.
- [ ] TV room is separate from living room.
- [ ] Ground-floor CR route passes the bookshelf/book passage.
- [ ] Bar cabinet faces separate escape door.
- [ ] Six main upstairs rooms exist.
- [ ] Master 1 has private CR and computer area.
- [ ] Master 1 ↔ terrace ↔ study loop works.
- [ ] Guest room has above-bed antique mirror.
- [ ] Twin room has two beds.
- [ ] Master 2 has bed, seated doll, wardrobes, and mirror.

## Visual / Atmosphere

- [ ] `haunted_house_all_frames/` was inspected.
- [ ] Major visible materials/furniture reflect the references.
- [ ] Living room and TV room have exterior windows/curtains.
- [ ] Upstairs main rooms have required windows/curtains.
- [ ] Upstairs hallway has exactly two electric fixtures.
- [ ] Breaker is near master 1.
- [ ] Garage contains car and antique mirror.
- [ ] House has coherent abandoned materials and clutter.

## Playability

- [ ] Main routes are walkable.
- [ ] Staircase is safe and traversable.
- [ ] Terrace loop works both directions.
- [ ] Furniture does not block required paths.
- [ ] Doors do not intersect major furniture.
- [ ] No major props visibly float or clip into walls.
- [ ] Required navigation remains possible in darkness.

## Performance

- [ ] Repeated assets are reused/instanced where practical.
- [ ] Dynamic lights are limited.
- [ ] Expensive shadows/reflections are limited.
- [ ] Texture sizes are reasonable.
- [ ] Unnecessary dense geometry is avoided.

---

# Goal and Continuation Requirement

The goal is to **finish the complete haunted-house environment**, even if the current Codex session reaches its context/token limit.

If the session is close to its limit or cannot finish:

1. Do not restart completed work.
2. Preserve all existing code, rooms, assets, materials, imports, and changes.
3. Create or update:

```text
HAUNTED_HOUSE_PROGRESS.md
```

The progress file must record:

- `STATUS: IN PROGRESS` or `STATUS: COMPLETE`
- rooms already completed
- rooms still unfinished
- blueprint sections already implemented
- frame groups/areas already inspected
- 3d-assets installation/use status
- files changed
- current errors
- fixes already attempted
- last successful step
- exact next step
- remaining acceptance-checklist items

If I later say:

> Continue what you have started.

or:

> Continue from where you stopped.

Codex must inspect the existing project, read this guide, read `HauntedHouse-Blueprint.md`, read `HAUNTED_HOUSE_PROGRESS.md` if present, reuse completed work, and resume from the exact unfinished step.

Do not rebuild completed rooms unless they are broken or conflict with the blueprint.

---

# Required Final Report

When finished, report:

```text
HAUNTED HOUSE ENVIRONMENT COMPLETE

Blueprint read: Yes/No
Reference frames inspected: Yes/No
Ground floor complete: Yes/No
Second floor complete: Yes/No
Staircase aligned: Yes/No
Terrace loop complete: Yes/No
Required furniture placed: Yes/No
Eight dining chairs verified: Yes/No
Two upstairs hallway lights verified: Yes/No
3d-assets package used: Yes/No
Environment optimized: Yes/No
First-person walkthrough completed: Yes/No

Important files changed:
- ...

Remaining issues:
- ...
```

Do not claim completion until the acceptance checklist has been checked.

---

# Short Prompt I Will Use in Codex

After this guide, `HauntedHouse-Blueprint.md`, and `haunted_house_all_frames/` are available in Codex, I can use:

> Read and follow `HAUNTED_HOUSE_ENVIRONMENT_GENERATION_GUIDE.md`. Read the complete `HauntedHouse-Blueprint.md` and inspect the relevant images in `haunted_house_all_frames/` before building. Create the complete haunted-house environment according to the blueprint and visual references. You may inspect/use `https://github.com/boytchev/3d-assets` or install `npm i 3d-assets` for suitable reusable props such as bookshelves and furniture, but do not replace the project's existing rendering engine. Keep progress resumable and continue until the haunted-house environment passes the acceptance checklist.
