import type { GhostState, Position, Progress, Vec3 } from './types.ts';
import type { Navigation } from '../scripts/3d-generation/house-navigation.mjs';

export interface GhostEnvironment {
  nav: Navigation;
  clearSight(a: Vec3, b: Vec3): boolean;
}
export interface GhostPlayer { position: Position; hidden: boolean; hideExposed: boolean }
const distance = (a: Position, b: Position) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const patrol: Position[] = [
  { x: -3.2, y: 0, z: -18.2, level: 0 },
  { x: 3, y: 0, z: -18.2, level: 0 },
  { x: 0, y: 0, z: -10.4, level: 0 },
  { x: -2.3, y: 0, z: -6.1, level: 0 },
  { x: .3, y: 3.24, z: -.85, level: 1 },
  { x: 3, y: 3.24, z: -10.6, level: 1 },
  { x: -3, y: 3.24, z: -10.6, level: 1 },
  { x: 0, y: 3.24, z: -14, level: 1 },
];
export class GhostStateMachine {
  state: GhostState = 'Dormant';
  position: Position = { x: -5.7, y: 0, z: -19, level: 0 };
  yaw = 0;
  grace = 0;
  immunity = 0;
  stateTime = 0;
  private route: Position[] = [];
  private target: Position | null = null;
  private lastSeen: Position | null = null;
  private lostSight = 0;
  private repath = 0;
  private patrolIndex = 0;
  private voiceCooldown = 0;

  reset(active: boolean, player: Position): void {
    this.state = active ? 'Patrol' : 'Dormant';
    // Checkpoints always put the enemy on the other floor or far down the house.
    this.position = player.level === 1 ? { x: -3.2, y: 0, z: -18.2, level: 0 } : { x: 0, y: 3.24, z: -14, level: 1 };
    this.route = []; this.target = this.lastSeen = null;
    this.grace = 12; this.immunity = 0; this.stateTime = this.lostSight = this.repath = 0; this.patrolIndex = 0; this.voiceCooldown = 0;
  }
  reveal(player: Position, nav: Navigation): void {
    const candidates = [[-5.7, -19], [-2.5, -16.5], [-2.8, -20], [-6.8, -16.5], [-6.3, -20.4]]
      .map(([x, z]) => nav.point(x, z, 0)).filter((p): p is Position => p !== null);
    candidates.sort((a, b) => distance(b, player) - distance(a, player));
    this.position = candidates[0] ?? { x: 0, y: 0, z: -17, level: 0 };
    this.state = 'Patrol'; this.grace = 9; this.route = []; this.target = null;
    this.yaw = Math.atan2(player.x - this.position.x, this.position.z - player.z);
  }
  sees(player: GhostPlayer, env: GhostEnvironment): boolean {
    if (player.hidden && !player.hideExposed || Math.abs(this.position.y - player.position.y) > .9) return false;
    const dx = player.position.x - this.position.x, dz = player.position.z - this.position.z, d = Math.hypot(dx, dz);
    if (d > 9.5) return false;
    if (d > 2 && (Math.sin(this.yaw) * dx - Math.cos(this.yaw) * dz) / d < .35) return false;
    return env.clearSight([this.position.x, this.position.y + 1.45, this.position.z], [player.position.x, player.position.y + 1.45, player.position.z]);
  }
  hear(point: Position, radius: number): void {
    if (this.state === 'Dormant' || this.state === 'Catch' || this.state === 'Stunned' || this.state === 'Chase' || this.grace > 0) return;
    if (distance(this.position, point) > radius) return;
    // Repeated footsteps at the same spot must not restart the first route step.
    const changed = this.state !== 'Investigate' || !this.target || distance(this.target, point) > .5;
    this.transition('Investigate'); this.target = { ...point }; if (changed) this.repath = 0;
  }
  stun(): boolean {
    if (this.state === 'Dormant' || this.state === 'Catch' || this.state === 'Stunned' || this.immunity > 0) return false;
    this.transition('Stunned'); this.route = []; this.immunity = 6;
    return true;
  }
  private transition(state: GhostState): void { if (this.state !== state) { this.state = state; this.stateTime = 0; } }
  update(dt: number, env: GhostEnvironment, player: GhostPlayer, progress: Progress, say: (event: 'spotted' | 'lost') => void): boolean {
    this.grace = Math.max(0, this.grace - dt); this.immunity = Math.max(0, this.immunity - dt);
    this.stateTime += dt; this.repath -= dt; this.voiceCooldown -= dt;
    if (this.state === 'Dormant' || this.state === 'Catch') return false;
    if (this.state === 'Stunned') {
      if (this.stateTime >= 2) { this.transition('Search'); this.target = this.lastSeen; this.repath = 0; }
      return false;
    }
    if (this.grace > 0) return false;
    const visible = this.sees(player, env);
    if (visible) {
      if (this.state !== 'Chase' && this.voiceCooldown <= 0) { say('spotted'); this.voiceCooldown = 10; }
      this.transition('Chase'); this.lastSeen = { ...player.position }; this.target = this.lastSeen; this.lostSight = 0;
      if (distance(this.position, player.position) < .72) { this.transition('Catch'); return true; }
    } else if (this.state === 'Chase') {
      this.lostSight += dt;
      if (this.lostSight > 1.35) { this.transition('Search'); this.target = this.lastSeen; if (this.voiceCooldown <= 0) { say('lost'); this.voiceCooldown = 10; } }
    }
    if ((this.state === 'Search' && this.stateTime > 7) || (this.state === 'Investigate' && this.stateTime > 10)) { this.transition('Patrol'); this.target = null; this.route = []; }
    if (this.state === 'Patrol' && (!this.target || distance(this.position, this.target) < .3)) {
      this.target = patrol[this.patrolIndex++ % patrol.length]; this.repath = 0;
    }
    if (this.target && this.repath <= 0) {
      this.repath = this.state === 'Chase' ? .9 : 3;
      try { this.route = env.nav.path(this.position, this.target); }
      catch { this.route = []; if (this.state === 'Patrol') this.target = null; }
    }
    const speed = this.state === 'Chase' ? (progress.cabinet ? 2.7 : 2.4) : this.state === 'Investigate' ? 1.65 : 1.2;
    let remaining = speed * dt;
    while (this.route.length && remaining > 0) {
      const next = this.route[0], dx = next.x - this.position.x, dz = next.z - this.position.z, d = Math.hypot(dx, dz);
      if (d < .035) { this.route.shift(); continue; }
      const step = Math.min(d, remaining), moved = env.nav.move(this.position, dx / d * step, dz / d * step, false);
      if (distance(this.position, moved) < .00001) { this.route = []; this.repath = 0; break; }
      this.yaw = Math.atan2(dx, -dz); this.position = moved; remaining -= step;
    }
    return false;
  }
}
