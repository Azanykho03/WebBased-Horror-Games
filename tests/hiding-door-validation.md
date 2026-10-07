# Hiding and hinged-door validation — 2026-10-07

The existing Babylon game, controller, interaction system, collision queries,
touch controls and Corazon state machine were extended in place.

## Implementation

- Exactly two functional cabinets: dining room and upstairs guest bedroom.
- Shared `HidingSystem`: normal → opening → entering → closing → hidden;
  hidden → exiting → closing → normal. Input spam cannot cross a state boundary.
- Entry uses two eased movement segments, independent 98° cabinet panels and an
  internal camera anchor. Exit opens the panels, moves to a checked external
  anchor, closes the panels, clears stale input/velocity and restores walking.
- Hidden and transitional movement skips ordinary gravity/physics integration;
  the existing camera remains upright. Hidden yaw/pitch are bounded.
- Corazon keeps patrolling/investigating when the concealed player was not seen.
  Witnessed entry preserves the reachable cabinet entrance as a search target;
  it does not expose the hidden player's position through geometry.
- All 17 doorways use the supplied door leaf/frame/handles. The leaf and handles
  rotate at the inspected hinge while the frame remains stationary. The kitchen
  and ordinary unlocked doors start open. The main and bedroom locks use their
  supplied keys; the service exit stays sealed. Player and ghost collision follow
  the moving leaf, with sweep checks that stall before contact and resume on clearance.
- Old static door panels and the replaced wardrobe are removed from the house's
  room-batched meshes in memory. The house GLB and source manifest remain intact.

## Verification

- `npm test`: 73 passing tests, zero failures, including repeated hiding cycles
  on both floors, gravity/velocity locks, exact camera anchor, reset recovery,
  witnessed/unwitnessed perception, key/save guards and moving-door collision.
- `npm run build`: successful production bundle and strict TypeScript check.
- Desktop and phone-sized browser (844 × 390, touch pointers): three complete
  enter/exit cycles per cabinet in each mode, input spam,
  pause/resume, fixed cabinet body, internal anchor, hidden movement/look limits,
  no drift and restored upright walking, free look, jumping, gravity and landing.
- Live Corazon encounter fixtures: unseen hiding retained active investigation
  without capture; witnessed hiding led to searching that cabinet and capture;
  actual capture → retry restored closed cabinets, camera and walking.
- Every operable doorway: two complete open/close cycles in desktop mode and
  two in touch mode, including the master bedroom and final main entrance.
  Both modes checked stationary frames, repeated input, and a swing blocked by
  the player that resumed after walking clear. All 16 operable doors passed;
  the remaining service door preserved its deliberately sealed mission state.
- Full touch playthrough with normal movement, real pickups, live Corazon and
  checkpoint recovery: completed the master-key/bedroom lock, upstairs hiding,
  all keepsakes, final key, main-door opening and physical walk outside.
  Passed in 109.4 simulation seconds over 241.0 m, with three captures/retries.
- Live screenshots confirm the player camera is inside the closed cabinet with
  a narrow view into the room. The exit prompt moves below the slit. No camera
  roll, wall clipping or stale movement lock was observed in repeated cycles.
- Browser console: no errors or warnings during the cabinet, door, perception
  and full touch-journey checks. Both production and validation bundles compile
  with no TypeScript errors. Vite retains its existing informational warnings
  about the two deliberately copied classic Babylon vendor scripts.
- The final production preview loaded every game asset and reached the menu
  without console errors. The production page contains no validation controls.

## Reproduce

Run the validation build and preview, then use its cabinet/door/perception check
buttons. These checks deliberately position the player and prepare mission state,
then use the actual keyboard or touch handlers and production game tick. They are
separate from **Run full journey**, which uses normal movement, pickups and the
live enemy. Preview buttons permit manual cabinet visual inspection. None of the
validation UI is included in the production build.

Browser touch tests simulate touch pointer events and a phone-sized viewport;
they do not constitute a physical Android hardware test.

Screenshots: [upstairs internal view](screenshots/hiding-upstairs.jpg),
[dining internal view](screenshots/hiding-dining.jpg), and
[completed touch escape](screenshots/touch-escape.jpg).

## Asset inspection and TypeSafe

All four supplied GLBs match the Downloads originals byte-for-byte. Neither the
cabinet nor wooden door contains bones or animation clips. The cabinet is fused;
its front panels are split with attribute-preserving polygon clipping, plus a
narrow real viewing slot. The wooden door already separates frame, leaf and handles.

The project-local TypeSafe skill remains installed. Its live
[documentation index](https://docs.typesafe.ai/llms.txt) and
[Jev guidance for coding agents](https://docs.typesafe.ai/introduction/coding-agents)
were consulted. Known state transitions, physics, collision and permission guards
remain deterministic code with actual tests. No Jev API call or probabilistic
runtime dependency was introduced or claimed as validation.

## Files

New runtime modules: `src/hinge.ts`, `src/fixtures.ts`, `src/cabinet-geometry.ts`,
`src/hiding.ts`. Integration: `world.ts`, `game.ts`, `player.ts`, `ghost.ts`,
`interactions.ts`, `touch.ts`, `config.ts`, `types.ts`, `objectives.ts`, `storage.ts`,
`ui.ts`, `style.css`, and `vite.config.ts`. Supplied assets: `public/assets/models/interactive/`.
Tests: hiding unit/browser/perception checks and the existing journey/gameplay/
system fixtures. Documentation: project README, asset notes and this record.
