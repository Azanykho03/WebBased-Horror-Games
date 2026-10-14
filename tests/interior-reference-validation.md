# Interior and hallway reference update

Verified in the existing WebBased-Horror-Games project on 2026-10-11.

## Completed visual work

- Reused the supplied haunted-house model's plaster, timber, panelling, tile and
  patterned rug textures. Added shallow normal maps for plaster and timber.
- Reused a clean wall island and its matching normal map from the supplied hallway
  atlas. Added cream, stained hallway walls, dark lower panels, thin rails and
  shallow repeating piers fitted to the existing solid wall segments.
- Added localized ceiling damage, exposed lath, fixture soot and a corroded,
  permanently unlit private-bathroom bulb. Existing dirt, webs, 237 debris pieces,
  torn curtains, worn furnishings and damaged furniture remain. The new details
  use a separate random seed to preserve the old detail placements exactly.
- Electrical light and visible bulb glow now agree with the existing breaker
  state. Working fixtures illuminate after restoration; faulty fixtures dip
  slowly and independently. Reduced flicker keeps functioning lamps steady.
- Furniture stays in place and receives the source timber/tile/plaster surfaces,
  existing dust and contact shading. The existing flashlight shadow pipeline,
  moonlight, fog and room light budget remain in use.

## Reference and blueprint mapping

Both GLBs were parsed and rendered locally before adaptation. Original supplied
files and local reference copies have matching SHA-256 hashes.

| Reference | Inspected content | Applied to the existing house |
| --- | --- | --- |
| `haunted_house.glb` | 310 nodes, 144 meshes, 7,670 triangles, 14 materials, no animations; different scale and a different floor plan | Selected plaster, wood grain, wall panelling, tiles and rug fabric; the source layout was not substituted |
| `scary_interiorHallway.glb` | 49 nodes, 20 meshes, 4,528 triangles, 3 materials; baked scene atlases, narrow cream walls and repeated piers | Matching diffuse/normal wall crops, narrow passage rhythm, darker wood base and stained upper walls; no baked furniture UV islands tiled on walls |
| `haunted_house_all_frames/` and `HauntedHouse-Blueprint.md` | Frame contact sheets plus individual room/stair frames; two floors, cream walls, dark wood trim, filled rooms, narrow hallways | Kept the existing stairs, terrace connections, book passage, room boundaries, furniture positions and eight dining chairs; retained exactly H1 and H2 in the upstairs hallway |

Source bounds, hierarchy, materials, texture sizes, crop coordinates and hashes
are recorded in
[`inspection.json`](../public/assets/models/environments/haunted-house/source/interior-references/inspection.json).
The extraction script is repeatable and does not regenerate the original house.
Embedded CC BY 4.0 attribution is preserved in
[`ATTRIBUTION.md`](../public/assets/models/environments/haunted-house/textures/reference/ATTRIBUTION.md).

## Preserved gameplay

Git object hashes confirm the original house GLB and collision manifest are
unchanged, as are the Celestina, arms, flashlight, key, door and hiding-cabinet
GLBs. No changes were made to player controls/physics, Celestina state/navigation,
hinges, hiding, missions, interactions, save handling, audio or animation systems.
Changes in `world.ts` only prepare bulb visuals and update their light output.

The manifest still has its original 257 colliders. The existing replacement-door
and cabinet setup yields the same 239 static runtime colliders plus the original
dynamic fixtures. New decoration is non-colliding and non-pickable. Wall finishes
are clipped to solid wall pieces so openings stay open; thin trims and high
ceiling details preserve player and enemy routes.

## Build and regression checks

- `npm test`: **83 passed, 0 failed**. Includes normal mission progression,
  checkpoints, interaction rays, collision, stairs, jumping, enemy perception,
  30-second searches, doors, hiding, touch input, animation recovery and audio.
- Three new checks cover wall/opening clearance without manifest mutation,
  power/faulty-bulb behavior with bounded flicker, and the texture download budget.
- `npm run build -- --configLoader native`: **passed**, including `tsc --noEmit`.
- `npm run build:validation -- --configLoader native`: **passed**.
- `git diff --check`: **passed**.
- The existing Vite notices about the two classic Babylon scripts remain. The
  production asset copier includes both scripts, and the production browser
  loads successfully with no warning/error messages.
- A type error in the review-only bulb diagnostic was fixed during validation.
  The final diagnostic checks all 21 fixtures successfully with power on/off and
  reduced flicker. It is not shipped in the production game.

## Actual browser checks

The existing development journey supplies movement and interaction input with
normal collision, objectives and a live enemy. Separate fixture audits explicitly
position actors to exercise cases; they are not claimed as ordinary playthroughs.

| Check | Result and evidence |
| --- | --- |
| Full desktop mission route | **PASS**, 79.8 active seconds, 203.6 m, one capture, checkpoint recovery and full escape; 57 FPS average / 21 minimum. [Raw result](interior-desktop-journey.txt) |
| Full touch mission route | **PASS**, 111.1 active seconds, 241.5 m, three captures with preserved checkpoints, all objectives and full escape; 58 FPS average / 28 minimum. Simultaneous movement/look/sprint, pointer cancel, pause/journal, flashlight, throwing and hiding passed. [Raw result](interior-touch-journey.txt) |
| Both hiding cabinets | **PASS**, three complete cycles each, smooth entry/exit, fixed body, no drift, upright camera and restored movement/jumping. [Raw result](interior-cabinet-cycles.txt) |
| Player doors | **PASS**, all 17 fixtures, repeated open/close cycles, input guards, a blocked swing resuming, mission and sealed locks. [Raw result](interior-door-cycles.txt) |
| Celestina doors | **PASS**, all 15 usable doors from both sides, Chase and Search, one opening request, waiting and collision-safe crossing. [Raw result](interior-celestina-doors.txt) |
| Celestina and hiding | **PASS**, both cabinets: witnessed concealment, full 30-second search, frozen pause clock, return to patrol, Hard early exit, capture and clean retry. [Raw result](interior-celestina-search.txt) |
| Touch jumping | **PASS**, table jump, stable landing, no air jump or held-key repeat, walk-off gravity. [Raw result](interior-touch-jump.txt) |
| Production preview | **PASS**, packaged game loads, intro enters the rendered house, journal opens/resumes, no development controls and no browser errors/warnings |

Room reviews covered living, dining, kitchen, TV room, book passage, garage,
entrance/stairs, both hallway directions, guest/twin/far master bedrooms, study and
private bathroom. Reviewed power off, restored power, failing fixtures, reduced
flicker, flashlight shadows and Low graphics.

## Performance and remaining limits

- Nine shared source-derived maps total **356,398 bytes (348 KiB)**. The supplied
  source GLBs and inspection files are excluded from production downloads.
- The full decay/detail layer is **7,124 triangles in 106 room/material batches**,
  versus the earlier 5,318 triangles / 85 batches. Existing floor/distance culling
  stays active; the reviewed scenes enabled 44–53 batches.
- No added light sources, shadow maps or post-processing passes. Small per-bulb
  visual meshes allow independent power/flicker without a scene-wide material.
- Standard reviews: approximately 60 FPS, 48 dust motes, 512px flashlight shadow.
- Low review at an 844 × 390 viewport: **675 × 312 render buffer**, 12 motes,
  256px flashlight shadow, approximately 60 FPS. [Diagnostics](interior-mobile-diagnostics.txt)
- Browser timings are observations on this Windows machine, including transient
  drops during gameplay. The touch journey uses simulated touch pointers and the
  game's normal fullscreen behavior (1280 × 720); the separate Low visual review
  verifies the smaller 844 × 390 layout. A physical Android/iOS device has not
  been tested. No outstanding errors were found in the final gameplay or
  production runs. [Browser logs](interior-browser-errors.json)

The project-local TypeSafe skill and live documentation were consulted. This task
needs deterministic rendering and must preserve existing AI behavior, so no Jev
inference, network-dependent gameplay, credentials or new runtime dependencies
were introduced. The local skill installation is untouched.

## Modified and added files

- Rendering: `src/decay-textures.ts`, `src/decay.ts`, `src/world.ts`.
- New visual helpers: `src/interior-assets.ts`, `src/interior-layout.ts`,
  `src/interior-lighting.ts`.
- Build asset list: `vite.config.ts`.
- Sources and textures: `public/assets/models/environments/haunted-house/`
  `source/interior-references/` and `textures/reference/`.
- Reproduction: `scripts/3d-generation/prepare_interior_references.py`.
- Review/tests: `tests/interior-review.html`, `tests/interior-review.ts`,
  `tests/environment-reference-review.html`, `tests/interior-reference.test.ts`.
- This report and the `tests/interior-*.jpg` / `tests/interior-*.txt` evidence.

## Saved views

[Living room](interior-living-final.jpg) · [Dark hallway](interior-hallway-final.jpg)
· [Powered hallway](interior-hallway-powered.jpg) · [Power off](interior-power-off.jpg)
· [Dining](interior-dining-final.jpg) · [Kitchen](interior-kitchen-final.jpg)
· [Bedroom](interior-bedroom-final.jpg) · [Broken bulb](interior-broken-bulb.jpg)
· [Low graphics](interior-mobile-bedroom.jpg) · [Desktop ending](interior-desktop-escape.jpg)
· [Touch ending](interior-touch-escape.jpg) · [Production game](interior-production-game.jpg)
