# Corazon: The Haunted House — scare recovery validation

Date: 2026-10-06. Work remains in the existing project and its Babylon.js,
TypeScript, Vite, audio mixer, ghost state machine and input controllers.

## Result and timing

- The new `public/assets/audio/peircing.wavJumpscare.mp3` is byte-identical to
  the supplied Downloads file and the production/validation copies.
- SHA-256: `c9efa8678b8ec58b841c15531711ca372008966b82457ca3913c7fc2fe74677e`.
- Chromium decoded duration: 5.264729 s, stereo, 48 kHz. The strongest 20 ms
  window begins at 0.20 s (RMS 0.40573). Playback skips the quiet lead-in using
  that offset and a 3 ms gain attack; the original MP3 is not trimmed or re-encoded.
- The existing visual timeline emits one reveal: 0.16 s into the normal scare,
  0.38 s into capture. At that tick the face is close, visible and illuminated,
  and one decoded source starts at the impact. The later head motion/lunge remain.
- The recording stops at sequence completion (1.75 s normal / 2.20 s capture),
  menu/reset/retry/disposal. Pause freezes the audio/presentation; resume does
  not create another source. Unavailable or late downloads never replay late.
- Both presentations keep the body and camera position fixed. Capture can still
  rotate the view toward Corazon and fade into game over. The old downward camera
  recoil was removed. Input and vertical velocity are cleared at both boundaries.
  A grounded player stays grounded; an already airborne player resumes ordinary
  gravity after the scare without a stored jump impulse or horizontal drift.
- The production UI/document title is **Corazon: The Haunted House**. Internal
  save keys and historical filenames stay stable. English threat pools replace
  old ghost dialogue, with no immediate repeats and an eight-second incidental
  cooldown. Quiet environmental lines keep the existing non-repeating scheduler.
  Scare dialogue is caption-only so a second vocal effect cannot mask the impact.

## Checks

| Check | Result |
| --- | --- |
| `npm test` | 65/65 passed |
| Production and validation builds | Passed, including strict TypeScript |
| Grounded/airborne normal scare, desktop and touch | Four fixtures passed: fixed body/camera, one source, no tail, restored walk/look, stable gravity |
| Pause/resume inside normal scare | Frozen body, visual/audio clock; no replay |
| Actual capture/game-over | Six yaw/pitch fixtures passed, plus pause/resume and retry cleanup |
| Audio sample audit | Strongest burst at configured offset; 20 duplicate calls ignored; output silent at end; gentle mode, mute, pause and disposal passed |
| Existing menu/gameplay/proximity layers | Decode, native loops, music/ambience mix and proximity hysteresis passed |
| Desktop full gameplay journey | Escaped with live ghost; all objectives, one capture, checkpoint restore, inventory and exit verified |
| Touch full gameplay journey, 844 × 390 | Escaped with live ghost; simultaneous move/look/sprint, pointer cancel, pause, journal, flashlight, throw, hiding, capture and checkpoint restore passed |
| Browser console | No warnings/errors during completed audits |
| Production preview at `http://127.0.0.1:4173/` | Loaded successfully with the official title and no validation controls or console errors; landscape and 390 px portrait title fit |
| Obsolete audio references / runtime old title and dialogue | Zero matches in source, shipped assets and builds |
| Original assets | House GLB/manifest, Corazon, arm, flashlight and key match Git HEAD |

Desktop journey: 64.3 s simulated play, 164.9 m, one capture; visited Dormant,
Patrol, Investigate, Chase and Catch. Tests exercise the supplied house and model,
not substitute fixtures for navigation/objectives. Deliberate capture/recovery
fixtures use fresh runs and are separate from the full journeys.

Touch journey: 69.2 s simulated play, 177.5 m, one capture; all five objectives
and escape completed with the existing touch-pointer driver.

Audio/visual synchronization is verified at the application render tick and in
decoded/output samples. Physical speaker/Bluetooth latency and Android hardware
were not measured. Mobile checks use browser viewports and real touch handlers
driven by synthetic pointer events. Existing Vite notices about external Babylon
scripts are expected: the build copies those local vendor files explicitly.

Final continuation pass: reviewed the existing diff without restarting the work;
reran all 65 tests, both builds/type-checks and `git diff --check` successfully.
The earlier production-preview approval-review usage interruption was resolved
on retry; no browser blocker remains. Physical Android/audio-device checks remain
outside this browser verification.

## Changed files

- Runtime: `src/audio.ts`, `src/recorded-audio.ts`, `src/config.ts`,
  `src/corazon-motion.ts`, `src/corazon.ts`, `src/game.ts`, `src/player.ts`,
  `src/player-physics.ts`, `src/horror.ts`, `src/ui.ts`, `src/interactions.ts`,
  `src/objectives.ts` and `index.html`.
- Asset/metadata: new scare MP3, removed retired scare MP3, `package.json` and
  `package-lock.json`. House, Corazon, flashlight, arm and key models are unchanged.
- Checks: `tests/scare-recovery-audit.ts`, `tests/browser-journey.ts`,
  `tests/corazon-audit.ts`, `tests/corazon-audio-audit.ts`,
  `tests/corazon-motion.test.ts`, `tests/movement.test.ts`,
  `tests/recorded-audio.test.ts`, this record and its browser report.
- Title/dialogue documentation: `README.md`, `AUDIO_CREDITS.md`,
  `GAME-DISCUSSION.md`, `haunted-house-game-plan.md`, `HAUNTED_HOUSE_PROGRESS.md`,
  both existing continuation briefs, environment README/viewer/blueprint,
  `scripts/3d-generation/house-viewer.html`, `tests/interior-review.html`, and
  the earlier Corazon validation records (marked historical where appropriate).

## TypeSafe skill

Read the project-local skill, the live [documentation index](https://docs.typesafe.ai/llms.txt)
and [Jev with coding agents](https://docs.typesafe.ai/introduction/coding-agents).
Following the skill's guidance, known timing, physics and authored cue selection
remain deterministic TypeScript. No TypeSafe runtime dependency, API call, key or
global installation was needed. The local skill installation is unchanged.
