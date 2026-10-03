# Jumping, difficulty and mobile display validation

Verified in the existing project on 2026-10-03 (Asia/Manila).

## Implementation

- `src/player-physics.ts` adds cylinder/box collision, gravity and swept vertical
  landing/ceiling checks to the actual `Player`. It reuses the house manifest,
  oriented furniture boxes, dynamic gates and existing navigation stair heights.
  Chair seats/backs, sofas and bed mattresses/headboards use separate player shapes.
  Authored floor and ceiling slabs and window panes are solid. Ghost navigation
  keeps its existing walking footprints and path cache.
- Space and the mobile Jump button feed the same input queue. A new press and
  ground contact are required; holding Space, keyboard repeat, and airborne presses
  cannot grant another jump. The 5.4 m/s impulse and 15 m/s² gravity produce a
  0.972 m peak on level ground. Walking off furniture falls under gravity.
  The supplied arm asset has five pose clips and no jump animation; its original
  rig stays intact, follows the player camera, and stops walking bob in the air.
- `src/difficulty.ts` centralizes Easy/Medium/Hard tuning. The new selection screen
  appears before a new night is committed. Difficulty persists in `Progress` and
  checkpoints; old v1 saves migrate to Medium, and invalid modes are rejected.
  Cancelling/reloading the selection screen leaves the existing checkpoint intact.
- The existing ghost state machine applies movement, detection, hearing, reaction,
  attack windup, lost-sight chase persistence, search duration, grace and stun
  values. It can see an elevated player and path to a reachable edge of furniture.
  The existing horror scheduler scales incidental encounter intervals. Battery
  pickup charge, drain and checkpoint reserves vary; essential objectives are
  preserved in every mode.
- `src/mobile-display.ts` handles resize, visual viewport resize, orientation and
  fullscreen changes. Fullscreen includes both canvas and UI. It attempts once
  when mobile landscape gameplay becomes eligible and retries once on a real
  interaction. An automatic intro transition cannot consume that gesture retry.
  Manual fullscreen exit is respected. Unsupported/denied requests retain the
  viewport layout. Desktop does not auto-request fullscreen.
- Touch Jump occupies the right action cluster's upper-right cell in landscape
  and the lower-left cell in portrait. Existing movement, look, light, interaction,
  throw, hide, sprint, journal and pause remain. Safe-area padding and dynamic
  viewport sizing remain active.

## Automated checks

`npm test`: **51 passed, 0 failed**. Coverage includes physical jumps and stable
landings on actual dining tables, chair seats, boxes, beds and counters; walking
off edges; no air jumps; low-frame-rate thin-wall/ceiling collision; rotated props;
stairs in both directions; closed gates/windows; ghost approach to furniture;
actual difficulty-dependent ghost movement/capture and battery/encounter changes;
save migration; fullscreen rejection, retry limits, unsupported APIs and manual
exit; and the existing objectives, audio, flashlight and navigation regressions.

`npm run build` and `npm run build:validation`: **passed**, including strict
TypeScript checking. The pre-existing Vite notices about classic Babylon scripts
remain expected: the asset-copy plugin supplies both scripts in the output.
`git diff --check`: passed.

## Running browser checks

The existing validation journey drives the actual player and input/interaction
systems, with live ghost AI and normal inventory, stamina, batteries and gates.
The additional jump audit walks to the living-room table and supplies keyboard
or simultaneous touch movement/look/jump input without setting player positions.

| Check | Result | Evidence |
| --- | --- | --- |
| Space jump, table landing, air/held-key rejection, walk-off gravity | Pass; 0.972 m peak | `jump-desktop-report.txt` |
| Touch move + look + Jump, landing and walk-off | Pass; 0.969–0.972 m peak | `jump-touch-report.txt` |
| Full desktop escape and checkpoint recovery | Pass; 61.8 s simulation, one capture | `jump-difficulty-desktop-journey.txt` |
| Full touch escape, cancel/pause/journal/light/throw/hide, checkpoint recovery | Pass; 65.7 s simulation, one capture | `jump-difficulty-touch-journey.txt` |
| Hard selection retained after cancelling/reloading a new selection | Pass | `jump-checkpoint-report.txt` |
| Real Fullscreen API through production display controller | Granted; canvas 667×375, camera aspect 1.779 | `jump-fullscreen-report.txt` |
| Web Audio lifecycle, 10 soundscapes, mute, pause/resume and cleanup | Pass | `jump-audio-report.txt` |
| Supplied MP3 playback/looping, fades and independent mute | Pass | `jump-music-report.txt` |
| ILI ILI + Mixkit loop, ducking, effects and lifecycle | Pass | `jump-ambience-report.txt` |
| Final production preview: Easy selection, intro, gameplay, Space input and pause | Pass; no runtime errors or validation controls | `http://127.0.0.1:4173/` |

Landscape screenshots cover 667×375 and 568×320. A 320×568 portrait check confirms
all action buttons and joystick stay within the viewport without overlapping each
other. Returning between orientations keeps gameplay and the renderer intact.
Screenshots: `jump-mobile-landscape.png`, `jump-mobile-compact.png`, and
`jump-mobile-portrait.png`. Browser console checks showed no runtime errors.

## Verification limits

Touch input was simulated through real PointerEvent handlers in the desktop
browser at phone viewport sizes. The fullscreen audit simulates mobile capability
but calls the real Fullscreen API and renderer resize. No physical Android/iOS
device was attached, so device-specific browser chrome, notches, permission policy
and hardware frame rates remain device checks. The app still works when a browser
does not support document fullscreen.

All existing model, texture and audio assets remain unchanged. No new project,
asset generation service, network AI dependency or global skill installation was
introduced. The local TypeSafe skill and live documentation index were consulted;
the requested physics and difficulty rules remain deterministic TypeScript.
