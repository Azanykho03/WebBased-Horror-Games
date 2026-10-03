# Active first-person female arm

The game uses the supplied `free_gameready_fps_female_arms.glb` without
re-exporting or modifying its contents. The previous generated arm in
`flashlight-arms/` remains as historical source; it is no longer loaded.

## Preserved source

- SHA-256: `1e410ec6ac5133c70bd42a691fda73d88d28744ec7fa1b0b51ab4a151e179a1d`
- 39,313,020 bytes; matches the supplied Downloads file byte for byte.
- Two separate skinned meshes, one original skeleton, 58 joints, 70 nodes.
- Original vertex positions, UVs, tangents, joint indices, weights and bind matrices.
- Original base-color, metallic/roughness and normal PNGs, each 4096 × 4096.
- All five authored single-frame pose presets retained and stopped.
- Only the right mesh is enabled. The left mesh and its joints are retained.

Attribution: **BAMEN**, **FREE GameReady [FPS Female Arms]**, **CC BY 4.0**.
See [ATTRIBUTION.md](ATTRIBUTION.md); the same attribution is in the game credits.
`female-arms-source-report.json` records the inspected hierarchy and metadata.
The source's 39.3 MB download and original 4K textures are intentionally preserved.

## Runtime integration

`src/flashlight-viewmodel.ts` uses the original glTF bone-linked TransformNodes:

`Shoulder.R_024 → Shoulder_2.R_025 → Forearm.R_026 → Hand.R_027`

The hand owns `FlashlightSocket`; the socket owns the existing standalone yellow
flashlight from `models/items/flashlight/flashlight.glb`. Its bytes are unchanged.
The Fists Pose is relaxed through the original finger joints to fit the barrel.
Pose offsets are rebuilt from cached transforms each frame to prevent drift.
An external scale parent removes only the source's Sketchfab display multiplier.
No inverse bind matrix, source joint hierarchy or skin data is edited.

The camera-relative right arm uses a foreground rendering group and cannot
intercept interaction rays. Its bind-pose bounds cannot cull the posed skin.
The actual player collision and movement system are unchanged. The spotlight
origin is the lens at local `[0, 0, -0.171]`, and its direction is local `-Z`
transformed by the animated flashlight. A dedicated fill light preserves arm
visibility without changing the original PBR textures.

## Gameplay

- A fresh game starts with the arm hidden and the light off.
- The flashlight rests on the existing F02 living-room coffee table, beside
  the warning. Existing distance, sightline, look-target and E interaction apply.
- Pickup moves the same loaded flashlight from the table into the hand socket.
  Its world transform is preserved at reparenting; a 0.78-second transition
  settles it into the closing grip while the arm rises from below the camera.
- F and the touch Light button become available after equip finishes.
- Shoulder, elbow, wrist and fingers use the original rig. Idle breathing,
  distance-driven walk sway, stronger sprint sway, equip and toggle are animated.
  Reduced-motion settings damp the idle/movement offsets.
- Hiding lowers visibility and switches the light off. Existing collected-item
  saves restore the held arm without replaying pickup or duplicating the prop.
- The warning reuses the existing story text and journal; objectives now refer
  to the living-room table.

Visible geometry: **19,400 arm triangles + 10,832 flashlight triangles = 30,232**,
six meshes with their original PBR materials. Assets load once; skin influences
and bone lookup are inspected once during construction.

## Changed files

Runtime: `src/flashlight-viewmodel.ts`, `src/flashlight-state.ts`,
`src/config.ts`, `src/world.ts`, `src/player.ts`, `src/interactions.ts`,
`src/game.ts`, `src/objectives.ts`, `src/ui.ts`, `vite.config.ts`.

Review: `tests/viewmodel-review.html`, `tests/viewmodel-review.ts`,
`tests/female-arm-audit.ts`, `tests/flashlight.test.ts`, `tests/systems.test.ts`.
The review and generation source files are excluded from the production build.

Run `npm run dev`, open `/tests/viewmodel-review.html`, and choose **Run rig checks**
to check the loaded model, original weight/bind data, gate timing, attachment,
beam, hide/restore and 100 reset cycles. **Fresh pickup**, **Freeze**, and
**Step 0.1 seconds** support frame-by-frame visual inspection without touching
saved games. **Inspect grip** provides multiple camera angles.

## Verified on 2026-10-03

- Production build and validation build: passed.
- Automated game tests: 34 passed, zero failures.
- Loaded-model checks: 17 passed. Beam position error measured 0.000000 mm
  and minimum direction dot product was 1.000000000 in the sampled motion.
- Original joint indices, weights and bind matrices stayed unchanged through
  movement, hiding and 100 inventory/reset cycles.
- Full desktop escape: 61.5 seconds of simulation, one live ghost capture,
  successful checkpoint restore and escape.
- Full touch escape: 65.3 seconds of simulation, one live ghost capture,
  successful checkpoint restore and escape; touch Light off/on, sprint,
  multitouch look/movement, pause, journal, hiding and throwing checked.
- No browser warning/error entries were reported during the built-game runs.
- Source and production-copy hashes match. The flashlight hash is unchanged:
  `d5ab686ee9f6a83740432c1c71c7b3a78042e390f20adf3f531aba7135cb098c`.

Both runs used the project's existing normal-input journey driver with actual
navigation, collisions, objectives and a live ghost; it does not grant items,
teleport or bypass gates. Measurements are local observations, not a benchmark
for all devices. Build output includes the existing informational Vite warnings
about classic Babylon script tags; both scripts are copied and load successfully.

Evidence: `female-arm-runtime-checks.txt`, `desktop-journey.txt`,
`touch-journey.txt`, and the `preview-*.png` files in this folder.
