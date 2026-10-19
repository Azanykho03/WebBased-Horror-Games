# Leg grab, ground drag and escape validation

Updated 19 October 2026 in the existing **Escape the Haunting** checkout.
The previous grab implementation was extended in place. Existing missions,
doors, hiding, navigation, physics, audio, FPS arms, flashlight and original
Celestina assets remain in use. No new runtime dependencies or backend.

## Encounter behavior

The existing ghost AI owns the encounter. A single subordinate animation/QTE
clock coordinates these states:

`Chase → GrabStart → Falling → Dragging → Struggling`

- Success: `EscapeKick → Releasing → Recovering → Chase`.
- Timeout: `Killing → existing capture presentation → Game Over`.

The reach lasts 0.6 s, backward fall 0.9 s, and drag 0.65 s. The player falls
through a blended camera/body pose while the actual player controller retains
floor support and collision. Celestina steps back as the legs extend and both
actors move through a collision-checked 0.24 m pull. The final kick, release and
get-up last 0.32 s, 0.36 s and 1.2 s respectively. Release adds up to 0.35 m of
ghost recoil. Normal chase resumes with three seconds of grab protection.

The ground camera is 0.47 m above support, behind the hips, with zero roll.
The trouser/sole envelope prevents floor penetration throughout the fall,
kicks, recovery and ordinary landing. The normal yaw, pitch, FOV, input and
flashlight equip state are restored after recovery. Temporary velocities are
cleared. Death begins from the ground view and uses the existing face reveal,
recording and Game Over screen once.

The countdown begins only after floor contact and the drag have settled.
It follows elapsed active time, including dropped frames; pre-QTE presses and
late presses do not count. Pause, blur and backgrounding freeze the encounter.
Normal navigation, attacks, stuns and competing scares cannot interrupt it.

Captures require continuous level support and a clear swept envelope for the
fall, legs, drag and recoil. Walls, furniture, stairs, closed doors, successful
hiding and protection can prevent a grab. The ghost continues chasing when an
exit is visible but the cabinet recess is too cramped for a safe fall. A player
who runs directly into her is given collision-checked spacing before the windup.

## Progressive difficulty and controls

Values are centralized in `src/difficulty.ts`; shared physical/timing constants
are in `src/grab.ts`.

| Grab | Easy | Medium | Hard |
| --- | --- | --- | --- |
| 1 | 8 presses / 7 s | 12 / 6 s | 16 / 5 s |
| 2 | 10 / 6.5 s | 15 / 5.5 s | 20 / 4.5 s |
| 3 | 12 / 6 s | 18 / 5 s | 24 / 4 s |
| 4 | 14 / 5.5 s | 21 / 4.5 s | 28 / 4 s |
| Subsequent cap | 20 / 5 s | 27 / 4 s | 32 / 4 s |

The count survives successful escapes and resets on a new game/checkpoint retry.
Desktop uses individual **E** presses; touch uses **TAP TO ESCAPE!**. Key repeat,
held pointers and duplicate clicks cannot complete the QTE. Accepted presses
alternate the kicking leg, react on the ghost and flash the progress meter.
The last press starts a stronger kick before her hands release.

The persistent **KICK TO ESCAPE!** overlay displays attempt number, press count,
progress and remaining time. Its layout leaves the leg/ghost contact visible.
Touch controls support safe areas, portrait, landscape and cancelled pointers.
Movement/look/interact buttons are suspended during the grab and restored after
recovery. The existing fullscreen capability detection and viewport fallback
remain in place. Desktop pointer-lock races cannot pause a new run or capture
touch input after the user switches modes.

## Inspected assets and animation

The supplied `female_skinny_bottom_part.glb` is an unrigged lower-body scan:
887,991 vertices, 1,432,320 triangles, no skins or clips. Its transformed bounds
and cross-sections were inspected before scaling, joint placement and clothing.
The optional `female_2500__base_mesh.glb` is preserved as a reference.

`scripts/3d-generation/prepare_player_legs.py` produces the runtime derivative
from that scan. It fits actual navy trouser geometry with cloth ease, knee/cuff
folds, creases, waistband and source-foot-fitted school shoes. Covered skin is
omitted. The mesh has one connected seven-bone pelvis/thigh/shin/foot skin with
normalized weights and inverse bind matrices. Side assignments follow the
original leg, avoiding cloth that stretches across the opposite leg.

Runtime asset: **1,732,072 bytes, 24,061 vertices, 47,677 triangles**, three meshes
and seven bones. Procedural joint animation supplies idle, walk, run, jump,
landing, fall, ground hold, drag, alternating kicks, final kick and get-up.
There is no cloth simulation or large per-frame geometry allocation for the
player skin. Only the optimized derivative and attribution ship in `dist`.
Original source GLBs remain unchanged under the asset's `source/` directory.

Celestina's original `ghost.glb` contains two static meshes, **no skeleton or
finger bones**. It therefore uses a reversible weighted spine bend and bounded
two-link arm IK over the inspected asymmetric arm regions. Targets follow the
actual skinned ankle joints. The head follows the same spine pivot. The original
face, UVs, materials, proportions and source file are preserved. The original
vertices/normals restore on exit; updated bounds prevent incorrect culling.
This is constrained procedural articulation, not an authored finger-grip clip.

The FPS arms use the original `free_gameready_fps_female_arms.glb`, skeleton,
left/right skins and flashlight socket. Both arms brace during the fall. An
uncollected flashlight stays on its table; interrupted equip resumes correctly.
The finishing scare reuses the existing Celestina presentation and
`peircing.wavJumpscare.mp3`. The supplied Slendrina models remain motion
references rather than replacement characters.

See [asset report](../public/assets/models/player/legs/leg-integration-report.json)
and [attribution](../public/assets/models/player/legs/ATTRIBUTION.md).

## TypeSafe skill

Followed the project-local [skill](../.agents/skills/typesafe-ai/SKILL.md) and
consulted the current [TypeSafe documentation index](https://docs.typesafe.ai/llms.txt)
and [System One documentation](https://docs.typesafe.ai/concepts/system-one.md).
The building-guide endpoint was unavailable; no API contract was inferred.
The skill says to keep exact rules, calculations and execution in code and use
model judgments where semantic understanding helps. This feature needs exact
timing, geometry and input, so it uses deterministic typed game logic and adds
no remote inference, API credential or network dependency. The local skill
installation is preserved.

## Implementation file map

| Files | Responsibility |
| --- | --- |
| `src/grab.ts`, `src/difficulty.ts` | Phase clock, ground gate, edge-triggered E input, progression/caps |
| `src/player-legs.ts` | Connected leg skin, locomotion, floor clearance, ankle targets, kicks and recovery |
| `src/ghost-arms.ts`, `src/grab-presentation.ts` | Reversible spine/arm IK, synchronized drag, camera, recoil and cleanup |
| `src/grab-space.ts`, `src/world.ts`, `src/config.ts` | Valid fall areas and runtime asset integration |
| `src/flashlight-viewmodel.ts` | Original arm skins, bracing pose and equip/socket restoration |
| `src/struggle-ui.ts`, `src/style.css`, `src/ui.ts` | Timer, progress feedback, desktop/touch prompts and responsive layout |
| `src/game.ts`, `src/ghost.ts`, `src/types.ts` | Existing lifecycle/AI integration, locks, success protection and death handoff |
| `src/player.ts`, `src/player-physics.ts` | Input/camera recovery, gravity and swept collision |
| `src/hiding.ts`, `src/hinge.ts` | Safe interrupted hiding/door reversal without an angle jump |
| `src/audio.ts`, `src/horror.ts` | Grab, cloth-drag and impact feedback; competing-scare suppression |
| `scripts/3d-generation/prepare_player_legs.py` | Reproducible offline clothing, reduction and skinning |
| `public/assets/models/player/legs/` | Preserved input assets, runtime uniform, provenance and integration metadata |
| `vite.config.ts` | Ship runtime legs/attribution; exclude source/reference assets |
| `README.md` | Updated controls, behavior and asset notes |

New tests: `grab.test.ts`, `player-legs.test.ts`, `grab-browser.mjs`,
`leg-grab-browser.mjs`, `grab-regression-browser.mjs`, and the standalone
`legs-review.html` / `legs-review-browser.mjs` asset viewer. Existing attack,
hiding and capture assertions were updated in `gameplay.test.ts`,
`difficulty-display.test.ts`, `ghost-ai.test.ts`, `hiding.test.ts`,
`corazon-motion.test.ts` and `corazon-audit.ts`. `browser-journey.ts` exposes
fixtures only in validation mode and revisits mission doors normally after retry.
Its touch driver now releases the joystick/camera during kitchen dialogue,
matching the desktop key release. This prevents the suspended driver from
walking past its waypoint and attempting to return through furniture.

## Verification

- `npm test`: **99 passed, 0 failed** on the final source, including the
  floor-height tuning. [Unit report](grab-unit-test-report.txt).
- `npm run typecheck`, `npm run build`, `npm run build:validation`: **passed**.
  Existing classic Babylon script warnings are expected; the build copies those
  vendor scripts unchanged. No lint script is configured in this repository.
- All three difficulties: keyboard/touch escape, held-input rejection,
  pause/resume, upright camera, inventory, movement/jump recovery, timeout,
  single scare audio, Game Over, retry, portrait and menu cancellation passed.
  [Outcome report](grab-browser-report.txt).
- Interrupted equip/unowned flashlight, pre-held E, blur/focus, dropped-frame
  deadlines, repeated live catches, touch-look suppression and actual landscape
  document fullscreen at 844×390 passed. [Edge report](grab-edges-browser-report.txt).
- Imported runtime skin, walk/run/jump/landing, falling, drag, alternating kicks,
  final kick and recovery passed. The sampled ground trouser surface rests
  2.4 cm above support; sampled soles remain above the floor through kicks and
  recovery. Palm-target error during held fall/drag/kicks was at most 1.3 cm
  in the recorded sequence (grip constraints intentionally release afterward).
- Four consecutive **Hard touch grabs** required **16/20/24/28** taps with
  **5/4.5/4/4 s** windows; rotation and retry reset passed.
  [Rig/progression report](leg-grab-browser-report.json).
- Full desktop and touch missions passed back-to-back against the compiled
  validation bundle, including normal collision, all objectives, live pursuit,
  touch hiding and the final exit (84.5 s desktop, 91.1 s touch).
  [Journey report](grab-regression-browser-report.txt).
- Six initial capture directions/pitches passed: upright ground camera, centered
  face, exactly one sound, Game Over, pause/resume and clean retry.
  [Independent touch/capture run](grab-touch-regression-browser-report.txt).
- Production excludes the validation host/development panel and source GLBs.
  Original ghost, FPS arms, runtime legs and scare audio are hash-checked against
  their deployed copies.

Browser checks use isolated Playwright contexts and do not modify the user's
browser save. Deliberate attack fixtures are separate from ordinary full mission
journeys, which use normal controls, collision, objectives and live ghost AI.

Screenshots: [ground encounter](leg-ground.png), [final kick](leg-final-kick.png),
[recovery](leg-recovery.png), [landscape touch](grab-mobile.png),
[portrait](grab-portrait.png).

Physical Android/iOS devices and Safari were unavailable. Touch and rotation
were verified in desktop Edge with phone viewports; actual mobile GPU throughput,
iOS browser chrome and device fullscreen behavior still merit hardware testing.
The source ghost has no articulated fingers, so its hand shape is preserved.

## Reproduce

```powershell
npm test
npm run build
npm run build:validation
npm run preview:validation
# In another terminal, with Playwright and a browser available:
$env:GAME_URL='http://127.0.0.1:4174'
$env:PLAYWRIGHT_PATH='C:/Users/asus/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'
$env:BROWSER_PATH='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
node tests/grab-browser.mjs
node tests/grab-browser.mjs --edges
node tests/leg-grab-browser.mjs
node tests/grab-regression-browser.mjs
```

The optional asset viewer runs under the development server because test HTML
is intentionally excluded from the deployed build. Rebuild the derivative with
the existing `.venv-3d/Scripts/python.exe scripts/3d-generation/prepare_player_legs.py`
environment (NumPy and trimesh; no Blender or external generation service).
