# BALAY: Ayaw Pagsulod

A desktop browser survival horror game built around the project's existing
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

WASD moves, mouse looks, Shift sprints, E interacts/hides, F toggles the light,
left click throws the tsinelas, Tab toggles the journal and Escape pauses.
If pointer lock is unavailable, hold the right mouse button to look or use the
arrow keys. Click the play/continue button to enable sound.

1. Take the flashlight and read the warning near the entrance.
2. Find the fuse on the kitchen counter. Install it in the upstairs hallway
   breaker beside the first master bedroom.
3. Recover the garage letter, guest bedroom locket and far master bedroom music box.
4. Return them to the glass cabinet downstairs and take the red key.
5. Unlock the service exit directly opposite the cabinet and cross its threshold.

The front latch stays jammed. This route uses the completed house blueprint's
existing upstairs breaker and service exit. The earlier compact game plan used
a utility room and front exit; those locations were adapted to the existing house.

The kitchen introduces Mayang once per saved run. Walls block sight, footsteps
attract her, and a hiding place only conceals an entry she did not witness.
The recoverable tsinelas stuns for two seconds, with immunity afterward.
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
- Ambience: original synthesis adapted from the existing house viewer. The game
  adds positional ghost noise and sound captions. Dialogue recordings are optional.

The four GLBs and original textures were preserved byte-for-byte. Small gameplay
props (fuse, batteries, keepsakes and tsinelas) fill gaps in the original inventory.
No generation service was called and no existing model was replaced.

Set the ghost name, model, face and optional normal/clean voice paths in
`src/config.ts`. Paths are relative to `public/assets/`; the build includes
configured recordings automatically. Empty entries use captions and temporary
synthesized cues. Clean dialogue never falls back to an unclean recording.

Asset generation records and source references remain with their models. The
repository does not contain a separate permission record for the supplied face
reference or personal voice recordings. No personal voice recordings are included.
Babylon.js 9.28.0 is Apache-2.0; its license is preserved with the vendor files.

## Validation

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

## Specification status

`HAUNTED_HOUSE_PROGRESS.md` records the current implementation and evidence.
The supplied environment guide and `haunted-house-game-plan.md` were read.
`BALAY-Codex-Full-Game-Master-Prompt.md` has not been exposed by the accessible
chat attachments or found locally. Alignment with that primary specification
remains unverified; it has not been replaced with an invented specification.

The project's local TypeSafe/JEV skill was read with its live documentation.
Its guidance keeps known rules in code. This game's deterministic progression,
collision and enemy states use strict TypeScript and tests; no unnecessary
network AI dependency or global skill installation was introduced.
