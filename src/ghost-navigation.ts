import { createNavigation } from '../scripts/3d-generation/house-navigation.mjs';
import type { Navigation } from '../scripts/3d-generation/house-navigation.mjs';
import type { Collider, HouseManifest, Position } from './types.ts';
import type { HouseDoor, InteractiveFixtures } from './fixtures.ts';
import { boxHit } from './geometry.ts';

const distance = (a: Position, b: Position) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

/** Plans through usable doors; actual movement ALWAYS uses the physical nav.
 * This is the existing pathfinder with a planning-only collider set, not a
 * second movement controller. Locked leaves and all cabinet solids remain.
 */
export class GhostNavigation {
  readonly planner: Navigation;
  private signature = '';
  private data: HouseManifest;
  private physical: Navigation;
  private fixtures: InteractiveFixtures;
  constructor(data: HouseManifest, physical: Navigation, fixtures: InteractiveFixtures) {
    this.data = data; this.physical = physical; this.fixtures = fixtures;
    this.planner = createNavigation(data);
  }
  canOpen(door: HouseDoor): boolean { return !door.locked && door.lock !== 'sealed' && door.lock !== 'final'; }
  sync(solids: Collider[]): void {
    const usable = new Set(this.fixtures.doors.filter(d => this.canOpen(d) && d.hinge.state !== 'OPEN').map(d => `leaf-${d.id}`));
    const fixed = solids.filter(c => !usable.has(c.id)), signature = JSON.stringify(fixed);
    if (signature === this.signature) return;
    this.signature = signature; this.planner.setDynamicColliders(fixed);
  }
  path(start: Position, end: Position): Position[] {
    let physical: Position[] | null = null;
    try { physical = this.physical.path(start, end); } catch { /* A usable closed door may be the only route. */ }
    if (physical && !this.fixtures.doors.some(d => this.canOpen(d) && d.hinge.state !== 'OPEN')) return physical;
    let planned: Position[];
    try { planned = this.planner.path(start, end); } catch (error) { if (physical) return physical; throw error; }
    const length = (route: Position[]) => route.reduce((sum, p, i) => sum + (i ? distance(p, route[i - 1]) : 0), 0);
    // Allow a short clear detour, but do not run around the house to avoid a
    // normal door. The margin accounts for stopping and opening its hinge.
    return physical && length(physical) <= length(planned) + 1.5 ? physical : planned;
  }
  blockingDoor(start: Position, route: Position[]): HouseDoor | null {
    let from = start, travelled = 0;
    for (const to of route) {
      const length = distance(from, to);
      if (travelled > 3.5) break;
      const found = this.fixtures.doors.filter(d => this.canOpen(d) && d.hinge.state !== 'OPEN')
        .map(door => ({ door, hit: boxHit([from.x, from.y + .9, from.z], [to.x, to.y + .9, to.z], this.fixtures.collider(door, 0), .28) }))
        .filter((entry): entry is { door: HouseDoor; hit: number } => entry.hit !== null)
        .sort((a, b) => a.hit - b.hit)[0];
      if (found && travelled + found.hit * length <= 3.5) return found.door;
      travelled += length; from = to;
    }
    return null;
  }
  approach(door: HouseDoor, from: Position): Position[] | null {
    const yaw = door.root.rotation.y, nx = Math.sin(yaw), nz = Math.cos(yaw);
    const side = Math.sign((from.x - door.root.position.x) * nx + (from.z - door.root.position.z) * nz) || -1;
    // Stand outside the entire swing, on the side we actually approached from.
    const standOff = side === Math.sign(door.hinge.openAngle) ? door.width + .4 : .8;
    for (const extra of [0, .25]) for (const offset of [0, -.25, .25]) {
      const point = this.physical.point(door.root.position.x + nx * side * (standOff + extra) + Math.cos(yaw) * offset,
        door.root.position.z + nz * side * (standOff + extra) - Math.sin(yaw) * offset, from.level);
      if (!point) continue;
      try { return this.physical.path(from, point); } catch { /* Try a clear position on this side. */ }
    }
    return null;
  }
  searchPoints(origin: Position): Position[] {
    const candidates: Position[] = [];
    const add = (x: number, z: number) => {
      const point = this.physical.point(x, z, origin.level);
      if (!point || distance(point, origin) < .8 || distance(point, origin) > 8) return;
      if (!this.data.rooms.some(r => r.floor === origin.level && r.id !== 'F03' && r.rects.some(([x0, x1, z0, z1]) => x > x0 && x < x1 && z > z0 && z < z1))) return;
      if (candidates.some(p => distance(p, point) < .85)) return;
      candidates.push(point);
    };
    for (const door of this.fixtures.doors) for (const side of [-1, 1]) {
      if (Math.abs(door.root.position.y - origin.y) > 1) continue;
      add(door.root.position.x + Math.sin(door.root.rotation.y) * side * 1.7,
        door.root.position.z + Math.cos(door.root.rotation.y) * side * 1.7);
    }
    for (const room of this.data.rooms.filter(r => r.floor === origin.level)) for (const [x0, x1, z0, z1] of room.rects) add((x0 + x1) / 2, (z0 + z1) / 2);
    for (const radius of [1.8, 3.3, 5, 7]) for (let i = 0; i < 12; i++) add(origin.x + Math.sin(i * Math.PI / 6) * radius, origin.z + Math.cos(i * Math.PI / 6) * radius);
    return candidates.sort((a, b) => distance(a, origin) - distance(b, origin));
  }
}
