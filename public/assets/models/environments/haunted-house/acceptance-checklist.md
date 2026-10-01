# Haunted house environment acceptance

Result: **PASS — environment scope**, reviewed 2026-10-01.

Applies to `haunted-house.glb`, SHA256
`df9ecea1a11edc048ee6c156ac6b6968ad60efeb979d9c56983fbafb97ebbd35`,
and the accompanying Babylon.js inspection page and manifest.
All 17 zones F01–F09/U00–U07 are complete, with a private CR inside U01.

## Evidence

- `source/`: complete original guide/blueprint, 982-frame inventory and hashes,
  chronological contact sheets, detail sheets and 22 retained original frames.
- `layout-validation.json`: all 13 assertions pass; 29 route legs, stair alignment,
  clearance, solid rails/walls, required prop counts and reverse terrace loop.
- `babylon-validation.json`: actual continuous first-person tour, 213.47 metres,
  30 stops, zero collision failures, no missing textures or runtime errors.
- `settings-validation.json`: brightness/flashlight visual checks, reduced flicker,
  volume/mute and audio start/pause checks.
- `validation-report.json`: Khronos glTF Validator, zero errors/warnings/infos/hints.
- `mesh-inspection.json` and `optimization-report.json`: final geometry, embedded
  images, vertex welding and web rendering budgets.
- `*-preview.png`: actual browser captures. Visual review complements the geometry
  checks; the code checks alone do not establish appearance.

## Guide — layout

- [x] Two floors connect with aligned staircase positions.
- [x] Living room is near entrance and beside stairs.
- [x] Garage is across from the stairs.
- [x] Kitchen faces dining room.
- [x] Dining table has exactly eight chairs: three on each long side, one at each end.
- [x] TV room is separate from living room.
- [x] Ground-floor CR route passes the bookshelf/book passage.
- [x] Bar cabinet faces separate escape door through a clear crossing lane.
- [x] Six main upstairs rooms exist: Master 1, study, guest, twin, shared CR, Master 2.
- [x] Master 1 has private CR and computer area.
- [x] Master 1 ↔ terrace ↔ study loop works without entering the private CR.
- [x] Guest room has above-bed antique mirror.
- [x] Twin room has two beds.
- [x] Master 2 has bed, seated doll, wardrobes with clothes, and standing mirror.

## Guide — visual / atmosphere

- [x] `haunted_house_all_frames/` inspected before construction.
- [x] Major visible materials/furniture reflect the references: cream walls,
  carved reddish timber doors, turned stair banisters, layered curtains, covered
  sofas, crowded bookshelves and glass display cabinets.
- [x] Living room and TV room have exterior windows/curtains.
- [x] Upstairs main rooms have required windows/curtains; shared CR has frosted
  glazing and a short worn curtain.
- [x] Upstairs hallway has exactly two electric fixtures, H1 and H2.
- [x] Breaker is near Master 1, past the unsettling cabinets.
- [x] Garage contains car and antique mirror, with dim entrance and darker rear.
- [x] Coherent abandoned materials and clutter: localized damp, cracked surfaces,
  old fabric, rust, dusty glass, cobwebs, fallen books, plates and spoiled food.

## Guide — playability

- [x] Main routes are walkable; the complete browser tour reached every stop.
- [x] Staircase is safe and traversable: 18 solid treads, 1.8 m width, matched
  3.24 m rise and smooth collision ramp, with upper and side guards.
- [x] Terrace loop works both directions.
- [x] Furniture does not block required paths.
- [x] Open doors do not intersect major furniture; U06 wardrobe clearance corrected.
- [x] No major floating props or wall intersections found in room-by-room review.
- [x] Required navigation remains possible in darkness using the adjustable
  brightness and flashlight. Reduced Flicker keeps lighting stable.

## Guide — performance

- [x] Furniture uses shared procedural definitions and materials. Render meshes
  are merged by room/material rather than retaining a draw call per small prop.
- [x] Six nearby local lights active at most, plus ambient and optional flashlight.
- [x] One 512px flashlight shadow map; no expensive live mirror reflections.
- [x] Twenty-six embedded 512px textures; no 4K assets.
- [x] Dense geometry avoided; exact vertex welding reduced export from 15.45 MB
  to 10.18 MB while preserving geometry and texture bytes. Final 146,276 triangles.
- [x] Inactive floor hidden except near the shared stair area; distant lighting
  and decorative effects limited. About 60 FPS observed locally, not a guarantee.

## Additional blueprint requirements

- [x] Master 1 and study entrances are close to the landing and each other.
- [x] Master 1 has a book-lined entry corridor, sleeping area, private CR, separate
  adjacent terrace door, beige computer/CRT/keyboard, desk and bookshelves.
- [x] Study has exactly two beds, desk/computer, books, notebooks, belongings and sofa.
- [x] Guest room has large wardrobe, bookshelf and secured above-bed antique mirror.
- [x] Twin room sits immediately before the shared CR zone.
- [x] Foyer has heavy weathered door/latch, mat and slippers. Living room has two
  sofas, armchair, doll, coffee table, figurine cabinet and upright piano.
- [x] TV room has two sofas, CRT, remote, side table, rug and cables.
- [x] Kitchen has stove, sink, dishes, cupboards, refrigerator, food and window.
- [x] CRs have toilet, basin, cloudy mirror, shower curtain and damp surfaces.
- [x] Garage includes car, mirror, boxes, tools, tires, covered furniture and cabinet.
- [x] Terrace includes cracked tiles, leaves, dead plants and continuous solid rails.
- [x] Local slow light variations are independent. Reduced Flicker disables them.
- [x] Original quiet wind and room-specific synthetic ambience, long randomized
  pauses, text cues, separate volume and mute. Audio starts on explicit interaction
  and suspends on pause/tour completion; visibility handling also suspends it.
- [x] A rare decorative rat crosses the upper hallway; no enemy logic.
- [x] Stable room IDs, doorway endpoints, positions, facing and open state recorded
  in the manifest. The service exit is physically reachable, with clear completion
  feedback at the end of the environment walkthrough.

The blueprint's optional power puzzle, fuse/key persistence, scare encounters and
game-winning exit state are **not applicable** to this environment-only request.
No puzzle or enemy system was added. The asset contains static open doors; future
interactive doors must update their colliders together with their geometry.

## Remaining issues / fidelity limits

No known blocking environment defects. This is a stylized real-time interpretation
of the supplied frames, with blueprint-based unseen rooms and layout. Mirrors use
static materials, sounds use lightweight synthesis, and curtains are static geometry.
It is not a photogrammetric reconstruction or a complete horror game. Performance
has been measured on this machine only. Integration instructions are in `README.md`.
