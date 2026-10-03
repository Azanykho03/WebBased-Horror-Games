# Refined flashlight and right arm

**Historical generated arm.** The game now uses the user's original rigged female
arm and the standalone flashlight. See [the active integration](../README.md).
The source models and validation below are preserved as the generation record.

The previous viewmodel is `flashlight_arms.glb`. It contains a modeled yellow flashlight
and a posed bare right hand/forearm. The separate exports share the same coordinates
and can be assembled at an identity transform.

| File | Triangles | Size | Purpose |
| --- | ---: | ---: | --- |
| `flashlight_arms.glb` | 27,778 | 3,939,492 bytes | Previous static viewmodel |
| `right_arm.glb` | 16,946 | 1,472,972 bytes | Separate posed right arm |
| `../../../items/flashlight/flashlight.glb` | 10,832 | 2,593,928 bytes | Separate flashlight |

All exports are GLB 2.0 with embedded textures. The combined model has eight PBR
meshes and four color images, at most 1024 pixels per side. Material batching keeps
the flashlight at five meshes. No billboard or camera-facing image plane is used.

## Generation and refinement

The two uploaded references are preserved in `source/reference-20261003/`.
`preparation.json` records the imagegen preparation of the open hand into a closed
grip; the uploaded arm provides the anatomy and color reference. The grip pose and
unseen surfaces are inferred, not an exact reconstruction of unseen anatomy.

- **Arm: TRELLIS**, through the Hugging Face Space `trellis-community/TRELLIS`,
  seed 42. The generated palm and fingers were retained. Pinched/duplicated arm
  geometry was replaced with smooth anatomical cross sections, the ends were
  capped, and the hand was fitted to the flashlight. The hand was simplified from
  14,834 to 9,642 triangles with locked borders. Generated skin was rebaked and
  de-lit to remove painted shadow bands and blend the wrist.
- **Flashlight: TripoSR fallback**, using the locally cached Hugging Face
  `stabilityai/TripoSR` model, revision
  `5b521936b01fbe1890f6f9baed0254ab6351c04a`. TRELLIS was tried first but produced
  two intersecting flashlight bodies. The hosted TripoSR Space returned
  `RUNTIME_ERROR`, so the existing local runtime completed inference offline.
  The lumpy reconstruction then received a substantial hard-surface rebuild:
  ribbed yellow housing, faceted rubber bezel/tail, guarded switch, recessed
  reflector, convex lens and emitter. Material wear was transferred from the
  saved TripoSR reconstruction.

The final assets are refined models, not untouched inference output. Original
meshes and generation reports are retained in each asset's `source/` folder.
The prior silver flashlight viewmodel, its metadata and previews are archived in
`source/previous-20261003/`. Earlier source files and texture extracts remain
historical; `generation-info.json` identifies the current outputs and textures.

## Previous static runtime integration

Coordinates are metres, +Y up, with the beam along local -Z and the grip centred
at the origin. The flashlight is 26.2 cm long. The combined file contains
`Flashlight_beam_socket` at `[0, 0, -0.171]`; the separate flashlight uses the same
origin and beam direction, but does not contain that socket node.

`src/config.ts` retains the existing `ASSETS.arms` path and defines the camera pose
in `VIEWMODEL`. `src/player.ts` uses that pose as the bob baseline. `src/world.ts`
preserves the imported PBR materials, adds a light affecting only the viewmodel,
aligns the spotlight with the lens socket, toggles emitter brightness, and adjusts
the horizontal anchor for narrow screens. Existing pickup/hide behavior is used.
The production build includes the combined model; source models and review tools
are excluded by the existing build configuration.

These are **static posed meshes**. They work with the current camera transform,
walking bob and hide/show behavior. No skeleton, skin weights or animation clips
are included. The hand, repaired forearm and caps overlap; deformation animation
would require welding/retopology, rigging and weight painting.

## Review and validation

All three files passed the Khronos glTF validator with **0 errors / 0 warnings**.
The combined model and separate exports were loaded in Babylon.js 9.28.0. The
combined viewmodel was inspected with textures, clay geometry and multiple camera
angles. The actual `World` + `Player` review checked flashlight switching, walking,
turning, reduced motion, hiding and narrow-screen framing. The lens/socket position
error was 0.000 mm in the observed visible states. FPS readings are local review
observations, not a benchmark across devices.

`npm run build` passed; 31 game tests and 8 generation-workflow tests passed.
Validation reports, runtime observations and screenshots are stored alongside the
models. `preview-gameplay.jpg` shows the imported model in the game renderer;
`preview-geometry.jpg` shows the actual mesh with textures removed.

Start the existing Vite server and open `/tests/viewmodel-review.html` for an
isolated review using the real game classes; it does not change saved progress.
For orbit/clay/standalone inspection, serve the project root:

```powershell
.\.venv-3d\Scripts\python.exe scripts/3d-generation/serve_assets.py --directory . --port 8774
```

Then open `http://127.0.0.1:8774/scripts/3d-generation/viewmodel-viewer.html?asset=combined`.

## Continue without new inference

The final files are already installed. To reproduce the last material polish and
assembly in a separate output directory using the preserved optimized arm:

```powershell
.\.cache\3d-generation\triposr-local\venv\Scripts\python.exe scripts/3d-generation/refine_flashlight_arms.py `
  --optimized-arm public/assets/models/player/arms/flashlight-arms/source/arm-optimized-before-albedo-polish.glb `
  --flashlight public/assets/models/items/flashlight/flashlight.glb `
  --output .cache/3d-generation/flashlight-refinement/reassembled
```

This reuses the completed flashlight and does not contact a provider. To rebuild
the flashlight's hard-surface geometry from its retained TripoSR source, omit
`--flashlight`. Never feed the already polished arm back into the material-polish
stage; use the named pre-polish source to keep the bake reproducible.

## Files changed for this delivery

- Updated `flashlight_arms.glb`, `generation-info.json`, `babylon-validation.json`,
  `validation-report.json`, and the two existing PNG preview files in this folder.
- Added `right_arm.glb`, `README.md`, `right-arm-validation.json`,
  `right-arm-babylon-validation.json`, `runtime-validation.json`,
  `optimization-report.json`, and the `preview-*.jpg` reviews.
- Added the current named texture extracts in `textures/`, TRELLIS source GLBs and
  report, the optimized arm before albedo polish, original/prepared references,
  and the preserved previous delivery under `source/`.
- Added `public/assets/models/items/flashlight/` with the standalone GLB, texture
  extracts, original and rejected source meshes, reference, generation/validation
  records, preview and README.
- Updated `src/config.ts`, `src/player.ts`, and `src/world.ts` for the new pose,
  materials and lens-aligned beam.
- Updated `scripts/3d-generation/generate_asset.py`, `generate_local_triposr.py`,
  and `utils/mesh.py` for separate assets and recorded quality-based fallback.
- Added `scripts/3d-generation/refine_flashlight_arms.py`,
  `viewmodel-viewer.html`, `viewmodel-viewer.js`, and
  `tests/viewmodel-review.html` / `tests/viewmodel-review.ts`.
- Updated the generation workflow README and progress record.
