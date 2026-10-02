import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import Babylon from 'babylonjs';
import { createNavigation } from '../scripts/3d-generation/house-navigation.mjs';
import { DEFAULT_SETTINGS, freshProgress } from '../src/types.ts';
import type { HouseManifest, Position, Vec3 } from '../src/types.ts';
import type { InputSystem } from '../src/player.ts';
import { GhostStateMachine } from '../src/ghost.ts';

// Babylon's real headless engine exercises the player and projectile systems.
// The browser build provides the same library as a local classic script.
(globalThis as unknown as { window: EventTarget & { BABYLON: typeof Babylon } }).window = Object.assign(new EventTarget(), { BABYLON: Babylon });
const { World } = await import('../src/world.ts');
const { Player } = await import('../src/player.ts');
const { InteractionSystem } = await import('../src/interactions.ts');
const data = JSON.parse(readFileSync('public/assets/models/environments/haunted-house/house-manifest.json', 'utf8')) as HouseManifest;
function setup() {
  const engine = new Babylon.NullEngine(), world = new World(engine);
  world.data = data; world.nav = createNavigation(data);
  world.arms = new Babylon.TransformNode('test-arm', world.scene);
  world.key = new Babylon.TransformNode('test-key', world.scene);
  const player = new Player(), progress = freshProgress(), keys = new Set<string>();
  const input = { keys, look: () => [0, 0], consume: () => false } as unknown as InputSystem;
  const cleanup = () => { world.dispose(); engine.dispose(); };
  return { world, player, progress, keys, input, cleanup };
}
test('player sprint exhausts, recovers, collides, and hiding stops movement and battery drain', () => {
  const { world, player, progress, keys, input, cleanup } = setup();
  try {
    progress.collected.push('flashlight'); keys.add('KeyW'); keys.add('ShiftLeft');
    let travelled = 0;
    for (let i = 0; i < 125; i++) {
      if (i === 75) player.yaw = Math.PI;
      const before = { ...player.position };
      player.update(.05, input, world, progress, DEFAULT_SETTINGS, () => {}, () => {});
      travelled += Math.hypot(player.position.x - before.x, player.position.z - before.z);
    }
    assert(travelled > 23); assert(player.stamina < .15); assert(progress.battery < 99);
    keys.clear();
    for (let i = 0; i < 80; i++) player.update(.05, input, world, progress, DEFAULT_SETTINGS, () => {}, () => {});
    assert(player.stamina > 2);
    const before = { ...player.position }, battery = progress.battery;
    player.hidden = true; keys.add('KeyW');
    for (let i = 0; i < 20; i++) player.update(.05, input, world, progress, DEFAULT_SETTINGS, () => {}, () => {});
    assert.deepEqual(player.position, before); assert.equal(progress.battery, battery); assert.equal(player.flashlight, false);
    player.hidden = false; player.reset({ x: 0, y: 0, z: -3, level: 0 }); player.yaw = -Math.PI / 2;
    for (let i = 0; i < 100; i++) player.update(.05, input, world, progress, DEFAULT_SETTINGS, () => {}, () => {});
    assert(player.position.x > -1.1, 'Player cannot walk through the hallway wall');
  } finally { cleanup(); }
});
test('actual tsinelas projectile hits the enemy once and resets cleanly on retry', () => {
  const { world, player, progress, cleanup } = setup();
  try {
    progress.kitchenSeen = true;
    const interactions = new InteractionSystem(world), ghost = new GhostStateMachine();
    ghost.state = 'Patrol'; ghost.position = { x: 0, y: 0, z: -6, level: 0 };
    interactions.takeSlipper(progress); assert(interactions.throw(player)); assert.equal(interactions.throw(player), false);
    let hits = 0;
    for (let i = 0; i < 90; i++) interactions.updateProjectile(1 / 30, ghost, () => {}, () => hits++);
    assert.equal(hits, 1); assert.equal(ghost.state, 'Stunned');
    const dropped = interactions.hotspots.find(h => h.id === 'tsinelas')!;
    assert(world.nav.point(dropped.position[0], dropped.position[2], 0));
    assert(interactions.available(dropped, progress));
    const landing = world.nav.point(dropped.position[0], dropped.position[2], 0)!;
    assert(world.nav.path(player.position, landing));
    interactions.takeSlipper(progress); assert(interactions.slipperInHand);
    assert.equal(progress.collected.filter(id => id === 'tsinelas').length, 1);
    interactions.reset(progress); assert(interactions.slipperInHand);
    interactions.reset(freshProgress()); assert.equal(interactions.slipperInHand, false);
  } finally { cleanup(); }
});

test('touch analog input shares collisions, has no diagonal speed boost, and clamps camera pitch', () => {
  const { world, player, progress, input, cleanup } = setup();
  try {
    input.touchMode = true; input.touchSprint = false;
    const start: Position = { x: 0, y: 0, z: -3, level: 0 };
    const travel = (side: number, forward: number) => {
      player.reset(start); input.setMove = (x, y) => { input.moveX = x; input.moveForward = y; }; input.setMove(side, forward);
      player.update(.05, input, world, progress, DEFAULT_SETTINGS, () => {}, () => {});
      return Math.hypot(player.position.x - start.x, player.position.z - start.z);
    };
    const forward = travel(0, 1), diagonal = travel(1, 1), half = travel(0, .5), backward = travel(0, -1);
    assert(Math.abs(diagonal - forward) < 1e-7); assert(Math.abs(half - forward / 2) < 1e-7); assert(Math.abs(backward - forward) < 1e-7);
    input.moveX = -1; input.moveForward = 0; player.reset(start);
    for (let i = 0; i < 100; i++) player.update(.05, input, world, progress, DEFAULT_SETTINGS, () => {}, () => {});
    assert(player.position.x > -1.1, 'Touch cannot cross hallway collision');
    input.moveX = 0; input.look = () => [100, -10000];
    player.update(.05, input, world, progress, { ...DEFAULT_SETTINGS, touchSensitivity: 2 }, () => {}, () => {});
    assert.equal(player.pitch, 1.35); assert(Math.abs(player.yaw - .44) < 1e-7);
    input.look = () => [-100, 10000]; player.update(.05, input, world, progress, { ...DEFAULT_SETTINGS, touchSensitivity: 2 }, () => {}, () => {});
    assert.equal(player.pitch, -1.35); assert(Math.abs(player.yaw) < 1e-7);
  } finally { cleanup(); }
});
test('a wall blocks a thrown tsinelas and its miss remains reachable', () => {
  const { world, player, progress, cleanup } = setup();
  try {
    progress.kitchenSeen = true; player.reset({ x: 0, y: 0, z: -3, level: 0 }); player.yaw = -Math.PI / 2;
    player.camera(world, DEFAULT_SETTINGS);
    const interactions = new InteractionSystem(world), ghost = new GhostStateMachine();
    ghost.state = 'Patrol'; ghost.position = { x: -3, y: 0, z: -3, level: 0 };
    interactions.takeSlipper(progress); interactions.throw(player);
    let hits = 0;
    for (let i = 0; i < 80; i++) interactions.updateProjectile(.05, ghost, () => {}, () => hits++);
    assert.equal(hits, 0); assert.equal(ghost.state, 'Patrol');
    const dropped = interactions.hotspots.find(h => h.id === 'tsinelas')!;
    const floor = world.nav.point(dropped.position[0], dropped.position[2], 0);
    assert(floor); assert(world.nav.path(player.position, floor));
  } finally { cleanup(); }
});
test('kitchen reveal chooses a reachable spawn away from every kitchen approach', () => {
  const nav = createNavigation(data), ghost = new GhostStateMachine();
  for (const [x, z] of [[-5.7, -19], [-2.5, -16.5], [-2.8, -20], [-4.2, -18]]) {
    const player: Position = { x, y: 0, z, level: 0 };
    ghost.reveal(player, nav);
    assert(nav.point(ghost.position.x, ghost.position.z, 0));
    assert(Math.hypot(ghost.position.x - x, ghost.position.z - z) > 2.5);
    assert(ghost.grace >= 8); assert(nav.path(player, ghost.position));
  }
});
test('opening the cabinet exposes the key without the cabinet stealing interaction focus', () => {
  const { world, player, progress, cleanup } = setup();
  try {
    const interactions = new InteractionSystem(world);
    player.reset({ x: .6, y: 0, z: -11.94, level: 0 });
    const key = interactions.hotspots.find(h => h.id === 'exit-key')!;
    const dx = key.position[0] - player.eye[0], dz = key.position[2] - player.eye[2];
    player.yaw = Math.atan2(dx, -dz); player.pitch = Math.atan2(key.position[1] - player.eye[1], Math.hypot(dx, dz));
    player.camera(world, DEFAULT_SETTINGS);
    assert.equal(interactions.focus(player, progress)?.id, 'cabinet');
    progress.cabinet = true;
    assert.equal(interactions.focus(player, progress)?.id, 'exit-key');
    progress.collected.push('exit-key'); assert.equal(interactions.focus(player, progress), null);
  } finally { cleanup(); }
});
test('enemy follows an actual stair route between floors and cannot cross a shut gate', () => {
  const nav = createNavigation(data), ghost = new GhostStateMachine(), progress = freshProgress();
  const start: Position = { x: 0, y: 0, z: -5, level: 0 }, upstairs: Position = { x: 0, y: 3.24, z: -4.6, level: 1 };
  ghost.reset(true, upstairs); ghost.position = start; ghost.grace = 0; ghost.hear(upstairs, 30);
  const player = { position: upstairs, hidden: true, hideExposed: false };
  const env = { nav, clearSight: (_a: Vec3, _b: Vec3) => false };
  for (let i = 0; i < 240; i++) { ghost.hear(upstairs, 30); ghost.update(.05, env, player, progress, () => {}); }
  assert.equal(ghost.position.level, 1); assert(Math.abs(ghost.position.y - 3.24) < .01);
  nav.setDynamicColliders([{ id: 'shut-exit', room: 'F08', center: [-1.4, 1.175, -13.5], size: [.1, 2.35, 1.21], yaw: 0 }]);
  ghost.position = { x: 0, y: 0, z: -13.5, level: 0 }; ghost.state = 'Patrol';
  const outside = { x: -2.6, y: 0, z: -13.5, level: 0 as const };
  for (let i = 0; i < 30; i++) { ghost.hear(outside, 30); ghost.update(.05, env, { ...player, position: outside }, progress, () => {}); }
  assert(ghost.position.x > -1.1);
});
