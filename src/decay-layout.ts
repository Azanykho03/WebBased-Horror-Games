import type { Collider, Hotspot, HouseManifest, Vec3 } from './types.ts';

export type DebrisKind = 'timber' | 'paper' | 'plaster' | 'ceramic';
export interface DebrisPiece { room: string; kind: DebrisKind; position: Vec3; size: Vec3; yaw: number }

export function seededRandom(seed: number): () => number {
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
}

/** Shallow litter cannot hide a pickup, cover a doorway, or occupy the stairs.
 * This never adds colliders or changes the navigation manifest. */
export function clearOfPlaySpace(data: HouseManifest, hotspots: Hotspot[], p: Vec3, radius: number): boolean {
  const floor = p[1] >= data.floorRise ? 1 : 0;
  const [x0, x1, z0, z1] = data.stair.rect;
  if (p[0] > x0 - radius - .5 && p[0] < x1 + radius + .5 && p[2] > z0 - radius - .5 && p[2] < z1 + radius + .5) return false;
  if (hotspots.some(h => (h.position[1] >= data.floorRise ? 1 : 0) === floor && Math.hypot(p[0] - h.position[0], p[2] - h.position[2]) < radius + (h.kind === 'hide' ? 1.25 : .95))) return false;
  return !data.doors.some(d => {
    if (d.floor !== floor) return false;
    const along = d.axis === 'x' ? 0 : 2, across = d.axis === 'x' ? 2 : 0;
    return Math.abs(p[along] - d.position[along]) < d.width / 2 + radius + .25 && Math.abs(p[across] - d.position[across]) < 1 + radius;
  });
}

export function insideFootprint(p: Vec3, collider: Collider, inset = 0): boolean {
  if (!collider.center) return p[0] >= collider.min[0] + inset && p[0] <= collider.max[0] - inset && p[2] >= collider.min[2] + inset && p[2] <= collider.max[2] - inset;
  const dx = p[0] - collider.center[0], dz = p[2] - collider.center[2], c = Math.cos(collider.yaw), s = Math.sin(collider.yaw);
  return Math.abs(dx * c - dz * s) <= collider.size[0] / 2 - inset && Math.abs(dx * s + dz * c) <= collider.size[2] / 2 - inset;
}

// Authored sources of damage, rather than uniform random clutter. The seeded
// scatter stays close to a leak, shelf, kitchen corner or garage storage pile.
const deposits: [string, number, number, DebrisKind, number][] = [
  ['F01', -1.12, -4.25, 'plaster', 13], ['F01', -1.08, -11.35, 'timber', 8],
  ['F02', 8.92, -1.0, 'timber', 22], ['F02', 8.98, -5.65, 'plaster', 16],
  ['F04', 8.85, -20.9, 'ceramic', 20], ['F04', 2.05, -21.5, 'timber', 14],
  ['F05', -7.12, -19.7, 'plaster', 18], ['F05', -6.25, -15.35, 'ceramic', 14],
  ['F06', -7.06, -11.36, 'timber', 14], ['F06', -3.2, -11.63, 'paper', 10],
  ['F07', 3.7, -7.98, 'paper', 18], ['F07', 8.83, -11.45, 'plaster', 12],
  ['F08', 1.07, -21.25, 'plaster', 9], ['F09', -6.94, -.64, 'timber', 21],
  ['U00', -1.09, -8.15, 'plaster', 12], ['U00', 1.1, -20.8, 'paper', 8],
  ['U01', 8.94, -6.65, 'timber', 14], ['U02', -6.45, -7.37, 'paper', 15],
  ['U03', 8.9, -8.62, 'paper', 13], ['U04', -7.03, -9.25, 'timber', 18],
  ['U05', -5.01, -18.4, 'ceramic', 16], ['U06', 8.91, -21.33, 'plaster', 18],
];

export function planDebris(data: HouseManifest, hotspots: Hotspot[]): DebrisPiece[] {
  const random = seededRandom(0xc0a20), result: DebrisPiece[] = [];
  for (const [roomId, x, z, kind, count] of deposits) {
    const room = data.rooms.find(r => r.id === roomId)!;
    for (let i = 0; i < count; i++) {
      const size: Vec3 = kind === 'timber' ? [.06 + random() * .08, .012 + random() * .027, .14 + random() * .43] : kind === 'paper' ? [.12 + random() * .12, .004, .15 + random() * .16] : [.025 + random() * .09, .008 + random() * .023, .03 + random() * .14];
      const radius = Math.hypot(size[0], size[2]) / 2;
      const position: Vec3 = [x + (random() - .5) * .7, room.floor * data.floorRise + .035 + size[1] / 2, z + (random() - .5) * 1.1];
      const yaw = random() * Math.PI;
      if (!room.rects.some(([a, b, c, d]) => position[0] - radius > a + .12 && position[0] + radius < b - .12 && position[2] - radius > c + .12 && position[2] + radius < d - .12)) continue;
      if (!clearOfPlaySpace(data, hotspots, position, radius)) continue;
      // The centre of the narrow passages remains visually readable during a chase.
      if (['F01', 'F08', 'U00'].includes(roomId) && Math.abs(position[0]) - radius < .78) continue;
      result.push({ room: roomId, kind, position, size, yaw });
    }
  }
  return result;
}
