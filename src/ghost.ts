import type { GhostState, Position, Progress, Vec3 } from './types.ts';
import type { Navigation } from '../scripts/3d-generation/house-navigation.mjs';
import { difficultySettings } from './difficulty.ts';
import type { Difficulty } from './difficulty.ts';
import { angleDifference } from './corazon-motion.ts';
import type { GhostNavigation } from './ghost-navigation.ts';
import type { HouseDoor } from './fixtures.ts';
import { GRAB } from './grab.ts';

export interface GhostEnvironment {
  nav: Navigation;
  ghostNavigation?: GhostNavigation;
  clearSight(a: Vec3, b: Vec3): boolean;
  canGrab?(player: GhostPlayer, ghost: Position): boolean;
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
  get holding(): boolean { return ['GrabStart', 'Falling', 'Dragging', 'Struggling', 'EscapeKick', 'Releasing', 'Recovering', 'Killing', 'Catch'].includes(this.state); }
  get attacking(): boolean { return this.attackTime > 0 || this.holding; }
  grabProtection = 0;
  grace = 0;
  immunity = 0;
  stateTime = 0;
  // Door handling is one movement substate; chase/search owns the goal and clock.
  doorAction: 'ApproachingDoor' | 'OpeningDoor' | 'WaitingForDoor' | null = null;
  openedDoor: Vec3 | null = null;
  get doorId(): string | null { return this.doorTask?.door.id ?? null; }
  get lastKnownPlayerPosition(): Position | null { return this.lastSeen ? { ...this.lastSeen } : null; }
  get searchRemaining(): number { return this.state === 'Search' ? Math.max(0, this.tuning.searchTime - this.stateTime) : 0; }
  private doorTask: { door: HouseDoor; route: Position[]; approach: Position; time: number } | null = null;
  private searchOrigin: Position | null = null;
  private searchPoints: Position[] = [];
  private searchIndex = 0;
  private searchPause = 0;
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
    this.grabProtection = 0;
    this.clearDoor(); this.searchOrigin = null; this.searchPoints = []; this.searchIndex = this.searchPause = 0; this.openedDoor = null;
    this.speed = this.distanceMoved = 0;
    this.yaw = Math.atan2(player.x - this.position.x, this.position.z - player.z);
  }
  reveal(player: Position, nav: Navigation): void {
    const candidates = [[-5.7, -19], [-2.5, -16.5], [-2.8, -20], [-6.8, -16.5], [-6.3, -20.4]]
      .map(([x, z]) => nav.point(x, z, 0)).filter((p): p is Position => p !== null);
    candidates.sort((a, b) => distance(b, player) - distance(a, player));
    this.position = candidates[0] ?? { x: 0, y: 0, z: -17, level: 0 };
    this.transition('Patrol'); this.stateTime = 0; this.grace = this.tuning.revealGrace; this.route = []; this.target = this.lastSeen = null;
    this.clearDoor(); this.searchOrigin = null; this.searchPoints = []; this.searchIndex = this.searchPause = 0;
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
    if (this.state === 'Dormant' || this.holding || this.state === 'Stunned' || this.state === 'Chase' || this.grace > 0) return;
    if (distance(this.position, point) > radius * this.tuning.hearingMultiplier) return;
    if (this.state === 'Search') {
      // A real sound can redirect the current search, but never renew its timer
      // or overwrite a sight-only last-known position.
      if (!this.target || distance(this.target, point) > .5) { this.target = { ...point }; this.route = []; this.repath = 0; this.clearDoor(); }
      return;
    }
    // Repeated footsteps at the same spot must not restart the first route step.
    const changed = this.state !== 'Investigate' || !this.target || distance(this.target, point) > .5;
    this.transition('Investigate'); this.target = { ...point }; if (changed) this.repath = 0;
  }
  stun(): boolean {
    if (this.state === 'Dormant' || this.holding || this.state === 'Stunned' || this.immunity > 0) return false;
    this.transition('Stunned'); this.route = []; this.immunity = this.tuning.stunImmunity;
    this.speed = this.distanceMoved = 0;
    this.noticeTime = this.attackTime = 0;
    return true;
  }
  private clearDoor(): void { this.doorTask = null; this.doorAction = null; }
  falling(): void { if (this.state === 'GrabStart') this.transition('Falling'); }
  dragging(): void { if (this.state === 'Falling') this.transition('Dragging'); }
  struggle(): void { if (this.state === 'Dragging') this.transition('Struggling'); }
  escapeKick(): void { if (this.state === 'Struggling') this.transition('EscapeKick'); }
  release(): void { if (this.state === 'EscapeKick') this.transition('Releasing'); }
  recover(): void { if (this.state === 'Releasing') this.transition('Recovering'); }
  kill(): void { if (this.holding) this.transition('Killing'); }
  resumeAfterEscape(): void {
    this.transition('Chase'); this.target = this.lastSeen ? { ...this.lastSeen } : null;
    this.attackTime = this.noticeTime = this.lostSight = 0;
    this.grabProtection = GRAB.protectionSeconds; this.speed = this.distanceMoved = 0;
  }
  private transition(state: GhostState): void {
    if (this.state === state) return;
    this.state = state; this.stateTime = 0; this.route = []; this.repath = 0; this.clearDoor();
    if (state !== 'Search') { this.searchOrigin = null; this.searchPoints = []; this.searchPause = 0; }
  }
  private beginSearch(env: GhostEnvironment): void {
    const origin = this.lastSeen ?? this.target ?? this.position;
    this.transition('Search'); this.searchOrigin = { ...origin }; this.target = { ...origin };
    this.searchPoints = env.ghostNavigation?.searchPoints(origin) ?? [];
    if (!env.ghostNavigation) for (const radius of [1.8, 3.3, 5]) for (let i = 0; i < 12; i++) {
      const p = env.nav.point(origin.x + Math.sin(i * Math.PI / 6) * radius, origin.z + Math.cos(i * Math.PI / 6) * radius, origin.level);
      if (p) this.searchPoints.push(p);
    }
    this.searchIndex = 0; this.searchPause = 0; this.route = []; this.repath = 0;
  }
  private nextSearchPoint(env: GhostEnvironment): void {
    for (let i = 0; i < this.searchPoints.length; i++) {
      const point = this.searchPoints[this.searchIndex++ % this.searchPoints.length];
      if (distance(point, this.position) < 1) continue;
      try {
        const route = this.routeToTarget(env, point);
        if (!route.length) continue;
        this.target = { ...point }; this.route = route; this.repath = 3; return;
      } catch { /* A newly locked door may remove this candidate. */ }
    }
    this.searchPause = .8;
  }
  update(dt: number, env: GhostEnvironment, player: GhostPlayer, progress: Progress, say: (event: 'spotted' | 'lost') => void): boolean {
    this.distanceMoved = 0;
    this.openedDoor = null;
    this.difficulty = progress.difficulty;
    const tuning = this.tuning;
    this.grace = Math.max(0, this.grace - dt); this.immunity = Math.max(0, this.immunity - dt);
    this.grabProtection = Math.max(0, this.grabProtection - dt);
    this.stateTime += dt; this.repath -= dt; this.voiceCooldown -= dt;
    if (this.state === 'Dormant' || this.holding) { this.speed = 0; return false; }
    if (this.state === 'Stunned') {
      this.speed = 0;
      if (this.stateTime >= tuning.stunTime) this.beginSearch(env);
      return false;
    }
    if (this.grace > 0) { this.speed = 0; return false; }
    // Only a completed hide suppresses sight. Witness metadata never grants
    // x-ray tracking or a capture through the cabinet.
    const visible = this.sees(player, env);
    if (visible) {
      this.lastSeen = { ...player.position };
      this.noticeTime += dt;
      if (this.state !== 'Chase' && this.state !== 'Search' && this.noticeTime < tuning.reactionTime) { this.speed = 0; return false; }
      if (this.state !== 'Chase' && this.voiceCooldown <= 0) { say('spotted'); this.voiceCooldown = 10; }
      this.transition('Chase'); this.target = { ...this.lastSeen }; this.lostSight = 0;
      const gap = Math.hypot(this.position.x - player.position.x, this.position.z - player.position.z);
      if (env.canGrab && gap < GRAB.minimumDistance && Math.abs(this.position.y - player.position.y) < .1) {
        // A player can run into her between frames. Regain arm-length spacing
        // through navigation before winding up, instead of intersecting bodies.
        const ux = gap > .001 ? (this.position.x - player.position.x) / gap : Math.sin(this.yaw),
          uz = gap > .001 ? (this.position.z - player.position.z) / gap : -Math.cos(this.yaw);
        const step = Math.min(GRAB.minimumDistance - gap + .005, dt * 1.4), before = this.position;
        this.position = env.nav.move(before, ux * step, uz * step, false);
        this.distanceMoved = distance(before,this.position); this.speed = dt > 0 ? this.distanceMoved / dt : 0;
        this.attackTime = 0; this.face(player.position,dt); return false;
      }
      // Low furniture never makes the player invisible or immune to a nearby ghost.
      const inReach = Math.hypot(this.position.x - player.position.x, this.position.z - player.position.z) < tuning.attackRange
        && Math.abs(this.position.y - player.position.y) < 1.78 && (env.canGrab?.(player, this.position) ?? true);
      this.attackTime = inReach && this.grabProtection === 0 ? this.attackTime + dt : 0;
      if (this.attackTime >= tuning.attackWindup) { this.speed = 0; this.distanceMoved = 0; this.transition('GrabStart'); return true; }
      if (this.attackTime > 0) { this.speed = 0; this.distanceMoved = 0; this.face(player.position, dt); return false; }
    } else {
      this.noticeTime = this.attackTime = 0;
      if (this.state === 'Chase') {
        this.lostSight += dt;
        if (player.hidden || this.lostSight > tuning.lostSightTime) { this.beginSearch(env); if (this.voiceCooldown <= 0) { say('lost'); this.voiceCooldown = 10; } }
      }
    }
    if ((this.state === 'Search' && this.stateTime >= tuning.searchTime) || (this.state === 'Investigate' && this.stateTime > tuning.investigateTime)) { this.transition('Patrol'); this.target = null; }
    if (this.state === 'Search' && !this.searchOrigin) this.beginSearch(env);
    if (this.doorTask && this.updateDoor(dt, env)) return false;
    if (this.state === 'Search' && !this.target) {
      if (this.searchPause > 0) { this.searchPause -= dt; this.yaw += dt * .45; this.speed = 0; return false; }
      this.nextSearchPoint(env);
    }
    if (this.state === 'Patrol' && (!this.target || distance(this.position, this.target) < .3)) {
      this.target = patrol[this.patrolIndex++ % patrol.length]; this.repath = 0;
    }
    if (this.target && this.repath <= 0) {
      this.repath = this.state === 'Chase' ? tuning.chaseRepath : 3;
      try { this.route = this.routeToTarget(env, this.target); }
      catch { this.route = []; if (this.state === 'Patrol' || this.state === 'Search') this.target = null; }
    }
    if (visible && this.state === 'Chase' && this.route.length <= 2) {
      const end = this.route.at(-1), target = env.nav.point(player.position.x, player.position.z, player.position.level);
      // Track a moving player between repaths on a clear, walkable segment.
      // Keep the normal route around furniture, closed doors and stair turns.
      if (target && (!end || distance(end, target) > .15) && env.nav.segment(this.position, target)) this.route = [target];
    }
    const door = env.ghostNavigation?.blockingDoor(this.position, this.route);
    if (door) {
      const approach = env.ghostNavigation!.approach(door, this.position);
      if (approach?.length) {
        this.doorTask = { door, route: approach, approach: approach[approach.length - 1], time: 0 }; this.doorAction = 'ApproachingDoor';
        this.updateDoor(dt, env); return false;
      }
    }
    const speed = this.state === 'Chase' ? (progress.cabinet ? tuning.finalChaseSpeed : tuning.chaseSpeed) : this.state === 'Investigate' ? tuning.investigateSpeed : tuning.patrolSpeed;
    this.moveRoute(dt, env.nav, this.route, speed);
    if (this.state === 'Search' && !this.route.length) { this.target = null; this.searchPause = .65; }
    if (visible && this.attacking) this.face(player.position, dt);
    return false;
  }
  private face(point: Position, dt: number): void {
    const targetYaw = Math.atan2(point.x - this.position.x, this.position.z - point.z);
    const turn = angleDifference(targetYaw, this.yaw) * (1 - Math.exp(-12 * dt));
    this.yaw += Math.max(-5.5 * dt, Math.min(5.5 * dt, turn));
  }
  private updateDoor(dt: number, env: GhostEnvironment): boolean {
    const task = this.doorTask!, access = env.ghostNavigation;
    task.time += dt;
    if (!access?.canOpen(task.door) || task.door.hinge.state === 'OPEN' || task.time > 8) {
      const timedOut = task.time > 8; this.clearDoor(); this.route = []; this.repath = timedOut ? 1 : 0;
      if (timedOut && this.state === 'Search') this.target = null;
      return timedOut;
    }
    if (distance(this.position, task.approach) > .12) {
      this.doorAction = 'ApproachingDoor';
      if (!task.route.length) { this.clearDoor(); this.route = []; this.repath = .5; return true; }
      this.moveRoute(dt, env.nav, task.route, Math.min(1.5, this.tuning.investigateSpeed)); return true;
    }
    this.speed = 0;
    const at = { x: task.door.root.position.x, y: task.door.root.position.y, z: task.door.root.position.z, level: this.position.level };
    this.face(at, dt);
    const facing = Math.abs(angleDifference(Math.atan2(at.x - this.position.x, this.position.z - at.z), this.yaw)) < .25;
    if (task.door.hinge.state === 'CLOSED' && facing && task.door.hinge.request(true)) {
      this.openedDoor = [at.x, at.y + 1.12, at.z]; this.doorAction = 'OpeningDoor';
    } else this.doorAction = 'WaitingForDoor';
    return true;
  }
  private moveRoute(dt: number, nav: Navigation, route: Position[], speed: number): void {
    while (route.length) {
      const next = route[0], dx = next.x - this.position.x, dz = next.z - this.position.z, d = Math.hypot(dx, dz);
      if (d < .025) { route.shift(); continue; }
      // Turn through the shortest arc, then accelerate along the actual facing.
      // Sharp corners are turns in place, never a backwards or sideways glide.
      const targetYaw = Math.atan2(dx, -dz), error = angleDifference(targetYaw, this.yaw);
      const turn = error * (1 - Math.exp(-12 * dt)), maxTurn = 5.5 * dt;
      this.yaw += Math.max(-maxTurn, Math.min(maxTurn, turn));
      const aligned = Math.abs(angleDifference(targetYaw, this.yaw)) < .22;
      const protectedNearby = this.state === 'Chase' && this.grabProtection > 0 && this.target && distance(this.position, this.target) < 1.15;
      const desiredSpeed = aligned && !this.attacking && !protectedNearby ? Math.min(speed, d / Math.max(dt, .001)) : 0;
      this.speed += Math.max(-10 * dt, Math.min(6 * dt, desiredSpeed - this.speed));
      const step = aligned ? Math.min(d, this.speed * dt) : 0;
      if (step > 0) {
        const moved = nav.move(this.position, Math.sin(this.yaw) * step, -Math.cos(this.yaw) * step, false);
        this.distanceMoved = Math.hypot(moved.x - this.position.x, moved.z - this.position.z);
        if (this.distanceMoved < .00001) { route.length = 0; this.repath = .35; this.speed = 0; }
        this.position = moved;
      }
      return;
    }
    this.speed = Math.max(0, this.speed - 10 * dt);
  }
  private routeToTarget(env: GhostEnvironment, target: Position): Position[] {
    const nav = env.ghostNavigation?.planner ?? env.nav;
    const path = (point: Position) => env.ghostNavigation ? env.ghostNavigation.path(this.position, point) : nav.path(this.position, point);
    if (nav.point(target.x, target.z, target.level)) return path(target);
    // The player can stand on furniture that the ground-bound ghost walks around.
    // Approach its reachable edge using the same pathfinder and closed gates.
    const candidates: Position[] = [];
    for (const radius of [.35, .7, 1.1, 1.6, 2]) for (let i = 0; i < 12; i++) {
      const angle = i * Math.PI / 6, p = nav.point(target.x + Math.sin(angle) * radius, target.z + Math.cos(angle) * radius, target.level);
      if (p) candidates.push(p);
    }
    candidates.sort((a, b) => distance(a, target) + distance(a, this.position) * .15 - distance(b, target) - distance(b, this.position) * .15);
    for (const candidate of candidates.slice(0, 8)) {
      try { return path(candidate); } catch { /* Try another side of the furniture. */ }
    }
    return [];
  }
}
