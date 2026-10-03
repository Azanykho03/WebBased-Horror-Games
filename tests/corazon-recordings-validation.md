# Corazon recording integration — 2026-10-03

Implemented in the existing game and AudioSystem. Original MELANCHOLIA, ILI ILI,
Mixkit, procedural effects, voice placeholders, assets and gameplay remain.
No additional AudioContext, audio dependency or ghost controller was introduced.

## Configuration and lifecycle

`CORAZON_AUDIO` in `src/config.ts` centralizes filenames, levels, loop flags,
fade durations and proximity thresholds. Levels are before the existing sliders
and limiter.

| Recording | Behavior | Base gain / fade | Bus |
| --- | --- | --- | --- |
| CreepyNightBreeze.mp3 | Menu / pre-game loop alongside MELANCHOLIA | 0.24 / 0.8 s | Music |
| CreepyLittleGirl.mp3 | Gameplay loop alongside ILI ILI and Mixkit | 0.16 / 0.8 s | Ambience |
| CreepyCurseSound.mp3 | Enter at 8 m, leave beyond 11 m, maximum at 2 m | 0.09–0.38 / 0.45 s | Effects |
| JumpScareCorazon.mp3 | One-shot when the face overlay becomes visible | 0.85 / 0.006 s attack | Effects |

The curse uses the existing ghost's position, including through occluding walls.
Distance changes and reversed fades reuse one source. Faded-out sources stop.
The two gameplay loops stop on capture, escape and menu return. Pause suspends
the shared clock; resume retains playback position. The first player gesture
unlocks audio with the original activation handlers.

Both the kitchen reveal and capture use the UI's shared face-appearance callback,
so decoding/network work never happens at the trigger. Repeated frames and calls
are gated until the scene completes. The 7.44-second one-shot finishes its tail
on the caught screen, with background ducking retained; a later distinct scare
replaces a remaining tail without overlapping it. Retry/menu cancels the tail.
Gentle mode lowers both warning and jumpscare levels.

Loads use the existing abortable cache. Failed clips are marked unavailable and
reported once; original effects continue. A late download cannot replay a missed
jumpscare. Production and validation builds include all four unchanged files.

## Checks performed

- `npm test`: **56/56 passed**. Includes existing gameplay, navigation, jumping,
  difficulty, touch input, music and ambience tests, plus new recording tests for
  hysteresis, fade reversal, suspended clocks, single sources, one-shots and
  late/unavailable buffers.
- `npm run build` and `npm run build:validation`: **passed**, including TypeScript.
- `git diff --check`: **passed**.
- Original Downloads, project and production MP3 copies matched byte-for-byte.
  Each production URL returned HTTP 200 with `audio/mpeg`.
- Runtime console checks during the live desktop journey: **no warnings/errors**.

## Browser validation

Windows Codex in-app Chromium, real MP3s and Web Audio, with ordinary user
activation and no autoplay-policy override. The packaged validation build was
served at `http://127.0.0.1:4174/`.

The four-recording audit passed simultaneous menu output, menu fade/stop,
simultaneous output from all three gameplay layers, each new native loop boundary,
8/11 m hysteresis, increasing warning intensity, fade reversal, far-distance stop,
20 duplicate scare calls, sequence rearming, one-shot tail replacement, gentle
mode, suspension/resume, mixer mute, ending/menu cleanup and disposal.

Measured simultaneous menu RMS was 0.00142 for breeze and 0.02287 for MELANCHOLIA.
Gameplay RMS was 0.00458 for the girl, 0.02231 for ILI ILI and 0.00745 for Mixkit;
the sampled mixed peak at the audit's reduced master level was 0.00861.
These measurements verify real output and relative levels, not a listening test
on every speaker/headphone or a physical Android test.

The original music, synchronized ambience and effects audits also passed:
looping, source reuse, fade transitions, ducking/recovery, independent sliders,
pause/resume, repeated resets, voice budget and cleanup.

A complete live desktop journey passed all objectives, Corazon's chase/capture,
checkpoint restore and escape: **61.7 seconds, 163.1 m, one capture**. It used the
existing normal movement and interaction driver, without teleporting, granting
items or freezing the ghost. A MutationObserver on the actual face overlay
confirmed the kitchen reveal started source 1 in its visibility frame; the later
capture started source 2 in its visibility frame. Each scene had one trigger.
The new gameplay/warning sources were stopped on the caught and ending screens.
Returning to the real menu restored MELANCHOLIA and one breeze source; the girl,
curse and jumpscare had zero live sources and the original Mixkit layer was quiet.

## Saved evidence

- [Four integrations](corazon-recordings-browser-report.txt)
- [Original music regression](corazon-recordings-music-report.txt)
- [Original synchronized ambience regression](corazon-recordings-ambience-report.txt)
- [Original effects regression](corazon-recordings-effects-report.txt)
- [Kitchen face event](corazon-recordings-live-kitchen.txt)
- [Capture face event and stopped gameplay sources](corazon-recordings-live-capture.txt)
- [Full desktop journey](corazon-recordings-desktop-journey.txt)
- [Live return to menu](corazon-recordings-menu-return.txt)
- [Gameplay screenshot](corazon-recordings-gameplay.png)
- [Production preview](corazon-recordings-production.png)

The audit controls, diagnostic text and observer are excluded from production.
The normal production menu and audio settings were opened at
`http://127.0.0.1:4173/` after the live tests, with no console warnings/errors.
