# Balay ni Mayang — haunted house environment

An explorable, two-storey environment assembled from the owner's complete blueprint
and the supplied interior video frames. The existing ghost, arms, and key assets
are unchanged. Babylon.js 9.28.0 remains the renderer. This is the environment
asset and its inspection page; it does not add enemy AI, inventory, puzzles or story.

## Open the walkthrough

From the project root:

```powershell
.\.venv-3d\Scripts\python.exe scripts/3d-generation/serve_assets.py --port 8769
```

Open <http://127.0.0.1:8769/>. The server binds to loopback only. All renderer,
loader, geometry and texture files are local; no service credentials are needed.
Use this server on Windows because the system MIME registry may serve `.mjs` as
`text/plain`, which browsers correctly reject. Opening `index.html` as `file://`
does not support the manifest/module fetches.

- **Explore:** WASD moves; drag the canvas to look; arrow keys turn; F toggles
  the flashlight; Escape pauses. Shift walks faster, at 2.4 m/s.
- **Guided walkthrough:** follows the validated route with the same collision
  and stair code as free exploration. It does not teleport between rooms.
- **Inspect a room:** places the inspection camera at a verified clear viewpoint.
- **Plan:** live floor plan, doors and camera position.
- **Settings:** brightness, reduced flicker (default on), flashlight, separate
  sound volume, sound toggle, tour speed and cutaway overview.
- **Validation:** live renderer, texture, light, chair, frame rate, audio and
  walkthrough status. Frame rate is a local observation, not a device guarantee.

Sound is original synthesis: quiet wind and room-specific piano, paper, water,
metal, glass, static and fabric sounds. It starts only after an explicit Sound
control and Explore/Tour action, and suspends when paused or the tab is hidden.
One decorative rat crosses rarely; it has no collision or enemy behavior.

## Files and integration

- `haunted-house.glb`: self-contained Y-up glTF 2.0 mesh in metres, embedded PBR
  texture maps, no external texture paths. X is east, negative Z north. Front Z=0.
- `house-manifest.json`: stable F01–F09/U00–U07 room IDs, floor rectangles,
  doorway source/destination/facing/open state, furniture, windows, light inventory,
  collision boxes and stair anchors. Floor rise is 3.24 m.
- `house-navigation.mjs`: pure navigation module shared by tests and preview.
  Walkable floor polygons plus circle-versus-oriented-box collisions. Camera
  radius 0.23 m, body height 1.78 m, eye height 1.65 m. Eighteen real treads use
  a matching smooth ramp for safe first-person ascent/descent.
- `walkthrough-paths.json`: clearance-checked route for the guided walkthrough.
- `layout-validation.json`, `validation-report.json`, `mesh-inspection.json`,
  `optimization-report.json`, `babylon-validation.json`, `settings-validation.json`:
  acceptance evidence. The complete checked record is in `acceptance-checklist.md`.
- `source/`: unmodified complete specifications, frame manifests, source hashes,
  22 retained original frames and four chronological/detail reference sheets.
- `textures/`: original deterministic 512px surface maps. Included in the GLB.
- `vendor/`: pinned Babylon.js and loader, with upstream license.
- `*-preview.png`: actual browser captures of the rendered asset.

Meshes are batched by room and shared material, with ceiling, roof and floor
names separated for visibility control. Six nearby local lights are enabled at
once, plus ambient and the optional flashlight. Only the flashlight uses a 512px
shadow map. The preview uses inexpensive StandardMaterial equivalents of the
GLB's PBR surfaces. Mirrors are dark static surfaces, with no live reflections.
H1 and H2 are the only electric fixtures in U00; window spill is not electric.
Doors are held fully open and have explicit collision. The garage shutter is
visibly shut. Future interactive doors must update both their geometry and collider.

The accepted export has 146,276 triangles, 209,422 vertices, 275 batches, 27
materials and 26 embedded 512px maps, totaling 10,179,228 bytes. The 213.47-metre
continuous walkthrough reached all 30 stops without collision failures. Khronos
validation reports zero errors or warnings; browser review found no missing
textures or runtime errors. See the reports for evidence and scope limits.

Import the GLB with the existing Babylon glTF loader and read the manifest to add
collisions/lights. Those runtime systems intentionally are not embedded as a game
in the static GLB. Preserve room IDs and coordinate anchors when integrating.
Upstairs has five bedrooms/study rooms plus shared CR: **six main rooms**, with
Master 1's private CR additional. The complete terrace loop avoids the private CR.

## Resume or modify

Read the root `HAUNTED_HOUSE_PROGRESS.md` first. Reuse the existing source code;
do not rerun reference preparation, remote generation or completed phases.
Only recompile after an intentional correction:

```powershell
.\.venv-3d\Scripts\python.exe scripts/3d-generation/generate_house.py --phase final
node scripts/3d-generation/mesh-tools/optimize-house.mjs
node scripts/3d-generation/mesh-tools/validate-house.mjs
node scripts/3d-generation/mesh-tools/validate.mjs public/assets/models/environments/haunted-house/haunted-house.glb
```

The existing `.venv-3d` supplies trimesh, NumPy and Pillow. The existing mesh-tools
package supplies glTF Transform and Khronos Validator. No new package environment.
Other supported phase checkpoints: `blockout`, `furniture`, `materials`, `lighting`.
Those are saved in `.cache/3d-generation/runs/haunted-house/`; the final compiled
asset stays here. Previous compiled assets are retained by SHA256 in the same
cache's `history/`. Git ignores that cache, so keep it separately if historical
binary checkpoints are needed; all reproducible source and final artifacts live
outside the cache. The optimizer welds identical vertices and deduplicates shared
data without simplifying geometry or re-encoding textures.

## References and licenses

The 982 source frames were inventoried and sampled chronologically, then repeated
landmarks inspected together. Frame evidence supports carved reddish doors, timber
banisters, cream walls, layered curtains, display cabinets, sofas and book passage.
The unseen complete layout, garage, upper rooms and terrace follow the blueprint;
the result is a stylized real-time interpretation, not a photogrammetric scan.
Original frame photographs are not used as public wall textures.

The optional [3d-assets repository](https://github.com/boytchev/3d-assets) and MIT
license were inspected. Its bookshelf uses Three.js; no code/models from that
package were incorporated or installed. All house geometry and surface art are
local procedural originals. Existing TypeSafe files and the local skill are kept;
this deterministic environment has no need for a new runtime AI integration.

The optional gameplay acceptance items in blueprint §§7–8 (keys, power puzzle,
scares and a game-winning exit condition) are deliberately outside this request.
The service exit is geometrically reachable and the walkthrough reports completion.
