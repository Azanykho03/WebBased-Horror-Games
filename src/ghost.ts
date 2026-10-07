import type { GhostState, Position, Progress, Vec3 } from './types.ts';
import type { Navigation } from '../scripts/3d-generation/house-navigation.mjs';
import { difficultySettings } from './difficulty.ts';
import type { Difficulty } from './difficulty.ts';
import { angleDifference } from './corazon-motion.ts';

export interface GhostEnvironment {
  nav: Navigation;
  clearSight(a: Vec3, b: Vec3): boolean;
}
export interface GhostPlayer { position: Position; hidden: boolean; hideExposed: boolean; hidingAt?: Position | null }
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
  difficulty: Difficulty = 'medium';
  get tuning() { return difficultySettings[this.difficulty]; }
  state: GhostState = 'Dormant';
  position: Position = { x: -5.7, y: 0, z: -19, level: 0 };
  yaw = 0;
  speed = 0;
  distanceMoved = 0;
  get attacking(): boolean { return this.attackTime > 0 || this.state === 'Catch'; }
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
  private noticeTime = 0;
  private attackTime = 0;

  reset(active: boolean, player: Position): void {
    this.state = active ? 'Patrol' : 'Dormant';
    // Checkpoints always put the enemy on the other floor or far down the house.
    this.position = player.level === 1 ? { x: -3.2, y: 0, z: -18.2, level: 0 } : { x: 0, y: 3.24, z: -14, level: 1 };
    this.route = []; this.target = this.lastSeen = null;
    this.grace = this.tuning.checkpointGrace; this.immunity = 0; this.stateTime = this.lostSight = this.repath = 0; this.patrolIndex = 0; this.voiceCooldown = 0;
    this.noticeTime = this.attackTime = 0;
    this.speed = this.distanceMoved = 0;
    this.yaw = Math.atan2(player.x - this.position.x, this.position.z - player.z);
  }
  reveal(player: Position, nav: Navigation): void {
    const candidates = [[-5.7, -19], [-2.5, -16.5], [-2.8, -20], [-6.8, -16.5], [-6.3, -20.4]]
      .map(([x, z]) => nav.point(x, z, 0)).filter((p): p is Position => p !== null);
    candidates.sort((a, b) => distance(b, player) - distance(a, player));
    this.position = candidates[0] ?? { x: 0, y: 0, z: -17, level: 0 };
    this.state = 'Patrol'; this.grace = this.tuning.revealGrace; this.route = []; this.target = null;
    this.noticeTime = this.attackTime = 0;
    this.speed = this.distanceMoved = 0;
    this.yaw = Math.atan2(player.x - this.position.x, this.position.z - player.z);
  }
  sees(player: GhostPlayer, env: GhostEnvironment): boolean {
    if (player.hidden || Math.abs(this.position.y - player.position.y) > 1.9) return false;
    const dx = player.position.x - this.position.x, dz = player.position.z - this.position.z, d = Math.hypot(dx, dz);
    if (d > this.tuning.detectionRange) return false;
    if (d > 2 && (Math.sin(this.yaw) * dx - Math.cos(this.yaw) * dz) / d < .35) return false;
    return env.clearSight([this.position.x, this.position.y + 1.45, this.position.z], [player.position.x, player.position.y + 1.45, player.position.z]);
  }
  hear(point: Position, radius: number): void {
    if (this.state === 'Dormant' || this.state === 'Catch' || this.state === 'Stunned' || this.state === 'Chase' || this.grace > 0) return;
    if (distance(this.position, point) > radius * this.tuning.hearingMultiplier) return;
    // Repeated footsteps at the same spot must not restart the first route step.
    const changed = this.state !== 'Investigate' || !this.target || distance(this.target, point) > .5;
    this.transition('Investigate'); this.target = { ...point }; if (changed) this.repath = 0;
  }
  stun(): boolean {
    if (this.state === 'Dormant' || this.state === 'Catch' || this.state === 'Stunned' || this.immunity > 0) return false;
    this.transition('Stunned'); this.route = []; this.immunity = this.tuning.stunImmunity;
    this.speed = this.distanceMoved = 0;
    this.noticeTime = this.attackTime = 0;
    return true;
  }
  private transition(state: GhostState): void { if (this.state !== state) { this.state = state; this.stateTime = 0; } }
  update(dt: number, env: GhostEnvironment, player: GhostPlayer, progress: Progress, say: (event: 'spotted' | 'lost') => void): boolean {
    this.distanceMoved = 0;
    this.difficulty = progress.difficulty;
    const tuning = this.tuning;
    this.grace = Math.max(0, this.grace - dt); this.immunity = Math.max(0, this.immunity - dt);
    this.stateTime += dt; this.repath -= dt; this.voiceCooldown -= dt;
    if (this.state === 'Dormant' || this.state === 'Catch') { this.speed = 0; return false; }
    if (this.state === 'Stunned') {
      this.speed = 0;
      if (this.stateTime >= tuning.stunTime) { this.transition('Search'); this.target = this.lastSeen; this.repath = 0; }
      return false;
    }
    if (this.grace > 0) { this.speed = 0; return false; }
    // A witnessed entry supplies the cabinet's reachable entrance, never x-ray
    // tracking of the concealed body. Patrol/search still runs for unseen entries.
    const witnessed = player.hidden && player.hideExposed && player.hidingAt;
    const quarry: GhostPlayer = witnessed ? { ...player, hidden: false, position: witnessed } : player;
    const visible = witnessed ? env.clearSight([this.position.x, this.position.y + 1.45, this.position.z], [witnessed.x, witnessed.y + 1.45, witnessed.z]) : this.sees(player, env);
    if (visible) {
      this.noticeTime += dt;
      if (this.state !== 'Chase' && this.noticeTime < tuning.reactionTime) { this.speed = 0; return false; }
      if (this.state !== 'Chase' && this.voiceCooldown <= 0) { say('spotted'); this.voiceCooldown = 10; }
      this.transition('Chase'); this.lastSeen = { ...quarry.position }; this.target = this.lastSeen; this.lostSight = 0;
      // Low furniture never makes the player invisible or immune to a nearby ghost.
      const inReach = Math.hypot(this.position.x - quarry.position.x, this.position.z - quarry.position.z) < tuning.attackRange
        && Math.abs(this.position.y - quarry.position.y) < 1.78;
      this.attackTime = inReach ? this.attackTime + dt : 0;
      if (this.attackTime >= tuning.attackWindup) { this.speed = 0; this.transition('Catch'); return true; }
    } else {
      this.noticeTime = this.attackTime = 0;
      if (this.state === 'Chase') {
        this.lostSight += dt;
        if (this.lostSight > tuning.lostSightTime) { this.transition('Search'); this.target = this.lastSeen; if (this.voiceCooldown <= 0) { say('lost'); this.voiceCooldown = 10; } }
      }
    }
    if ((this.state === 'Search' && this.stateTime > tuning.searchTime) || (this.state === 'Investigate' && this.stateTime > tuning.investigateTime)) { this.transition('Patrol'); this.target = null; this.route = []; }
    if (this.state === 'Patrol' && (!this.target || distance(this.position, this.target) < .3)) {
      this.target = patrol[this.patrolIndex++ % patrol.length]; this.repath = 0;
    }
    if (this.target && this.repath <= 0) {
      this.repath = this.state === 'Chase' ? tuning.chaseRepath : 3;
      try { this.route = this.routeToTarget(env.nav, this.target); }
      catch { this.route = []; if (this.state === 'Patrol') this.target = null; }
    }
    if (visible && this.state === 'Chase' && this.route.length <= 2) {
      const end = this.route.at(-1), target = env.nav.point(quarry.position.x, quarry.position.z, quarry.position.level);
      // Track a moving player between repaths on a clear, walkable segment.
      // Keep the normal route around furniture, closed doors and stair turns.
      if (target && (!end || distance(end, target) > .15) && env.nav.segment(this.position, target)) this.route = [target];
    }
    const speed = this.state === 'Chase' ? (progress.cabinet ? tuning.finalChaseSpeed : tuning.chaseSpeed) : this.state === 'Investigate' ? tuning.investigateSpeed : tuning.patrolSpeed;
    while (this.route.length) {
      const next = this.route[0], dx = next.x - this.position.x, dz = next.z - this.position.z, d = Math.hypot(dx, dz);
      if (d < .025) { this.route.shift(); continue; }
      // Turn through the shortest arc, then accelerate along the actual facing.
      // Sharp corners are turns in place, never a backwards or sideways glide.
      const targetYaw = Math.atan2(dx, -dz), error = angleDifference(targetYaw, this.yaw);
      const turn = error * (1 - Math.exp(-12 * dt)), maxTurn = 5.5 * dt;
      this.yaw += Math.max(-maxTurn, Math.min(maxTurn, turn));
      const aligned = Math.abs(angleDifference(targetYaw, this.yaw)) < .22;
      const desiredSpeed = aligned && !this.attacking ? Math.min(speed, d / Math.max(dt, .001)) : 0;
      this.speed += Math.max(-10 * dt, Math.min(6 * dt, desiredSpeed - this.speed));
      const step = aligned ? Math.min(d, this.speed * dt) : 0;
      if (step > 0) {
        const moved = env.nav.move(this.position, Math.sin(this.yaw) * step, -Math.cos(this.yaw) * step, false);
        this.distanceMoved = Math.hypot(moved.x - this.position.x, moved.z - this.position.z);
        if (this.distanceMoved < .00001) { this.route = []; this.repath = 0; this.speed = 0; }
        this.position = moved;
      }
      return false;
    }
    this.speed = Math.max(0, this.speed - 10 * dt);
    if (visible && this.attacking) {
      const turn = angleDifference(Math.atan2(player.position.x - this.position.x, this.position.z - player.position.z), this.yaw) * (1 - Math.exp(-12 * dt));
      this.yaw += Math.max(-5.5 * dt, Math.min(5.5 * dt, turn));
    }
    return false;
  }
  private routeToTarget(nav: Navigation, target: Position): Position[] {
    if (nav.point(target.x, target.z, target.level)) return nav.path(this.position, target);
    // The player can stand on furniture that the ground-bound ghost walks around.
    // Approach its reachable edge using the same pathfinder and closed gates.
    const candidates: Position[] = [];
    for (const radius of [.35, .7, 1.1, 1.6, 2]) for (let i = 0; i < 12; i++) {
      const angle = i * Math.PI / 6, p = nav.point(target.x + Math.sin(angle) * radius, target.z + Math.cos(angle) * radius, target.level);
      if (p) candidates.push(p);
    }
    candidates.sort((a, b) => distance(a, target) + distance(a, this.position) * .15 - distance(b, target) - distance(b, this.position) * .15);
    for (const candidate of candidates.slice(0, 8)) {
      try { return nav.path(this.position, candidate); } catch { /* Try another side of the furniture. */ }
    }
    return [];
  }
}
