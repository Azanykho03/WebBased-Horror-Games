# Corazon: The Haunted House — audio, environment and mobile validation

Implementation and validation date: 2026-10-02.

## Active repository

All completed work was transferred, without rebuilding it, to the user's active
`C:\Users\asus\Documents\WebBased-Horror-Games` repository on **main**.
Before transfer it was clean at `5306898543884be7ae0059ea8d736db83c027ba6`, the
same base as the detached Codex worktree. All 38 transferred files were checked
with SHA256 after copying. No existing local edit was overwritten. Subsequent
edits, tests and builds run in the Documents repository. Changes remain uncommitted
and are visible in VS Code Source Control.

The two supplied references are preserved in the repository root:
`Balay-ni-Corazon-Audio-and-Haunted-Environment-Prompt.md` and
`Balay-ni-Corazon-Continue-and-Mobile-Support.md`.

## Existing project audit and preservation

Inspected every runtime module, tests, build configuration, asset folders,
generation tools, navigation and house manifest before implementation. The existing
17-room, two-storey environment already contained stained walls, worn wood, cracked
tile, furniture, curtains, religious objects, cabinets, portraits and clutter.
Most house geometry is batched by room/material. New effects use bounded overlay
meshes instead of separating/rebuilding those batches.

The house, Corazon, flashlight arms and red key GLBs retain their original hashes.
Their textures, collision manifest, navigation gates and generation provenance are
preserved. Corazon's supplied mesh has no skeletal animation clips; existing
floating movement and stun tilt remain. No external model generation was run.

The five missions, battery/stamina, kitchen reveal, hiding rules, throwable
tsinelas, sight/noise AI, checkpoints, save format and escape guards remain active.
The TypeSafe skill stays installed locally. Its guidance keeps exact rules in
code; no network inference dependency was needed for this deterministic game.

## Requirement coverage

| Area | Implemented behavior |
| --- | --- |
| Identity and story | Corazon: The Haunted House title; Corazon dialogue/keepsakes; short skippable rain-backed intro; original missions retained |
| Mixer | One AudioContext, master plus music/ambience/effects/voice buses, smooth gains, compressor, contextual ducking |
| Adaptive music | Ten states: exploration, uneasy, nearby, detection, chase, hiding, jumpscare, recovery, game over and ending |
| Ambience/weather | Original synthesized wind, room tone and filtered rain; local window exposure; delayed thunder after lightning; exterior rain streaks |
| Ghost presence | Moving spatial breath/cloth, sparse cry/hum/laugh, eight non-repeating whisper captions/textures, HRTF direction, distance attenuation, wall filtering and shared reverb |
| Player sounds | Movement-distance steps with non-repeating variants; wood/tile/concrete routes and metal/dirt palettes; sprint loudness, exertion breathing and smoothed fear heartbeat |
| Interactions | Keys/metal pickup, paper, music box, batteries/objects, flashlight click, latch/door creak, cabinet, breaker, throw/impact, objectives and UI select |
| Scares | Existing kitchen/capture visuals synchronized with sting; silence/recovery; reduced audio/visual scare option; aggressive vocal texture on capture |
| Environmental activity | Sparse room-aware events, recent-kind exclusion and cooldowns; window/curtain, falling moulding, creaks/knocks/scratching, upstairs steps, piano/drip/glass/paper/metal, CRT murmur, silence/whisper |
| Lighting | Shared proximity dimming, rare light failure, flashlight dip, weather flashes, moving shadow and brief corridor afterimage disappearing when illuminated |
| Accessibility | Sound captions, five volume sliders, clean dialogue, brightness, reduced lightning/flicker, reduced motion, gentler scares, touch sensitivity |
| Touch input | Capability detection, analog joystick, independent camera pointer, simultaneous action pointers, sprint toggle, all existing actions, release/cancel/blur/reset cleanup |
| Responsive UI | Landscape/portrait, dismissible rotation hint, safe areas, 48–64px gameplay controls, scrollable settings/journal, compact HUD, no horizontal scrolling |
| Device performance | Auto touch profile, adaptive render scale with hysteresis, four/six nearby lights, one 256/512px flashlight shadow, fewer rain streaks/no dust on Low, bounded audio sources and reused effect meshes |
| Lifecycle | Pause/visibility loss freezes gameplay and audio; retry clears sounds/events/input; no duplicated audio loops/listeners; resize updates canvas and resets touches |

Possible visual/event examples in the references were adapted to existing assets.
No new crouch or jump mechanic was introduced: the existing hide mechanic has
a dedicated Hide/Leave touch button. Existing gated doors and cabinets receive
sounds; decorative batched furniture remains intact.

## Build and automated tests

Run in the active Documents repository:

- `npm test`: **23/23 passed**.
- `npm run build`: **passed**, including strict TypeScript.
- `npm run build:validation`: **passed**.
- `git diff --check`: no whitespace errors.
- Vite reports two informational warnings for the existing classic Babylon vendor
  scripts. The asset-copy plugin deliberately retains them and their license.
  The normal production build contains no validation controls or journey driver.

Tests cover progression/escape guards, corrupt saves/settings, approaches to every
item, both floors, gates and collision, AI sight/noise/stun, projectile recovery,
hiding/stamina/battery, horror transitions/cooldowns/silence, settings migration,
analog diagonals, sensitivity/pitch clamps, capability detection and adaptive scale.

## Browser evidence

The desktop and touch journeys drive ordinary input through the existing game;
they do not teleport, grant inventory, disable collision, freeze Corazon or bypass
mission guards. Route aiming is automated. Touch simulation dispatches separate
pointer IDs to the actual joystick/camera/action handlers; it is not a test of
Android's native touchscreen hardware.

- Desktop: full escape passed, **152.1m / 58.0s simulation time**, one capture and
  verified checkpoint recovery. Observed Dormant, Patrol, Investigate, Chase and
  Catch. Sampled FPS average 59, minimum 37.
- Touch at 844×390: full escape passed, **183.4m / 68.5s simulation time**, two
  captures with retained inventory. Verified diagonal move/look/sprint together,
  cancellation, flashlight off/on, Interact, Throw, Hide/Leave, Pause/Continue and
  Journal/Continue. Observed Chase/Search/Catch. FPS average 59, minimum 34.
- Repeated the full touch route after transfer, served from the active Documents
  repository: **162.8m / 61.0s**, one capture/recovery, average 59 FPS, minimum 35;
  ending reached and browser warning/error logs empty. See
  `corazon-active-folder-journey.txt` and `corazon-active-folder-escape.png`.
- Web Audio: actual analyser output was nonzero across the state audition; all
  five mixer levels mute, source budget caps at 20, pause suspends and resume
  restarts the same context. Eight resets retain exactly 11 permanent sources,
  clear transient/delayed sounds and disposal closes the context.
- Desktop browser console had no warnings or errors in the recorded journey.
- At 844×390 Auto touch rendered a 675×312 canvas. Gameplay targets measured
  48–50px. Page width equaled the viewport and touch camera used `touch-action:none`.
- Live resize to 360×800 preserved the session and showed a dismissible portrait
  recommendation. Menus/settings scroll vertically; 44px sliders/select and label
  hit areas remain usable. Touch sensitivity persisted as 1.1 across a real reload,
  then was restored to 1.0.
- A slow room-light event appeared during manual portrait inspection.
- Final production build served from the active Documents repository passed menu,
  ready screen, intro, first-person scene and Escape pause checks with empty
  warning/error logs; the validation panel is absent. See `corazon-active-production.png`.
- Active-folder Web Audio audit passed again, including vocal variants, pause,
  mute, resets and disposal (`corazon-active-folder-audio.txt`).
- Screenshots and text reports are in this folder, prefixed `corazon-`.

Timing measures simulated playing time, not wall-clock duration; retry restores
saved elapsed time. FPS was measured on this desktop browser at the indicated
viewport. It is not a physical Android performance claim.

## Audio recordings and physical-device checks

All gameplay effects and music function with original synthesis. **Spoken English
voice recordings are not included.** Airy vocal textures and subtitles are explicit
placeholders. `../AUDIO_CREDITS.md` gives exact cue/filename suggestions, source
searches and licensing/provenance requirements. No copyrighted audio was downloaded.

Still requires physical Android Chrome/Samsung Internet checks: native pointer
capture under rapid multi-touch, two-thumb comfort, address-bar/safe-area changes,
backgrounding/locking and audio recovery, speaker/headphone mix, long-session
heat/memory/FPS, and WebGL behavior on lower-end GPUs. Analyser output and envelope
checks do not replace a listening test for perceived balance or clicks on a phone.

## Files modified

- `src/audio.ts`, `src/config.ts`, `src/game.ts`, `src/objectives.ts`,
  `src/player.ts`, `src/storage.ts`, `src/style.css`, `src/types.ts`,
  `src/ui.ts`, `src/world.ts`.
- `index.html`, `package.json`, `package-lock.json`.
- `tests/browser-journey.ts`, `tests/systems.test.ts`.
- `README.md`, `HAUNTED_HOUSE_PROGRESS.md`, `haunted-house-game-plan.md`.
- `public/assets/models/environments/haunted-house/README.md`,
  `public/assets/models/environments/haunted-house/index.html`,
  `scripts/3d-generation/house-viewer.html` (display name only).

## Files created

- `src/horror.ts`: shared pressure and event scheduler.
- `src/haunting.ts`: pooled visual weather and supernatural effects.
- `src/touch.ts`: capability detection and touch controller.
- `src/performance.ts`: automatic and adaptive render profile.
- `tests/horror.test.ts`, `tests/touch-driver.ts`, `tests/audio-audit.ts`.
- `AUDIO_CREDITS.md`, this acceptance record, the `corazon-*.png` screenshots
  and `corazon-*.txt` browser evidence.
- Root copies of the two user-supplied reference documents.
