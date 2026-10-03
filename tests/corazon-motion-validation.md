# Corazon motion validation

## Preserved assets and reference inspection

The existing `public/assets/models/enemies/ghost/ghost.glb` has two textured meshes,
`Ghost_body` and `Ghost_head`, three nodes, no skins, and no animation clips.
The head's authored face points toward local +Z. Gameplay uses
`(sin(yaw), 0, -cos(yaw))`, so the mesh rotation is `PI - yaw`, not `yaw + PI`.
The old expression faces backwards at east/west headings.

The original meshes, geometry buffers, textures, materials and proportions are
retained. Runtime transforms provide body sway, attack lean and head movement
about the neck. A walking/running skeleton was not added: the original body is
one static, floor-length dress mesh, so it retains a floating pursuit with sway
driven by actual distance traveled. Idle/stun/attack blend that movement out.

Inspected local user-supplied references:

| Reference | Clip | Observations used |
| --- | --- | --- |
| `slendrina_the_cellar_1.0_-_slendrina_jumpscare.glb` | `faceattack`, 1.75 s, 7 channels, no skin | Head rotation, held approach and the forward movement in the final 0.4 s. Body/head translation channels have 77 keys; root translation has 54. |
| `game_over_slendrina_the_cellar_pc.glb` | `SlendrinaAttack`, 2.2 s, 11 channels, 36 joints | Head dip/roll, reversal around 0.5–0.75 s, torso lean and final push. Head and spine rotation channels have 133 keys. |

The files contain no camera definitions or audio. Camera distance, initial reveal
and exit fade are adapted to Corazon's dimensions and the existing first-person
camera. Sampled relative head/spine motion is converted to her upright +Z frame.
Reference arm/finger animation cannot be retargeted to the static original body;
no Slendrina mesh, face, skin or texture is used in gameplay.

Reference inspection copies stay in ignored `.cache/corazon-references/`.
Neither reference GLB nor any validation script is shipped in `dist/`.
The project-local TypeSafe skill and current documentation were consulted;
these changes are deterministic motion/timing and require no AI service.

## Implementation checks

- One guarded presentation clock owns each scare. Duplicate starts are rejected.
- The first visible/illuminated face and `JumpScareCorazon.mp3` share a reveal tick.
  Even a long frame must render the reveal before it can end the sequence.
  After the reveal, elapsed time keeps the animation at the audio's pace.
- Capture starts at the actual captor's position. The camera turns smoothly toward
  her even if the player is looking away or sharply up/down. The animated face is
  centered; near-plane and viewport checks protect desktop and portrait framing.
- Player movement, look, jumping, interactions, AI and projectiles stop during
  presentation. Pause/backgrounding freeze the sequence. The kitchen scare
  restores controls; capture fades into the existing caught screen. Retry and
  menu restore camera, visibility, render groups, fog and animation state.
- Pursuit takes the shortest turn, uses bounded angular speed and acceleration,
  and travels along its visual facing. Sharp changes turn in place; the original
  pathfinder, doors, stairs, perception, difficulty and objective logic remain.
- Reduced motion removes recoil/FOV motion and reduces pose motion; gentle mode
  increases distance and retains the existing audio attenuation.

## Automated and live verification

- `npm test`: **62 passed, 0 failed**. Includes original progression, collision,
  difficulty, jump, audio and navigation checks, plus real Babylon headless tests
  of the preserved head geometry, camera headings/pitches, portrait/landscape
  frusta, forward pursuit, acceleration, duplicate triggers and dropped frames.
- `npm run build` and `npm run build:validation`: **passed**, including strict
  TypeScript. Vite retains its existing notice about the two intentionally
  external classic Babylon vendor scripts; both are copied into the build.
- Full desktop journey: **PASS**, live ghost, kitchen scare, chase/capture,
  existing Game Over, checkpoint restore, cabinet/key and escape. 64.9 simulation
  seconds / 167.1 m / one capture. [Report](corazon-motion-desktop-report.txt).
- Full touch journey at 844 × 390: **PASS**, simultaneous movement/look/sprint,
  pointer cancellation, pause/journal resume, flashlight, throw, hiding, all
  objectives, capture/retry and escape. 69.0 s / 176.9 m / one capture.
  [Report](corazon-motion-touch-report.txt).
- Six capture directions: **PASS**, including facing away and looking sharply
  up/down, one reveal/audio event, paused-sequence recovery, retry and menu
  restoration. [Report](corazon-motion-capture-report.txt).
- Four Corazon audio integrations: **PASS**, measured samples, loop boundaries,
  proximity behavior, immediate scare playback, 20 duplicate calls suppressed,
  caught-screen tail, pause/resume, mute and cleanup.
  [Report](corazon-motion-audio-report.txt).
- Desktop and touch jumping: **PASS**, table landing, 0.972 m peak, no airborne
  or held-button repeat, stable landing and walk-off gravity.
  [Report](corazon-motion-jump-report.txt).
- Landscape fullscreen: **PASS**, actual browser fullscreen and canvas/camera
  resize, with mobile capability simulated. [Report](corazon-motion-fullscreen-report.txt).
- Visually reviewed the original textured face in the desktop scare and both
  portrait sequences at 390 × 844. Head framing remains inside the viewport.
  [Desktop scare](corazon-motion-desktop-scare.png),
  [portrait jumpscare](corazon-motion-portrait.png),
  [portrait capture](corazon-motion-portrait-capture.png).
- Production preview at `http://127.0.0.1:4173/`: original menu loads without
  browser errors or warnings, and contains no development validation controls.

Mobile runs use browser viewports and the existing touch-pointer driver; they
are not a claim of testing on physical Android hardware.

## Asset verification

All three files below match Git HEAD and their production copies byte-for-byte:

| Asset | SHA-256 |
| --- | --- |
| `ghost.glb` | `6909796ed3f3973e290b35fb4f61411b65714b06ac344b93de8bc22f1a1f86f1` |
| `ghost-face-reference.png` | `89a44a290825f70d6488925db10cfb653c191b357e5102f085e20eb87c429975` |
| `JumpScareCorazon.mp3` | `a2b2d03191deed9094d36ec3b84b2356f4371876173542d02afc29ffa0410191` |

## Reproduce

1. `npm run dev`; open `/tests/corazon-review.html` to scrub the actual controller
   against the existing house/model at different headings and pitches.
2. `npm run build:validation`, then `npm run preview:validation`; open port 4174.
3. Run the ordinary desktop/touch journeys. If caught, use **Continue journey
   from checkpoint**. These journeys do not teleport, grant items or freeze AI.
4. **Check capture angles** uses six explicitly staged captor fixtures and then
   enters the normal attack → scare → caught → retry/menu flow.
5. Run the existing jumping, fullscreen and four-recording audio checks.
