import type { Difficulty } from './difficulty.ts';
export type Vec3 = [number, number, number];
export type Floor = 0 | 1;
export interface Position { x: number; y: number; z: number; level: Floor }
export type Collider = { id: string; room: string } & (
  { min: Vec3; max: Vec3; center?: never; size?: never; yaw?: never } |
  { center: Vec3; size: Vec3; yaw: number; min?: never; max?: never }
);
export interface HouseManifest {
  version: number; floorRise: number; eyeHeight: number; playerRadius: number; bodyHeight: number;
  rooms: { id: string; name: string; floor: Floor; rects: [number, number, number, number][] }[];
  stair: { rect: [number, number, number, number]; bottom: Vec3; top: Vec3 };
  colliders: Collider[];
  doors: { id: string; source: string; destination: string; position: Vec3; width: number; height: number; axis: 'x' | 'z'; floor: Floor }[];
  lights: { id: string; room: string; position: Vec3; intensity: number; range: number; color: Vec3; period: number; phase: number; electric: boolean }[];
  windows: { room: string; position: Vec3; height: number; width: number; axis: 'x' | 'z'; exterior: boolean }[];
  props: { id: string; room: string; kind: string; position: Vec3; yaw: number }[];
  tour: { name: string; x: number; z: number; floor: Floor }[];
}
export interface Settings {
  volume: number; music: number; ambience: number; effects: number; voice: number; sensitivity: number; touchSensitivity: number; brightness: number;
  subtitles: boolean; reducedFlicker: boolean; reducedMotion: boolean; gentleScares: boolean;
  cleanDialogue: boolean; quality: 'auto' | 'standard' | 'low';
}
export const DEFAULT_SETTINGS: Settings = {
  volume: .65, music: .5, ambience: .55, effects: .75, voice: .8, sensitivity: 1, touchSensitivity: 1, brightness: 1,
  subtitles: true, reducedFlicker: true, reducedMotion: true, gentleScares: false,
  cleanDialogue: false, quality: 'auto',
};
export type Screen = 'loading' | 'menu' | 'difficulty' | 'ready' | 'intro' | 'playing' | 'paused' | 'journal' | 'settings' | 'credits' | 'caught' | 'won' | 'error';
export type Mission = 'M01' | 'M02' | 'M03' | 'M04' | 'M05';
export type ItemId = 'flashlight' | 'note' | 'fuse' | 'locket' | 'letter' | 'music-box' | 'exit-key' | 'battery-kitchen' | 'battery-study' | 'battery-guest' | 'tsinelas';
export type InteractionId = ItemId | 'breaker' | 'cabinet' | 'exit' | 'front-door' | 'bedroom-door' | 'hide-guest' | 'hide-master';
export type GhostState = 'Dormant' | 'Patrol' | 'Investigate' | 'Chase' | 'Search' | 'Stunned' | 'Catch';
export type Checkpoint = 'entrance' | 'breaker' | 'cabinet';
export interface Progress {
  difficulty: Difficulty;
  collected: ItemId[]; power: boolean; cabinet: boolean; exitUnlocked: boolean;
  kitchenSeen: boolean; battery: number; elapsed: number; checkpoint: Checkpoint;
}
export const freshProgress = (difficulty: Difficulty = 'medium'): Progress => ({
  difficulty,
  collected: [], power: false, cabinet: false, exitUnlocked: false,
  kitchenSeen: false, battery: 100, elapsed: 0, checkpoint: 'entrance',
});
export interface Hotspot {
  id: InteractionId; label: string; position: Vec3; room: string;
  kind: 'pickup' | 'note' | 'fixture' | 'door' | 'hide'; radius: number;
}
