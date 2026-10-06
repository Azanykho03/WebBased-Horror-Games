# Jumpscare camera orientation repair

Date: 2026-10-07. Continued in the existing project from the committed audio,
dialogue, title and scare recovery work. Those assets and systems are unchanged.

## Reproduced cause

`CorazonPresentation` switched the FreeCamera from Euler rotation to a
quaternion for the scare, then switched back without refreshing the up vector.
Babylon 9.28.0 rotates and caches that vector when a quaternion's Z component
changes. A quaternion can have a nonzero Z component even when Euler roll is
zero. After returning to gameplay, `setTarget()` zeroed `rotation.z`, but its
view matrix still used the old up vector. Turning subsequently banked the view.
An isolated reproduction measured a 25.19-degree apparent bank with Euler Z=0.

The capture sequence also used quaternion slerp between yaw/pitch poses. Its
intermediate poses could roll (38.50 degrees in a reproduced example), although
the endpoints were upright. Both new regression tests failed before the repair.

The camera has no parent or player TransformNode ancestor. The animated ghost
root/torso/head are independent; the flashlight rig and scare light are camera
children. No camera animation, tween, physics impulse or parent roll was found.
Movement already used player yaw correctly; a banked rendered basis made that
movement appear misaligned with the screen.

## Repair

- `src/player-camera.ts` gives normal play and both scare kinds the same Euler
  yaw/pitch camera orientation, sets Z=0, and tells Babylon to regenerate its up
  vector from that orientation on every view update.
- `src/corazon.ts` interpolates the shortest yaw turn and pitch independently.
  Cleanup restores the saved heading, position and FOV, refreshes the view, and
  clears native camera direction, rotation, inertial accumulators and targeting.
  Ghost animation, face framing, reveal timing, audio and game-over remain intact.
- `src/player.ts` uses that same camera orientation for looking and movement,
  and clears native camera motion alongside the existing body halt. The existing
  halt clears vertical velocity, recalculates actual floor support, and clears
  moving/sprinting/bob state. There is no stored horizontal velocity; horizontal
  movement is recomputed from fresh input and player yaw each tick.
- Existing Game boundary cleanup still clears keyboard/touch/look/jump input,
  releases the cinematic lock, restores the viewmodel and resumes normal play.
  It does not exit pointer lock for a regular scare. An already airborne player
  resumes ordinary gravity and lands; a grounded player does not fall or drift.

## Verification

- 68/68 tests passed, including the original systems and three added regressions:
  18 repeated scares with subsequent turns; every intermediate capture pose at
  four diagonal/extreme viewing angles; seeded native inertia followed by
  correctly aligned WASD movement and idle stability.
- `npm run build` and `npm run build:validation` passed, including TypeScript.
  The existing notices for copied classic Babylon scripts remain expected.
- The actual built game at `http://127.0.0.1:4174/` passed 12 consecutive scares
  in one session. Three non-cardinal yaw/pitch pairs were tested with desktop
  and touch controls, grounded and mid-jump. Immediate forward/backward/left/
  right movement, mouse/touch look, input clearing, idle stability, floor support,
  single synchronized impact, stopped audio tail and pause/resume all passed.
  Maximum absolute vertical component of the rendered camera's right vector:
  `1.895e-8` (floating-point noise); camera Z was exactly zero throughout.
- Six real ghost attacks passed: upright camera throughout the turn, centered
  face, one sound, game-over, pause/resume and retry cleanup.
- Full desktop journey passed with the live ghost: all objectives, interactions,
  scripted kitchen scare, real capture, checkpoint restoration and final escape
  (65.0 s simulated play, 167.2 m, one capture; 59 FPS average).
- Full touch journey passed at 844 × 390 with the live ghost: simultaneous
  joystick/look/sprint, pointer cancellation, pause/journal, flashlight, throw,
  hiding, all objectives, real capture, checkpoint recovery and final escape
  (68.4 s simulated play, 175.4 m, one capture; 59 FPS average).
- A second consecutive-scare run also passed all 12 cases after focusing the
  browser, with the same maximum horizon error and no accumulated offsets.
- Browser console: no warnings or runtime errors after both journeys and the
  final recovery run. `git diff --check` passed. The production server serves
  the current compiled camera fix; the original supplied MP3 remains unchanged.
- Production smoke test at `http://127.0.0.1:4173/`: launched Medium through
  the normal menu and intro, verified the rendered foyer is upright and the HUD
  is active, with no validation controls or console warnings/errors. Left that
  build open for play. No runtime changes were needed after the successful builds.

The automated browser exposes desktop drag-look fallback rather than native
pointer lock. Touch checks drive the real pointer handlers in the browser;
physical mobile hardware and native pointer-lock capture are not covered by
this environment. Tests check that scare cleanup preserves the input lock state.

## Scope and skill

Only the three runtime camera/player files and related tests/validation records
changed. The supplied MP3, title, English dialogue, model, ghost AI, navigation,
objectives, inventory, difficulty, flashlight and environmental audio remain in
the existing architecture. The project-local TypeSafe skill and live documentation
were consulted; exact camera transforms and physics belong in deterministic code,
so no AI service, dependency or global skill installation was added.

Changed files: `src/player-camera.ts`, `src/player.ts`, `src/corazon.ts`,
`tests/corazon-motion.test.ts`, `tests/systems.test.ts`,
`tests/scare-recovery-audit.ts`, `tests/corazon-audit.ts`, and this record.
