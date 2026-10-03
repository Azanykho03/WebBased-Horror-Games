# Yellow flashlight

`flashlight.glb` is the standalone refined prop: 10,832 triangles, five PBR meshes,
two embedded 1024px color images, and 26.2 cm length. Metres, +Y up, beam along -Z;
origin matches the grip in the combined first-person model.

TRELLIS was attempted first and rejected for intersecting duplicate bodies.
The TripoSR Hugging Face Space was unavailable; the existing local installation
used cached `stabilityai/TripoSR` weights. The final prop has a substantial
hard-surface rebuild, with material wear transferred from that reconstruction.
Raw results, the rejected TRELLIS model and reference are preserved in `source/`.

See [the complete delivery record](../../player/arms/flashlight-arms/README.md)
for generation provenance, file manifest and offline reassembly. The active game
now loads this standalone prop once: it starts on the living-room table and moves
to the uploaded female arm's Hand.R_027 socket when collected. See
[the rigged-arm integration](../../player/arms/README.md).
