# Balay ni Corazon — Continue Development + Android Mobile Support

Continue from where you already stopped in the existing **Balay ni Corazon** project. Do not restart, rebuild, or undo the work you have already completed. Review the current implementation and continue improving it based on the existing project files and `Balay-ni-Corazon-Audio-and-Haunted-Environment-Prompt.md`.

# IMPORTANT COMPLETION GOAL

Your goal is to **continue developing Balay ni Corazon until the requested work is fully implemented and the game is in a complete playable state**.

Do not intentionally stop after implementing only a small portion of the requirements.

Work through the requirements systematically and continue with the next unfinished task after completing each part.

If you approach a context, token, execution, or tool limit:

- Do not restart the project.
- Do not redo already completed work.
- Preserve all existing changes.
- Record/checkpoint what has already been completed.
- Clearly identify the exact next unfinished task.
- Resume from that point when execution can continue.
- Keep using the existing codebase and implementation.
- Continue resolving build, TypeScript, runtime, gameplay, mobile, audio, and performance issues until the requested features are complete.

Do not treat a partial implementation as finished.

Before declaring the task complete, verify the project against the requirements in this prompt and `Balay-ni-Corazon-Audio-and-Haunted-Environment-Prompt.md`.

The final objective is to leave **Balay ni Corazon in a functional, playable, tested state**, not merely provide suggestions or unfinished placeholder code.

---

# ANDROID / MOBILE RESPONSIVE SUPPORT

Make the entire game **fully responsive and playable on Android phones through the browser**.

When a player opens the game's link on a phone, the game must automatically detect the mobile/touch device and adapt:

- UI
- Camera controls
- Resolution
- HUD
- Menus
- Gameplay controls
- Performance settings

The player should not need to install an app.

---

# MOBILE TOUCH CONTROLS

Implement proper mobile FPS-style controls:

- **Left virtual joystick** — forward, backward, strafe left, strafe right, diagonal movement
- **Right-side touch/drag area** — rotate the first-person camera and look around
- **Interact button** — pick up keys/items, open doors, inspect objects, and interact with objectives
- **Flashlight button** — toggle flashlight on/off
- **Run/Sprint button**
- **Crouch/Hide button** if the mechanic already exists
- **Pause/Menu button**
- Any other action button already required by the existing game

Make the controls comfortable for two-thumb gameplay.

Support multi-touch so the player can move with the left thumb while simultaneously looking around or pressing action buttons with the right thumb.

The controls should feel like proper mobile first-person game controls, not ordinary webpage buttons.

---

# AUTOMATIC DEVICE ADAPTATION

Do not require the player to manually enable Mobile Mode.

Expected behavior:

```text
Desktop / Laptop
↓
Keyboard + Mouse
↓
Desktop HUD
↓
Higher graphics settings when capable


Android / Touch Device
↓
Virtual Joystick
+ Touch Camera
+ Mobile Action Buttons
↓
Responsive Mobile HUD
↓
Mobile-optimized graphics
```

Keep existing desktop keyboard and mouse controls fully functional.

Mobile controls should appear automatically on touch/mobile devices.

If a device supports both input methods, handle switching gracefully.

---

# MOBILE CAMERA CONTROLS

Implement smooth FPS-style touch camera controls.

The right side of the screen should allow:

- Drag left → look left
- Drag right → look right
- Drag up → look up
- Drag down → look down

Requirements:

- Smooth movement
- Configurable sensitivity
- No sudden camera jumps
- Multi-touch support
- No interference with action buttons
- Proper vertical rotation clamping
- Preserve desktop mouse-look

---

# MOBILE JOYSTICK

Create a responsive virtual joystick at the bottom-left.

Support:

- Forward
- Backward
- Strafe left
- Strafe right
- Diagonal movement

Use analog input strength where practical.

The joystick should:

- Respond immediately
- Return to center when released
- Work simultaneously with camera movement
- Work reliably during chase sequences
- Scale for different screen sizes

---

# MOBILE ACTION BUTTONS

Place action controls primarily on the right side.

Suggested arrangement:

```text
                [INTERACT]

       [FLASHLIGHT]     [SPRINT]

                [CROUCH]
```

Adjust based on existing gameplay mechanics.

Buttons should have:

- Large touch targets
- Clear icons
- Semi-transparent appearance
- Press feedback
- Proper spacing
- Responsive sizing

Do not overcrowd the screen.

---

# LANDSCAPE MOBILE GAMEPLAY

Prefer **landscape orientation**.

If the phone is in portrait mode, show a clean message such as:

```text
Rotate your phone for the best experience.
```

Do not permanently block gameplay if orientation locking is unsupported.

On orientation change:

- Resize renderer
- Update camera aspect ratio
- Reposition HUD
- Reposition touch controls
- Recalculate joystick boundaries
- Recalculate touch-look area

Do not require the game to reload.

---

# RESPONSIVE UI

Make these interfaces responsive:

- Main menu
- Game title
- Intro sequence
- Loading screen
- Story text
- HUD
- Objectives
- Inventory
- Subtitles
- Interaction prompts
- Pause menu
- Settings
- Game-over screen
- Ending screen
- Jumpscare overlays

Avoid:

- Text leaving the screen
- Button overlap
- HUD overlapping touch controls
- Tiny touch targets
- Horizontal page scrolling
- Desktop-only fixed dimensions

---

# MOBILE BROWSER BEHAVIOR

Prevent normal webpage gestures from interfering during active gameplay where appropriate:

- Page scrolling
- Text selection
- Pull-to-refresh interference
- Double-tap zoom
- Pinch zoom during gameplay
- Long-press selection/context behavior

Do this carefully so menus and accessibility remain usable.

---

# AUDIO ON ANDROID

Mobile browsers may require a user interaction before audio starts.

Initialize/unlock audio after the player's first valid interaction, such as pressing:

```text
START GAME
```

After activation, ensure these work:

- Background ambience
- Rain
- Thunder
- Corazon whispers
- Spatial ghost audio
- Footsteps
- Heartbeat
- Player breathing
- Chase music
- Door sounds
- Pickup sounds
- Jumpscare sounds

Do not repeatedly ask for audio activation.

---

# MOBILE PERFORMANCE OPTIMIZATION

Optimize the game for reasonable Android hardware.

Possible optimizations:

- Dynamic render resolution
- Device pixel ratio limits
- Reduced shadow resolution
- Fewer shadow-casting lights
- Lower particle count
- Reduced post-processing
- Texture optimization
- Model LOD where appropriate
- Audio object reuse
- Reduced expensive real-time lighting
- Frustum culling
- Object pooling
- Avoid unnecessary per-frame allocations
- Optimize physics/update loops

Do not destroy the horror atmosphere just to improve FPS.

Preserve:

- Darkness
- Creepy lighting
- Flashlight effects
- Corazon's appearance
- Environmental effects
- Important shadows

---

# DEVICE PERFORMANCE PROFILES

If useful, implement:

```text
LOW
MEDIUM
HIGH
```

Example:

## LOW / Mobile

- Lower render scale
- Lower shadow resolution
- Fewer particles
- Reduced post-processing
- Reduced dynamic lights

## MEDIUM

Balanced performance and visual quality.

## HIGH / Desktop

- Higher resolution
- Better shadows
- More atmospheric effects
- Better post-processing

Do not rely only on user-agent strings. Use sensible capability/input detection where possible.

---

# PRESERVE EXISTING GAMEPLAY

Ensure these systems remain functional:

- Player controls
- First-person camera
- Flashlight
- Existing Corazon 3D model
- Corazon animations
- Ghost AI
- Ghost detection
- Ghost chase
- Jumpscares
- Objectives
- Keys
- Item pickups
- Doors
- Haunted-house layout
- Environmental horror events
- Audio system
- Story events
- UI

Extend working systems instead of replacing them unnecessarily.

---

# MOBILE HORROR EXPERIENCE

Mobile support must mean the game is actually playable, not simply that the webpage fits the phone.

A player using only an Android phone should be able to:

```text
Open game URL
↓
Start game
↓
Watch/read introduction
↓
Move around
↓
Look around
↓
Use flashlight
↓
Open doors
↓
Pick up keys
↓
Pick up objective items
↓
Run from Corazon
↓
Hide/crouch if supported
↓
Experience jumpscares
↓
Complete objectives
↓
Finish the game
```

No keyboard or mouse should be required.

---

# TESTING

## Desktop

- [ ] WASD movement works
- [ ] Mouse-look works
- [ ] Interactions work
- [ ] Flashlight works
- [ ] Sprint works
- [ ] Corazon AI works
- [ ] Audio works

## Android / Mobile Simulation

- [ ] Mobile UI appears
- [ ] Desktop-only controls are hidden appropriately
- [ ] Joystick moves the player
- [ ] Diagonal movement works
- [ ] Touch-look works
- [ ] Multi-touch works
- [ ] Interact button works
- [ ] Flashlight button works
- [ ] Sprint button works
- [ ] Crouch/hide works if available
- [ ] Pause works
- [ ] Rotation/resizing works
- [ ] Audio starts correctly
- [ ] Corazon chase remains playable
- [ ] Jumpscares display correctly
- [ ] Objectives remain readable
- [ ] No page scrolling occurs during gameplay
- [ ] No major UI overlap exists

---

# BUILD AND ERROR CHECKING

After implementation, run the project's existing build/test commands, such as:

```bash
npm run build
```

Also run relevant lint/type/test commands already configured in the project.

Fix:

- TypeScript errors
- Import errors
- Build errors
- Runtime errors
- Missing references
- Broken mobile input
- Duplicate event listeners
- Touch conflicts
- Resize/orientation errors

Do not knowingly leave straightforward build errors unresolved.

---

# FINAL COMPLETION CHECK

Before stopping, compare the implemented project against:

```text
Balay-ni-Corazon-Audio-and-Haunted-Environment-Prompt.md
```

and this mobile/responsive prompt.

Continue with clearly unfinished requirements that can be completed within the project.

Do not stop merely because:

- One feature works
- The application builds
- Desktop works
- The mobile UI appears
- The joystick exists

The task should only be considered complete after the **core game is playable from beginning to end on desktop and the Android browser control system provides every gameplay action needed without requiring a keyboard or mouse**.

If execution must be interrupted because of an environment, context, token, or tool limit:

- Preserve the implementation.
- Save/checkpoint the current work.
- Record exactly what is finished.
- Record the next unfinished requirement.
- Resume from that point when continuing.
- Do not restart or redo completed work.

---

# FINAL REPORT

Once implementation is complete, provide a concise report with:

## Completed Features
What was implemented.

## Mobile Controls
Explain joystick, touch camera, and action buttons.

## Responsive Changes
List mobile UI/layout improvements.

## Performance Optimizations
Explain graphics/performance changes.

## Files Modified
List modified files.

## Files Created
List genuinely necessary new files.

## Testing
Report desktop and mobile testing results.

## Remaining Real-Device Testing
Clearly identify anything that still needs testing on a physical Android phone.

---

# FINAL TARGET

**PC / Laptop:** Keyboard + mouse

**Android Phone:** Touch joystick + touch-look + on-screen action buttons

A player should be able to open the hosted **Balay ni Corazon** URL in a supported Android browser and play the game without installing a separate app.

Continue from the existing project state and keep progressing until the requested implementation is complete.
