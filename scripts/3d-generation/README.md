> Active game update: the uploaded rigged female right arm now holds the existing
> standalone yellow flashlight. See
> [`public/assets/models/player/arms/README.md`](../../public/assets/models/player/arms/README.md).
> The generated arm workflow and previous source assets below are preserved.

# 3D asset generation

## Haunted-house environment

The complete two-storey environment now uses this same workflow and the existing
Babylon.js renderer. See
`public/assets/models/environments/haunted-house/README.md` for local walkthrough,
source/reference preservation, room/collision/light metadata, and validation.
`HAUNTED_HOUSE_PROGRESS.md` at the project root records phase and acceptance status.
The deterministic entry point is `generate_house.py`; existing Space-based ghost,
arms and key generators retain their behavior and assets. No new root project,
rendering engine or parallel asset pipeline is introduced.

Creates a mesh asset only. No game, game UI, enemy AI, rig or animation is created.
The project-local TypeSafe skill and existing project instructions are preserved.

## Flashlight arms and keys

These commands reuse the ghost workflow's Space adapters, reference preservation
and GLB validation. They do not build the game:

```powershell
.\.venv-3d\Scripts\python.exe scripts\3d-generation\generate_asset.py `
  --type flashlight-arms --image "path\to\handTexture.jpg"
.\.venv-3d\Scripts\python.exe scripts\3d-generation\generate_asset.py `
  --type key --image "path\to\ScaryKeys.png"
```

The default output paths are:

- `public/assets/models/player/arms/flashlight-arms/flashlight_arms.glb`
- `public/assets/models/items/keys/key.glb`

`--image` can be repeated. The single-image adapters use the first image and
explicitly record that additional images are preserved for review, not separately
conditioned. For one coherent input prepared from several references, pass
`--prepared-image` and a required `--reference-strategy` explaining each input's
role. Original images and their SHA256 hashes are always preserved.

Props use Y-up with a centered pivot. `--size` sets the longest dimension in
metres (key default 0.12, flashlight arms default 0.5). `--source-up x|y|z`,
`--rotate X Y Z` in degrees and `--pivot center|base` allow visual correction.
These settings do not change the existing ghost's normalization behavior.
Native GLB texture/geometry binary data is preserved; a root transform supplies
orientation, scale and pivot. Textures remain embedded, and copies are also
extracted to `textures/` without re-encoding. Scalar PBR settings approximate
painted metal for the key and nonmetal skin for the combined arm; the arm's
single color atlas does not provide a separate metallic map for its flashlight.

Use `--resume-run path/to/generation-info.json` with the same input images to
finish processing a preserved raw generation **without another GPU call**. The
script checks both original-reference and prepared-input hashes before resuming.
Raw sources and their sidecars are also retained in `source/`; resuming can use
that copy if the ignored cache has been removed. `--replace` archives the previous
GLB and metadata before replacing it. Successful GPU downloads are recorded
before normalization so a failed conversion can be resumed.

### Delivered assets, 2026-10-01

- **Key:** the saved TRELLIS run used the exact `ScaryKeys.png` hash, so it was
  recovered rather than generated again. 3,904 triangles, 12 cm, one 2048px color
  atlas. Three-loop bow, red worn finish and key bit visually checked.
- **Flashlight hand/forearm:** the original `handTexture.jpg` shows one right
  hand/forearm. Direct TRELLIS output omitted most of the cropped forearm and was
  rejected. Built-in imagegen completed that forearm in a transparent reference
  while retaining the grip and plain silver flashlight; its prompt and limitations
  are saved in `source/reference-preparation.json`. The next TRELLIS attempt hit
  its free GPU quota; the TripoSR Space reported `RUNTIME_ERROR`. The existing
  offline TripoSR installation generated the accepted complete forearm instead.
  24,688 triangles, 55 cm, one 2048px atlas, source Z-up converted to Y-up, then
  rotated `-100 0 0` degrees for a raised forward resting pose. A centered root
  allows later positioning below/right of the player camera.

Both GLBs pass Khronos validation with zero errors/warnings and load in Babylon.js
9.28.0 with ready textures and verified world-space vertex bounds. Each asset has
`generation-info.json`, `validation-report.json`, `babylon-validation.json`, and
preview PNGs. They are ready for **static rendering**. The arm is a single fused
surface with inferred hidden anatomy and approximate small details; it still
needs cleanup/retopology, rigging and weight painting for animation. It has no
independent flashlight articulation, emission, beam or gameplay. Neither asset
has a skeleton or animation. Existing ghost assets were left unchanged.

### Optional local TripoSR fallback

The local runtime already present in this project is
`.cache/3d-generation/triposr-local/venv/` (Python 3.12, PyTorch 2.6 CUDA); the
ordinary `.venv-3d` is the small Space-client/validation environment. Local
inference uses the official [TripoSR source](https://github.com/VAST-AI-Research/TripoSR)
in `triposr-local/vendor`, and cached `stabilityai/TripoSR` plus DINO model files
under `.cache/huggingface`. No dependency installation, weights download or paid
service is triggered. A fresh checkout needs those optional dependencies/weights
provisioned separately; the remote commands above do not require them.

After **both** Space providers have failed, run the following with a prepared
transparent RGBA input and their matching failure report:

```powershell
.\.cache\3d-generation\triposr-local\venv\Scripts\python.exe `
  scripts\3d-generation\generate_local_triposr.py `
  --image public\assets\models\player\arms\flashlight-arms\source\forearm-complete-reference.png `
  --resume-failures .cache\3d-generation\runs\flashlight-arms-20261001T013839_092756Z\generation-info.json `
  --output-run .cache\3d-generation\runs\flashlight-arms-local-20261001-01
```

The Windows fallback uses scikit-image marching cubes on the same inferred density
field, instead of the unavailable torchmcubes extension; upstream coordinate order
is retained. It uses xatlas/ModernGL for UV baking and chunked GPU color queries.
It saves inference state and the untextured mesh so the same `--output-run` resumes
unfinished stages. Finalize an existing local result through the normal entry point:

```powershell
.\.venv-3d\Scripts\python.exe scripts\3d-generation\generate_asset.py `
  --type flashlight-arms `
  --image public\assets\models\player\arms\flashlight-arms\source\reference-1.jpg `
  --prepared-image public\assets\models\player\arms\flashlight-arms\source\forearm-complete-reference.png `
  --reference-strategy "Original grip, skin and silver flashlight; imagegen completed the cropped forearm." `
  --resume-run public\assets\models\player\arms\flashlight-arms\generation-info.json `
  --source-up z --rotate -100 0 0 --size 0.55 --replace
```

Offline conformance validation (uses the existing mesh-tools dependencies):

```powershell
node scripts/3d-generation/mesh-tools/validate.mjs `
  public/assets/models/items/keys/key.glb `
  public/assets/models/player/arms/flashlight-arms/flashlight_arms.glb
```

The temporary Babylon inspection page is in
`.cache/3d-generation/flashlight-key-preview/`; it is a standalone asset viewer,
not a game UI. `PROGRESS.md` records the resumable task state.

## Setup (PowerShell, Python 3.11+)

```powershell
python -m venv .venv-3d
.\.venv-3d\Scripts\python.exe -m pip install -r scripts\3d-generation\requirements.txt
```

The first installed environment uses Python 3.14. Dependencies are pinned to that
verified installation. Older Python versions may require compatible package pins.

## Generate

```powershell
.\.venv-3d\Scripts\python.exe scripts\3d-generation\generate_ghost.py `
  --face "path\to\face.png" `
  --body "path\to\body.jpg" `
  --prepared-image "public\assets\models\enemies\ghost\source\ghost-combined-reference.png"
```

The prepared image for this ghost combines the first reference's face with the
second reference's full body using Codex's built-in imagegen tool. Its prompt is
saved in `public/assets/models/enemies/ghost/source/reference-preparation.json`.
This preparation is a separate image step; all 3D generation uses free, open-source
Hugging Face models. No paid 3D provider is configured.

For a different character, prepare a new combined full-body image from its two
references before supplying `--prepared-image`. The command also works with just
`--face` and `--body`: it then uses the body for reconstruction, preserves the face
for review, and explicitly reports that facial identity was not independently
conditioned. It does not silently claim to combine references in that mode.
TRELLIS's multi-view mode expects different whole-object views; a close-up head and
a complete body are unsuitable as interchangeable views.

## Providers and authentication

1. TRELLIS: `trellis-community/TRELLIS` (the former `microsoft/TRELLIS` redirects here).
2. TripoSR: `stabilityai/TripoSR`, attempted if TRELLIS fails.

Public access is attempted without a token. If a Space requires authentication,
set `HF_TOKEN` in the process environment using a secure local method, then rerun.
Do not paste tokens into chat, source code, metadata, or a frontend. No token is
printed or stored by this workflow. `.env.example` contains placeholders; `.env`
is ignored. The script reads environment variables, not `.env` files automatically.

`HF_3D_SPACE_ID` and `HF_TRIPOSR_SPACE_ID` override the respective providers.
Alternatively use `--trellis-space owner/name` and `--triposr-space owner/name`.
Overrides must implement the inspected compatible API contract; unsupported schemas
fail explicitly. The official TripoSR Space reported a runtime error at first setup;
its future availability is not guaranteed.

The script uses Gradio's queue client, inspects and saves the live API schema before
submitting images, preserves the session across preprocessing and generation,
and sets a timeout for each endpoint (`--timeout 600`). No endpoint is guessed.
The adapter's endpoint names come from the Spaces' published source and are checked
against live schemas on every invocation.

## Output and validation

- Final asset: `public/assets/models/enemies/ghost/ghost.glb`
- Originals and combined reference: that folder's `source/`
- Non-sensitive report: `generation-info.json`
- Raw downloads, provider video, schema and run history: `.cache/3d-generation/runs/`
- Textures remain embedded in GLB; `textures/` is available for later manual work.

Each run keeps its raw downloads. Existing final models are protected: use
`--replace` to archive a previous model before replacing it. Failed reruns preserve
an existing successful model and write `last-failure.json` instead of replacing its
metadata. `.cache/` is ignored by Git; retain the raw run directory separately if
you need its source files in long-term backups.

The output is converted with trimesh, oriented Y-up, scaled to 1.85 metres, and
centred horizontally with the origin at ground level. `--height` changes the size.
The default upright-axis heuristic selects the longest axis of this full-body
humanoid; `--source-up x|y|z` overrides it. Visually check head-up orientation.

Validation checks the GLB header/chunks, embedded images and buffer ranges,
external paths, nonempty geometry, finite vertices, valid triangle indices,
materials, UV presence, skin/animation presence and bounds. This is basic validation,
not a claim of Khronos conformance. Visual review is required before marking the
asset Babylon-ready. Mesh generation does not create a humanoid skeleton.

GLB, glTF, OBJ, PLY and STL are loaded where supported. FBX or unusual formats may
need Blender conversion; errors preserve raw output and never masquerade as a GLB.
No Blender installation is required for the normal native-GLB path.

## Refined yellow flashlight and right arm (2026-10-03)

The active viewmodel now uses the supplied yellow flashlight and bare-arm
references. TRELLIS supplied the hand; its flashlight result was rejected for
duplicate intersecting bodies, so cached Hugging Face TripoSR weights supplied
the flashlight reconstruction. The saved reconstructions were refined locally
into complete volumes with PBR materials and integrated at the existing game path.

The final assets and exact continuation commands are documented in
[`flashlight-arms/README.md`](../../public/assets/models/player/arms/flashlight-arms/README.md).
Use `refine_flashlight_arms.py` and its saved pre-polish arm to continue offline;
do not run fresh inference to repeat review, polishing or assembly.

`generate_asset.py --type flashlight` and `--type arm` support separate exports.
When a successful TRELLIS result fails visual review, `--fallback-from REPORT`
with `--fallback-reason TEXT` records the defect and tries TripoSR while retaining
the rejected source. This path verifies that the original/prepared references
match the saved run. The local fallback can reuse saved provider preprocessing
with `--preprocessed-image`; it still requires recorded attempts from both Spaces.

## Offline checks

```powershell
.\.venv-3d\Scripts\python.exe -m unittest discover -s scripts\3d-generation\tests -v
```

## Sources inspected

- https://huggingface.co/spaces/trellis-community/TRELLIS
- https://huggingface.co/spaces/trellis-community/TRELLIS/blob/main/app.py
- https://huggingface.co/spaces/stabilityai/TripoSR/blob/main/app.py
- https://github.com/microsoft/TRELLIS

Live model availability, queues and schemas can change. Error reports distinguish
authentication, GPU/quota, timeout, schema, download, conversion and validation
failures. A failed generation creates no substitute or placeholder ghost mesh.

## Face refinement used for the delivered ghost

The first whole-body reconstruction distorted facial features in close-up. The
delivered model therefore uses a second TRELLIS reconstruction directly from the
original face image. Both generated meshes keep their own embedded 2048x2048
textures. The detailed head was fitted to the body and simplified with
meshoptimizer; the texture bytes were verified unchanged.

The normalized source meshes are preserved in the asset's `source/` folder:
`ghost-body-generated.glb` and `ghost-head-generated.glb`. The exact fit and
optimization settings are recorded in `generation-info.json`. These are separate
overlapping head/body meshes, not welded deformation-ready topology. Before
skeletal animation, clean up the neck/hair junction, weld or retopologize as needed,
then rig and weight-paint. The red eyes are in the color texture; no emission effect
or animation is included.

To generate a fresh detailed head:

```powershell
.\.venv-3d\Scripts\python.exe scripts\3d-generation\refine_face.py `
  --face public\assets\models\enemies\ghost\source\ghost-face-reference.png
```

To reproduce the delivered assembly from its saved sources without another GPU run:

```powershell
.\.venv-3d\Scripts\python.exe scripts\3d-generation\assemble_ghost.py `
  --body public\assets\models\enemies\ghost\source\ghost-body-generated.glb `
  --head public\assets\models\enemies\ghost\source\ghost-head-generated.glb `
  --output .cache\3d-generation\ghost-reassembled.glb
npm ci --prefix scripts/3d-generation/mesh-tools --no-fund --no-audit
node scripts/3d-generation/mesh-tools/optimize.mjs `
  .cache\3d-generation\ghost-reassembled.glb `
  .cache\3d-generation\ghost-reoptimized.glb Ghost_head 0.2
```

Assembly defaults reproduce this ghost's fit; other characters require visual
adjustment using `--cut-y`, `--head-bottom`, `--head-height`, `--head-x`, `--head-z`
and `--yaw`. The optimizer refuses to overwrite an existing output, preserves the
body's triangles, reduces the head, and writes both optimization and official
Khronos glTF Validator reports. This ghost passed with zero errors and warnings.

The asset was also loaded and visually inspected in Babylon.js 9.28.0. A temporary
inspection page in `.cache/3d-generation/preview/` contains no gameplay and is not
part of the game. Preview screenshots in the asset folder show the actual GLB.
