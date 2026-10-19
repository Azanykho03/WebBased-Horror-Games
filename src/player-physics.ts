import type { Navigation } from '../scripts/3d-generation/house-navigation.mjs';
import type { Collider, Floor, HouseManifest, Position, Vec3 } from './types.ts';

export const JUMP = { velocity: 5.4, gravity: 15, terminalVelocity: 18, stepHeight: .20 } as const;
const EPSILON = .0001;
type Box = { id: string; room: string; center: Vec3; size: Vec3; yaw: number };
const box = (c: Collider): Box => c.center ? c : {
  id: c.id, room: c.room, yaw: 0,
  center: c.min.map((v, i) => (v + c.max[i]) / 2) as Vec3,
  size: c.min.map((v, i) => c.max[i] - v) as Vec3,
};

/** Player shapes refine the original manifest; ghost navigation keeps its proven footprint. */
export function playerSolids(data: HouseManifest): Collider[] {
  const props = new Map(data.props.map(p => [p.id, p]));
  const result: Collider[] = [];
  for (const source of data.colliders) {
    const c = box(source), prop = props.get(c.id), base = c.center[1] - c.size[1] / 2;
    const part = (name: string, x: number, y: number, z: number, size: Vec3) => {
      const co = Math.cos(c.yaw), si = Math.sin(c.yaw);
      result.push({ id: `${c.id}-${name}`, room: c.room, yaw: c.yaw, size,
        center: [c.center[0] + x * co + z * si, base + y, c.center[2] - x * si + z * co] });
    };
    if (prop?.kind === 'dining-chair') {
      part('seat', 0, .265, .015, [.52, .53, .5]);
      part('back', 0, .76, -.225, [.52, .56, .06]);
    } else if (prop?.kind === 'bed') {
      part('mattress', 0, .35, 0, [c.size[0] - .1, .70, c.size[2] - .1]);
      part('headboard', 0, .75, -(c.size[2] - .1) / 2, [c.size[0], 1.5, .10]);
      part('footboard', 0, .39, (c.size[2] - .1) / 2, [c.size[0], .78, .10]);
    } else if (prop?.kind === 'sofa' || prop?.kind === 'armchair') {
      part('seat', 0, .30, 0, [c.size[0], .60, .94]);
      part('back', 0, .71, -.37, [c.size[0], .72, .22]);
      for (const side of [-1, 1]) part(`arm-${side}`, side * (c.size[0] / 2 - .075), .67, 0, [.15, .46, .96]);
    } else result.push(source);
  }
  // These rectangles match the authored floor/ceiling slabs in generate_house.py.
  // The ground ceiling has four pieces so the stairwell remains open.
  const slab = (id: string, room: string, r: number[], bottom: number, top: number) =>
    result.push({ id, room, min: [r[0], bottom, r[2]], max: [r[1], top, r[3]] });
  for (const room of data.rooms) {
    if (room.id === 'F03') continue;
    for (const [i, rect] of room.rects.entries()) {
      // The continuous stair support uses the existing navigation ramp.
      slab(`${room.id}-floor-${i}`, room.id, rect, room.floor * data.floorRise - .2, room.floor * data.floorRise);
      if (room.floor === 1 && room.id !== 'U07') slab(`${room.id}-ceiling-${i}`, room.id, rect, data.floorRise + 3.05, data.floorRise + 3.17);
    }
  }
  for (const [i, r] of [[-7.6, 1.4, -22, 0], [3.4, 9.4, -22, 0], [1.4, 3.4, -22, -6.1], [1.4, 3.4, -1.6, 0]].entries())
    slab(`ground-ceiling-${i}`, 'F01', r, 2.985, 3.065);
  // Windows were visual openings in the walking-only controller. They remain solid.
  for (const [i, w] of data.windows.entries()) {
    const size: Vec3 = w.axis === 'x' ? [w.width, w.height, .03] : [.03, w.height, w.width];
    result.push({ id: `window-glass-${i}`, room: w.room, center: [w.position[0], w.position[1] + w.height / 2, w.position[2]], size, yaw: 0 });
  }
  return result;
}

type Support = { y: number; level: Floor };
/** Vertical cylinder against the house's oriented boxes, using spatial buckets. */
export class PlayerCollision {
  private staticSolids: Collider[];
  private buckets = new Map<string, Box[]>();
  readonly data: HouseManifest;
  private nav: Navigation;
  constructor(data: HouseManifest, nav: Navigation) {
    this.data = data; this.nav = nav;
    this.staticSolids = playerSolids(data); this.setDynamicColliders([]);
  }
  setDynamicColliders(dynamic: Collider[]): void {
    this.buckets.clear();
    for (const c of this.staticSolids.concat(dynamic).map(box)) {
      const co = Math.abs(Math.cos(c.yaw)), si = Math.abs(Math.sin(c.yaw));
      const rx = (co * c.size[0] + si * c.size[2]) / 2 + this.data.playerRadius;
      const rz = (si * c.size[0] + co * c.size[2]) / 2 + this.data.playerRadius;
      for (let x = Math.floor((c.center[0] - rx) / 2); x <= Math.floor((c.center[0] + rx) / 2); x++)
        for (let z = Math.floor((c.center[2] - rz) / 2); z <= Math.floor((c.center[2] + rz) / 2); z++) {
          const key = `${x},${z}`, list = this.buckets.get(key) ?? [];
          list.push(c); this.buckets.set(key, list);
        }
    }
  }
  private overlaps(x: number, z: number, c: Box): boolean {
    const co = Math.cos(c.yaw), si = Math.sin(c.yaw), dx = x - c.center[0], dz = z - c.center[2];
    const px = dx * co - dz * si, pz = dx * si + dz * co;
    const qx = Math.max(0, Math.abs(px) - c.size[0] / 2), qz = Math.max(0, Math.abs(pz) - c.size[2] / 2);
    return qx * qx + qz * qz < this.data.playerRadius ** 2 - EPSILON ** 2;
  }
  private local(x: number, z: number): Box[] {
    return (this.buckets.get(`${Math.floor(x / 2)},${Math.floor(z / 2)}`) ?? []).filter(c => this.overlaps(x, z, c));
  }
  blocked(p: Position): boolean {
    return this.local(p.x, p.z).some(c => p.y < c.center[1] + c.size[1] / 2 - EPSILON && p.y + this.data.bodyHeight > c.center[1] - c.size[1] / 2 + EPSILON);
  }
  support(p: Position, maxY = p.y + EPSILON): Support | null {
    const supports: Support[] = [];
    for (const level of [0, 1] as const) {
      const y = this.nav.height(p.x, p.z, level);
      if (y !== null && y <= maxY) supports.push({ y, level });
    }
    for (const c of this.local(p.x, p.z)) {
      const y = c.center[1] + c.size[1] / 2;
      if (y <= maxY) supports.push({ y, level: c.room.startsWith('U') ? 1 : 0 });
    }
    return supports.sort((a, b) => b.y - a.y)[0] ?? null;
  }
  horizontal(p: Position, dx: number, dz: number, grounded: boolean): Position {
    let current = { ...p };
    const tryStep = (x: number, z: number) => {
      // Stay within the authored playable footprint, even while airborne.
      const heights = ([0, 1] as const).map(level => ({ level, y: this.nav.height(x, z, level) })).filter(s => s.y !== null);
      if (!heights.length) return false;
      const next = { ...current, x, z };
      if (grounded) {
        for (const c of this.local(x, z)) if (c.id.includes('-floor-'))
          heights.push({ level: c.room.startsWith('U') ? 1 : 0, y: c.center[1] + c.size[1] / 2 });
        const floor = heights.sort((a, b) => b.y! - a.y!).find(s => Math.abs(s.y! - current.y) <= JUMP.stepHeight);
        if (floor) { next.y = floor.y!; next.level = floor.level; }
      }
      // A rising stair surface is solid even during a jump.
      const stair = this.nav.height(x, z, 0);
      if (stair !== null && stair > 0 && next.y < stair - EPSILON) return false;
      if (this.local(x, z).some(c => {
        if (next.y >= c.center[1] + c.size[1] / 2 - EPSILON || next.y + this.data.bodyHeight <= c.center[1] - c.size[1] / 2 + EPSILON) return false;
        // Controlled hiding moves inside a synthetic navigation reservation.
        // If a grab interrupts that move, permit gradual outward recovery from
        // the existing overlap. Entry stays blocked; real panels/walls always win.
        const leavingReservation = c.id.endsWith('-reserved') && this.overlaps(current.x, current.z, c)
          && current.y < c.center[1] + c.size[1] / 2 - EPSILON && current.y + this.data.bodyHeight > c.center[1] - c.size[1] / 2 + EPSILON
          && (x - c.center[0]) ** 2 + (z - c.center[2]) ** 2 > (current.x - c.center[0]) ** 2 + (current.z - c.center[2]) ** 2 + 1e-9;
        return !leavingReservation;
      })) return false;
      current = next; return true;
    };
    if (!tryStep(p.x + dx, p.z + dz)) { tryStep(current.x + dx, current.z); tryStep(current.x, current.z + dz); }
    return current;
  }
  vertical(p: Position, dy: number): { position: Position; grounded: boolean; hit: boolean } {
    const position = { ...p, y: p.y + dy };
    let hit = false, grounded = false;
    if (dy <= 0) {
      const ground = this.support(p);
      if (ground && position.y <= ground.y + EPSILON) {
        position.y = ground.y; position.level = ground.level; hit = grounded = true;
      }
    } else {
      const head = p.y + this.data.bodyHeight;
      for (const c of this.local(p.x, p.z)) {
        const bottom = c.center[1] - c.size[1] / 2;
        if (bottom >= head - EPSILON && bottom < position.y + this.data.bodyHeight) {
          position.y = bottom - this.data.bodyHeight; hit = true;
        }
      }
    }
    return { position, grounded, hit };
  }
}

export class PlayerPhysics {
  velocity = 0;
  grounded = false;
  reset(): void { this.velocity = 0; this.grounded = false; }
  halt(position: Position, collision: PlayerCollision): void {
    this.velocity = 0;
    const support = collision.support(position);
    this.grounded = !!support && Math.abs(support.y - position.y) < .002;
  }
  update(position: Position, dt: number, vx: number, vz: number, jump: boolean, collision: PlayerCollision): Position {
    let p = { ...position };
    const support = collision.support(p);
    this.grounded = this.velocity <= 0 && !!support && Math.abs(support.y - p.y) < .002;
    if (jump && this.grounded) { this.velocity = JUMP.velocity; this.grounded = false; }
    // Fixed upper bound on displacement prevents tunnelling at low frame rates.
    const steps = Math.max(1, Math.ceil(dt / (1 / 180))), h = dt / steps;
    for (let i = 0; i < steps; i++) {
      p = collision.horizontal(p, vx * h, vz * h, this.grounded);
      const dy = this.velocity * h - JUMP.gravity * h * h / 2;
      this.velocity = Math.max(-JUMP.terminalVelocity, this.velocity - JUMP.gravity * h);
      const moved = collision.vertical(p, dy);
      p = moved.position; this.grounded = moved.grounded;
      if (moved.hit) this.velocity = 0;
    }
    return p;
  }
}
