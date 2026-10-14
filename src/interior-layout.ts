import type { HouseManifest, Vec3 } from './types.ts';

export interface WallFinish {
  collider: string; room: string; center: Vec3; along: 0 | 2; across: 0 | 2;
  side: number; length: number; bottom: number; top: number; base: number;
}

/** Surfaces are clipped to the solid wall pieces, including window sills and
 * door headers. Room rectangles alone would incorrectly bridge the openings. */
export function planWallFinishes(data: HouseManifest): WallFinish[] {
  const surfaces: WallFinish[] = [];
  for (const wall of data.colliders) {
    if (!wall.min) continue;
    const size = wall.max.map((v, i) => v - wall.min[i]);
    if (size[1] < .35 || Math.min(size[0], size[2]) > .24 || Math.min(size[0], size[2]) < .12) continue;
    const along = size[0] > size[2] ? 0 : 2, across = along === 0 ? 2 : 0;
    if (size[along] < .24) continue;
    const floor = wall.min[1] >= data.floorRise - .01 ? 1 : 0, base = floor * data.floorRise;
    for (const side of [-1, 1]) {
      const center = wall.min.map((v, i) => (v + wall.max[i]) / 2) as Vec3;
      center[across] += side * (size[across] / 2 + .004);
      const room = data.rooms.find(r => r.floor === floor && !['F03', 'U07'].includes(r.id)
        && r.rects.some(([x0, x1, z0, z1]) => center[0] > x0 && center[0] < x1 && center[2] > z0 && center[2] < z1));
      if (room) surfaces.push({ collider: wall.id, room: room.id, center, along, across, side,
        length: size[along], bottom: Math.max(wall.min[1], base + .025), top: Math.min(wall.max[1], base + 3.035), base });
    }
  }
  return surfaces;
}
