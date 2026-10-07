import type { Hotspot, Position } from './types.ts';

export const assetUrl = (path: string) => `${import.meta.env.BASE_URL}assets/${path}`;
export const ASSETS = {
  house: 'models/environments/haunted-house/haunted-house.glb',
  manifest: 'models/environments/haunted-house/house-manifest.json',
  ghost: 'models/enemies/ghost/ghost.glb',
  arms: 'models/player/arms/free_gameready_fps_female_arms.glb',
  flashlight: 'models/items/flashlight/flashlight.glb',
  key: 'models/interactive/Lastkey.glb',
  masterKey: 'models/interactive/masterbedroomKey.glb',
  door: 'models/interactive/old_wooden_door.glb',
  hidingCabinet: 'models/interactive/cabinetForHiding.glb',
  face: 'models/enemies/ghost/source/ghost-face-reference.png',
};
export const GAME_TITLE = 'Corazon: The Haunted House';
// Camera-relative origin for the uploaded rig, after its display scale is undone.
export const VIEWMODEL = { position: [.13, -1.9, -.02] as const };
// Existing F02 coffee table: preserved boards top out at approximately .47 m.
export const FLASHLIGHT_PICKUP = { position: [5.9, .515, -3.28] as [number, number, number], rotation: [.053, -.3, 0] as [number, number, number] };
export const GHOST_PROFILE = { name: 'Corazon', face: ASSETS.face, model: ASSETS.ghost };
export const MUSIC_AUDIO = {
  menu: 'audio/MELANCHOLIA Music Box Sad, creepy song.mp3',
  game: 'audio/ILI ILI Tulog Anay Scary Version Music Box Cover.mp3',
};
export const AMBIENCE_AUDIO = 'audio/mixkit-horror-ambience-2482.wav';
// Levels are before the existing mixer sliders and master limiter. Distances are
// world meters; all fades use the AudioContext clock (which freezes on pause).
export const CORAZON_AUDIO = {
  menu: { path: 'audio/CreepyNightBreeze.mp3', volume: .24, loop: true, fade: .8 },
  gameplay: { path: 'audio/CreepyLittleGirl.mp3', volume: .16, loop: true, fade: .8 },
  proximity: { path: 'audio/CreepyCurseSound.mp3', volume: .38, loop: true, fade: .45,
    enterDistance: 8, exitDistance: 11, fullVolumeDistance: 2, minimumVolume: .09 },
  // The supplied recording's strongest 20 ms burst starts at .20 s. Skip its
  // quiet lead-in at playback, without altering the original MP3.
  jumpscare: { path: 'audio/peircing.wavJumpscare.mp3', volume: .85, loop: false, fade: .003, offset: .20 },
};
export type VoiceCue = 'kitchen-player' | 'kitchen-ghost' | 'recognition' | 'spotted' | 'sprint' | 'lost' | 'exit' | 'hit' | `whisper-${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8}` | 'cry' | 'hum' | 'laugh' | 'scream';
// Optional asset paths under public/assets. Captions and synthesized cues work
// when recordings are absent. Clean mode never falls back to an unclean clip.
export const VOICE_AUDIO: Partial<Record<VoiceCue, { normal?: string; clean?: string }>> = {};
// Context is known by the state machine. Short authored pools keep that logic
// offline and predictable; the existing subtitle/voice cooldown owns timing.
export const GHOST_DIALOGUE = {
  'kitchen-ghost': ['You should never have come here.', 'I have been waiting for you.', 'You cannot leave this place.'],
  spotted: ['I see you.', 'I know where you are.', 'You cannot hide from me.'],
  sprint: ["Don't run from me.", "Keep running. It won't save you.", 'There is nowhere left to hide.'],
  lost: ['I can hear you breathing.', 'The walls cannot hide you.', 'I will find you.'],
  exit: ['You belong to this house now.', 'That door will not save you.', 'You cannot leave me here.'],
  hit: ['You cannot stop me.', 'You will not escape.', 'I am still here.'],
  capture: ['You belong to this house now.', 'There is nowhere left to run.', 'Stay with me. Forever.'],
} as const;
export const CHECKPOINTS: Record<string, Position> = {
  entrance: { x: 0, y: 0, z: -2.5, level: 0 },
  breaker: { x: 0, y: 3.24, z: -4.65, level: 1 },
  cabinet: { x: 0, y: 0, z: -13.5, level: 0 },
};
export const HOTSPOTS: Hotspot[] = [
  { id: 'flashlight', label: 'Pick up Flashlight', position: [...FLASHLIGHT_PICKUP.position], room: 'F02', kind: 'pickup', radius: .19 },
  { id: 'note', label: 'Read the warning', position: [6.34, .507, -3.3], room: 'F02', kind: 'note', radius: .2 },
  { id: 'fuse', label: 'Take the kitchen fuse', position: [-4.5, 1.1, -21.35], room: 'F05', kind: 'pickup', radius: .23 },
  { id: 'breaker', label: 'Restore the lights', position: [-1.08, 4.67, -4.65], room: 'U00', kind: 'fixture', radius: .35 },
  { id: 'locket', label: 'Take the family locket', position: [7.46, 4.04, -13.8], room: 'U03', kind: 'pickup', radius: .24 },
  { id: 'letter', label: 'Take the folded letter', position: [-4.7, .99, -6.45], room: 'F09', kind: 'pickup', radius: .25 },
  { id: 'music-box', label: 'Take the music box', position: [7.18, 4.0, -21.1], room: 'U06', kind: 'pickup', radius: .27 },
  { id: 'cabinet', label: 'Return the keepsakes', position: [.68, 1.45, -13.5], room: 'F08', kind: 'fixture', radius: .46 },
  { id: 'exit-key', label: 'Take the final key', position: [.58, 1.38, -13.5], room: 'F08', kind: 'pickup', radius: .25 },
  { id: 'master-key', label: 'Take the master bedroom key', position: [-4.3, 3.99, -7.17], room: 'U02', kind: 'pickup', radius: .25 },
  { id: 'battery-kitchen', label: 'Take spare battery', position: [-2.8, 1.09, -21.3], room: 'F05', kind: 'pickup', radius: .22 },
  { id: 'battery-study', label: 'Take spare battery', position: [-4.3, 3.38, -6.8], room: 'U02', kind: 'pickup', radius: .22 },
  { id: 'battery-guest', label: 'Take spare battery', position: [7.62, 4.02, -13.8], room: 'U03', kind: 'pickup', radius: .22 },
  { id: 'tsinelas', label: 'Pick up the tsinelas', position: [-3.2, .12, -18.8], room: 'F05', kind: 'pickup', radius: .3 },
];

export const WARNING = 'Do not enter. The front door is locked. Find the fuse in the kitchen. Restore the breaker upstairs. The study holds the master bedroom key. Return our locket, letter, and music box to the glass cabinet. The final key opens the main entrance. Break her line of sight before hiding in the dining or upstairs cabinet. If she sees you enter, she knows where to search.';
