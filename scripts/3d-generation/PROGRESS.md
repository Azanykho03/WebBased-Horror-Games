# Flashlight arms and key generation

STATUS: COMPLETE

## Objective and scope

Follow `C:/Users/asus/Downloads/HUGGINGFACE_3D_FLASHLIGHT_ARMS_AND_KEY_GUIDE.md`:
reuse this ghost workflow to produce and validate a first-person hand/forearm
holding the silver flashlight in `handTexture.jpg`, plus the realistic worn red
key in `ScaryKeys.png`. No game or gameplay systems. The flashlight reference
shows one right hand/forearm; preserve that silhouette rather than inventing a
second arm. Keep the project-local TypeSafe skill and existing ghost intact.

## Completed

- Read the guide, project instructions, TypeSafe skill and current documentation.
- Inspected the existing generators, shared Space adapters, GLB checks and caches.
- Inspected the current TRELLIS API: the existing queue/session contract is usable.
- Found a successful cached TRELLIS key run made from this exact reference:
  `.cache/3d-generation/runs/key-20260930T122918_288666Z/`.
  Reference SHA256: `660a1a37be5db60a54cf9ad0a8eee1966d58fb3fecfec741853d75e562360872`.
  Reuse its raw mesh; do not spend another generation on it.
- Existing cached arms use different references and do not satisfy this request.
  New hand reference SHA256:
  `217d7e7d8cdea28ae89ca9374d6ee465ce4a7262ab738f978b27a6279a6ac522`.

## Provider status and errors

- TRELLIS: `trellis-community/TRELLIS`, live schema inspected successfully.
  Direct hand-reference generation completed; rejected for missing forearm.
  The prepared-reference retry hit ZeroGPU quota (11:05:52 retry delay at that
  time). No quota workaround or alternate account was used.
- TripoSR Space: `stabilityai/TripoSR`, currently reports `RUNTIME_ERROR`.
- Local TripoSR: successfully reused the existing runtime and cached model,
  offline on the GTX 1650. Generated the accepted complete forearm and atlas.
- Sandboxed network probes failed with WinError 10013; approved network execution
  successfully inspected TRELLIS. This is not a generation failure.
- Cached failures from earlier, different arms references remain preserved.

## Final assets / last successful step

`generate_asset.py` and asset-specific preparation have been added. Cached key
restored at the target path, textured, 3,904 triangles, 12 cm, 3,292,592 bytes,
Khronos 0 errors / 0 warnings. Babylon load, exact world-space scale and visual
silhouette checked; preview and both validation reports saved.

The first direct TRELLIS arm generation succeeded, but visual review rejected it
because it lost the forearm. Its raw mesh is preserved in
`.cache/3d-generation/runs/flashlight-arms-20261001T013223_060113Z/`.
The source node named `world` caused a trimesh bounds-check collision; fixed by
renaming that node without changing its mesh or binary textures. Both models
passed Khronos after this fix; the arm still needs the visual refinement below.

Built-in imagegen prepared `source/forearm-complete-reference.png` with the original
silver flashlight/grip and a visible extended forearm. Prompt and provenance are
saved in `source/reference-preparation.json`. After both Space providers failed,
local TripoSR completed the accepted model using that prepared image:
`.cache/3d-generation/runs/flashlight-arms-local-20261001-01/`.
It has 24,688 triangles, a 2048px atlas, and a 55 cm longest dimension, and is
2,486,768 bytes. Source Z-up is converted to Y-up and rotated `-100 0 0` degrees
for a raised resting pose. The root pivot is centered. Exact vertex bounds were
verified in Babylon (transformed bounding boxes alone overestimate rotated mesh
size). Khronos reports zero errors and warnings; Babylon textures load correctly.

The last completed step verified each final file's SHA256 against metadata,
triangle count against Babylon, embedded textures/UVs, actual world-space scale,
and both conformance reports. Existing ghost files and local skills are unchanged.

## Files created / workflow changes

- `generate_asset.py`: repeatable type/image commands, raw-output resume,
  provenance checks, output protection and texture extraction.
- `generate_local_triposr.py`: optional offline fallback; records prior Space
  failures, preserves inference/mesh stages, uses the existing local installation.
- `utils/mesh.py`: prop-specific preparation, preserved native GLB binary data;
  ghost preparation behavior retained.
- `mesh-tools/validate.mjs`: official Khronos report without modifying the model.
- `README.md`: complete commands and limitations. Eight offline tests pass.
- Each asset folder contains originals/raw sources, texture PNG, metadata,
  Khronos/Babylon reports and actual GLB preview screenshots.
- Temporary inspection page: `.cache/3d-generation/flashlight-key-preview/`.
  This contains asset review controls only, not a game.

## Remaining tasks / exact next step

None within this request. Do not regenerate these assets on continuation.
For future asset edits, use the final `generation-info.json` with `--resume-run`
and the same images; see README. Both are static and unrigged/unanimated.
The hand/forearm is a fused mesh with inferred hidden anatomy and approximate
small details. Cleanup/retopology, rigging, weight painting and independent
flashlight articulation are future animation work, not claimed complete here.
No player, flashlight gameplay, pickup, inventory, ghost AI or game was created.

## Expected final paths

- `public/assets/models/player/arms/flashlight-arms/flashlight_arms.glb`
- `public/assets/models/items/keys/key.glb`

Keep all raw downloads and successful generations. Resume at the unfinished step;
never restart a successful generation merely to continue validation or conversion.
