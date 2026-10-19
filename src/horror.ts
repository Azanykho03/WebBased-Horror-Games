import type { GhostState, HouseManifest, Position, Vec3 } from './types.ts';
import { GHOST_PROFILE } from './config.ts';
import type { VoiceCue } from './config.ts';
import { difficultySettings } from './difficulty.ts';
import type { Difficulty } from './difficulty.ts';

export type Soundscape = 'CALM_EXPLORATION' | 'UNEASY' | 'CELESTINA_NEARBY' | 'CELESTINA_DETECTED_PLAYER' | 'CHASE' | 'HIDING' | 'JUMPSCARE' | 'POST_JUMPSCARE' | 'GAME_OVER' | 'ENDING';
export type Surface = 'wood' | 'tile' | 'concrete' | 'metal' | 'dirt';
export type HauntKind = 'creak' | 'knock' | 'scratch' | 'footsteps' | 'window' | 'object' | 'curtain' | 'radio' | 'whisper' | 'silence' | 'light' | 'shadow' | 'apparition' | 'door' | 'thunder' | 'piano' | 'drip' | 'glass' | 'paper' | 'metal';
export interface HauntEvent {
  kind: HauntKind; room: string; position: Vec3; duration: number; strength: number;
  caption: string; voice?: VoiceCue; delay?: number;
}
export interface HorrorInput {
  room: string; player: Position; eye: Vec3; direction: Vec3;
  ghost: Position | null; ghostState: GhostState; ghostGrace: number; ghostOccluded: boolean;
  hidden: boolean; sprinting: boolean; stamina: number; suppressed: boolean;
}
export interface Atmosphere {
  state: Soundscape; proximity: number; fear: number; exertion: number; silence: number;
}
export const calmAtmosphere = (): Atmosphere => ({ state: 'CALM_EXPLORATION', proximity: 0, fear: 0, exertion: 0, silence: 0 });
export const clamp = (n: number, min = 0, max = 1) => Math.max(min, Math.min(max, n));
const smooth = (value: number, target: number, dt: number, seconds: number) => value + (target - value) * (1 - Math.exp(-dt / seconds));

// Coarse, filtered pressure; this is deliberately not an exact enemy radar.
export function ghostProximity(player: Position, ghost: Position | null, occluded: boolean): number {
  if (!ghost) return 0;
  const distance = Math.hypot(player.x - ghost.x, (player.y - ghost.y) * 2.5, player.z - ghost.z);
  return clamp((14 - distance) / 11) * (occluded ? .55 : 1);
}
export function surfaceForRoom(room: string, position?: Position): Surface {
  if (['F01', 'F04', 'F05', 'F06', 'F07', 'F08', 'F09', 'U05', 'U07'].includes(room)) return 'tile';
  if (room === 'U01' && position && position.x > 6.7 && position.z > -2.8) return 'tile';
  if (room === 'OUT') return 'concrete';
  return 'wood';
}
export function soundDirection(eye: Vec3, forward: Vec3, source: Vec3): string {
  const dx = source[0] - eye[0], dz = source[2] - eye[2];
  if (source[1] - eye[1] > 1.5) return 'upstairs';
  if (eye[1] - source[1] > 2.5) return 'downstairs';
  const along = dx * forward[0] + dz * forward[2], side = -dx * forward[2] + dz * forward[0];
  if (Math.abs(side) > Math.abs(along) * .8) return side > 0 ? 'to your right' : 'to your left';
  return along < 0 ? 'behind you' : 'ahead';
}
export const WHISPERS = ['Turn around.', 'I can hear you breathing.', 'I am closer than you think.', 'I see you.', 'You should never have come here.', 'This house remembers you.', 'Do not look behind you.', 'I have been waiting for you.'];
const unsettling = new Set(['F06', 'F07', 'F08', 'U00', 'U03', 'U06']);

// One simulation-clock scheduler. Pause freezes it; retry resets every pending event.
// It never changes navigation, objectives, inventory, or the real ghost's position.
export class HorrorDirector {
  difficulty: Difficulty = 'medium';
  atmosphere = calmAtmosphere();
  private data: HouseManifest;
  private random: () => number;
  private clock = 0;
  private nextEvent = 18;
  private nextStorm = 38;
  private quiet = 0;
  private quietWhisper = 0;
  private scareTime = 0;
  private recovery = 0;
  private detection = 0;
  private previousGhost: GhostState = 'Dormant';
  private recent: HauntKind[] = [];
  private cooldown = new Map<HauntKind, number>();
  private whisperHistory = new Map<number, number>();
  private lastWhisper = -1;
  constructor(data: HouseManifest, random = Math.random) { this.data = data; this.random = random; }
  private between(a: number, b: number): number { return a + clamp(this.random(), 0, .999999) * (b - a); }
  private pick<T>(items: T[]): T { return items[Math.floor(this.between(0, items.length))]; }
  reset(): void {
    this.atmosphere = calmAtmosphere(); this.clock = 0;
    this.nextEvent = this.between(16, 25) * difficultySettings[this.difficulty].encounterInterval; this.nextStorm = this.between(30, 52);
    this.quiet = this.quietWhisper = this.scareTime = this.recovery = this.detection = 0;
    this.previousGhost = 'Dormant'; this.recent = []; this.cooldown.clear(); this.whisperHistory.clear(); this.lastWhisper = -1;
  }
  silence(seconds: number): void { this.quiet = Math.max(this.quiet, seconds); }
  scare(seconds: number): void { this.scareTime = seconds; this.recovery = seconds + 8; this.quietWhisper = 0; }
  recover(): void { this.recovery = Math.max(this.recovery, 7); this.nextEvent = Math.max(this.nextEvent, 18); }
  update(dt: number, input: HorrorInput): { atmosphere: Atmosphere; events: HauntEvent[] } {
    const events: HauntEvent[] = [];
    this.clock += dt;
    this.quiet = Math.max(0, this.quiet - dt); this.scareTime = Math.max(0, this.scareTime - dt);
    this.recovery = Math.max(0, this.recovery - dt); this.detection = Math.max(0, this.detection - dt);
    if (input.ghostState === 'Chase' && this.previousGhost !== 'Chase') this.detection = .85;
    this.previousGhost = input.ghostState;
    const a = this.atmosphere;
    a.proximity = smooth(a.proximity, ghostProximity(input.player, input.ghost, input.ghostOccluded), dt, 1.7);
    a.exertion = smooth(a.exertion, Math.max(input.sprinting ? .7 : 0, 1 - input.stamina / 6), dt, 2.5);
    const pressure = a.proximity > .6 ? .65 : a.proximity > .2 ? .32 : 0;
    const held = ['GrabStart', 'Falling', 'Dragging', 'Struggling', 'EscapeKick', 'Releasing', 'Recovering', 'Killing', 'Catch'].includes(input.ghostState);
    const threat = input.ghostState === 'Chase' || held ? 1 : pressure;
    a.fear = smooth(a.fear, Math.max(threat, this.recovery > 0 ? .55 : 0, input.hidden && a.proximity > .1 ? .5 : 0), dt, threat > a.fear ? 1.2 : 7);
    a.silence = smooth(a.silence, this.quiet > 0 ? 1 : 0, dt, this.quiet > 0 ? .7 : 2.7);
    a.state = this.scareTime > 0 ? 'JUMPSCARE' : input.hidden ? 'HIDING' : this.detection > 0 ? 'CELESTINA_DETECTED_PLAYER' : input.ghostState === 'Chase' ? 'CHASE' : this.recovery > 0 ? 'POST_JUMPSCARE' : a.proximity > .28 ? 'CELESTINA_NEARBY' : unsettling.has(input.room) || a.fear > .25 ? 'UNEASY' : 'CALM_EXPLORATION';
    if (input.suppressed || this.scareTime > 0 || held) return { atmosphere: { ...a }, events };
    if (this.quietWhisper > 0) {
      this.quietWhisper -= dt;
      if (this.quietWhisper <= 0 && input.ghostState !== 'Chase') events.push(this.whisper(input, true));
    }
    this.nextStorm -= dt;
    if (this.nextStorm <= 0 && input.ghostState !== 'Chase' && this.recovery === 0 && this.quiet === 0) {
      const window = this.data.windows.find(w => w.room === input.room);
      events.push({ kind: 'thunder', room: input.room, position: window ? [...window.position] : [input.player.x + 10, 9, input.player.z - 12], duration: 4, strength: this.between(.35, .8), delay: this.between(.8, 2.1), caption: 'Lightning outside. Thunder rolls across the roof.' });
      this.nextStorm = this.between(42, 95); this.nextEvent = Math.max(this.nextEvent, 8);
    }
    this.nextEvent -= dt;
    if (this.nextEvent > 0 || input.ghostState === 'Chase' || this.recovery > 0 || input.ghostGrace > 0) return { atmosphere: { ...a }, events };
    this.nextEvent = this.between(25, 55) * (a.proximity > .5 ? .85 : 1) * difficultySettings[this.difficulty].encounterInterval;
    const kinds: HauntKind[] = input.hidden ? ['creak', 'knock', 'footsteps', 'whisper', 'silence'] : ['creak', 'knock', 'scratch', 'footsteps', 'object', 'whisper', 'silence', 'light'];
    if (!input.hidden) {
      const local: Record<string, HauntKind> = { F02: 'piano', F05: 'drip', F07: 'drip', F08: 'glass', F09: 'metal', U00: 'glass', U01: 'paper', U02: 'paper', U05: 'drip', U07: 'metal' };
      if (local[input.room]) kinds.push(local[input.room]);
      if (this.data.windows.some(w => w.room === input.room)) kinds.push('window', 'curtain');
      if (input.room === 'F06') kinds.push('radio');
      if (input.room === 'F01') kinds.push('door');
      if (['F01', 'F08', 'U00'].includes(input.room)) kinds.push('shadow');
      if (input.ghost && !input.hidden && input.ghostOccluded && a.proximity < .5 && ['F01', 'F08', 'U00'].includes(input.room)) kinds.push('apparition');
    }
    const eligible = kinds.filter(kind => !this.recent.includes(kind) && (this.cooldown.get(kind) ?? 0) <= this.clock);
    if (!eligible.length) return { atmosphere: { ...a }, events };
    const kind = this.pick(eligible), event = this.makeEvent(kind, input);
    this.recent.push(kind); if (this.recent.length > 4) this.recent.shift();
    this.cooldown.set(kind, this.clock + (['silence', 'apparition', 'shadow'].includes(kind) ? 120 : 65));
    if (kind === 'silence') { this.silence(7); this.quietWhisper = 3.5; }
    events.push(event);
    return { atmosphere: { ...a }, events };
  }
  private source(input: HorrorInput): Vec3 {
    const room = this.data.rooms.find(r => r.id === input.room);
    const doors = this.data.doors.filter(d => d.source === input.room || d.destination === input.room);
    if (doors.length) { const p = this.pick(doors).position; return [p[0], p[1] + 1.2, p[2]]; }
    const rect = room?.rects[0];
    return rect ? [(rect[0] + rect[1]) / 2, input.player.y + 1.2, (rect[2] + rect[3]) / 2] : [...input.eye];
  }
  private whisper(input: HorrorInput, behind = false): HauntEvent {
    const eligible = WHISPERS.map((_, i) => i).filter(i => i !== this.lastWhisper && (this.whisperHistory.get(i) ?? 0) <= this.clock);
    const line = this.pick(eligible.length ? eligible : WHISPERS.map((_, i) => i).filter(i => i !== this.lastWhisper));
    this.lastWhisper = line; this.whisperHistory.set(line, this.clock + 120);
    let position = this.source(input);
    if (behind) position = [input.eye[0] - input.direction[0] * 2.7, input.eye[1], input.eye[2] - input.direction[2] * 2.7];
    else if (input.ghost && this.random() < .55) position = [input.ghost.x, input.ghost.y + 1.5, input.ghost.z];
    return { kind: 'whisper', room: input.room, position, duration: 3, strength: this.between(.45, .75), voice: `whisper-${line + 1}` as VoiceCue, caption: `${GHOST_PROFILE.name}, ${soundDirection(input.eye, input.direction, position)}: “${WHISPERS[line]}”` };
  }
  private makeEvent(kind: HauntKind, input: HorrorInput): HauntEvent {
    if (kind === 'whisper') return this.whisper(input);
    let position = this.source(input), room = input.room;
    if (kind === 'window' || kind === 'curtain') { const w = this.pick(this.data.windows.filter(w => w.room === room)); position = [w.position[0], w.position[1] + .6, w.position[2]]; }
    if (kind === 'radio') position = [-4.2, 1.2, -11.4];
    if (kind === 'piano') position = [4.27, .9, -6.48];
    if (kind === 'drip') {
      const basin = this.data.props.find(p => p.room === room && p.kind === 'basin');
      position = basin ? [basin.position[0], basin.position[1] + .8, basin.position[2]] : [-5.8, 1.1, -21.3];
    }
    if (kind === 'glass') {
      const cabinet = this.data.props.find(p => p.room === room && p.kind.includes('cabinet'));
      if (cabinet) position = [cabinet.position[0], cabinet.position[1] + 1.3, cabinet.position[2]];
    }
    if (kind === 'door') position = [0, 1.1, -.06];
    if (kind === 'footsteps' && input.player.level === 0 && this.random() < .5) { position = [0, 3.4, clamp(input.player.z, -19, -3)]; room = 'U00'; }
    if (kind === 'apparition' || kind === 'shadow') {
      // Fixed clear corridor points; no apparition in the player's collision capsule.
      const z = input.player.z > -11 ? -17 : -4;
      position = [0, input.player.level * this.data.floorRise, z];
      room = input.player.level === 1 ? 'U00' : z < -12 ? 'F08' : 'F01';
    }
    const captions: Record<HauntKind, string> = {
      creak: 'Old timber groans.', knock: 'Three knocks. No answer.', scratch: 'Scratching travels inside the wall.',
      footsteps: 'Uneven footsteps cross an empty passage.', window: 'A branch rattles the rain-soaked window.', object: 'Something falls in the dark.',
      curtain: 'A cold draft lifts the curtain.', radio: 'The dead television murmurs, then loses its signal.', whisper: '',
      silence: 'The rain recedes. The house holds its breath.', light: 'A bulb slowly dims, then recovers.', shadow: 'A shadow passes down the hall.',
      apparition: 'A familiar figure waits at the end of the passage.', door: 'The front door shudders against its latch.', thunder: 'Thunder rolls across the roof.',
      piano: 'One low piano note. Nobody at the keys.', drip: 'Water drips into a cracked basin.', glass: 'Glass rattles inside the cabinet.', paper: 'A page turns on the abandoned desk.', metal: 'A loose metal fitting ticks in the dark.',
    };
    return { kind, room, position, duration: kind === 'silence' ? 7 : kind === 'apparition' ? 2.8 : 4.5, strength: this.between(.4, .75), caption: `${captions[kind]}${['silence', 'light', 'apparition', 'shadow'].includes(kind) ? '' : ` (${soundDirection(input.eye, input.direction, position)})`}` };
  }
}
