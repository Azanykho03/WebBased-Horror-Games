# Balay ni Mayang — Abandoned House Blueprint

**Design brief:** A frightening, old, abandoned two-storey house for an explorable horror game.

**Reference game:** https://balaynimayang-a-horror-games.netlify.app/

**Document status:** Proposed redesign based on the owner's written description. The reference website could not be inspected, so this document does not claim to describe its current implementation. This is a game level blueprint, not a construction drawing. Room sizes and additional encounters below are design suggestions.

## 1. Overall direction

The house should feel as though a family left suddenly many years ago. Furniture remains in place, meals have rotted on the dining table, clothes still fill the wardrobes, and old computers sit beside forgotten books. Every space should have a recognizable purpose, its own eerie sound, and a memorable object.

Use faded cream walls, stained wood, dirty gray tiles, peeling paint, water stains, rusty metal, dusty glass, cobwebs, and mold in damp corners. Avoid making every surface equally dirty: dust should collect on unused furniture, damp stains should gather near windows and plumbing, and paths should remain readable.

The central feeling is quiet dread. Most of the time, players hear the house before anything happens. Flickering lights briefly reveal dolls, mirrors, curtains, and empty doorways. Darkness should hide details without making movement impossible.

### Non-negotiable features

- Two connected floors with an actual staircase and upstairs landing.
- Large living room near the main entrance; stairs next to it; garage across from the stairs.
- Dining table with exactly eight chairs, old plates, glasses, and spoiled food; kitchen opposite.
- Separate TV room with sofas; nearby CR reached past a large bookshelf and fallen books.
- Glass-filled bar cabinet opposite a separate ground-floor exit door.
- Garage containing a car, antique mirror, and abandoned objects; flickering entrance and dark interior.
- Six main upstairs rooms as interpreted below, plus the first master bedroom's private CR and a terrace.
- Windows and curtains in every upstairs main room. Use a small frosted window and short dirty curtain for the shared CR.
- Windows with old curtains in the ground-floor living room and TV room.
- Only two electric hallway light fixtures upstairs; darkness beyond their pools of light.
- Breaker near the first master bedroom, approached past unsettling cabinets.

### Clarification used for this draft

The description names five sleeping/study rooms and one shared CR. These form the **six main upstairs rooms**:

1. Master bedroom 1.
2. Study room with two beds.
3. Guest bedroom.
4. Twin bedroom.
5. Shared CR.
6. Master bedroom 2.

The private CR inside master bedroom 1 is additional. If six bedrooms were intended, add a seventh main room later rather than silently changing this layout.

## 2. Spatial blueprint and orientation

In this document, **south is the front/main entrance** and **north is the back of the house**. West is left and east is right when entering. Both floors share a central circulation spine. The upstairs staircase sits directly above the ground-floor staircase.

The tables are schematic position maps, not scaled drawings. Each cell describes a zone; it does not automatically create a doorway. The connection tables define the doors and passages.

### Ground floor: proposed arrangement

Read this table from the back of the house toward the front:

| Position | West side | Central passage | East side |
| --- | --- | --- | --- |
| North / rear | Kitchen | Rear passage; exit door in west wall, glass bar cabinet facing it on east wall | Dining room with eight chairs |
| Middle | TV room with exterior windows | Passage linking living room to rear rooms | Large book passage leading to ground-floor CR |
| South / front | Garage; inward door faces staircase across the passage | Entrance foyer and junction | Staircase beside large living room |
| South frontage | Garage vehicle shutter, closed | Main entrance | Living room extends along the front and east exterior walls; windows on both |

The bar cabinet is furniture in the rear passage, not a separate room. The exit leads outside through the west exterior wall of that passage; leave an exterior recess between kitchen and TV-room footprints so this door does not open into either room. Dining and kitchen entrances face each other across the rear passage.

The ground-floor CR sits against the east exterior wall, behind the book passage. Players walking from the TV room to the CR cross the central passage and pass the shelving before reaching the bathroom door.

### Ground-floor connections

| From | To | Connection and placement |
| --- | --- | --- |
| Outside front | Entrance foyer | Main entrance door |
| Foyer | Living room | Broad opening on east side |
| Foyer | Central passage | Open route north |
| Living room / foyer junction | Stairs | Stair foot directly beside living room |
| Same junction | Garage | West-facing route; garage door directly opposite stairs |
| Central passage | TV room | West-side doorway |
| Central passage | Book passage | East-side opening facing TV-room approach |
| Book passage | Ground-floor CR | Door beyond tall shelf and fallen books |
| Central passage | Rear passage | Continuous route north |
| Rear passage | Kitchen | West opening |
| Rear passage | Dining room | East opening, opposite kitchen |
| Rear passage | Outside escape area | Exit door facing bar cabinet |
| Stair foot | Upstairs landing | Single traversable staircase |

Keep the main entrance and escape exit visually different: the main entrance is a heavy front door; the escape exit is a rear-side service door opposite the glasses.

### Second floor: proposed arrangement

| Position | West side | Central hallway | East side |
| --- | --- | --- | --- |
| North / far end | Shared CR | Dark hallway end | Master bedroom 2 |
| Middle | Twin bedroom | Mostly dark; occasional vermin crossing | Guest bedroom |
| South / near landing | Study room | Light H2; cabinets and breaker near master 1 | Master bedroom 1 |
| South / front | Terrace spans the front of study and master 1 | Short terrace connection outside the rooms | Landing and light H1; staircase opening beside master 1 |

Master 1 and study face one another across the near hallway, so their entrances are close. The guest room is a short walk beyond them. The twin room lies opposite the guest room, and the shared CR is immediately farther along beside the twin room. Master 2 occupies the far east end.

**Terrace connection:** Inside master 1, put the private CR off its small entrance hallway. Beside the CR door, place a separate terrace door. Walking onto the terrace leads to a second door into the study. Players never need to walk through the toilet to reach the terrace. This creates a loop: main hallway → master 1 → terrace → study → main hallway.

### Upstairs connections

| From | To | Rule |
| --- | --- | --- |
| Stairs | Landing | Matching vertical position on both floors |
| Landing | Main hallway | Continuous walkable space |
| Main hallway | Each of the six main rooms | Six distinct doors |
| Master 1 entrance hallway | Master 1 sleeping area | Open internal passage |
| Master 1 entrance hallway | Private CR | Separate bathroom door |
| Master 1 entrance hallway | Terrace | Door beside private CR |
| Terrace | Study | Second terrace door |
| Master 1 sleeping area | Computer corner | Open internal area |

### Suggested scale

Use these only as starting proportions; enlarge them for the camera and player collision size.

| Area | Approximate playable interior size |
| --- | --- |
| Living room | 7 × 6 m |
| Garage | 6 × 7 m |
| Dining room | 5 × 5 m |
| Kitchen | 4 × 5 m |
| TV room | 5 × 4 m |
| Ground-floor CR | 2.5 × 3 m |
| Master 1, including internal hall and private CR | 7 × 6 m |
| Study | 5 × 5 m |
| Guest bedroom | 4.5 × 4.5 m |
| Twin bedroom | 4.5 × 4.5 m |
| Shared upstairs CR | 2.5 × 3 m |
| Master 2 | 6 × 6 m |
| Main passages | Approximately 1.8–2.2 m clear width |
| Staircase | Approximately 1.4 m clear width with landing |

These dimensions are independent targets, not a solved building footprint. During layout, fit them within a consistent outer shell, align the staircase, and put every requested window on an exterior wall. Keep at least one comfortable walking lane around major furniture.

## 3. Ground-floor room design

### F01 — Entrance foyer

- Heavy weathered wooden door, rusty latch, muddy welcome mat, and abandoned slippers.
- First sightline reveals the living-room sofa, a doll silhouette, and part of the staircase.
- The garage door is visible across the same junction as the stairs.
- Sound: low wind through door gaps, an isolated upstairs footstep, then silence.
- Suggested event: the front door settles shut behind the player. Do not lock it through an unexplained invisible barrier; show a jammed latch if it becomes unusable.

### F02 — Large living room

- Two worn sofas and one armchair around a scratched coffee table. Leave a clear route to the stairs.
- One frightening porcelain doll sits on a sofa facing the entry. Its dress is faded and one eye is damaged.
- Scary antique figurines occupy a display cabinet and narrow side table. Use chipped faces, dusty glass, and odd silhouettes.
- An old upright piano stands against an interior wall near the stair approach. Several keys are yellowed or missing.
- Tall exterior windows carry torn, heavy curtains; a thin cold light leaks through gaps.
- Lighting: weak overhead light with slow irregular dimming; a low lamp reveals the doll and table.
- Sound: soft curtain movement, wood settling, and a single distant piano note.
- Suggested encounter: after the player explores another room, the doll's head faces a different direction. Change it only out of view.
- Optional interaction: inspect a faded family photograph or piano note as a story clue.

### F03 — Staircase

- Dark wooden treads, worn banister, loose wallpaper, crooked portraits, cobwebs, and small antique objects on a landing shelf.
- Portrait eyes and shelf objects should create unsettling shapes without blocking the steps.
- Lighting: a weak stair sconce dims unevenly. The upstairs landing light reveals only the final steps.
- Sound: individual creaking steps and an occasional extra footstep after the player stops.
- Suggested encounter: a shadow crosses the upper landing once, followed by a long quiet period.
- Provide safe stair collision and landing transitions; darkness must not cause accidental clipping or falls.

### F04 — Dining room

- Long dining table with **exactly eight chairs**, arranged as three on each long side and one at each end.
- Old plates, cloudy drinking glasses, tarnished cutlery, moldy rice, spoiled food, and dark stains cover the table.
- A few chairs are pulled out at uneven angles; one can be tipped over away from the main walking lane.
- Kitchen entrance is opposite the dining-room entrance across the rear passage.
- Lighting: an old pendant slowly dims and recovers above the food.
- Sound: quiet flies, a glass tapping once, and a chair scrape from behind the player.
- Suggested encounter: one chair moves a short distance when the player returns. It must not trap the player.

### F05 — Kitchen

- Rusting stove, stained sink, dirty dishes, damaged cupboards, cracked tiles, and an old refrigerator.
- Food remains match the abandoned meal in the dining room.
- Add a small curtained exterior window where the footprint permits it.
- Lighting: intermittent weak fluorescent glow; corners remain dark.
- Sound: dripping tap, occasional pipe knock, faint refrigerator vibration when power is available.
- Suggested interaction: a drawer holds a note or useful item. An adjacent empty cupboard opens slightly after inspection.

### F06 — TV room

- Separate from the living room, with two sagging sofas facing an old CRT television.
- Dusty remote, damaged side table, tangled cables, and a faded rug.
- Exterior windows with dirty curtains; brief movement in the fabric suggests a draft.
- Lighting: restrained TV static glow and a failing corner lamp.
- Sound: low static, interference, and one brief fragment of indistinct speech.
- A nearby doorway leads back across the passage toward the bookshelf and CR.
- Suggested encounter: the screen shows a vague room-shaped image for a moment, then returns to static. Avoid rapid full-screen flashing.

### F07 — Book passage and ground-floor CR

- Tall wooden bookshelf stands along the bathroom approach; swollen books, dust, and a few fallen volumes narrow the space visually.
- Add leaning picture frames and a small figurine among the books. Do not let loose books block the only route.
- CR contains stained toilet, cracked sink, cloudy mirror, water marks, and a dirty shower curtain.
- Lighting: dim passage lamp plus weak bathroom bulb, each with independent slow irregular flicker.
- Sound: dripping water, paper shifting, and a restrained knock from the bathroom side of the wall.
- Suggested encounter: a book falls behind the player after they pass the shelf. The CR mirror may briefly reveal a silhouette that disappears when viewed directly.

### F08 — Bar cabinet and escape exit

- Tall dark-wood cabinet full of glasses, decanters, empty bottles, and chipped goblets.
- Place it directly opposite the escape door, with a clear crossing lane between them.
- Glasses catch small highlights from the passage light. Some doors hang slightly crooked.
- Lighting: weak pendant or wall fixture; enough contrast to recognize the exit hardware.
- Sound: delicate glass rattles and a draft around the exit frame.
- Suggested interaction: the cabinet contains an exit clue. The exit visibly indicates its lock state and objective.
- Broken glass may be decorative or produce a footstep sound; do not add unexplained damage.

### F09 — Garage

- An old dusty car occupies the center, with enough space to walk around one side and reach the rear.
- Add an antique full-length mirror leaning securely against a wall, boxes, old tools, tires, covered furniture, and a damaged cabinet.
- Keep the mirror partly visible from the doorway so the player can mistake it for a standing figure.
- The inward garage door faces the staircase across the foyer junction. The exterior vehicle shutter stays visibly rusted shut unless intentionally made interactive.
- **Lighting sequence:** the doorway bulb flickers; a few steps inside, its light falls away; the back half is dark and explored using the player's light.
- The entrance bulb remains a location-based light. Do not suddenly black out the entire screen when a trigger is crossed.
- Sound: metal cooling, faint wind beneath the shutter, a quiet car-body creak, and occasional scratching behind boxes.
- Suggested encounter: the car radio briefly emits a distorted sound. A covered shape is revealed to be furniture when approached.
- Suggested pickup: a replacement fuse on a workbench, reachable without powered equipment.

## 4. Second-floor room design

### U00 — Landing, hallway, cabinets, and breaker

- Long narrow-feeling hall with warped wood, peeling wallpaper, water stains, old portraits, and runners worn thin.
- **Exactly two electric hallway lights:** H1 at the landing and H2 near master 1 and the breaker. Both dim irregularly; beyond H2 the hallway is dark.
- Add faint ambient visibility for walls and door frames. Optional pale light spills from room windows through open doors.
- Put tall cabinets along the breaker approach, containing old figurines, covered dolls, picture frames, and cracked decorative objects.
- Recess the breaker in the wall near master 1, beyond the cabinets. Its cover should remain recognizable and accessible.
- Rats occasionally cross from one gap to another; cockroaches scatter near skirting boards. Use rare events rather than constant movement.
- Sound: faint upstairs wind, wood creaks, electrical hum close to the breaker, and intermittent scratching.
- Leave cabinet doors and loose objects outside the required walking width.

### U01 — Master bedroom 1

**Internal order:** hallway entrance → short private book-lined corridor → large sleeping area. The private CR and terrace door sit beside one another off that short corridor.

- Corridor: tall bookshelves, dusty stacked books, fallen papers, a crooked framed picture, and small scattered possessions.
- Sleeping area: a large old bed, discolored sheets, heavy curtains, bedside furniture, and a wardrobe.
- Bed lighting: one failing warm bedside or overhead light illuminates part of the bed; surrounding corners remain shadowed.
- Computer corner: old beige desktop computer, CRT monitor, yellowed keyboard, battered desk, and another full bookshelf.
- Computer lighting: a separate flickering desk lamp; the monitor may show a dim static image if powered.
- Windows: exterior windows with long faded curtains. Show slight fabric movement and dirty panes.
- Private CR: stained fittings, cloudy mirror, damp walls, and a weak light.
- Sound: paper rustle in the entrance corridor, light buzzing near the bed, and faint computer fan noise when powered.
- Suggested encounter: a few keys click after the player turns away from the computer. Do not repeat on every entry.
- Optional clue: a handwritten note references the breaker and study-room books.

### U02 — Study room with two beds

- Place **two separate beds** along the walls, leaving the middle route open.
- Add an old computer desk, crowded bookshelves, a worn sofa, stacks of notebooks, scattered paper, and abandoned belongings.
- Make the room feel like a study that became a shared sleeping space.
- Windows have dirty curtains. Exterior light outlines the sofa and bed frames but leaves most of the room dark.
- Lighting: almost no stable electric room light; a failing desk lamp provides occasional low illumination if switched on.
- Doors: one to the main hallway, one to the terrace connecting back to master 1.
- Sound: soft page turning, a desk creak, and distant terrace wind.
- Suggested encounter: pages move under a draft even when the player cannot see an open window.
- Optional clue: a readable notebook gives an exit hint; surrounding books remain decorative.

### U03 — Guest bedroom

- A large bed has a **large antique mirror mounted above its headboard**, visibly secured but crooked.
- Add a large wardrobe, tall bookshelf, bedside table, dusty bedding, and curtained exterior window.
- Position the entrance so the player notices the mirror and bed together.
- Lighting: dim bedside fixture with occasional slow failures; a cold highlight catches the mirror frame.
- Sound: a soft wardrobe knock or hanger movement, separated by long silences.
- Suggested encounter: the mirror briefly shows a delayed or changed silhouette. For a lightweight implementation, use a controlled visual overlay instead of a costly live reflection.

### U04 — Twin bedroom

- Two old beds, rumpled sheets, abandoned belongings, a small dresser, and scattered toys or personal items.
- Exterior windows with long curtains; one curtain partially obscures a bed silhouette.
- This room sits immediately before the shared CR along the hallway.
- Lighting: faint window light plus one weak lamp with slow uneven dimming.
- Sound: fabric moving against the wall and an occasional small object rolling beneath a bed.
- Suggested encounter: a curtain lifts enough to suggest someone is behind it, then settles to reveal empty space.

### U05 — Shared upstairs CR

- Door directly beside the twin-bedroom zone, opening from the main hallway.
- Stained tiles, old toilet, cracked basin, fogged mirror, rusty fixtures, and a dirty shower curtain.
- Small frosted exterior window with a short worn curtain satisfies the upstairs window requirement.
- Lighting: weak bulb dims unpredictably; basic fixture silhouettes stay readable.
- Sound: dripping tap, plumbing knocks, and a single drain gurgle.
- Suggested encounter: knocking stops as the player opens the door. Do not make the small room a permanent trap.

### U06 — Master bedroom 2

- Large bed with an eerie doll **sitting upright on it**, facing approximately toward the entrance.
- Antique standing mirror, side table, scattered belongings, and large wardrobes full of old clothes.
- Leave one wardrobe slightly open so hanging clothes form a human-like silhouette.
- Exterior windows with heavy damaged curtains; dirty panes allow a weak outline of the outside.
- Lighting: an aging ceiling fixture and bedside light dim at different times, revealing the doll and mirror unevenly.
- Sound: clothes brushing together, a wardrobe creak, and a faint intermittent music-box phrase.
- Suggested encounter: the doll changes head direction between visits. A separate rare event can make the wardrobe door move.
- Optional final pickup: the escape key rests in a drawer or wardrobe and is inspectable without a jump scare being required.

### U07 — Terrace

- Weathered terrace along the front of master 1 and the study, with cracked tiles, damp leaves, dead plants, and rusty but continuous railings.
- Doors connect to master 1 beside its private CR and to the study.
- Curtains are visible through the adjoining windows.
- Lighting: pale outdoor ambient light; no extra fixture that would violate the two-light hallway rule.
- Sound: stronger wind, distant insects, and a loose hanging object lightly tapping.
- Keep the terrace traversable and its rails solid. Its purpose is an eerie alternative route, not an unavoidable fall hazard.

## 5. Lighting behavior

Use darkness as a spatial effect: each room has local pools of light, visible door outlines, and dark corners. Lights must not all flicker together.

| Zone | Normal state | Suggested disturbance |
| --- | --- | --- |
| Living room | Weak warm light | Slow dip followed by gradual recovery |
| Stairs | Weak sconce | Brief dimming while an upstairs footstep plays |
| Dining room | Dirty pendant glow | Uneven brightness over spoiled meal |
| Kitchen | Weak fluorescent light | Occasional failed start, then low steady glow |
| TV room | Dim lamp and CRT | Static changes without bright full-screen flashes |
| Ground-floor CR | Low bulb | Short dropout followed by slow return |
| Garage | Lit entrance, dark rear | Entrance bulb flickers independently of player movement |
| Upstairs hallway | H1 and H2 only | Unsynchronized dimming; far end remains dark |
| Master 1 | Bed light and computer lamp | Independent flicker patterns |
| Study | Mostly dark | Low desk-lamp flutter |
| Guest and twin bedrooms | Very weak light | Rare slow fluctuations |
| Shared upstairs CR | Weak bulb | Occasional gradual loss of light |
| Master 2 | Failing overhead and bedside lights | Alternate dimming reveals doll and wardrobe |

Suggested baseline: vary local brightness over roughly 8–20 seconds, with occasional short dim intervals. These are artistic timings, not a medical safety guarantee. Avoid rapid strobing and large flashes.

Include **Reduced Flicker**, **Brightness**, and **Separate Sound Volume** settings. Reduced Flicker replaces irregular fluctuations with stable dim lighting and keeps all clues readable. A flashlight or equivalent player light should remain usable even if the house power fails.

## 6. Eerie sound system

- Start audio after the player presses Play or another explicit control, so browser playback restrictions are handled.
- Use a quiet whole-house bed of wind and wood settling.
- Layer local sounds over it: piano in living room, static in TV room, flies in dining room, metal in garage, pages in study, water in CRs, and clothes in master 2.
- Let nearby rooms be faintly audible through doors; reduce sound when walls or closed doors intervene.
- Use directional audio where the game supports it. In a simpler game, adjust volume by player distance.
- Randomize ambient intervals with long pauses. Never run every room's scary sound at once.
- Keep sudden sounds below an aggressive maximum volume; fear should come from timing and location.
- Stop or fade room sounds on transitions and pause them when the game is paused.
- Supply text cues for sounds that carry required information, such as “A latch clicks upstairs.”
- Use original or appropriately licensed sound assets.

## 7. Suggested exploration and interaction flow

This is an optional gameplay layer. Preserve existing objectives, controls, and difficulty choices if they already work; adapt this route to them.

1. Enter through the foyer and establish the living room, stairs, and opposite garage.
2. Explore the dining room, kitchen, TV room, and book passage. Discover the separate escape exit opposite the bar cabinet.
3. Find a replacement fuse at the garage workbench. The garage stays accessible before power restoration.
4. Go upstairs and locate the breaker beside master 1. Inspect the cabinet-lined approach.
5. Use a simplified fictional interaction to restore partial power. This is a game puzzle, not real electrical repair guidance.
6. Explore master 1, its CR, the terrace, and study loop. Find a clue that points toward master 2.
7. Pass the guest room, twin room, and shared CR, then search master 2 for the escape key.
8. Return downstairs and unlock the exit opposite the bar cabinet.

### Puzzle and access rules

- Do not require a powered computer to obtain the fuse needed to power that computer.
- Breaker interaction restores only selected circuits; it must not make the whole house bright or add upstairs hallway fixtures.
- Keep the initial master 1–terrace–study loop accessible, or clearly show any lock and provide its key elsewhere.
- Required items must stay reachable even when furniture moves during a scare.
- Keys, fuse state, and opened doors persist after changing floors.
- The front door and garage shutter are visibly jammed if unavailable; the exit door has a readable lock prompt.
- Optional room scares never determine whether the player can finish.

### Optional Bisaya flavor

Use short lines sparingly so the abandoned-house atmosphere stays tense:

- At the dark garage: “Ngano nisulod man jud ko diri?”
- At the piano: “Kinsa may nagtukar ana?”
- At the old meal: “Ayaw na lang jud na kaona.”
- Near the escape door: “Abli na, palihog!”

## 8. Scare pacing and environmental motion

Use one main encounter per area, with smaller ambient details around it. Do not trigger a scare every time a doorway is crossed.

| Trigger | Event | Repeat rule |
| --- | --- | --- |
| First living-room return | Doll head changes orientation | Once per playthrough |
| First stair ascent | Shadow crosses landing | Once per playthrough |
| Walking past book passage | One book falls behind player | Once per playthrough |
| First deep garage exploration | Brief radio sound | Once per playthrough |
| First breaker use | Cabinets creak nearby | Once per playthrough |
| Entering middle upstairs hall | Rat runs across into a gap | Rare, with long cooldown |
| Guest-room inspection | Mirror silhouette appears briefly | Once per playthrough |
| Master 2 return | Doll or wardrobe position changes | Once per playthrough |

Suggested ambient cooldowns can be 45–90 seconds or longer. Track event state separately from room visibility so leaving and returning does not restart every scare. Disable large encounters during menus or reading screens.

Curtains, dust particles, rats, and cockroaches should move subtly. Vermin are atmosphere, not enemies, unless intentionally added to the game rules.

## 9. Build guidance

### Scene organization

- Keep separate ground-floor and second-floor scene groups, with matched staircase anchors.
- Assign stable room IDs from this document: F01–F09 and U00–U07.
- Give every doorway a source room, destination room, position, facing direction, and lock state.
- Store furniture, windows, light fixtures, sound zones, interaction points, and scare triggers per room.
- Reuse wood, plaster, books, curtains, and cabinet assets, but vary placement and damage.
- Show important props clearly at the game's camera angle. For a top-down game, use readable silhouettes and wall cutaways; for a first-person game, use controlled sightlines and local lighting.
- Old mirrors may use inexpensive staged reflections. Reflective effects must not expose rooms that should be hidden.

### Performance and usability

- Limit active dynamic lights and expensive shadows to nearby areas.
- Pause distant room effects and hide the inactive floor where appropriate.
- Use shared low-cost textures and a few animated vermin rather than large populations.
- Offer sound mute, brightness adjustment, reduced flicker, and readable interaction prompts.
- Ensure decorative curtains, books, and scattered papers do not accidentally block movement.
- Give touch controls enough space if the existing game supports mobile play.
- Preserve game progress across floor transitions; reset it only when starting a new run.

## 10. Acceptance checklist

### Layout

- [ ] Two floors connect through the same staircase footprint.
- [ ] Living room is near the main entrance and beside the stairs.
- [ ] Garage entrance is directly across from the stair approach.
- [ ] Kitchen faces the dining area; dining table has exactly eight chairs.
- [ ] TV room connects to a nearby CR route past a large bookshelf.
- [ ] Bar cabinet faces a separate exterior escape door.
- [ ] Six main upstairs room doors match the stated interpretation.
- [ ] Master 1 and study entrances are close to the landing and each other.
- [ ] Master 1 has an internal hallway, private CR, large bed, computer corner, and bookshelves.
- [ ] Terrace door is beside the private CR and connects onward to study.
- [ ] Study has two beds, computer, books, scattered belongings, and sofa.
- [ ] Guest room has the above-bed mirror, large wardrobe, and bookshelf.
- [ ] Twin bedroom has two beds and sits beside the shared CR zone.
- [ ] Master 2 has a large bed, seated doll, antique mirror, table, and clothes-filled wardrobes.

### Atmosphere

- [ ] Living room and TV room have exterior windows and curtains.
- [ ] Every upstairs main room has an exterior window and curtains.
- [ ] Upstairs hallway has exactly two electric light fixtures.
- [ ] Breaker is near master 1 and reached past unsettling cabinets.
- [ ] Garage contains a car and antique mirror, with a flickering entrance and dark rear.
- [ ] Each room has distinct old furniture, deterioration, local lighting, and eerie sound.
- [ ] Dining table has old plates, glasses, and spoiled food.
- [ ] Hallway rats or cockroaches appear occasionally.

### Playability

- [ ] Every required door and item is reachable without clipping or impossible navigation.
- [ ] Terrace loop works in both directions.
- [ ] Power puzzle has no circular dependency.
- [ ] Key and door states survive floor transitions.
- [ ] Exit condition works and produces clear completion feedback.
- [ ] Darkness remains navigable; Reduced Flicker and audio controls work.
- [ ] Scares respect cooldowns and do not trap the player.
- [ ] Browser audio starts after player interaction and pauses correctly.

## 11. Suggested implementation order

1. Block out both floors with plain walls, doors, stairs, and the terrace loop.
2. Verify room connections, window placement, and movement clearance.
3. Place the distinctive furniture and required props in every room.
4. Add aged materials, curtains, scattered belongings, and environmental damage.
5. Add local lighting, the two upstairs hallway fixtures, and garage darkness gradient.
6. Add room-based sound, ambient motion, and restrained scripted scares.
7. Integrate objectives and breaker interactions with the existing game systems.
8. Walk the full escape route and complete the acceptance checklist.

**Desired result:** A believable abandoned family house that becomes more unsettling as the player moves from the furnished front rooms into the dark garage and the long upstairs hallway. Each room has its own visual identity, but all belong to the same old, decaying home.
