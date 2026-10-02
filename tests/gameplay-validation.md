# BALAY gameplay validation — 2026-10-02

The available game plan's five-mission escape loop is implemented and has completed
an automated browser playthrough using normal player input and the live ghost.
This is evidence for the available plan, not a claim of compliance with the
unavailable `BALAY-Codex-Full-Game-Master-Prompt.md`.

## Commands and build

- `npm test`: 15/15 passing. Includes strict objective guards, corruption handling,
  item reachability, collision geometry, real Babylon NullEngine player/projectile
  execution, ghost sight/stairs/doors, safe reveal positions and key focus.
- `npm run build`: strict TypeScript passes; deployable game in `dist/`.
- `npm run build:validation`: same game systems plus a separate controller-input
  driver in `dist-validation/`. Normal production output excludes this driver.
- `git diff --check`: no whitespace errors.
- Existing `validate-house.mjs`: all 13 checks pass, 29 continuous route legs,
  209.63 m. Ran against a temporary manifest copy to preserve original asset reports.
- Shared source and public-viewer navigation modules are identical.

The two Vite notices about classic Babylon scripts are expected: those existing
local vendor scripts are deliberately copied as runtime assets. They load correctly
in both builds; browser error/warning logs were empty after the corrected journeys.
The production payload contains 12 files and about 34.6 MB, including the existing
GLBs, embedded textures and Babylon runtime.

## Acceptance evidence

| Requirement | Evidence and status |
| --- | --- |
| Desktop first-person game | Production page loaded, entered first-person view and paused using Escape. Controller tests verify movement, collision and stamina. |
| Dare and escape goal | Menu, initial briefing, entrance warning and HUD explain the dare and the locked service-exit route. |
| All five missions reachable | Built browser journey collected flashlight, note, fuse, tsinelas, battery, letter, locket and music box; restored power; opened cabinet; collected key; unlocked exit; crossed threshold. Every hotspot also passes a reachable-approach/clear-ray test. |
| Exit cannot bypass requirements | Unit tests check every incomplete mission stage, removing each required item, and the final escape guard. Closed door blocks player and enemy movement. Front latch remains jammed, per the adapted route. |
| One kitchen reveal with recovery | Browser journey completed the reveal; checkpoint reload retained its flag. No enemy update/catch runs during the sequence. Spawn tests cover several kitchen approach points; reveal gives nine seconds of grace. |
| Wall-aware enemy and hiding | Perception tests cover cone, walls and witnessed hiding. Actual stair route and locked-gate tests pass. Player hiding freezes movement and switches the flashlight off. Hiding is a designated-spot state; no new wardrobe interior model was created. |
| Tsinelas defense and recovery | Actual projectile tests hit the ghost once, block a hit through a wall, recover misses on reachable floor and prevent duplicate inventory. FSM tests verify two-second stun and immunity. Browser route completes without throwing. |
| Captioned dialogue and cooldown | All authored lines go through one caption/cooldown path. New voice playback cancels the previous clip. Current build uses captions/synthesized cues; no personal recordings were supplied, so recorded-voice quality is not verified. |
| Replaceable ghost profile | Name, mesh, face and optional normal/clean recordings are configured in `src/config.ts`; build asset copying follows that configuration. Existing body, face and arm/key models were reused. |
| Pause | Live validation compared progression/time, player position/stamina, ghost position/timers/grace and audio state while paused and in Settings. Reported PASS; `pause-settings-validation.png`. Tab opened and closed the journal. |
| Save/reload | A real page reload retained the checkpoint and eight items, all three keepsakes, kitchen flag, battery and settings. Normal Continue menu restored the correct mission. The saved journey then reached the ending; `checkpoint-reload-validation.png`, `reload-escape-validation.png`, `reload-journey-report.txt`. |
| Safe retry and no duplication | Live journey was caught during M04, retried and verified inventory equality and an opposite-floor ghost with grace. Same scene, systems, listeners and audio instance are retained across retries. Projectile reset tests cover inventory and mesh reset. |
| Reduced motion/flicker and settings | Defaults reduce both. Brightness, gentle scare, clean dialogue and Low graphics were changed via UI, then verified after reload. Reduced camera motion disables bob; reduced flicker disables modulation and kitchen blackout. |
| Credits/permissions | In-game credits and README record model/runtime/audio provenance. A separate permission record for the supplied face reference was not found. No personal voice files are included. Permission information remains unknown, not inferred from generation metadata. |
| Built full playthrough | Validation build completed the full route with the live enemy and checkpoint retry: 151.8 m, one capture. The final production build's startup, first-person view and pause were checked separately. The driver supplies normal inputs and does not teleport, alter progress, suppress enemies or bypass collision. |
| Master specification | NOT VERIFIED: the named master prompt is absent from accessible chat attachments and local search results. User confirmation of an upload is acknowledged; its contents are not available to this runtime. |

## Performance observations

- Windows development machine, Codex in-app Chromium browser, 1280×720 viewport.
- Standard preset during the first 16 seconds: average about 58 FPS; minimum
  sampled average 42 FPS. This includes new-room/model/shader work.
- Mixed Standard/Low run: average 59 FPS; minimum sampled average 35 FPS.
- Reloaded Low-preset final route: average/minimum sample 58 FPS.
- Production warm reload plus the browser observation command took 1.44 seconds.
  This is not a cold-cache network benchmark or a pure renderer-load measurement.
- CPU/GPU/RAM queries were denied by the environment. Hardware identification and
  comparison across other desktop browsers remain unverified. These measurements
  are local observations, not a performance guarantee.

## Preserved model hashes (SHA-256)

| Existing file | Hash |
| --- | --- |
| Haunted house GLB | `df9ecea1a11edc048ee6c156ac6b6968ad60efeb979d9c56983fbafb97ebbd35` |
| Ghost GLB | `6909796ed3f3973e290b35fb4f61411b65714b06ac344b93de8bc22f1a1f86f1` |
| Red key GLB | `f0a945bef00f1e007a24f4b872b2135d7df5a1dde9fb19b2f21a4b1b2222a085` |
| Flashlight arm GLB | `efb66c5f0c13daeafe1e57350e5461bb2af78053a0f307b43039543d61cd05d7` |

All match the pre-implementation audit. Original textures, generation sources and
environment reports remain. Only the shared navigation module changed inside the
existing asset package. Missing small gameplay items use simple local geometry.

## Remaining work

Read and reconcile the actual master prompt once it is accessible. Confirm any
requirements it adds or changes before declaring the full original goal complete.
Optional supplied recordings/identity permission records and broader hardware
testing have not been fabricated. The current build remains a locally playable
implementation of the available plan with those limits recorded.
