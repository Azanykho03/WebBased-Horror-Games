import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createNavigation } from '../scripts/3d-generation/house-navigation.mjs';
import { PlayerCollision, PlayerPhysics, JUMP } from '../src/player-physics.ts';
import type { Collider, HouseManifest, Position } from '../src/types.ts';

const house = JSON.parse(readFileSync('public/assets/models/environments/haunted-house/house-manifest.json', 'utf8')) as HouseManifest;
function setup(colliders: Collider[] = []) {
  const data: HouseManifest = { ...house, colliders, props: [], windows: [],
    rooms: [{ id: 'TEST', name: 'Test floor', floor: 0, rects: [[-10, 10, -20, 10]] }],
    stair: { ...house.stair, rect: [30, 31, 30, 31] } };
  return { physics: new PlayerPhysics(), collision: new PlayerCollision(data, createNavigation(data)) };
}
const start = (): Position => ({ x: 0, y: 0, z: -8, level: 0 });
const solid = (id: string, min: [number, number, number], max: [number, number, number]): Collider => ({ id, room: 'TEST', min, max });

test('a scare halt clears velocity without moving the body and preserves supported/airborne recovery', () => {
  const { physics, collision } = setup([solid('platform', [-1, 0, -9], [1, .5, -7])]);
  for (const y of [.5, 1.1]) {
    const p = { ...start(), y }, before = { ...p };
    physics.velocity = JUMP.velocity;
    physics.halt(p, collision);
    assert.deepEqual(p, before); assert.equal(physics.velocity, 0);
    assert.equal(physics.grounded, y === .5);
    const moved = physics.update(p, 1 / 60, .5, 0, false, collision);
    assert(moved.x > p.x, 'Horizontal movement must resume on the next frame');
    assert(y === .5 ? moved.y === y : moved.y < y, 'Only an already airborne player should fall');
  }
});

test('physical jump has bounded height, gravity, no second jump, and stable rearming after landing', () => {
  const { physics, collision } = setup(); let p = start(), peak = 0;
  for (let i = 0; i < 60; i++) {
    p = physics.update(p, 1 / 60, 0, 0, i === 0 || i === 15, collision);
    peak = Math.max(peak, p.y);
  }
  assert(peak > .94 && peak < 1.0); assert.equal(p.y, 0); assert(physics.grounded); assert.equal(physics.velocity, 0);
  p = physics.update(p, 1 / 60, 0, 0, true, collision); assert(p.y > 0); assert(!physics.grounded);
  physics.reset(); assert.equal(physics.velocity, 0);
});

test('jumping hits ceilings and thin walls, including at low frame rates', () => {
  const { physics, collision } = setup([
    solid('ceiling', [-2, 2.1, -10], [2, 2.2, -6]),
    solid('wall', [.6, 0, -10], [.63, 3, -6]),
  ]);
  let p = start(), peak = 0;
  for (let i = 0; i < 12; i++) {
    p = physics.update(p, .1, 3.9, 0, i === 0, collision); peak = Math.max(peak, p.y);
    assert(p.y + house.bodyHeight <= 2.1001); assert(p.x <= .6 - house.playerRadius + .001);
  }
  assert(peak > .1); assert(physics.grounded); assert.equal(p.y, 0);
});

test('landing on boxes is stable, walking off falls, and an airborne reset cannot jump', () => {
  const { physics, collision } = setup([solid('box', [.5, 0, -8.6], [1.5, .65, -7.4])]);
  let p = start();
  for (let i = 0; i < 70; i++) p = physics.update(p, 1 / 60, p.x < .95 ? 2.1 : 0, 0, i === 0, collision);
  assert.equal(p.y, .65); assert(physics.grounded);
  for (let i = 0; i < 90; i++) p = physics.update(p, 1 / 60, 2.1, 0, false, collision);
  assert.equal(p.y, 0); assert(physics.grounded);
  physics.reset(); p = { ...start(), y: 1 };
  p = physics.update(p, 1 / 60, 0, 0, true, collision); assert(p.y < 1); assert(physics.velocity < 0);
});

test('rotated furniture provides support and its side remains solid', () => {
  const { physics, collision } = setup([{ id: 'rotated', room: 'TEST', center: [0, .4, -8], size: [2, .8, .65], yaw: Math.PI / 4 }]);
  let p = { ...start(), y: 1.1 };
  for (let i = 0; i < 90; i++) p = physics.update(p, 1 / 60, 0, 0, false, collision);
  assert.equal(p.y, .8); assert(physics.grounded);
  assert(collision.blocked({ ...start(), x: .4 }));
});

test('the real house supports tables, chair seats, beds and boxes at their authored heights', () => {
  const collision = new PlayerCollision(house, createNavigation(house));
  for (const [x, y, z, level, top] of [
    [6.15, 1.15, -3.3, 0, .5], [5.5, 1.15, -18.5, 0, .84],
    [4.38, .95, -18.5, 0, .53], [-2.3, 1.15, -3, 0, .65], [6, 4.45, -13.23, 1, 3.94],
  ]) {
    const physics = new PlayerPhysics(); let p: Position = { x, y, z, level: level as 0 | 1 };
    for (let i = 0; i < 120; i++) p = physics.update(p, 1 / 60, 0, 0, false, collision);
    assert(Math.abs(p.y - top) < .001, `${x}, ${z}: landed at ${p.y}, expected ${top}`);
    assert(physics.grounded); assert(!collision.blocked(p));
  }
});

test('actual house stair ascent, jump, landing and descent preserve floor transitions', () => {
  const collision = new PlayerCollision(house, createNavigation(house)), physics = new PlayerPhysics();
  let p: Position = { x: 2.4, y: 0, z: -6.6, level: 0 }, jumped = false;
  for (let i = 0; i < 180; i++) {
    const jump = !jumped && p.z > -4.4;
    if (jump) jumped = true;
    p = physics.update(p, 1 / 60, 0, p.z < -1.1 ? 2.1 : 0, jump, collision);
  }
  assert.equal(p.level, 1); assert.equal(p.y, house.floorRise); assert(physics.grounded);
  for (let i = 0; i < 190; i++) p = physics.update(p, 1 / 60, 0, p.z > -6.6 ? -2.1 : 0, false, collision);
  assert.equal(p.level, 0); assert.equal(p.y, 0); assert(physics.grounded);
});

test('locked gates and window panes remain solid while jumping', () => {
  const collision = new PlayerCollision(house, createNavigation(house)), physics = new PlayerPhysics();
  collision.setDynamicColliders([solid('gate', [-1.45, 0, -14.1], [-1.35, 2.35, -12.9])]);
  let p: Position = { x: 0, y: 0, z: -13.5, level: 0 };
  for (let i = 0; i < 80; i++) p = physics.update(p, .05, -3.9, 0, i % 20 === 0, collision);
  assert(p.x > -1.13);
  assert(JUMP.velocity ** 2 / (2 * JUMP.gravity) < 1);
  physics.reset(); p = { x: 6.15, y: 0, z: -.9, level: 0 };
  for (let i = 0; i < 90; i++) p = physics.update(p, .05, 0, 3.9, i % 20 === 0, collision);
  assert(p.z < -.24, 'A window is not a jump-through escape route');
});

test('the controller can physically jump onto real dining tables, chairs, boxes, beds and counters', () => {
  const collision = new PlayerCollision(house, createNavigation(house));
  for (const [name, x, z, tx, tz, y, level, top] of [
    ['table', 4.25, -17.94, 5.5, -17.94, 0, 0, .84],
    ['chair', 4.38, -17.94, 4.38, -18.5, 0, 0, .53],
    ['box', -2.3, -2.3, -2.3, -3, 0, 0, .65],
    ['bed', 6, -11.15, 6, -12.5, 3.24, 1, 3.94],
    ['counter', -5, -20.25, -5, -21.35, 0, 0, .94],
  ] as [string, number, number, number, number, number, 0 | 1, number][]) {
    const physics = new PlayerPhysics(); let p: Position = { x, y, z, level };
    assert(!collision.blocked(p), `${name}: clear start`);
    for (let i = 0; i < 120; i++) {
      const dx = tx - p.x, dz = tz - p.z, length = Math.hypot(dx, dz), move = length > .04;
      p = physics.update(p, 1 / 60, move ? dx / length * 2.1 : 0, move ? dz / length * 2.1 : 0, i === 0, collision);
    }
    assert(Math.abs(p.y - top) < .001, `${name}: physical landing ${p.y}`);
    assert(physics.grounded); assert(!collision.blocked(p));
  }
});
