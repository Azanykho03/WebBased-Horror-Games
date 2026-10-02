# Abandoned interior acceptance record

Verified 2026-10-03 in the active `WebBased-Horror-Games` project.

The reference informed stained brown/green plaster, worn timber, torn fabric,
broken furniture and deposits of debris beside walls and storage. The original
house structure, Filipino furnishings, objective placement and gameplay remain.

## Verification

- `npm test`: 31 passing tests, including independent clearance checks for
  doors, stairs, pickups, hiding spots and central chase lanes.
- `npm run build -- --configLoader native`: production build and TypeScript pass.
- `npm run build:validation -- --configLoader native`: validation build passes.
  Native config loading avoids this machine's Vite temporary-directory permission
  restriction; no package configuration was changed.
- Production assets load locally. No browser errors or warnings in the final
  room review or gameplay run.
- Original house, ghost, flashlight-arm and key GLBs, plus the house collision
  manifest, match their Git HEAD object hashes. Original texture files are intact.
- All added decoration is non-pickable and non-colliding. The 257 original
  colliders remain unchanged. Visual floorboard gaps have solid floors beneath.

The existing browser journey supplies ordinary movement and interaction input
with collision, mission guards and Corazon active. Both routes reach the ending
after collecting all required items. Each run includes a capture and a successful
checkpoint restore with retained inventory and a safe enemy reset.

| Browser run | Result | Active test time | Distance | Observed FPS average / minimum |
| --- | --- | --- | --- | --- |
| Desktop | Full escape | 58.1 s | 152.3 m | 59 / 37 |
| Touch pointers, 844 × 390 | Full escape | 61.0 s | 162.6 m | 59 / 36 |

Touch validation also passes simultaneous joystick/look/sprint, pointer cancel,
pause/resume, journal/resume, flashlight toggling, throwing and hiding. Actual
Web Audio and supplied music audits pass: mixer mute controls, looping tracks,
fades, pause/resume and repeated resets without duplicate sources.

Raw reports: [desktop](decay-desktop-journey.txt),
[touch](decay-touch-journey.txt), [audio](decay-audio-audit.txt),
[music](decay-music-audit.txt).

## Rendering budget and visual checks

- 5,318 added static triangles, merged into 85 room/material batches across
  both floors; only nearby batches on the relevant floor are enabled.
- 237 seeded shallow debris pieces, clustered at authored sources of damage.
- Seven shared 512px surface maps and one 1024px decal atlas, generated once.
- No added real-time lights, shadow maps or post-processing passes.
- Standard: 48 thin-instanced dust motes, 18 m decoration range, subtle
  moonlight sheets limited to the current room; existing 512px flashlight shadow.
- Low / touch Auto: 12 motes, 11 m decoration range, no light sheets;
  existing 256px flashlight shadow and reduced render resolution.
- Reduced motion stops dust drift; reduced flicker and brightness controls
  continue to apply. Dust depth is clipped against the existing collider data.

Room reviews cover living/dining rooms, kitchen, hallway and bedrooms, including
split table boards, broken chair backs, missing cabinet panel, torn curtains,
ceiling/corner webs, water damage, peeling plaster and settled debris. Repeating
surface maps preserve wood grain across long meshes. Final Low bedroom review
uses a 675 × 312 render buffer in an 844 × 390 browser viewport, with 32 decay
batches enabled, 12 motes and a 256px shadow.

Previews: [living room](decay-living-standard.jpg),
[kitchen](decay-kitchen-standard.jpg), [hallway](decay-hallway-standard.jpg),
[Low bedroom](decay-bedroom-mobile.jpg).

The desktop browser reported the FPS above; these are observations, not an Android
performance guarantee. Touch input and Low graphics were tested in browser
simulation. A physical Android device has not been tested.

Use `/tests/interior-review.html` on the development server to review twelve
fixed room views, switch quality and lighting, or export a canvas PNG. The
review controls can collapse to reveal the scene. The review page is excluded
from the production build and does not access game saves.
