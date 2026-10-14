# Interior reference surfaces

Derived from the two GLBs supplied by the project owner:

- **Haunted House** by **Amy (uouoamy)** — [source model](https://sketchfab.com/3d-models/haunted-house-f0300977ea9640959779453f8373591d), [author](https://sketchfab.com/uouoamy).
- **Scary Interior** by **speedinfected** — [source model](https://sketchfab.com/3d-models/scary-interior-fa7d60e783764ecfb15039bba6c05306), [author](https://sketchfab.com/speedinfected).

Both GLBs declare **[Creative Commons Attribution 4.0](https://creativecommons.org/licenses/by/4.0/)** in their embedded metadata. No endorsement is implied.

Changes: selected embedded texture islands cropped and resized, timber grain rotated, colors desaturated, plaster/timber micro-normal maps derived from luminance. The hallway retains a matching crop of its original normal map. Geometry is adapted to the existing house instead of substituting either source layout.

`scripts/3d-generation/prepare_interior_references.py` reproduces these maps. `source/interior-references/inspection.json` records source hashes, material definitions, image resolutions, geometry bounds and crop coordinates. Original source GLBs remain unchanged and are excluded from the production build.
