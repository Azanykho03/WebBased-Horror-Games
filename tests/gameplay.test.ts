import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { freshProgress } from '../src/types.ts';
import type { Collider, HouseManifest, Position, Vec3 } from '../src/types.ts';
import { interact, mission, canEscape, keepsakeCount } from '../src/objectives.ts';
import { parseSave, parseSettings } from '../src/storage.ts';
import { boxHit, sphereHit, worldHit } from '../src/geometry.ts';
import { GhostStateMachine } from '../src/ghost.ts';
import { createNavigation } from '../scripts/3d-generation/house-navigation.mjs';
import { HOTSPOTS, CHECKPOINTS } from '../src/config.ts';

const data = JSON.parse(readFileSync('public/assets/models/environments/haunted-house/house-manifest.json', 'utf8')) as HouseManifest;
const nav = createNavigation(data);
const saved = (progress: ReturnType<typeof freshProgress>) => JSON.stringify({ version: 1, progress });
const complete = () => {
  const p = freshProgress();
  for (const id of ['flashlight', 'note', 'fuse', 'breaker', 'master-key', 'bedroom-door', 'locket', 'letter', 'music-box', 'cabinet', 'exit-key', 'exit'] as const) assert(interact(p, id).changed, id);
  return p;
};

test('five missions complete in order; duplicate pickups cannot advance progress', () => {
  const p = freshProgress(); assert.equal(mission(p), 'M01');
  assert.equal(interact(p, 'fuse').changed, false);
  interact(p, 'flashlight'); interact(p, 'note'); assert.equal(mission(p), 'M02');
  assert.equal(interact(p, 'breaker').changed, false);
  interact(p, 'fuse'); interact(p, 'breaker'); assert.equal(mission(p), 'M03');
  interact(p, 'locket'); assert.equal(interact(p, 'locket').changed, false); assert.equal(keepsakeCount(p), 1);
  interact(p, 'master-key'); interact(p, 'bedroom-door'); interact(p, 'letter'); interact(p, 'music-box'); assert.equal(mission(p), 'M04');
  interact(p, 'cabinet'); assert.equal(mission(p), 'M05');
  assert.equal(canEscape(p), false); interact(p, 'exit-key'); assert.equal(canEscape(p), false);
  interact(p, 'exit'); assert.equal(canEscape(p), true);
});
test('exit remains locked at every incomplete stage and the crossing rechecks prerequisites', () => {
  const p = freshProgress();
  for (const id of ['flashlight', 'note', 'fuse', 'breaker', 'master-key', 'bedroom-door', 'locket', 'letter', 'music-box', 'cabinet'] as const) {
    assert.equal(interact(p, 'exit').changed, false); assert.equal(canEscape(p), false); interact(p, id);
  }
  for (const id of ['flashlight', 'note', 'fuse', 'locket', 'letter', 'music-box', 'exit-key'] as const) {
    const value = complete(); value.collected = value.collected.filter(item => item !== id);
    assert.equal(canEscape(value), false, id);
  }
});
test('saves reject corruption, non-finite values, duplicate IDs, and impossible progression', () => {
  assert.equal(parseSave('broken'), null); assert.equal(parseSave('{"version":99}'), null);
  assert.equal(parseSave(saved({ ...freshProgress(), exitUnlocked: true })), null);
  assert.equal(parseSave(saved({ ...freshProgress(), power: true })), null);
  assert.equal(parseSave(saved({ ...freshProgress(), checkpoint: 'cabinet' })), null);
  assert.equal(parseSave(saved({ ...freshProgress(), battery: NaN })), null);
  assert.equal(parseSave(saved({ ...freshProgress(), collected: ['note', 'note'] })), null);
  assert.deepEqual(parseSave(saved(complete())), complete());
  const p = complete(); p.kitchenSeen = true; assert.equal(parseSave(saved(p))?.kitchenSeen, true);
});
test('settings constrain corrupted values and battery pickups are never wasted at full charge', () => {
  assert.equal(parseSettings('{"volume":900,"brightness":null,"sensitivity":-9}').volume, .65);
  const p = freshProgress(); assert.equal(interact(p, 'battery-kitchen').changed, false);
  p.battery = 30; interact(p, 'battery-kitchen'); assert.equal(p.battery, 85);
  interact(p, 'battery-kitchen'); assert.equal(p.battery, 85);
});
test('ray geometry rejects through-wall interactions and swept projectiles do not tunnel', () => {
  const wall: Collider = { id: 'wall', room: 'F01', min: [-1, 0, -3], max: [1, 3, -2.9] };
  assert.equal(boxHit([0, 1.5, 0], [0, 1.5, -10], wall), .29);
  assert.equal(boxHit([2, 1.5, 0], [2, 1.5, -10], wall), null);
  const ghost = sphereHit([0, 1.5, 0], [0, 1.5, -10], [0, 1.5, -6], .6);
  assert(ghost !== null && ghost > boxHit([0, 1.5, 0], [0, 1.5, -10], wall)!);
  assert.equal(sphereHit([2, 1.5, 0], [2, 1.5, -10], [0, 1.5, -6], .6), null);
});
test('existing house navigation traverses both floors and the terrace; gates invalidate paths', () => {
  for (const p of Object.values(CHECKPOINTS)) assert(nav.point(p.x, p.z, p.level));
  const from = data.tour.find(p => p.name === 'Front entrance')!, to = data.tour.find(p => p.name === 'Terrace')!;
  assert(nav.path(from, to).length > 10);
  const gate: Collider = { id: 'locked-exit', room: 'F08', center: [-1.4, 1.175, -13.5], size: [.1, 2.35, 1.21], yaw: 0 };
  const inside = { x: 0, z: -13.5, level: 0 as const }, outside = { x: -2.6, z: -13.5, level: 0 as const };
  assert(nav.path(inside, outside)); nav.setDynamicColliders([gate]);
  assert.throws(() => nav.path(inside, outside), /No collision-safe route/);
  const p = nav.point(inside.x, inside.z, 0)!; assert(nav.move(p, -3, 0).x > -1.12);
  nav.setDynamicColliders([]); assert(nav.path(inside, outside));
});
test('every authored interaction has a reachable position and a clear use ray', () => {
  const start = CHECKPOINTS.entrance;
  const issues: string[] = [];
  for (const item of HOTSPOTS) {
    let reachable = false;
    const floor = item.position[1] >= 3.24 ? 1 : 0;
    for (const radius of [.65, 1.1, 1.6]) {
      for (let i = 0; i < 16; i++) {
        const angle = i * Math.PI / 8;
        const point = nav.point(item.position[0] + Math.sin(angle) * radius, item.position[2] + Math.cos(angle) * radius, floor);
        if (!point) continue;
        const eye: Vec3 = [point.x, point.y + 1.65, point.z];
        if (Math.hypot(...item.position.map((v, n) => v - eye[n])) > 2.15) continue;
        const hit = worldHit(eye, item.position, data.colliders);
        if (hit !== null && hit < .985) continue;
        try { nav.path(start, point); reachable = true; break; } catch { /* Another approach may connect. */ }
      }
      if (reachable) break;
    }
    if (!reachable) issues.push(item.id);
  }
  assert.deepEqual(issues, [], 'Unreachable or occluded interactions');
});
test('ghost vision respects walls, its cone, floors, and witnessed hiding', () => {
  const ghost = new GhostStateMachine(); ghost.position = { x: 0, y: 0, z: -5, level: 0 }; ghost.yaw = 0;
  const player = { position: { x: 0, y: 0, z: -8, level: 0 as const }, hidden: false, hideExposed: false };
  assert.equal(ghost.sees(player, { nav, clearSight: () => false }), false);
  assert.equal(ghost.sees(player, { nav, clearSight: () => true }), true);
  player.hidden = true; assert.equal(ghost.sees(player, { nav, clearSight: () => true }), false);
  player.hideExposed = true; assert.equal(ghost.sees(player, { nav, clearSight: () => true }), false);
  player.position.z = -2; assert.equal(ghost.sees(player, { nav, clearSight: () => true }), false);
});
test('enemy capture, reveal grace, two-second stun and immunity are deterministic', () => {
  const ghost = new GhostStateMachine(), p = complete();
  const env = { nav, clearSight: () => true };
  const position: Position = { x: 0, y: 0, z: -5, level: 0 }, player = { position, hidden: false, hideExposed: false };
  ghost.reset(true, position); ghost.position = { ...position }; ghost.grace = 2;
  assert.equal(ghost.update(1, env, player, p, () => {}), false);
  assert(ghost.stun()); assert.equal(ghost.stun(), false);
  ghost.update(1, env, player, p, () => {}); assert.equal(ghost.state, 'Stunned');
  ghost.update(1, env, player, p, () => {}); assert.equal(ghost.state, 'Search'); assert.equal(ghost.stun(), false);
  ghost.grace = 0; assert.equal(ghost.update(.016, env, player, p, () => {}), false);
  assert.equal(ghost.update(.6, env, player, p, () => {}), true); assert.equal(ghost.state, 'GrabStart');
});
