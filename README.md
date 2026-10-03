# Balay ni Corazon

A desktop and Android browser survival horror game built around the project's existing
two-storey house, ghost, flashlight arm and red key. TypeScript, Babylon.js and
Vite; no account, backend, API key or remote runtime assets are required.

## Run

Use Node.js 24 or newer (the tests use its native TypeScript support).

```powershell
npm ci
npm run dev
```

Open http://127.0.0.1:5173/. To check the deployable build:

```powershell
npm test
npm run build
npm run preview
```

Open http://127.0.0.1:4173/. Serve `dist/` over HTTP; opening its HTML directly
as `file://` does not support model loading. The build copies only required
runtime assets, configured voice files and the Babylon license. Generation
weights, source footage and working reference collections remain outside `dist/`.

## Play

WASD moves, mouse looks, Shift sprints, **Space jumps**, E interacts/hides, F toggles the light,
left click throws the tsinelas, Tab toggles the journal and Escape pauses.
If pointer lock is unavailable, hold the right mouse button to look or use the
arrow keys. Click the play/continue button to enable sound.

On a touch phone, controls appear automatically: left joystick moves, right-side
drag looks, **Interact** uses items/doors, **Light** toggles the flashlight, **Run**
toggles sprint, **Jump** jumps, **Hide/Leave** uses hiding places, and **Throw** throws the tsinelas.
Journal and Pause are at the top right. Movement, camera and buttons accept
simultaneous pointers. Keyboard movement or a mouse press restores desktop input
on hybrid devices. Touch sensitivity is adjustable in Settings.

Landscape is recommended; portrait remains playable and its rotation hint can
be dismissed. Mobile landscape gameplay attempts document fullscreen once, then
retries on a gameplay tap or Play/Continue if activation was required. Unsupported
browsers keep the viewport-filling layout. Manual fullscreen exit is respected;
there is no request loop. Rotation, fullscreen changes and browser chrome changes
resize the renderer and camera without reloading. Auto graphics
uses fewer lights, a 256px flashlight shadow, reduced rain/dust and a capped render
resolution for touch devices. Slow sustained frame rates gradually reduce resolution;
Standard and Low remain selectable. Serve `dist/` from a normal HTTP(S) host to
play from an Android URL; no app installation or account is needed.

Choose **Easy**, **Medium** (default), or **Hard** before starting a new night.
Checkpoints keep that choice; older saves load as Medium. Easy gives a slower ghost,
longer reaction/escape windows, fewer incidental encounters and more battery life.
Hard increases detection, pursuit and hearing, shortens attack/stun windows, and
makes batteries less generous. Essential items and objective order stay the same.
All tuning lives in `src/difficulty.ts`.

Jumping raises the actual player body with a 5.4 m/s impulse and 15 m/s² gravity
(about 0.97 m at the apex). It requires ground contact and a fresh press. Furniture
tops support landing, chair seats/backs and bed mattresses/headboards have separate
player collision shapes, and solid walls, windows, closed gates and ceilings block
the body. The original stair ramp and enemy navigation remain shared. There is no
jump clip in the supplied arm rig; the equipped arm follows the physically moving
camera and walking bob stops in the air.

1. Take the flashlight and read the warning near the entrance.
2. Find the fuse on the kitchen counter. Install it in the upstairs hallway
   breaker beside the first master bedroom.
3. Recover the garage letter, guest bedroom locket and far master bedroom music box.
4. Return them to the glass cabinet downstairs and take the red key.
5. Unlock the service exit directly opposite the cabinet and cross its threshold.

The front latch stays jammed. This route uses the completed house blueprint's
existing upstairs breaker and service exit. The earlier compact game plan used
a utility room and front exit; those locations were adapted to the existing house.

The kitchen introduces Corazon once per saved run. Walls block sight, footsteps
attract her, and a hiding place only conceals an entry she did not witness.
The recoverable tsinelas stuns for two seconds on Medium (2.8 on Easy, 1.5 on Hard),
with immunity afterward.
Escape is possible without a successful throw. Checkpoints preserve collected
items and put the enemy away from the player with a recovery window.

## Existing assets and systems

- House: `public/assets/models/environments/haunted-house/`; blueprint-led
  procedural geometry, furniture, textures, collision manifest and local renderer.
- Ghost: `public/assets/models/enemies/ghost/`; existing TRELLIS body/head assembly
  and supplied face reference. It moves as a floating static mesh; no rig was supplied.
- Player: `public/assets/models/player/arms/flashlight-arms/`; existing combined
  arm and flashlight model.
- Key: `public/assets/models/items/keys/`; existing red key.
- Navigation: `scripts/3d-generation/house-navigation.mjs`; reused by the game,
  environment viewer and validation, with dynamic gates and collision-query caching.
- Audio: one Web Audio context with master, music, ambience, effects and voice
  controls; the supplied MELANCHOLIA recording loops on the menu and pre-game
  screens, then fades out before ILI ILI loops during the intro and gameplay.
  A single streaming player feeds the music/master mixer, with 0.8-second fades
  on each side of a track change. Sound unlocks on the first click, tap or key
  press; menu settings/credits keep menu music, while pause and backgrounding
  freeze playback. Resume keeps the current position; returning to the menu
  restores MELANCHOLIA. The supplied `mixkit-horror-ambience-2482.wav` sits quietly
  beneath ILI ILI through the same context, Ambience slider and master limiter.
  Its steady interior uses a three-second crossfade for a gapless 70-second native
  loop; the source WAV and both MP3s remain unchanged. A soft low-pass filter and
  0.055 base gain leave room for the music box and foreground effects. The layer
  follows actual game-music playback/fades, freezes on pause, and fades out for
  the menu. Both background buses duck for dialogue, chase and jumpscares with
  fast attacks and smooth recovery; concurrent cues retain the stronger duck.
  Original procedural rain/wind, adaptive tension, directional ghost
  movement/voices, heartbeat, exertion breathing, varied surface steps, doors and
  object sounds remain, including contextual ducking through ten gameplay states.
  `CreepyNightBreeze.mp3` loops alongside MELANCHOLIA in the menu and fades out
  on entry. `CreepyLittleGirl.mp3` joins ILI ILI and Mixkit during gameplay, and
  stops on capture, escape or menu return. `CreepyCurseSound.mp3` follows the
  existing ghost's distance, entering at 8 m, growing louder toward 2 m, and
  fading out past 11 m even when Corazon is around a corner. The warning and
  `JumpScareCorazon.mp3` use the Effects slider. The preloaded jumpscare starts
  in the shared face-reveal render tick for both the kitchen scene and captures,
  plays once per complete sequence, and finishes on the caught screen. A later
  scare replaces any remaining tail; retry/menu cancels it. Gentle scares also
  reduce both cues.
  Adjust the four clips' volumes, loops, fades and distance thresholds in
  `CORAZON_AUDIO` in `src/config.ts`. Each recording has at most one source in
  the same context, and failed loads leave the original soundscape playable.
- Horror director: bounded, room-aware events, recent-event memory, silence before
  whispers, weather, cloth/window movement, falling picture moulding, a flickering
  CRT, moving shadows and brief Corazon afterimages that disappear under the light.
  Shared ghost proximity controls sound, heartbeat and room dimming. Events never
  modify progression, navigation or the real ghost's position.
- Accessibility: sound captions, clean dialogue, separate mixer levels, brightness,
  reduced flicker/lightning, reduced motion and gentle visual/audio scares.

The four GLBs and original textures were preserved byte-for-byte. Small gameplay
props (fuse, batteries, keepsakes and tsinelas) fill gaps in the original inventory.
No generation service was called and no existing model was replaced.

Set the ghost name, model, face and optional normal/clean voice paths in
`src/config.ts`. Paths are relative to `public/assets/`; the build includes
configured recordings automatically. Empty entries use captions and temporary
synthesized cues. Clean dialogue never falls back to an unclean recording.
See [AUDIO_CREDITS.md](AUDIO_CREDITS.md) for the recording manifest, provenance and
optional source searches. Spoken Bisaya recordings are not included; the captions
and clearly documented synthesized vocal placeholders work without missing requests.

Asset generation records and source references remain with their models. The
repository does not contain a separate permission record for the supplied face
reference or personal voice recordings. No personal voice recordings are included.
Babylon.js 9.28.0 is Apache-2.0; its license is preserved with the vendor files.

## Validation

The abandoned interior uses the existing house and furniture with an additional
room-batched decay layer (`src/decay.ts`). Shared 512px surface maps and one 1024px
decal atlas add weathered timber, damp plaster, dust, mold, cracks, cobwebs, torn
curtains and fabric. Selected chair backs, a cabinet panel and the coffee-table
top are damaged in memory; the source GLB and collision manifest remain intact.
Debris gathers beneath damage and beside storage rather than across walkways.
The central passages, stairs, door approaches, hiding spots and objective pickups
have explicit clearance rules.

Standard graphics includes subtle, depth-tested moonlight sheets and up to 48
flashlight dust motes. Low/Android Auto keeps the decay materials and props, uses
12 motes, disables the light sheets, and reduces decoration visibility distance.
No additional shadow maps or real-time lights are allocated. Reduced motion holds
dust drift still, and the existing reduced-flicker setting still governs light events.
The apparent floorboard gaps are shallow visual recesses over the original safe floor.

During development, open `http://127.0.0.1:5173/tests/interior-review.html` for fixed
views of twelve rooms, Standard/Low comparison, flashlight and power toggles,
rendering diagnostics and PNG export. This review page is outside the production
build and does not change saves or gameplay. See
[tests/decay-validation.md](tests/decay-validation.md) for the acceptance record.

`npm test` exercises objective order, save validation, all item approaches, both
floors, gates, ghost perception/navigation, battery/stamina, projectile collision
and recovery. `npm run build` includes strict TypeScript checking.

```powershell
npm run build:validation
npm run preview:validation
```

Open http://127.0.0.1:4174/ and choose **Run full journey**. This separate build
drives the actual player controller through the house, aims at items and supplies
normal interaction input. Collision, enemy perception, stamina, batteries and
mission guards remain active. It neither teleports nor grants progress. After a
capture, **Continue journey from checkpoint** verifies retained inventory and a
safe restore before continuing. **Resume saved journey** continues an existing
browser checkpoint after a reload. The validation controls are omitted from the
normal production build. Browser screenshots and the acceptance record live in
`tests/`; the original environment checks remain alongside its assets.

**Run touch journey** uses pointer events on the real joystick, camera and action
buttons, checks simultaneous movement/look/sprint, cancellation, pause, journal,
flashlight, throw and hiding, then follows the full escape route with the live ghost.
Use a phone-sized viewport. This is browser simulation, not a physical Android test.
**Check audio lifecycle** exercises actual Web Audio output, all ten soundscapes,
mixer mute, the voice budget, suspension, eight resets and cleanup.
**Check background music** plays the supplied MP3s through the real mixer, seeks
to each recording's end to verify looping, checks sequential fades and independent
music/master mute, then tests pause/resume, resets and disposal during a fade.
See [tests/background-music-validation.md](tests/background-music-validation.md)
for the results and the physical-device testing limit.
**Check four Corazon audio integrations** measures real samples from the menu
pair and all three gameplay layers, crosses each new native loop boundary,
checks proximity hysteresis and fade reversal, and verifies one-shot gating,
gentle mode, caught-screen tails, suspension, mute and cleanup. The validation
panel also observes the live face overlay to verify same-frame sound and one
trigger per actual capture. See [tests/corazon-recordings-validation.md](tests/corazon-recordings-validation.md).
**Check desktop jumping** and **Check touch jumping** walk the actual player to
the living-room table, jump onto it, reject repeated/airborne jump input, hold a
stable landing, and walk off under gravity.
**Check landscape fullscreen** uses the production display controller with a
simulated mobile capability and the real browser Fullscreen API, then checks the
canvas and camera aspect before exiting.
**Preview touch controls** enables a manual layout preview on a desktop browser.
Collapse the validation panel to see the HUD unobstructed.

## Specification status

This continuation follows the two supplied documents, preserved in the project root:
`Balay-ni-Corazon-Audio-and-Haunted-Environment-Prompt.md` and
`Balay-ni-Corazon-Continue-and-Mobile-Support.md`. The existing game, four model
assets, house layout, objective order and ghost state machine have been retained.
[tests/corazon-validation.md](tests/corazon-validation.md) records requirement
coverage, desktop/touch results, changed files and remaining physical-device checks.
`HAUNTED_HOUSE_PROGRESS.md` retains earlier project history separately.

The project's local TypeSafe/JEV skill was read with its live documentation.
Its guidance keeps known rules in code. This game's deterministic progression,
collision and enemy states use strict TypeScript and tests; no unnecessary
network AI dependency or global skill installation was introduced.

Jumping, difficulty, mobile layout and fullscreen verification are recorded in
[tests/jump-difficulty-validation.md](tests/jump-difficulty-validation.md).
