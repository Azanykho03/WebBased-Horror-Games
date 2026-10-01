# Haunted house environment

STATUS: COMPLETE

## Scope and continuity

Build the complete two-storey environment from the full owner-supplied guide and
blueprint; no enemy AI, inventory, puzzles, encounters or story progression.
Source documents are preserved in
`public/assets/models/environments/haunted-house/source/`.
Keep existing ghost, arms, key, generators, local TypeSafe skill and dependencies.
No root game app exists. The existing renderer for asset review is Babylon.js;
retain it and provide an environment-only first-person inspection page.
Scripts belong to `scripts/3d-generation/`; assets follow the existing
`public/assets/models/<category>/<asset>/{source,textures,reports}` convention.

## Phases

- [x] 1. Complete guide/blueprint read, project and reference inspection.
- [x] 2. Two-floor blockout and exterior terrace.
- [x] 3. Validate layout, doorways, windows, stair headroom and navigation.
- [x] 4. Required furniture in every room.
- [x] 5. Materials, damage and reference-inspired details.
- [x] 6. Local lighting; exactly H1/H2 in the upstairs hallway.
- [x] 7. Optimize and validate geometry, materials and runtime.
- [x] 8. First-person walkthrough, fix issues and check acceptance.

## Reference inspection

982 frames inventoried: video_1 = 517, video_2 = 465. Chronological overviews
sample every tenth frame and both final frames; four-frame detail sheets inspected
at full size. 22 key originals, both timestamp manifests, all frame SHA256 hashes,
contact sheets and both complete source documents retained in the asset's source/.

- video_1 1–170: cream hallway, reddish carved panel doors, timber floor,
  dark ceiling trim, framed pictures.
- video_1 180–330: dark glass-front cabinet, dishes, glassware, vintage electronics.
- video_1 340–465: crowded figurine display cases, olive/yellow covers, pale cupboards.
- video_1 470–517: broad multipane window, sheer pale curtain, framed artwork.
- video_2 1–140: solid hardwood treads and turned dark red banisters.
- video_2 150–220: paired fabric-covered sofas, low table, cream/lace curtains with
  reddish outer panels and large windows.
- video_2 230–330: carved heavy entry door, long mirror, mat and ceramic vessels.
- video_2 340–400: tiled dining zone and dark wooden chairs.
- video_2 410–465: tall densely filled shelves on bathroom approach.

Footage does not prove the complete floor plan, unseen bedrooms, garage or terrace.
Use the blueprint for those; apply its abandoned aging to the observed family-home
materials. Exact source photographs are references, not in-game wall textures.

## Asset / TypeSafe decisions

Existing assets are character/hand/key meshes, not reusable architectural furniture.
Inspected the optional 3d-assets repository and MIT license; no package installed
or used. TypeSafe local skill and live index read. This deterministic geometry
task needs no semantic runtime judgments, so no TypeSafe API or new AI gameplay.

## Rooms and implementation

All 17 zones modeled and furnished. Stable IDs: F01–F09 and U00–U07, with private CR
as a subspace of U01. Six main upper doors include the shared CR, not six bedrooms.
Coordinates: metres, Y up, X east, negative Z north, front at Z=0.
Starting solved footprint: west rooms X=-7.6..-1.4; passage X=-1.4..1.4;
east rooms X=1.4..9.4; rear Z=-22. Floor rise 3.24 m.

## Last successful step / exact next step

Final acceptance completed on 2026-10-01. No unfinished rooms or environment
acceptance items remain. See the complete checked record in
`public/assets/models/environments/haunted-house/acceptance-checklist.md`.

The final browser walkthrough continuously traversed 213.47 metres and 30 stops
using the same navigation as free exploration: both floors, all rooms, the CRs,
garage rear, aligned stairs, terrace loop, breaker and exterior escape recess.
Zero collision failures, missing textures or runtime errors. Reverse terrace
navigation and solid walls/rails also passed the offline movement checks.
All 13 layout assertions passed, including exact eight dining chairs, exact two
upstairs hallway fixtures H1/H2, bed counts and door/furniture clearance.

Final asset: 146,276 triangles, 209,422 vertices, 275 room/material batches,
27 materials, 26 embedded 512px images, 10,179,228 bytes. Exact vertex welding
reduced the 15,447,868-byte export without changing triangles or texture bytes.
Khronos validation: zero errors, warnings, infos or hints. SHA256:
`df9ecea1a11edc048ee6c156ac6b6968ad60efeb979d9c56983fbafb97ebbd35`.
Six active nearby local lights, one 512px flashlight shadow map and inactive-floor
visibility management. Browser observed about 60 FPS on this machine; this is
not a performance guarantee for other devices.

Brightness and flashlight changes were visually compared. Reduced Flicker was
checked and restored to its default on state. Sound starts after explicit user
interaction, reports running during exploration, and suspends on Pause and tour
completion. Separate volume and mute controls were checked. Settings and runtime
evidence are saved beside the GLB, with actual rendered screenshots.

The local Babylon preview at http://127.0.0.1:8769 uses
`scripts/3d-generation/serve_assets.py` (Windows MIME fix for .mjs).
Phase checkpoints and historical compiled GLBs are preserved under
`.cache/3d-generation/runs/haunted-house/`. That cache is ignored by Git; all
reproducible sources and final assets are in the regular project folders.

Exact next step: none within this environment request. Open the existing preview
for review. If a later correction is requested, edit the existing generator and
affected room only; follow the asset README's rebuild/validation commands.
No remote generation service was used.

Visual corrections applied: ceiling/wall hairline gap, kitchen window obstruction,
floating cupboard knobs and lamps, inverted tapered shades/glasses, book spines,
door colliders folded on the room side, targeted peeling paint/cracks and a faint
local ambient sound palette. One conservative door/wardrobe collider overlap was
found in U06; wardrobe moved 11 cm clear, exported and verified. Source-frame
reference remains the cream, carved timber, layered curtain and display-cabinet
family-home appearance. No known blocking environment errors remain.

Fixed: initial tight turn at stair foot (shortened run to create clear approach);
unsupported trimesh frustum helper (native cylinder taper); optional SciPy convex
hull dependency (explicit eight-vertex car cabin). No added Python dependencies.
Native procedural furniture selected after inspecting MIT 3d-assets bookshelf
source, which imports Three.js. That package is not installed or used.
Pinned Babylon.js 9.28.0 and its glTF loader are locally preserved under vendor/
with the upstream license. Initial sandbox download was network-blocked; approved
download succeeded. Existing model assets and runtime are preserved.

## Files changed

- This progress document.
- `scripts/3d-generation/README.md`: environment entry in the existing workflow.
- `scripts/3d-generation/generate_house.py`: phased native house assembly.
- `scripts/3d-generation/utils/house_{layout,geometry,furniture,materials,details}.py`:
  architectural data, reusable furniture, surfaces and abandoned details.
- `scripts/3d-generation/house-viewer.{html,js}`, `house-navigation.mjs` and
  `serve_assets.py`: Babylon inspection, collision/navigation and local server.
- `scripts/3d-generation/mesh-tools/{validate-house,optimize-house}.mjs`:
  layout/navigation acceptance and conservative GLB optimization.
- `public/assets/models/environments/haunted-house/`: final GLB, manifest,
  generation metadata, route, reports, README, acceptance checklist, preview
  page/scripts, rendered screenshots, source references, textures and local vendor.

## Scope limits

The environment is a stylized procedural interpretation of the references, not
a photogrammetric replica. Mirrors are static, doors are held open, sound is
lightweight original synthesis, and the GLB itself contains geometry/materials;
the companion manifest and preview provide lights and collision. There was no
existing game app to integrate into. Enemy AI, puzzles, pickups, persistent key
states, encounters and a winning exit condition remain outside the user's scope.
The blueprint's optional gameplay checks are explicitly marked not applicable,
not represented as implemented. Existing ghost, arms, key and TypeSafe work remains.
