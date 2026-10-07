import test from 'node:test';
import assert from 'node:assert/strict';
import Babylon from 'babylonjs';
import { readFileSync } from 'node:fs';
import { Hinge } from '../src/hinge.ts';
import { GhostStateMachine } from '../src/ghost.ts';
import { freshProgress, DEFAULT_SETTINGS } from '../src/types.ts';
import type { HouseManifest, Position } from '../src/types.ts';
import type { InputSystem } from '../src/player.ts';
import type { FlashlightViewmodel } from '../src/flashlight-viewmodel.ts';
import { createNavigation } from '../scripts/3d-generation/house-navigation.mjs';
import { interact, canEscape } from '../src/objectives.ts';
import { parseSave } from '../src/storage.ts';

Object.assign(globalThis, { window: Object.assign(new EventTarget(), { BABYLON: Babylon }) });
const { World } = await import('../src/world.ts');
const { Player } = await import('../src/player.ts');
const { HidingSystem } = await import('../src/hiding.ts');
const { anchorPosition } = await import('../src/fixtures.ts');
const { InteractiveFixtures } = await import('../src/fixtures.ts');
type Cabinet = import('../src/fixtures.ts').HidingCabinet;

test('hinges reject spam, hold blocked sweeps, and repeat without drift', () => {
  const hinge = new Hinge(Math.PI / 2, .7);
  for (let cycle = 0; cycle < 6; cycle++) {
    assert(hinge.request(true)); assert(!hinge.request(false)); assert.equal(hinge.state, 'OPENING');
    hinge.update(.1); assert(hinge.angle > 0 && hinge.angle < .2);
    const before = hinge.angle; hinge.update(.6, () => false); assert.equal(hinge.angle, before);
    hinge.update(.7); assert.equal(hinge.state, 'OPEN'); assert.equal(hinge.angle, Math.PI / 2);
    assert(hinge.request(false)); assert(!hinge.request(true)); hinge.update(.7); assert.equal(hinge.state, 'CLOSED'); assert.equal(hinge.angle, 0);
  }
  hinge.reset(true); assert.equal(hinge.state, 'OPEN'); assert(hinge.request(false));
});

test('both cabinet configurations repeat entry/exit, suspend gravity, clamp look and restore controls', () => {
  const engine = new Babylon.NullEngine(), world = new World(engine);
  world.data = JSON.parse(readFileSync('public/assets/models/environments/haunted-house/house-manifest.json', 'utf8')) as HouseManifest;
  world.data.colliders = world.data.colliders.filter(c => c.id !== 'U03-wardrobe-074'); world.nav = createNavigation(world.data);
  world.viewmodel = { update: () => false } as unknown as FlashlightViewmodel;
  const player = new Player(), keys = new Set<string>(), queued = new Set<string>(); let look: [number, number] = [0, 0];
  const input = { keys, consume: (k: string) => { const present = queued.has(k); queued.delete(k); return present; }, look: () => { const result = look; look = [0, 0]; return result; }, clear: () => { keys.clear(); queued.clear(); look = [0, 0]; } } as unknown as InputSystem;
  const hiding = new HidingSystem(player, input, world), ghost = new GhostStateMachine(), progress = freshProgress();
  const node = (name: string, parent: Babylon.TransformNode, x: number, y: number, z: number) => { const n = new Babylon.TransformNode(name, world.scene); n.parent = parent; n.position.set(x, y, z); return n; };
  try {
    for (const [x, y, z, yaw, level] of [[8.75, 0, -20.3, -Math.PI / 2, 0], [2.17, 3.24, -13, Math.PI / 2, 1]] as const) {
      const root = new Babylon.TransformNode('cabinet', world.scene); root.position.set(x, y, z); root.rotation.y = yaw;
      const cabinet = { root, hide: node('hide', root, 0, .015, .02), view: node('view', root, 0, 1.665, .02), entrance: node('entrance', root, 0, 0, .87), exit: node('exit', root, 0, 0, 1.28), hinge: new Hinge(1.71, .62), floor: level, yaw: Math.PI - yaw, pivots: [] } as unknown as Cabinet;
      const tick = () => { cabinet.hinge.update(1 / 60); hiding.update(1 / 60, ghost); player.update(1 / 60, input, world, progress, DEFAULT_SETTINGS, () => {}, () => {}); };
      for (let cycle = 0; cycle < 4; cycle++) {
        player.reset(anchorPosition(cabinet.exit, level)); player.halt(world); const before = { ...player.position };
        assert(hiding.enter(cabinet, ghost)); assert(!hiding.enter(cabinet, ghost)); assert(!hiding.exit());
        const observed = new Set<string>();
        for (let i = 0; i < 180; i++) { tick(); observed.add(hiding.state); }
        assert.deepEqual([...observed], ['OPENING_CABINET', 'ENTERING', 'CLOSING_CABINET', 'HIDDEN']);
        assert.equal(player.hidden, true); assert.equal(player.verticalVelocity, 0); assert.equal(cabinet.hinge.state, 'CLOSED');
        const view = anchorPosition(cabinet.view, level); assert.deepEqual(world.camera.position.asArray(), [view.x, view.y, view.z]);
        const inside = { ...player.position }; keys.add('KeyW'); keys.add('Space'); look = [5000, 5000];
        for (let i = 0; i < 120; i++) tick();
        assert.deepEqual(player.position, inside); assert(Math.abs(player.pitch) <= .22); assert.equal(player.verticalVelocity, 0);
        assert(hiding.exit()); assert(!hiding.exit());
        for (let i = 0; i < 180; i++) tick();
        assert.equal(hiding.state, 'NORMAL'); assert.equal(player.hidden, false); assert.equal(player.hideExposed, false);
        assert(Math.hypot(player.position.x - before.x, player.position.y - before.y, player.position.z - before.z) < .001);
        assert(player.grounded); assert.equal(world.camera.rotation.z, 0); assert.equal(world.camera.parent, null); assert.equal(player.pitch, 0);
        keys.add('KeyW'); for (let i = 0; i < 20; i++) tick(); assert(Math.hypot(player.position.x - before.x, player.position.z - before.z) > .4); keys.clear();
      }
      player.reset(anchorPosition(cabinet.exit, level)); player.halt(world); hiding.enter(cabinet, ghost);
      for (let i = 0; i < 50; i++) tick(); hiding.reset();
      assert.equal(hiding.state, 'NORMAL'); assert.equal(cabinet.hinge.state, 'CLOSED'); assert(player.grounded);
    }
  } finally { world.dispose(); engine.dispose(); }
});

test('witnessed hiding targets the external cabinet entrance; unwitnessed hiding keeps search active', () => {
  const data = JSON.parse(readFileSync('public/assets/models/environments/haunted-house/house-manifest.json', 'utf8')) as HouseManifest;
  const nav = createNavigation(data), env = { nav, clearSight: () => true }, progress = freshProgress();
  const ghost = new GhostStateMachine(), entrance: Position = { x: 0, y: 0, z: -5, level: 0 };
  const player = { position: { x: 3, y: 0, z: -5, level: 0 as const }, hidden: true, hideExposed: false, hidingAt: entrance };
  ghost.reset(true, player.position); ghost.grace = 0; ghost.position = { ...entrance }; ghost.state = 'Search';
  assert(!ghost.sees(player, env)); assert(!ghost.update(.2, env, player, progress, () => {})); assert.notEqual(ghost.state, 'Dormant');
  player.hideExposed = true; ghost.position = { ...entrance }; assert(!ghost.sees(player, env));
  let caught = false; for (let i = 0; i < 60; i++) caught ||= ghost.update(1 / 60, env, player, progress, () => {});
  assert(caught, 'Witnessed cabinet is searchable even when the concealed body is outside attack range');
});

test('new locks require the supplied keys; old powered checkpoints migrate without losing progress', () => {
  const p = freshProgress(); assert(!interact(p, 'front-door').changed); assert(!interact(p, 'bedroom-door').changed);
  for (const id of ['flashlight', 'note', 'fuse', 'breaker'] as const) interact(p, id);
  assert(!interact(p, 'bedroom-door').changed); assert(!interact(p, 'music-box').changed);
  for (const id of ['master-key', 'bedroom-door', 'locket', 'letter', 'music-box', 'cabinet', 'exit-key', 'front-door'] as const) assert(interact(p, id).changed, id);
  assert(canEscape(p));
  const old = { ...p } as Partial<typeof p>; delete old.bedroomUnlocked; old.collected = p.collected.filter(id => id !== 'master-key');
  const migrated = parseSave(JSON.stringify({ version: 1, progress: old })); assert(migrated?.bedroomUnlocked); assert(migrated.collected.includes('master-key'));
});

test('a closing door stalls before hitting the player, resumes after clearance and keeps navigation in sync', () => {
  const engine = new Babylon.NullEngine(), world = new World(engine);
  world.data = JSON.parse(readFileSync('public/assets/models/environments/haunted-house/house-manifest.json', 'utf8')) as HouseManifest;
  world.nav = createNavigation(world.data);
  const fixtures = new InteractiveFixtures(world), root = new Babylon.TransformNode('root', world.scene), pivot = new Babylon.TransformNode('pivot', world.scene);
  root.position.z = -5; pivot.parent = root; pivot.position.x = .6;
  const frame = Babylon.MeshBuilder.CreateBox('fixed-frame', {}, world.scene); frame.parent = root;
  const hinge = new Hinge(Math.PI / 2, .8); hinge.reset(true);
  const door: import('../src/fixtures.ts').HouseDoor = { id: 'front-door', root, pivot, frame, hinge, width: 1.2, height: 2.3,
    hotspot: { id: 'front-door', room: 'F01', position: [0, 1.12, -5], label: 'Open door', kind: 'door', radius: .5 }, locked: false, initialOpen: true, lock: null };
  fixtures.doors.push(door); frame.computeWorldMatrix(true); const before = [...frame.getWorldMatrix().asArray()];
  const doorway: Position = { x: 0, y: 0, z: -5, level: 0 }, away: Position = { x: 0, y: 0, z: -7, level: 0 };
  try {
    hinge.request(false);
    for (let i = 0; i < 80; i++) { fixtures.update(1 / 60, [doorway]); assert(!world.collision.blocked(doorway), 'Swing penetrated the player'); }
    assert.equal(hinge.state, 'CLOSING'); assert(hinge.angle > .3);
    const stopped = hinge.angle; fixtures.update(.1, [doorway]); assert.equal(hinge.angle, stopped);
    for (let i = 0; i < 60; i++) fixtures.update(1 / 60, [away]);
    assert.equal(hinge.state, 'CLOSED'); assert(world.collision.blocked(doorway)); assert.equal(world.nav.point(0, -5, 0), null);
    hinge.request(true); for (let i = 0; i < 60; i++) fixtures.update(1 / 60, [away]);
    assert.equal(hinge.state, 'OPEN'); assert(!world.collision.blocked(doorway)); assert(world.nav.segment(away, { ...away, z: -3 }));
    frame.computeWorldMatrix(true); assert.deepEqual([...frame.getWorldMatrix().asArray()], before);
  } finally { world.dispose(); engine.dispose(); }
});
