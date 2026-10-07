# Escape the Haunting — Celestina AI validation

## Implemented behavior

- The official title is **Escape the Haunting**. Menu/loading/story/credits,
  objectives, captions, difficulty text, browser title and current documentation
  use **Celestina**. Legacy module names and historical records remain intact.
- `GhostNavigation` reuses the house's existing A* pathfinder. It can plan through
  usable closed doors while actual movement continues through the physical nav
  and its moving-leaf collision. Open leaves, furniture and mission locks remain
  obstacles. A nearby normal door is preferred over a long route around the house.
- Door approach/open/wait is a movement substate under Chase, Search, Investigate
  or Patrol. The shared `Hinge` receives one opening request, movement stops outside
  the swing, and the route resumes once open. Existing player interaction and
  actor-safe swing checks remain active. A timeout releases a blocked door task.
- Bedroom access still requires the normal key unlock. Celestina never unlocks
  progression or requests the final entrance or sealed service door.
- Only completed `HIDDEN` suppresses sight and capture, including witnessed entry.
  A defensive capture guard also prevents a hidden-player jumpscare. Witness
  metadata remains available for future behavior but supplies no hidden position.
- Last-known position is copied only from valid sight. Search retains that
  snapshot, visits clear nearby points/doorways/rooms, and briefly pauses to look
  around. Hearing can redirect the current search without renewing its timer or
  overwriting sight memory.
- Search lasts 30 simulation seconds on every difficulty. Valid rediscovery
  immediately restores Chase. Timeout restores Patrol. The existing game-loop
  clock freezes on pause; reset clears memory, door tasks and search state. Capture
  leaves Search and the game-over screen does not advance AI.
- The original two cabinet animations, internal camera anchors, controls,
  movement/gravity recovery, mission order, models and audio remain in place.

## Completed automated checks

`npm test`: **80 passed, 0 failed** after the final route-selection fix.

New AI regressions use Babylon's NullEngine, the real house manifest, shared
navigation/collision, production hinges, hiding controller and ghost state machine:

- All 15 usable authored doors, from both sides (30 traversals), including the
  master bedroom after the normal unlock flag. Exactly one opening request per
  traversal; no wall/leaf penetration. A stricter check exposed an unnecessary
  balcony detour, which was fixed and re-tested.
- Successive doors during chase and search; closed, closing, opening and already
  open leaves; waiting without movement; mission locks preserved.
- Full 30-second searches with multiple visited points and active movement,
  hidden-position changes and witness metadata unable to update sight memory.
- Immediate reacquisition, repeated loss/reacquisition on all difficulties,
  noise without timer renewal, capture cleanup and restart cleanup.
- Both actual cabinet placements on Medium and Hard: witnessed entry, a full
  protected search, repeat entry, early exit and resumed chase/capture.
- Existing regressions also cover repeated cabinet cycles, camera/input/velocity
  recovery, gravity, doors, stairs, touch analog input, difficulty, objectives,
  saves, audio lifecycle, scares and projectile interaction.

`npm run build` and `npm run build:validation`: **passed**, including strict
`tsc --noEmit`. `git diff --check`: **passed**. Vite retains the existing notices
about the two classic Babylon scripts being copied rather than bundled; both
scripts are present in the build and served successfully.

The existing development server is running at <http://127.0.0.1:5173/> and the
validation preview at <http://127.0.0.1:4174/>. HTTP checks confirmed the updated
title and successful delivery of all 19 configured runtime asset paths from both
servers. No GLB, image, audio recording or local TypeSafe skill file was modified.

## Outstanding browser verification

**Actual browser gameplay, rendered animation review, runtime console checks and
physical-device checks are not certified by this run.** Both supported UI testing
connections fail before connecting to a page with:

`windows sandbox failed: helper_unknown_error: setup refresh had errors`

The failure persisted after restarting Codex and resetting the browser tool.
An in-app request to open the game was queued. The HTTP and NullEngine results
above are not substitutes for rendered browser tests. No browser PASS result is
claimed here, and no browser error was hidden or automatically treated as fixed.

The validation build now includes:

1. **Check Celestina door navigation** — deliberate encounters at all usable
   doors from both sides, live chase/search, one request, collision and lock guards.
2. **Check Celestina cabinet search** and **Check touch Celestina cabinet search**
   — both cabinets, witnessed concealment, 30-second search, pause, Hard early exit,
   rediscovery, capture and retry.
3. Existing **Check cabinet cycles**, **Check touch cabinet cycles**, **Check all
   hinged doors**, **Check touch hinged doors**, and the full desktop/touch journeys.

Run one check at a time with the page visible. Encounter checks deliberately place
actors and initialize progression; the separate full journeys use ordinary
movement and pickups. These controls are excluded from the production build.

## Files changed

- AI/game integration: `src/ghost.ts`, new `src/ghost-navigation.ts`,
  `src/world.ts`, `src/game.ts`, `src/difficulty.ts`.
- Naming and player guidance: `src/config.ts`, `src/ui.ts`, `src/objectives.ts`,
  `src/interactions.ts`, `src/horror.ts`, `src/audio.ts`, `src/corazon.ts`,
  `src/haunting.ts`, `index.html`, `package.json`, `package-lock.json`.
- Current documentation/viewers: `README.md`, `AUDIO_CREDITS.md`,
  `public/assets/models/environments/haunted-house/{README.md,index.html}`,
  `scripts/3d-generation/house-viewer.html`, `tests/corazon-review.html`,
  `tests/interior-review.html`.
- Regression/live checks: new `tests/ghost-ai.test.ts`,
  `tests/cabinet-observer.ts`, `tests/ghost-door-audit.ts`; updated
  `tests/hiding-perception-audit.ts`, `tests/hiding.test.ts`,
  `tests/browser-journey.ts`, `tests/audio-audit.ts`, `tests/horror.test.ts`,
  `tests/corazon-audit.ts`, `tests/corazon-audio-audit.ts`; this report.

The local TypeSafe skill and current documentation were consulted. Exact
coordinates, collision, hiding predicates, timers and state transitions remain
deterministic TypeScript, consistent with the requested scope. No runtime AI
service, API key, global skill installation or new dependency was introduced.
