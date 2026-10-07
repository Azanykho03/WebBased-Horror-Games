# Supplied interactive assets

Copied byte-for-byte from the four GLBs supplied by the user on 2026-10-07.
The source downloads and existing house asset remain unchanged.

| File | Inspected hierarchy | Runtime use |
| --- | --- | --- |
| `cabinetForHiding.glb` | One fused mesh, Z-up source transformed to Y-up, no bones or animation clips | Surface clipping preserves texture coordinates while separating two front panels. New local Y hinges rotate the panels 98 degrees. Fixed lining and explicit hide, camera, entrance and exit anchors complete the interior. |
| `old_wooden_door.glb` | Separate `Door`, `DoorFrame`, and two handle meshes; no bones or clips | Bake the imported coordinate transforms once, preserve the frame, and parent leaf plus handles to the right-edge hinge. Instances use the existing 17 doorway placements. |
| `masterbedroomKey.glb` | Three static mesh parts | Normalize as one pickup at the study desk, unlocking the far master bedroom after power is restored. |
| `Lastkey.glb` | One static mesh | Normalize as the final pickup in the keepsake cabinet, unlocking the main entrance. |

The cabinet faces +Z after applying its imported parent transform; the wooden door
hinge is at the leaf's maximum X edge. Game transforms are configured in
`src/fixtures.ts`; no whole cabinet or door frame rotates. No generation service,
external animation framework, global skill installation or runtime AI dependency
is needed. The files contain no usable AnimationGroup to reuse.
