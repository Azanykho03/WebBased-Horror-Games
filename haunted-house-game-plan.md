# Corazon: The Haunted House

## 1. Project overview

**Official title:** Corazon: The Haunted House
**Genre:** 3D objective-based psychological/survival horror
**Platform:** Desktop web browser  
**Perspective:** First person  
**Mode:** Single player  
**Stack:** HTML, CSS, TypeScript, Babylon.js, Vite, and localStorage

The player accepts a dare to enter an old Bisaya-style haunted house during a rainy night. Once inside, the entrance locks. To escape, the player must complete a sequence of missions while avoiding Corazon, using the existing ghost model and serious English dialogue.

The experience should begin as serious horror: dark hallways, rain against windows, flickering lights, creaking wooden floors, and footsteps from an apparently empty room. The close face reveal reinforces the threat; Corazon remains disturbing and serious.

Slendrina is the main inspiration for exploration, tension, and ghost encounters. Use an original house layout, story, character presentation, audio, and assets.

**Planning assumptions:** One compact house, one enemy, and a roughly 10–15 minute first playthrough. The title, mission details, and balancing values below are proposed defaults and can be adjusted during development.

## 2. Design goals

- Make the player feel physically present through first-person movement and spatial sound.
- Require clear missions before the escape door can open.
- Build fear before the sudden close encounter.
- Use short, serious English dialogue and preserve the existing Corazon model.
- Keep running, hiding, and limited defense meaningful after the threatening reveal.
- Keep the initial game small enough to finish and demonstrate in class.

## 3. Story and atmosphere

Friends dare the player to enter an abandoned ancestral house and bring back proof. The door slams shut behind them. A handwritten warning beside the entrance explains that the house will only release someone who restores its lights and returns its missing keepsakes.

The ghost resembles a friend, but recognizing the face does not end the haunting. Whether the friend is possessed or the house is imitating them remains deliberately unclear until the ending.

Art direction: weathered wooden walls, sliding windows, woven mats, old family photographs, an aging dining table, a kitchen with a kaldero, and rain visible outside. Use these as visual references for this fictional house, rather than claiming every Bisaya home looks the same.

Keep the ghost threatening and mysterious. Use short English lines sparingly, with no jokes or playful reactions.

## 4. Core gameplay loop

1. Read the current objective.
2. Explore rooms with a flashlight and listen for danger.
3. Collect clues, keys, batteries, or mission items.
4. Avoid the ghost by breaking line of sight, hiding, or using a tsinelas.
5. Complete a mission and unlock the next part of the house.
6. Finish all required missions, unlock the front door, and cross the escape threshold.

## 5. House layout

| Area | Function | Key content |
| --- | --- | --- |
| Front porch and entrance | Intro and final escape | Locked exit, warning note, flashlight |
| Living room | Central navigation hub | Objective clues and family photographs |
| Main hallway | Connect rooms and create tension | Flickering light, footsteps, hiding recess |
| Kitchen | First ghost reveal | Fuse and first tsinelas |
| Utility room | Restore power | Fuse box |
| Bedroom | Search and hiding | Keepsake, wardrobe, battery |
| Storage room | Exploration challenge | Keepsake and environmental clutter |
| Upstairs room | Final keepsake | Stronger ghost pressure |
| Hallway display cabinet | Mission completion point | Keepsake slots and exit key |

Keep doors and corridors wide enough for collision volumes and enemy movement. Every required item must be reachable before the objective that consumes it. The first version uses fixed item locations for reliable progression.

## 6. Mission progression

| ID | Mission | Requirement | Completion and reward |
| --- | --- | --- | --- |
| M01 | Find your bearings | Enter the house | Pick up the flashlight and read the entrance note; reveal the fuse objective |
| M02 | Restore the lights | Finish M01 | Find the kitchen fuse and install it in the utility-room fuse box; unlock the inner hallway door |
| M03 | Recover the keepsakes | Finish M02 | Collect three keepsakes from the bedroom, storage room, and upstairs room |
| M04 | Open the cabinet | Finish M03 | Place all three keepsakes in the hallway display cabinet; reveal the exit key |
| M05 | Escape the house | Finish M04 | Take the key, unlock the front door, and cross the exterior escape trigger |

Example HUD text: **“Pangitaa ang fuse sa kusina.”** and **“Keepsakes: 2/3.”**

The exit must remain locked until all required objectives are complete and the key is owned. Interacting early displays a useful hint. Collectibles have unique IDs and cannot increase progress twice. The escape trigger checks progression again rather than trusting the door animation.

## 7. Player mechanics and controls

| Input | Action |
| --- | --- |
| WASD | Move |
| Mouse | Look around |
| Shift | Sprint while stamina remains |
| E | Interact, collect, open, or enter/leave a hiding place |
| F | Toggle flashlight |
| Left mouse button | Throw an available tsinelas |
| Tab | Toggle mission and inventory panel |
| Esc | Release pointer lock and pause |

- Show a small crosshair and an interaction prompt only within usable range.
- Raycast from the camera and reject interactions through walls.
- Sprinting makes more noise and attracts the ghost.
- Flashlight battery drains while lit; spare batteries restore charge.
- Keep faint environmental visibility when the battery is empty so progress remains possible.
- Hiding is allowed at designated locations. It succeeds only if the ghost did not see the player enter.
- Keep head bob and camera shake subtle and allow them to be disabled.

Proposed starting balance: six seconds of sprint stamina, recovery after a short delay, and a two-second ghost stun. Treat these as tuning values, not fixed requirements.

## 8. Ghost behavior

Use a TypeScript finite-state machine:

| State | Behavior | Transition |
| --- | --- | --- |
| Dormant | Wait for the introductory kitchen encounter | Kitchen reveal starts |
| Patrol | Move along connected room waypoints | Hear noise or see the player |
| Investigate | Travel to the last heard sound | Detect player or finish searching |
| Chase | Pursue the visible player | Lose sight, take a tsinelas hit, or catch player |
| Search | Inspect the last known position | Reacquire player or return to patrol |
| Stunned | Stop briefly and play the hit reaction | Timer ends, then resume search/chase |
| Catch | Play a short capture sequence | Transition to game over |

Detection combines distance, view direction, and an unobstructed line-of-sight ray. Walls block vision. Footsteps and thrown objects produce explicit noise events.

Use a connected waypoint graph with path search for room-to-room travel. Door connections must update when doors unlock. The enemy must not move directly through walls toward the player.

Escalate patrol frequency and pursuit pressure after mission milestones. Keep an escape route possible; avoid spawning the ghost directly on the player. Only one system should control ghost movement at a time, including scripted scares.

## 9. Signature kitchen encounter

Trigger this sequence once when the player enters the kitchen during M02:

1. A metal pot falls off-screen.
2. The player says: **“Something is in here.”**
3. The kitchen light goes out briefly. Rain remains audible.
4. The existing 3D face appears close to the camera with one synchronized impact. The player body remains fixed.
5. Ghost: **“You should never have come here.”**
6. Player: **“I need to get out.”**
7. The face retracts and the ghost appears at the far end of the room.
8. After a short recovery window, normal enemy behavior begins.

Do not allow a catch during the scripted reveal. Preserve this encounter's completed flag in checkpoint saves so it does not repeat unexpectedly.

Additional voice lines:

| Trigger | Ghost dialogue |
| --- | --- |
| Spots the player | “I see you.” |
| Begins a chase | “I know where you are.” |
| Player sprints away | “Don't run from me.” |
| Player breaks line of sight | “I can hear you breathing.” |
| Player approaches the final exit | “You belong to this house now.” |
| Hit by a tsinelas | “You cannot stop me.” |

Give voice lines cooldowns and prevent overlapping dialogue. Display subtitles for every spoken line. All authored lines are clean; retain the existing optional clean-recording setting.

## 10. Tsinelas mechanic

The tsinelas provides temporary defense, not a way to kill the ghost.

- Introduce one collectible tsinelas in the kitchen after the reveal.
- Throw it in the camera's forward direction with a short visible trajectory.
- Check the swept path between projectile positions so fast movement does not skip collisions.
- A valid ghost hit briefly stuns it and plays the hit dialogue.
- The tsinelas falls to an accessible floor location and can be retrieved.
- Add a brief post-stun immunity window to prevent continuous stun-locking.
- If it falls outside the playable area, return it to a known pickup point.
- The game remains completable without landing a tsinelas hit.

## 11. Friend-face and voice assets

Use the friend's photo and recordings with their permission, including agreement on whether the demo will be publicly shared. Until provided, use an original placeholder face and temporary audio.

Required assets:

- Front-facing face photo exported as a transparent PNG.
- A face texture for a floating ghost body or camera-facing plane.
- A separate screen-space face overlay for short jump scares.
- Individual recordings of the selected English voice lines.
- A configuration value for `[FRIEND'S NAME]`, shared by subtitles and dialogue.

Suggested filenames: `spotted.wav`, `sprint.wav`, `lost.wav`, `exit.wav`, and `hit.wav`; preserve the existing face asset.

Keep the world ghost's visual mesh separate from its collision volume. Match perceived audio loudness across recordings and avoid clipping. The demo must run with placeholders if personal assets are absent.

## 12. Technology and architecture

| Technology | Responsibility |
| --- | --- |
| HTML and CSS | Canvas container, menus, loading screen, HUD, subtitles |
| TypeScript | Typed gameplay, mission progression, enemy AI, input, saves |
| Babylon.js | Rendering, camera, collisions, lighting, raycasts, animation, spatial audio |
| Vite and npm | Development server, dependencies, browser build |
| Blender and GLB/glTF | House, props, ghost body, and exported models |
| Audacity | Voice cleanup and sound editing |
| localStorage | Versioned settings and small checkpoint saves |
| Git and GitHub | Source control and team collaboration |

Use the established stack; a backend, login system, and online database are outside the first version. Vite transpiles TypeScript; run the TypeScript compiler separately for type checking. Select compatible stable package versions during implementation and commit the lockfile.

`Game` owns the engine and render loop. `GameplayScene` composes the house and gameplay systems. `InputSystem` owns keyboard and pointer input. `ObjectiveManager` owns progression. `GhostStateMachine` owns enemy decisions. `ScareDirector` coordinates authored scares without conflicting with enemy AI. UI components display state and emit player requests.

Use typed events such as `itemCollected`, `objectiveCompleted`, `noiseEmitted`, `ghostStunned`, `playerCaught`, and `escapeCompleted`. Remove event subscriptions and dispose Babylon resources when restarting a scene.

## 13. Project folder structure

```text
balay-horror/
├── public/assets/
│   ├── models/{house,props,ghost,items}/
│   ├── textures/{house,ghost,effects}/
│   ├── images/{faces,ui}/
│   ├── audio/{ambience,footsteps,voice,scares,interactions}/
│   └── fonts/
├── src/
│   ├── main.ts
│   ├── vite-env.d.ts
│   ├── core/
│   │   ├── Game.ts
│   │   ├── GameState.ts
│   │   ├── SceneManager.ts
│   │   └── EventBus.ts
│   ├── scenes/{MenuScene,GameplayScene}.ts
│   ├── player/{Player,FirstPersonController,Flashlight,Stamina,Inventory}.ts
│   ├── enemies/
│   │   ├── Ghost.ts
│   │   ├── GhostStateMachine.ts
│   │   ├── GhostPerception.ts
│   │   ├── WaypointNavigator.ts
│   │   └── states/{Dormant,Patrol,Investigate,Chase,Search,Stunned,Catch}State.ts
│   ├── interactions/{Interactable,Collectible,Door,FuseBox,HidingSpot,DisplayCabinet,ExitDoor}.ts
│   ├── objectives/{ObjectiveManager,ObjectiveConditions}.ts
│   ├── systems/{InputSystem,InteractionSystem,AudioSystem,ScareDirector,SaveSystem}.ts
│   ├── items/{TsinelasProjectile,BatteryPickup}.ts
│   ├── world/{HouseLoader,Lighting,SpawnManager}.ts
│   ├── effects/{FaceOverlay,ScreenDistortion,CameraShake}.ts
│   ├── ui/
│   │   ├── UIManager.ts
│   │   ├── screens/{MainMenu,LoadingScreen,PauseMenu,SettingsMenu,ResultScreen}.ts
│   │   └── hud/{HUD,ObjectiveTracker,InteractionPrompt,Subtitles,InventoryPanel}.ts
│   ├── data/{houseLayout,houseObjectives,itemDefinitions,dialogue,scareEvents}.ts
│   ├── config/{gameConfig,controls,assetManifest,ghostProfile}.ts
│   ├── types/{objective,level,item,save,event,ghost}.ts
│   └── styles/{main,menus,hud,effects}.css
├── art-source/
├── docs/{game-plan.md,asset-credits.md}
├── tests/{objective-progression,save-migration,escape-gate}.test.ts
├── index.html
├── package.json
├── package-lock.json
├── tsconfig.json
├── vite.config.ts
├── .gitignore
└── README.md
```

Brace notation above abbreviates separate files or directories; braces are not literal filenames. Add modules as their features are implemented. `art-source/` contains editable source assets, while `public/assets/` contains optimized game exports. Reference public files as `/assets/...`, adjusted for the deployment base path. Exclude `node_modules/` and `dist/` from Git.

## 14. Browser flow, saving, and presentation

- Main menu: Play, Continue when a valid save exists, Settings, and Credits.
- Load critical assets and show progress before enabling Click to Play.
- Use an explicit click to activate audio and request pointer lock; handle either request failing.
- Pause gameplay when pointer lock is released or the tab becomes hidden. Resume through a user action.
- Save completed mission IDs, collected item IDs, unlocked doors, inventory, a safe checkpoint ID, and completed scare flags.
- Restore the ghost to a designated safe starting state rather than saving an active chase.
- Version the save format, validate loaded data, and fall back gracefully on corrupt or unavailable storage.
- Game over offers Retry Checkpoint and Main Menu. Escape shows completion time and a short, serious English closing scene.
- Settings include volume sliders, sensitivity, subtitles, brightness, reduced flashing, reduced camera motion, and scare intensity.

## 15. Performance targets

Target a smooth 60 FPS on the development team's agreed reference laptop, with a lower-quality preset targeting 30 FPS. These are goals to measure, not guarantees.

Use a compact low-poly house, compressed assets, shared materials, limited shadow-casting lights, and restrained post-processing. Keep rain mostly outside windows. Avoid simulating every prop with rigid-body physics; basic player/world collisions and a custom tsinelas projectile are sufficient for the first version.

Test actual desktop browsers and record hardware, settings, frame rate, and loading time. Show a useful message when the browser cannot initialize the renderer. Mobile controls and optimization are a later phase.

## 16. Implementation milestones

1. **Foundation:** Vite/TypeScript setup, Babylon canvas, loading/menu flow, input, pointer lock, pause.
2. **Playable house:** Graybox rooms, collision, movement, flashlight, interaction prompts.
3. **Complete mission loop:** All objectives, inventory, locked doors, exit validation, win screen.
4. **Survival threat:** Enemy navigation, detection, chase/search, hiding, capture and retry.
5. **Signature encounter:** Kitchen reveal, existing Corazon model, serious subtitles, synchronized impact, tsinelas stun.
6. **Polish:** Environmental audio, lighting, save/load, settings, performance, credits.

The first playable milestone should contain the entrance, hallway, kitchen, one mission, one ghost encounter, and a working exit condition. Expand to the full house only after that loop works.

## 17. Acceptance checklist

- [ ] Game runs in a desktop browser with first-person controls and no installation.
- [ ] The player understands the dare and the locked-house escape goal.
- [ ] All mission steps can be completed without inaccessible items or circular requirements.
- [ ] The front door cannot grant escape before required missions and key collection.
- [ ] Kitchen reveal triggers once per saved playthrough and cannot cause an unavoidable death.
- [ ] Ghost detection respects walls, navigation respects doors, and hiding follows clear rules.
- [ ] Tsinelas hits stun briefly, misses are recoverable, and repeated hits cannot trap the ghost forever.
- [ ] Voice lines have subtitles, cooldowns, and no uncontrolled overlap.
- [ ] Friend assets can be replaced through configuration without editing enemy logic.
- [ ] Pause stops AI, timers, battery drain, stamina changes, and active chase audio appropriately.
- [ ] Save/reload preserves progression and restores a fair checkpoint.
- [ ] Retry does not duplicate enemies, listeners, audio, or collectibles.
- [ ] Reduced flashing and camera-motion settings work.
- [ ] Asset credits and permissions for included face/voice media are recorded.
- [ ] Type checking and the production build pass; the built game completes a full playthrough.

## 18. Later additions

After the core game is complete: validated randomized item locations, multiple friend-ghost profiles, difficulty presets, optional puzzles, alternate endings, and mobile controls. Multiplayer, public leaderboards, runtime face uploads, and procedural houses are outside the initial scope.
