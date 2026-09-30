# Ghost asset generation

Creates a mesh asset only. No game, game UI, enemy AI, rig or animation is created.
The project-local TypeSafe skill and existing project instructions are preserved.

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
