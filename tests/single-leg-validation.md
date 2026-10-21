# Single-leg grab implementation and validation

Completed 2026-10-21 in the existing Escape the Haunting project.

## Implemented behavior

- Normal play keeps the lower-body mesh hidden, including looking down, walking, sprinting and jumping. The existing first-person arms and flashlight remain in use.
- Chase samples the supplied Running Crawl motion by actual navigation distance. The existing ghost mesh bends through its shared torso/arm presentation, with bounded head tracking toward the camera.
- Initial contact reveals both legs, starts Stumble Backwards and the supplied grab sound in the same game update, and turns the view toward the encounter.
- Crawl Backwards supplies the grounded player pose. The ghost's right hand holds the player's right ankle; the other hand supports the ghost on the floor. Hand identities never switch during an encounter.
- Crawl sampling keeps the encounter clock across phase changes. The held pelvis/chain blend continuously out of the fall, and free-thigh rotations compensate for the source pelvis motion. This prevents a QTE-entry snap and poses that lifted the body into the camera.
- Kicking Out is authored for the left leg. Only that free leg receives its rotations; the right leg stays constrained. Accepted E presses start or advance one kick action, with a ghost reaction and camera impulse. No action queue or extra listeners were added.
- The existing GrabSequence still owns phase changes, response windows, press counts, increasing difficulty, failure, recovery and protection after escape. Both actors move through the existing collision/navigation controller.
- Time-based gradient Perlin noise adds a short contact impact and bounded dragging/kicking motion. Each frame starts from the absolute player camera pose, preventing accumulated offsets. Recovery fades the effects. Existing Reduced Motion disables shake and FOV effects; it is enabled by default.
- The new sound is cached by the existing audio manager, played once per encounter on the Effects bus, and stopped/reset on release, failure, retry or interruption. The existing later capture jumpscare remains separate.

## Files

| Files | Purpose |
| --- | --- |
| `src/grab-motion.ts` | Typed validation and interpolation of the baked source clips |
| `src/player-legs.ts` | Visibility, retargeted stumble/crawl, fixed right chain and masked left kick |
| `src/corazon.ts`, `src/ghost-arms.ts` | Shared crawl/grip presentation, fixed hand identities, bounded head tracking and cleanup |
| `src/grab-presentation.ts`, `src/player-camera.ts`, `src/grab.ts` | Coordinated camera/body/contact effects and grounded viewpoint |
| `src/game.ts`, `src/audio.ts` | Existing phase/input orchestration, contact sound and lifecycle cleanup |
| `src/world.ts`, `src/config.ts`, `vite.config.ts` | One shared motion preload, asset registration and production packaging |
| `src/style.css` | Portrait escape prompt placed below the ghost's face |
| `scripts/3d-generation/prepare_grab_animations.mjs` | Reproducible offline FBX extraction |
| `scripts/3d-generation/prepare_player_legs.py`, `public/assets/models/player/legs/` | Closed the existing waist cut, retaining the original rig, source and materials |
| `public/assets/animations/grab/` | Original source FBXs, runtime motion, hashes and import report |
| `public/assets/audio/scaryjumpscaregrabbinglegs.mp3`, `AUDIO_CREDITS.md` | Supplied audio and provenance entry |
| `tests/grab.test.ts`, `tests/grab-motion.test.ts`, `tests/leg-grab-browser.mjs` | Adapted existing checks and focused source/rig/browser coverage |
| `tests/grab-continuity-browser.mjs`, `tests/grab-regression-browser.mjs`, `tests/runtime-smoke-browser.mjs` | Rendered animation transitions, complete mission journeys and ordinary production UI checks |

## Animation integration

All four actual user-supplied FBXs were inspected and retained byte-for-byte under `public/assets/animations/grab/source/`. Each contains a 65-bone `Beta_Surface` rig and a `mixamo.com` animation with 53 tracks. The duplicate `Beta_Joints` display bones are excluded. Source hashes and durations are recorded in [integration-report.json](../public/assets/animations/grab/integration-report.json).

| Source | Source duration | Runtime use |
| --- | ---: | --- |
| Running Crawl.fbx | 0.667 s | Distance-driven chase hand/torso motion |
| Stumble Backwards.fbx | 3.333 s | Player fall, fitted to the existing 0.6 s reach and 0.9 s fall phases |
| Crawl Backwards.fbx | 3.967 s | Grounded struggling, with the held chain constrained |
| Kicking Out.fbx | 1.600 s | Left-leg-only kick fitted to the existing 0.32 s action |

Extraction uses Three.js 0.180.0 only in the ignored `.cache/fbx-import` tooling directory. No application dependency or lockfile was changed. Runtime uses one 122,567-byte motion JSON file, loaded once. FBX sources and the conversion library are excluded from production output. Root translation remains under collision control; it is not applied twice from the animation.

The MP3 is an unchanged 69,007-byte copy of the supplied Downloads file, decoded by the browser as approximately 4.258 seconds. Its configured level is 0.70 before existing Effects/master/gentle-scare controls, with background ducking.

TypeSafe's current documentation was consulted. These animation, input and lifecycle rules are deterministic, so this feature needs no runtime AI request or new credentials. The project's local TypeSafe skill remains installed.

## Verification performed

- Full existing Node test suite: **102 passed, 0 failed**, rerun after the final animation and asset fixes. [Final test log](runtime-unit-report.txt).
- Final focused source/rig/grab checks: **17 passed, 0 failed**. They cover all difficulties and deadline behavior, repeated/held inputs, collision/gravity, source hashes, finite normalized quaternions, the real leg bind hierarchy, held-leg invariance through the kick, and bounded continuous Perlin noise.
- `npm run build` and `npm run build:validation`: passed, including TypeScript checks. Both outputs contain the motion JSON and grab MP3; neither contains FBXs. Vite retains its existing notices about the deliberately external Babylon vendor scripts.
- Headless Edge with actual imported assets: desktop 1280×720, touch landscape 844×390 and touch portrait 390×844. [Machine-readable results](single-leg-browser-report.json) and `single-leg-*.png` screenshots are retained beside this report.
- Browser assertions passed for arms-only movement/jump, chase, contact, fall, drag, free-leg kick, held-E rejection, one-shot audio, pause/resume, escape and restored camera/control state.
- Three consecutive Hard touch escapes preserved the original **16 / 20 / 24** press progression and natural post-escape protection. A fourth encounter required 28 presses and was allowed to fail: exactly one existing capture followed, E was rejected afterward, and retry cleared the state.
- Menu interruption removed the grip, input lock, visible legs and grab audio. No browser page errors or missing asset responses were recorded.
- During the monitored desktop encounter, the maximum solved palm-to-ankle error was below 0.000001 m, roll stayed below the 0.12 rad clamp, the face stayed above 0.67 m and directed toward the camera, and no idle frame displayed the legs. Visible posed skin remained above the sampled flat floor.
- Complete ordinary-input desktop and touch mission journeys passed with the live ghost, in 85.0 s and 91.4 s respectively. Both reached the final exit through actual pickups, doors, stairs and mission gates. Six capture directions also passed, including pause/resume, one finishing sound, retry and restored camera/model state. [Journey and capture results](grab-regression-browser-report.txt).
- A separate rendered continuity check reproduced an approximately 0.118 m ankle snap at QTE entry before the fix. After the fix, the recorded transition moved approximately 0.016 m including the normal tug; deterministic same-time tests verify identical pose/ankle values across the boundary. A complete crawl cycle kept the pelvis below 0.35 m instead of lifting the waist into the camera. [Continuity results](grab-continuity-browser-report.json).
- The touch test now sends native taps without waiting for the button's `:active` CSS transition after every tap. Those test-only stability waits could exhaust the 4.5 s Hard timer on a busy host. No gameplay input timing or difficulty value was changed.
- Final production build, through normal visible UI controls: new game, difficulty selection, intro, movement, jump, pause, journal, resume, save-to-menu, reload and checkpoint continue all passed. No JavaScript/console errors or missing HTTP assets were recorded, and the production bundle exposes no validation fixture host. [Production runtime results](production-runtime-report.json), [build log](runtime-build-report.txt).

The targeted grab checks use validation hooks to place encounters, then exercise the real input, rendering, audio and game update paths. The separate full mission journeys use ordinary movement, look and interaction input without item grants or teleportation. Tests ran in Edge; touch is browser emulation, not a physical-phone test.

## Remaining visual limitations and manual checks

- The original ghost is an unrigged static body/head assembly, not a compatible Mixamo character. Running Crawl is adapted to its existing bounded torso/arm deformation. The dress does not reproduce a fully articulated humanoid crawl, and fingers do not wrap individually around the ankle.
- The follow-up runtime pass closed the existing model's waist opening with 64 triangles in the existing waistband mesh. It adds 816 bytes, remains fully weighted to the pelvis, and retains the camera framing. Grounded/kicking screenshots and the portrait view were inspected after the repair. This remains the existing simple lower-body model, without simulated clothing or a new full-body character.
- Screenshots and diagnostics verify framing and source playback state, not subjective fright, comfort or perceived loudness. A manual playthrough with headphones should assess the impact and mix. Disable Reduced Motion to assess the new shake.
- Physical mobile devices, other GPU/browser combinations, and every house location were not exhaustively exercised. Existing unit coverage for blocked doors, uneven support and stairs passed; the recorded browser encounters used a flat corridor.

No menu, mission, inventory, map, save, difficulty formula or normal movement mechanic was replaced.
