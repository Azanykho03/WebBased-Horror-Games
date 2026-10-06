# Corazon: The Haunted House — Horror Audio & Haunted Environment Enhancement Prompt

## Role

Act as a senior web horror game developer, sound designer, atmosphere designer, and gameplay programmer.

You are working on my existing web-based first-person survival horror game. Do **not** rebuild the project from scratch. Inspect the current folders, code, assets, configuration, existing gameplay systems, 3D models, animations, environment, ghost logic, interactions, and previous project documentation before modifying anything.

The game is inspired by the atmosphere and tension of classic first-person supernatural survival horror games, but it must maintain its own identity, story, assets, mechanics, audio, environment, and presentation.

---

# 1. OFFICIAL GAME RENAMING

Change the official game title everywhere to:

**Corazon: The Haunted House**

The main supernatural entity / ghost must now be named:

**Corazon**

Update the name consistently throughout the existing project wherever appropriate, including:

- Main menu
- Loading screen
- Intro sequence
- Story text
- Objective text
- HUD/UI
- Pause menu
- Game-over screen
- Ending sequence
- Dialogue
- Subtitles
- Ghost AI references where user-facing
- Audio/voice-line references
- Documentation
- Metadata
- README files
- Existing prompts or configuration files where necessary

Do not blindly rename internal code identifiers if doing so could break working systems. Prefer safe, targeted refactoring.

---

# 2. CORE ATMOSPHERE GOAL

Enhance the haunted house so that **Corazon: The Haunted House** feels extremely creepy, terrifying, oppressive, unpredictable, and immersive.

The horror must not depend only on jumpscares.

Create fear through:

- Silence
- Darkness
- Spatial audio
- Environmental storytelling
- Uncertainty
- Distant movement
- Unexplained sounds
- Flickering lights
- Shadow movement
- Limited visibility
- Sudden environmental changes
- Ghost proximity
- Psychological tension
- Misleading sounds
- Slow tension buildup
- Rare but powerful jumpscares

The player should frequently feel that **Corazon may be nearby even when she is not visible**.

Avoid making the experience noisy all the time. Silence should be treated as part of the horror design.

---

# 3. AUDIO SYSTEM

Inspect the project's current audio implementation first.

If no suitable system exists, use **Howler.js** for general audio management and spatial audio where appropriate.

Possible installation:

```bash
npm install howler
npm install -D @types/howler
```

If the game already uses Babylon.js audio, Web Audio API, Three.js positional audio, or another suitable audio system, preserve it instead of unnecessarily replacing it.

Create a clean audio manager or equivalent reusable architecture.

The audio system should support:

- Master volume
- Music volume
- Ambience volume
- Sound-effects volume
- Voice volume
- Looping
- Fading
- Cross-fading
- Randomized playback
- Cooldowns
- Positional/spatial audio
- Distance attenuation
- Preventing excessive sound overlap
- Temporary audio ducking
- State-based soundtrack changes
- Pause/resume behavior
- Browser autoplay restrictions
- Audio preloading where appropriate

---

# 4. RECOMMENDED AUDIO FOLDER STRUCTURE

Use the current project structure when possible.

Do not create unnecessary folders.

If an organized audio directory does not already exist, use:

```text
public/
└── assets/
    └── audio/
        ├── ambience/
        ├── music/
        ├── corazon/
        ├── player/
        ├── interactions/
        ├── environment/
        ├── jumpscares/
        └── ui/
```

Example filenames:

```text
audio/
├── ambience/
│   ├── haunted_house_roomtone.ogg
│   ├── rain_loop.ogg
│   ├── wind_loop.ogg
│   ├── distant_storm.ogg
│   └── low_horror_drone.ogg
│
├── music/
│   ├── exploration_theme.ogg
│   ├── tension_layer.ogg
│   ├── corazon_nearby.ogg
│   ├── chase_theme.ogg
│   └── ending_theme.ogg
│
├── corazon/
│   ├── whisper_01.wav
│   ├── whisper_02.wav
│   ├── distant_cry.wav
│   ├── breathing.wav
│   ├── laugh.wav
│   ├── appear.wav
│   ├── disappear.wav
│   ├── chase_voice.wav
│   ├── attack.wav
│   └── scream.wav
│
├── player/
│   ├── footsteps_wood_01.wav
│   ├── footsteps_wood_02.wav
│   ├── breathing_normal.wav
│   ├── breathing_scared.wav
│   ├── heartbeat_slow.wav
│   └── heartbeat_fast.wav
│
├── interactions/
│   ├── pickup_key.wav
│   ├── pickup_object.wav
│   ├── flashlight_click.wav
│   ├── locked_door.wav
│   ├── door_open.wav
│   ├── door_close.wav
│   └── drawer_open.wav
│
├── environment/
│   ├── floor_creak_01.wav
│   ├── floor_creak_02.wav
│   ├── window_rattle.wav
│   ├── distant_knock.wav
│   ├── object_fall.wav
│   ├── metal_drag.wav
│   ├── thunder.wav
│   ├── ceiling_noise.wav
│   └── wall_scratch.wav
│
├── jumpscares/
│   ├── jumpscare_impact_01.wav
│   ├── jumpscare_impact_02.wav
│   └── corazon_jumpscare.wav
│
└── ui/
    ├── menu_move.wav
    ├── menu_select.wav
    └── objective_update.wav
```

---

# 5. LICENSED AUDIO SOURCES

Do not use copyrighted commercial horror music or rip audio from movies, games, YouTube videos, or copyrighted soundtracks.

Audio may be sourced from properly licensed libraries such as:

- Pixabay
- Freesound
- Sonniss GameAudioGDC
- Kenney
- OpenGameArt

Prefer:

- CC0
- Royalty-free assets
- Assets explicitly licensed for games
- Assets that allow modification and redistribution as part of the finished game

If attribution is required, create or update an audio credits file.

Possible file:

```text
AUDIO_CREDITS.md
```

For every externally sourced asset, record:

- Filename
- Original title
- Creator
- Source
- License
- Required attribution

If no licensed asset is currently available, do not silently insert copyrighted material.

Instead, create a clearly named placeholder and report which audio file is still required.

---

# 6. ADAPTIVE HORROR MUSIC SYSTEM

Do not play one horror track continuously.

Create an adaptive soundtrack system based on gameplay state.

Recommended states:

```text
CALM_EXPLORATION
UNEASY
CORAZON_NEARBY
CORAZON_DETECTED_PLAYER
CHASE
HIDING
JUMPSCARE
POST_JUMPSCARE
GAME_OVER
ENDING
```

## CALM_EXPLORATION

Use mostly environmental ambience:

- Rain
- Wind
- Old-house room tone
- Very subtle low drone
- Occasional distant thunder

Music should be almost invisible.

The player should hear the haunted house more than the soundtrack.

---

## UNEASY

Trigger when the player enters suspicious areas or important story locations.

Gradually introduce:

- Low-frequency drone
- Reversed textures
- Very subtle dissonant tones
- Distant whisper layers
- Quiet heartbeat

Do not reveal Corazon immediately.

---

## CORAZON_NEARBY

When Corazon is within a configured distance:

- Increase subtle heartbeat
- Add barely audible whispers
- Reduce comforting environmental frequencies
- Add directional ghost breathing
- Occasionally play floor movement from her direction

The system should create tension without telling the player exactly where she is.

---

## CORAZON_DETECTED_PLAYER

When Corazon detects the player:

- Raise tension layer
- Increase heartbeat
- Increase breathing
- Play a short detection sting
- Reduce nonessential ambience
- Make Corazon's voice more noticeable

Do not immediately play the full chase track unless pursuit actually begins.

---

## CHASE

During an active chase:

- Play an intense but original chase layer
- Increase heartbeat dynamically
- Increase player's heavy breathing
- Use Corazon's spatial movement sounds
- Add occasional aggressive ghost vocalizations
- Reduce background ambience so chase audio stays readable

The chase music should stop or fade naturally once the player escapes.

Never restart the chase track unnecessarily every frame.

---

## HIDING

When hiding:

- Reduce music
- Make breathing and heartbeat very noticeable
- Allow Corazon's footsteps, movement, breathing, or whispers to pass outside the hiding location
- Use positional audio to show whether she is getting closer or farther away
- Occasionally create false movement sounds elsewhere

This state should be highly tense but comparatively quiet.

---

## JUMPSCARE

During a jumpscare:

- Quickly duck music and unnecessary ambience
- Play the jumpscare impact
- Play Corazon's scream/voice if appropriate
- Synchronize audio with the animation
- Do not stack several loud effects at full volume

Afterward, restore ambience gradually.

---

# 7. CORAZON'S AUDIO IDENTITY

Corazon needs a recognizable supernatural sound identity.

Her sound design should combine:

- Female whispers
- Distorted breathing
- Soft crying
- Distant humming
- Sudden silence before appearances
- Cloth movement
- Barefoot/unnatural movement sounds
- Low reversed vocal textures
- Subtle reverb
- Directional whispers

Avoid making every Corazon event loud.

Sometimes the scariest event should simply be:

- A whisper behind the player
- A breath near one ear
- A door gently opening
- A distant laugh
- A short shadow crossing a doorway
- Silence where ambience previously existed

---

# 8. CORAZON RANDOM WHISPER SYSTEM

Create randomized ghost whispers.

Current serious English dialogue examples:

```text
"Turn around."
"I can hear you breathing."
"I am closer than you think."
"I see you."
"You should never have come here."
"This house remembers you."
"Do not look behind you."
"I have been waiting for you."
```

Use the serious English pools in src/config.ts and src/horror.ts. Retire earlier comedic or Bisaya dialogue.

Use voice lines sparingly.

Randomize:

- Which line plays
- Delay before playback
- Direction
- Distance
- Volume
- Reverb
- Probability

Add cooldowns so the same line cannot repeat constantly.

Some whispers may intentionally originate from an empty room.

---

# 9. SPATIAL / 3D AUDIO

Use positional audio whenever technically appropriate.

Examples:

- Corazon
- Doors
- Windows
- Falling objects
- Knocking
- Footsteps
- Clock
- Radio
- Distant crying
- Ceiling movement
- Scratching
- Environmental props

Sound volume and stereo position should respond naturally to distance and direction.

Walls and rooms may slightly reduce or filter sound when practical.

Avoid unrealistic positional behavior.

---

# 10. HAUNTED HOUSE ENVIRONMENT ENHANCEMENT

Upgrade the existing haunted-house environment without replacing the existing layout unless required.

Preserve the established Bisaya/Filipino old-house identity.

The environment should feel abandoned, humid, aged, and supernatural.

Possible visual improvements:

- Dirty walls
- Damp stains
- Mold
- Peeling paint
- Cracked wood
- Old curtains
- Damaged furniture
- Dust
- Cobwebs
- Broken picture frames
- Old religious objects where contextually appropriate
- Antique cabinets
- Abandoned household items
- Old family photographs
- Water leaks
- Rusted metal
- Broken tiles
- Rotten floorboards

Keep performance appropriate for a browser game.

---

# 11. LIGHTING

Lighting is extremely important.

Use:

- Weak warm bulbs
- Cold moonlight
- Flashlight-dominant exploration
- Deep shadows
- Flickering fluorescent or incandescent lights
- Lightning flashes
- Intermittent light failure
- Very dark corners
- Light leaking under doors
- Moving shadows

Do not make the house completely black.

The player must still be able to navigate.

Use darkness to hide information rather than simply removing visibility.

---

# 12. RANDOM LIGHT EVENTS

Create rare environmental light events such as:

- Hallway bulb flickers
- Light turns off behind player
- Flashlight briefly flickers
- Room light switches itself on
- Lightning reveals Corazon for one frame/brief moment
- Shadow crosses a doorway
- Light slowly dims when Corazon is close

Use cooldowns and randomness.

Do not trigger these events every few seconds.

---

# 13. ENVIRONMENTAL HORROR EVENTS

Create an event manager for subtle supernatural activity.

Possible events:

- Door slowly opens by itself
- Door suddenly slams
- Window rattles
- Object falls in another room
- Picture frame changes orientation
- Chair moves slightly
- Cabinet door opens
- Footsteps upstairs
- Footsteps behind the player
- Scratching inside a wall
- Ceiling movement
- Distant crying
- Distant knocking
- Radio activates briefly
- Whisper comes from an empty room
- Light shuts off
- Shadow passes the hallway
- Corazon briefly appears at the end of a corridor
- Corazon disappears when directly illuminated
- An object is no longer where it was earlier

Events should be:

- Randomized
- Context-aware
- Rate-limited
- Nonrepetitive
- Performance-friendly

The system should remember recently triggered events to avoid obvious repetition.

---

# 14. FALSE SCARES

Not every suspicious event should be Corazon.

Implement false scares such as:

- Curtain movement
- Falling broom
- Rat/object noise
- Tree branch hitting window
- Thunder
- Hanging object moving
- A door closing from wind
- Player's own shadow
- A figure-like object in darkness

This prevents the player from learning that every sound means a ghost attack.

---

# 15. SILENCE EVENTS

Occasionally remove or greatly reduce ambient sound before important supernatural events.

Example:

```text
Normal rain + room ambience
        ↓
Rain becomes muffled
        ↓
House suddenly becomes almost silent
        ↓
Faint Corazon breathing behind player
        ↓
Player turns around
        ↓
Nothing there
```

Silence events should be rare so they remain effective.

---

# 16. WEATHER

Enhance the exterior weather atmosphere.

Possible effects:

- Heavy rain
- Distant thunder
- Occasional strong thunder
- Wind
- Window vibration
- Roof rain
- Water dripping
- Lightning flashes

Indoor audio should sound different from exterior rain.

Use environmental filtering/volume adjustment where practical.

---

# 17. FOOTSTEP SYSTEM

Improve player footsteps.

Footsteps should vary by surface:

```text
WOOD
TILE
CONCRETE
METAL
DIRT
```

Randomize between several samples per surface.

Avoid playing the exact same sample repeatedly.

Footstep timing should match player movement speed.

No footsteps when:

- Player is stationary
- Player is airborne
- Player is not actually moving

If crouching exists, footsteps should be quieter.

---

# 18. CORAZON MOVEMENT AUDIO

Corazon should not sound like a normal NPC.

Depending on her animation/state, use combinations of:

- Soft footsteps
- Dragging cloth
- Barefoot contact
- Floating movement
- Neck/body creak
- Whisper
- Breathing
- Low supernatural hum

Corazon can sometimes move almost silently.

This prevents players from relying completely on audio to locate her.

---

# 19. INTERACTION SOUND EFFECTS

Connect appropriate sounds to existing interactions.

Examples:

### Keys
- Metallic pickup sound
- Inventory confirmation

### Flashlight
- Mechanical click
- Optional subtle electrical noise

### Doors
- Open
- Close
- Locked
- Creak
- Slam

### Drawers/Cabinets
- Slide/open
- Close
- Rattle

### Important Items
- Subtle supernatural sting
- Objective update

### Puzzle Objects
- Mechanical or physical feedback

Audio should occur exactly when the interaction happens.

---

# 20. OBJECTIVE AUDIO

When the player discovers a major clue or completes an objective:

- Play a subtle notification
- Do not use cheerful UI sounds
- Keep the sound consistent with the horror tone

Example:

```text
OBJECTIVE UPDATED
Find the key to Corazon's room.
```

Use a quiet, unsettling tone.

---

# 21. HEARTBEAT SYSTEM

Implement adaptive heartbeat based on danger.

Example:

```text
Corazon far away       = no heartbeat
Corazon somewhat near  = slow heartbeat
Corazon close          = faster heartbeat
Detected               = strong heartbeat
Chase                  = very fast heartbeat
Escaped chase          = gradually slows
```

Do not directly reveal Corazon's exact position through heartbeat alone.

Smoothly interpolate changes.

---

# 22. BREATHING SYSTEM

Player breathing should respond to danger.

Normal exploration:

- Little or no audible breathing

Fear / Corazon nearby:

- Slight breathing

Chase:

- Heavy breathing

After chase:

- Gradually recover

Avoid continuously looping loud breathing during the entire game.

---

# 23. JUMPSCARE DESIGN

Jumpscares should be rare and meaningful.

Possible jumpscare structure:

```text
Tension buildup
↓
Subtle warning
↓
Moment of silence
↓
Unexpected appearance/movement
↓
Audio impact
↓
Corazon animation
↓
Recovery period
```

Do not constantly teleport Corazon directly into the camera.

Use different scare styles:

- Full-screen attack
- Doorway appearance
- Mirror appearance
- Looking through window
- Crawling past hallway
- Sudden close whisper
- Corazon standing behind player
- Brief lightning reveal
- Peeking from corner
- Passing behind player

Use cooldowns.

---

# 24. GHOST PROXIMITY SYSTEM

Expose a reusable ghost proximity value.

Conceptually:

```text
0.0 = Corazon very far
1.0 = Corazon extremely close
```

Use this value to influence:

- Heartbeat
- Breathing
- Whisper probability
- Drone intensity
- Light flicker probability
- Environmental activity
- Chase transitions

Do not connect everything linearly.

Introduce randomness so players cannot perfectly predict Corazon.

---

# 25. AUDIO DUCKING

Implement audio ducking.

Examples:

During jumpscare:

```text
Ambience: lower temporarily
Music: lower temporarily
Corazon scream: foreground
Impact: foreground
```

During dialogue:

```text
Music: reduce slightly
Ambience: remain
Dialogue: foreground
```

Restore volumes smoothly afterward.

---

# 26. RANDOMNESS

The horror system should avoid predictable loops.

Randomize:

- Ambient event interval
- Ghost whisper timing
- Environmental scares
- Thunder timing
- Floor creaks
- Window noises
- Ghost vocalization
- Certain light flickers

Use minimum and maximum delays.

Example concept:

```ts
nextEvent = randomBetween(20, 60);
```

Do not create excessive timers that hurt performance.

Prefer a centralized scheduler/event manager.

---

# 27. AUDIO PERFORMANCE

Because this is a web-based 3D game:

- Preload only important sounds
- Lazy-load optional sounds if necessary
- Reuse audio objects
- Avoid hundreds of simultaneous audio nodes
- Compress large ambience/music files appropriately
- Prefer OGG/MP3 for longer audio
- Use WAV primarily for short effects when appropriate
- Clean up unused audio
- Do not spawn new sound objects every frame

Test browser compatibility.

---

# 28. SOUND SETTINGS

If settings already exist, integrate into them.

Otherwise add an appropriate audio settings section.

Suggested controls:

```text
Master Volume
Music Volume
Ambience Volume
Sound Effects Volume
Voice Volume
```

Values should persist locally when possible.

---

# 29. INTRO ATMOSPHERE

Enhance the opening of **Corazon: The Haunted House**.

Before gameplay begins:

- Rain
- Dark screen
- Distant thunder
- Low ambience
- Short text/story intro
- Old-house exterior or entrance
- Minimal music

Slowly introduce the title:

# Corazon: The Haunted House

The intro should feel ominous and cinematic without becoming overly long.

---

# 30. STORY ATMOSPHERE

Maintain the existing story unless project documentation explicitly requires updates.

Corazon should feel connected to the haunted house.

Use environmental storytelling such as:

- Family photographs
- Old notes
- Locked room
- Damaged personal belongings
- Abandoned furniture
- Objects related to Corazon
- Subtle clues explaining what happened

Do not explain everything immediately.

Allow the player to piece the story together.

---

# 31. CORAZON'S PRESENCE

Make Corazon feel like she inhabits the house rather than simply spawning near the player.

Possible behavior:

```text
Player hears Corazon elsewhere
↓
Corazon crosses distant hallway
↓
Corazon disappears
↓
Several minutes later player hears whisper
↓
Object falls nearby
↓
Player enters another room
↓
Corazon is briefly visible outside the doorway
```

Her presence should persist psychologically even when she is off-screen.

---

# 32. DO NOT COPY OTHER GAMES

The game may take inspiration from survival horror pacing and atmosphere, but:

- Do not copy copyrighted music
- Do not copy exact ghost designs
- Do not copy maps
- Do not copy dialogue
- Do not copy unique characters
- Do not copy proprietary assets

Keep **Corazon: The Haunted House** original.

---

# 33. IMPLEMENTATION APPROACH

Before coding:

1. Inspect the entire existing project.
2. Read relevant `.md` planning files.
3. Inspect current audio implementation.
4. Inspect ghost AI.
5. Inspect environment and lighting.
6. Inspect interaction system.
7. Inspect current folder organization.
8. Reuse existing architecture whenever possible.
9. Identify exactly what needs modification.

Then implement the improvements incrementally.

Do not unnecessarily rewrite working systems.

---

# 34. DO NOT BREAK EXISTING FEATURES

Preserve:

- Player controls
- First-person camera
- Flashlight
- Existing ghost model
- Corazon animations
- Ghost chase
- Objectives
- Keys
- Item pickups
- Doors
- Existing haunted-house layout
- Existing UI
- Existing story events
- Existing jumpscare logic
- Existing 3D assets

Improve or extend these systems instead of replacing them unless technically required.

---

# 35. TESTING CHECKLIST

After implementation, test:

## Audio

- [ ] Background ambience loops correctly
- [ ] No obvious looping clicks
- [ ] Music transitions smoothly
- [ ] Ghost audio is spatial
- [ ] Heartbeat responds correctly
- [ ] Chase audio begins/stops correctly
- [ ] Jumpscare audio is synchronized
- [ ] Door sounds trigger once
- [ ] Pickup sounds trigger once
- [ ] Footsteps match movement
- [ ] Audio pauses/resumes correctly
- [ ] Volume settings work

## Environment

- [ ] Light flickers work
- [ ] Random events do not spam
- [ ] Environmental scares vary
- [ ] Corazon proximity affects atmosphere
- [ ] Weather ambience works
- [ ] Lighting remains playable
- [ ] Flashlight remains usable
- [ ] Shadows do not excessively hurt performance

## Gameplay

- [ ] Corazon can still detect the player
- [ ] Chase logic works
- [ ] Hiding works if implemented
- [ ] Keys work
- [ ] Objectives work
- [ ] Doors work
- [ ] Jumpscares work
- [ ] No existing mechanics were accidentally broken

---

# 36. FINAL OUTPUT REQUIRED FROM CODEX

When finished, provide a concise implementation report containing:

## Files Modified

List each modified file.

## Files Created

List only genuinely necessary new files.

## Audio Assets Required

List missing audio placeholders, for example:

```text
public/assets/audio/ambience/rain_loop.ogg
public/assets/audio/corazon/whisper_01.wav
public/assets/audio/corazon/scream.wav
public/assets/audio/interactions/pickup_key.wav
public/assets/audio/environment/window_rattle.wav
```

## Audio Source Recommendations

For each missing category, recommend an appropriate search phrase such as:

```text
Pixabay:
"dark haunted house ambience"

Freesound:
"female ghost whisper CC0"

Sonniss:
"old wooden house creak"

Kenney:
"item pickup sound"
```

Do not download questionable copyrighted audio automatically.

## Testing Results

Report:

- What was tested
- What works
- Any remaining issues
- Any missing audio assets

---

# FINAL GOAL

Turn the existing project into a much more terrifying and immersive supernatural horror experience called:

# **Corazon: The Haunted House**

Corazon should feel like a supernatural presence haunting the entire house rather than merely an enemy that appears during scripted encounters.

The player should constantly wonder:

> "Asa si Corazon?"

Use darkness, silence, sound direction, environmental activity, unpredictability, and carefully timed appearances to create fear.

Prioritize:

**Atmosphere > constant jumpscares**

**Tension > loudness**

**Uncertainty > predictability**

**Immersion > excessive effects**

**Originality > imitation**

Preserve the current game and improve it carefully instead of rebuilding it.
