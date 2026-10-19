import type { Position } from './types.ts';
import type { PlayerCollision } from './player-physics.ts';

/** Conservative swept body envelope for a floor encounter, including camera and feet. */
export function hasGrabSpace(player: Position, ghost: Position, collision: PlayerCollision): boolean {
  const dx = ghost.x - player.x, dz = ghost.z - player.z, d = Math.hypot(dx, dz);
  if (d < .65 || d > 1.2 || Math.abs(player.y - ghost.y) > .10 || collision.blocked(player)) return false;
  const ux = dx / d, uz = dz / d;
  // Reserve the fall behind the hips, leg length ahead, and the short drag.
  // Requiring a continuous level support excludes stair edges, furniture and gaps.
  for (let travel = -.55; travel <= 2.05; travel += .10) {
    const p = { ...player, x: player.x + ux * travel, z: player.z + uz * travel };
    if (collision.blocked(p)) return false;
    const support = collision.support(p, player.y + .06);
    if (!support || Math.abs(support.y - player.y) > .06) return false;
  }
  return true;
}
