import type { Hotspot, Position } from './types.ts';

export const assetUrl = (path: string) => `${import.meta.env.BASE_URL}assets/${path}`;
export const ASSETS = {
  house: 'models/environments/haunted-house/haunted-house.glb',
  manifest: 'models/environments/haunted-house/house-manifest.json',
  ghost: 'models/enemies/ghost/ghost.glb',
  arms: 'models/player/arms/free_gameready_fps_female_arms.glb',
  flashlight: 'models/items/flashlight/flashlight.glb',
  key: 'models/items/keys/key.glb',
  face: 'models/enemies/ghost/source/ghost-face-reference.png',
};
export const GAME_TITLE = 'Balay ni Corazon';
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
export type VoiceCue = 'kitchen-player' | 'kitchen-ghost' | 'recognition' | 'spotted' | 'sprint' | 'lost' | 'exit' | 'hit' | `whisper-${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8}` | 'cry' | 'hum' | 'laugh' | 'scream';
// Optional asset paths under public/assets. Captions and synthesized cues work
// when recordings are absent. Clean mode never falls back to an unclean clip.
export const VOICE_AUDIO: Partial<Record<VoiceCue, { normal?: string; clean?: string }>> = {};
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
  { id: 'exit-key', label: 'Take the worn red key', position: [.58, 1.38, -13.5], room: 'F08', kind: 'pickup', radius: .25 },
  { id: 'exit', label: 'Unlock the service exit', position: [-1.35, 1.1, -13.5], room: 'F08', kind: 'door', radius: .58 },
  { id: 'front-door', label: 'Inspect the front door', position: [0, 1.1, -.06], room: 'F01', kind: 'door', radius: .65 },
  { id: 'bedroom-door', label: 'Inspect the bedroom latch', position: [1.37, 4.4, -17], room: 'U00', kind: 'door', radius: .5 },
  { id: 'battery-kitchen', label: 'Take spare battery', position: [-2.8, 1.09, -21.3], room: 'F05', kind: 'pickup', radius: .22 },
  { id: 'battery-study', label: 'Take spare battery', position: [-4.3, 3.38, -6.8], room: 'U02', kind: 'pickup', radius: .22 },
  { id: 'battery-guest', label: 'Take spare battery', position: [7.62, 4.02, -13.8], room: 'U03', kind: 'pickup', radius: .22 },
  { id: 'tsinelas', label: 'Pick up the tsinelas', position: [-3.2, .12, -18.8], room: 'F05', kind: 'pickup', radius: .3 },
  { id: 'hide-guest', label: 'Hide behind the wardrobe', position: [2.75, 4.6, -13], room: 'U03', kind: 'hide', radius: .4 },
  { id: 'hide-master', label: 'Hide among the hanging clothes', position: [2.79, 4.6, -18.57], room: 'U06', kind: 'hide', radius: .4 },
];

export const WARNING = 'Ayaw pagsulod. You accepted the dare. Now the latch will not move. Find the fuse in the kitchen. Restore the breaker upstairs, beside the first master bedroom. Return our locket, letter, and music box to the glass cabinet. The red key opens the service exit opposite it. If you hear her, break her line of sight. A wardrobe may hide you—unless she saw you enter.';
