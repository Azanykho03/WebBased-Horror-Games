import type { World } from '../src/world.ts';
import type { Position } from '../src/types.ts';

/** A visible, reachable starting position for a deliberate cabinet encounter. */
export function cabinetObserver(world: World, exit: Position, range: number, near = false): Position {
  const distance = (a: Position, b: Position) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
  const choices: { p: Position; travel: number }[] = [];
  for (const room of world.data.rooms.filter(r => r.floor === exit.level && r.id !== 'F03')) for (const [x0, x1, z0, z1] of room.rects) {
    for (let x = x0 + .5; x < x1; x += .75) for (let z = z0 + .5; z < z1; z += .75) {
      const p = world.nav.point(x, z, exit.level);
      if (!p || distance(p, exit) < (near ? 2.1 : 5) || distance(p, exit) > (near ? 3.2 : range - .2)) continue;
      if (!world.clearSight([p.x, p.y + 1.45, p.z], [exit.x, exit.y + 1.45, exit.z])) continue;
      try {
        const route = world.nav.path(p, exit);
        choices.push({ p, travel: route.reduce((sum, q, i) => sum + (i ? distance(q, route[i - 1]) : 0), 0) });
      } catch { /* Discard disconnected rooms. */ }
    }
  }
  choices.sort((a, b) => near ? a.travel - b.travel : b.travel - a.travel);
  if (!choices.length) throw Error(`No visible cabinet encounter position at ${exit.x}, ${exit.z}`);
  return choices[0].p;
}
