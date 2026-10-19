import test from 'node:test';
import assert from 'node:assert/strict';
import Babylon from 'babylonjs';
import { readFileSync } from 'node:fs';
import { GhostStateMachine } from '../src/ghost.ts';
import { Hinge } from '../src/hinge.ts';
import { freshProgress } from '../src/types.ts';
import type { HouseManifest, Position } from '../src/types.ts';
import type { HouseDoor } from '../src/fixtures.ts';
import type { InputSystem } from '../src/player.ts';
import { cabinetObserver } from './cabinet-observer.ts';
import type { Difficulty } from '../src/difficulty.ts';
import { createNavigation } from '../scripts/3d-generation/house-navigation.mjs';

Object.assign(globalThis, { window: Object.assign(new EventTarget(), { BABYLON: Babylon }) });
const { World } = await import('../src/world.ts');
const { InteractiveFixtures, CABINETS, anchorPosition } = await import('../src/fixtures.ts');
const { Player } = await import('../src/player.ts');
const { HidingSystem } = await import('../src/hiding.ts');

function fixture(count = 3) {
  const engine = new Babylon.NullEngine(), world = new World(engine);
  // Narrow, separated rooms ensure a route must actually cross each doorway.
  world.data = { version: 1, floorRise: 3.24, eyeHeight: 1.65, playerRadius: .24, bodyHeight: 1.75,
    rooms: [{ id: 'F01', name: 'Test rooms', floor: 0, rects: [[-3, 3, -17, -.25]] }],
    stair: { rect: [50, 52, 50, 54], bottom: [50, 0, 50], top: [50, 3.24, 54] },
    colliders: [], doors: [], lights: [], windows: [], props: [], tour: [] } as HouseManifest;
  for (let i = 0; i < count; i++) for (const x of [-1.95, 1.95]) world.data.colliders.push({ id: `wall-${i}-${x}`, room: 'F01', center: [x, 1.3, -4 - i * 4], size: [2.1, 2.6, .16], yaw: 0 });
  world.nav = createNavigation(world.data);
  const fixtures = world.fixtures3d = new InteractiveFixtures(world);
  for (let i = 0; i < count; i++) {
    const root = new Babylon.TransformNode(`door-${i}`, world.scene), pivot = new Babylon.TransformNode(`pivot-${i}`, world.scene);
    root.position.z = -4 - i * 4; pivot.parent = root; pivot.position.x = .8;
    const frame = Babylon.MeshBuilder.CreateBox(`frame-${i}`, {}, world.scene); frame.parent = root;
    fixtures.doors.push({ id: `door:test-${i}`, root, pivot, frame, hinge: new Hinge(Math.PI / 2, .85), width: 1.6, height: 2.3,
      hotspot: { id: `door:test-${i}`, room: 'F01', position: [0, 1.12, root.position.z], label: 'Open door', kind: 'door', radius: .5 },
      locked: false, initialOpen: true, lock: null });
  }
  const progress = freshProgress(), ghost = new GhostStateMachine(); fixtures.reset(progress);
  const player: { position: Position; hidden: boolean; hideExposed: boolean } = { position: { x: 0, y: 0, z: -10, level: 0 }, hidden: false, hideExposed: false };
  ghost.reset(true, player.position); ghost.grace = 0; ghost.position = { x: 0, y: 0, z: -1.3, level: 0 }; ghost.yaw = 0;
  const tick = (dt = 1 / 60) => { fixtures.update(dt, [ghost.position, player.position]); const caught = ghost.update(dt, world, player, progress, () => {}); assert(!world.collision.blocked(ghost.position), 'Ghost penetrated a wall or moving leaf'); return caught; };
  const close = () => { fixtures.doors.forEach(d => d.initialOpen = false); fixtures.reset(progress); };
  const dispose = () => { world.dispose(); engine.dispose(); };
  return { engine, world, fixtures, progress, ghost, player, tick, close, dispose };
}

test('Celestina opens multiple closed doors with the shared hinges, waits safely, and resumes pursuit', () => {
  const f = fixture();
  try {
    for (let i = 0; i < 30; i++) f.tick();
    assert.equal(f.ghost.state, 'Chase'); assert(f.ghost.lastKnownPlayerPosition);
    f.close(); const opened = new Map<string, number>(); let waited = false, chasedAgain = false;
    for (let i = 0; i < 1600; i++) {
      const caught = f.tick();
      if (f.ghost.openedDoor) opened.set(f.ghost.doorId!, (opened.get(f.ghost.doorId!) ?? 0) + 1);
      if (f.ghost.doorAction === 'WaitingForDoor') { waited = true; assert.equal(f.ghost.distanceMoved, 0); }
      if (opened.size >= 2 && f.ghost.state === 'Chase') chasedAgain = true;
      if (caught) break;
    }
    assert.equal(opened.size, 2, 'Pursuit should cross the two doors before its last-known target');
    assert([...opened.values()].every(n => n === 1), 'An opening must not restart every frame');
    assert(waited && chasedAgain); assert(f.ghost.position.z < -8);
  } finally { f.dispose(); }
});

test('a 30-second search opens successive doors and never reads hidden coordinates or witness metadata', () => {
  const f = fixture();
  try {
    for (let i = 0; i < 30; i++) f.tick();
    const known = f.ghost.lastKnownPlayerPosition;
    f.close(); f.player.hidden = f.player.hideExposed = true;
    f.player.position = { x: 2.6, y: 0, z: -15.5, level: 0 };
    f.tick(); assert.equal(f.ghost.state, 'Search');
    const opened = new Set<string>(), visited = new Set<string>(); let travel = 0;
    for (let i = 0; i < 1798; i++) {
      assert(!f.tick()); travel += f.ghost.distanceMoved;
      if (f.ghost.openedDoor) opened.add(f.ghost.doorId!);
      visited.add(`${Math.round(f.ghost.position.x)},${Math.round(f.ghost.position.z)}`);
      assert.deepEqual(f.ghost.lastKnownPlayerPosition, known);
      assert.equal(f.ghost.state, 'Search');
    }
    assert(travel > 9 && visited.size > 8, `Search stood still: ${travel} m / ${visited.size} cells`);
    assert(opened.size >= 2, 'Search never passed the doors on its remembered route');
    for (let i = 0; i < 3; i++) f.tick();
    assert.equal(f.ghost.state, 'Patrol'); assert.equal(f.ghost.searchRemaining, 0);
  } finally { f.dispose(); }
});

test('rediscovery cancels search immediately, repeated losses get one fresh timer, and resets clear door work', () => {
  const f = fixture(0);
  try {
    for (const difficulty of ['easy', 'medium', 'hard'] as Difficulty[]) {
      f.progress.difficulty = difficulty; f.ghost.difficulty = difficulty;
      f.ghost.reset(true, f.player.position); f.ghost.grace = 0; f.ghost.position = { x: 0, y: 0, z: -7, level: 0 }; f.ghost.yaw = 0; f.player.hidden = false;
      for (let i = 0; i < 60; i++) f.tick();
      for (let cycle = 0; cycle < 3; cycle++) {
        f.player.hidden = true; f.tick(); assert.equal(f.ghost.state, 'Search');
        assert(f.ghost.searchRemaining > 29.9);
        for (let i = 0; i < 30; i++) f.tick();
        const remaining = f.ghost.searchRemaining;
        f.ghost.hear({ ...f.ghost.position, z: f.ghost.position.z - 1 }, 10); f.tick();
        assert(f.ghost.searchRemaining < remaining, 'Noise restarted the search');
        f.player.position = { ...f.ghost.position, z: f.ghost.position.z - 2.5 }; f.ghost.yaw = 0; f.player.hidden = false;
        f.tick(); assert.equal(f.ghost.state, 'Chase'); assert.equal(f.ghost.searchRemaining, 0);
        assert.deepEqual(f.ghost.lastKnownPlayerPosition, f.player.position);
      }
      f.player.hidden = true; f.tick(); f.ghost.reset(true, f.player.position);
      assert.equal(f.ghost.state, 'Patrol'); assert.equal(f.ghost.searchRemaining, 0); assert.equal(f.ghost.lastKnownPlayerPosition, null); assert.equal(f.ghost.doorAction, null);
    }
  } finally { f.dispose(); }
});

test('closed, closing, opening and open doors keep a single safe traversal; mission locks cannot be requested', () => {
  for (const state of ['CLOSED', 'CLOSING', 'OPENING', 'OPEN'] as const) {
    const f = fixture(1);
    try {
      for (let i = 0; i < 30; i++) f.tick();
      const door = f.fixtures.doors[0];
      f.close();
      if (state === 'OPEN' || state === 'CLOSING') { door.initialOpen = true; f.fixtures.reset(f.progress); }
      if (state === 'CLOSING') door.hinge.request(false);
      if (state === 'OPENING') door.hinge.request(true);
      f.player.hidden = true; let requests = 0;
      for (let i = 0; i < 700; i++) { f.tick(); if (f.ghost.openedDoor) requests++; if (f.ghost.position.z < -5) break; }
      assert(f.ghost.position.z < -5, `Stuck at ${state} door`);
      assert(requests <= 1); assert.equal(door.hinge.state, 'OPEN');
    } finally { f.dispose(); }
  }
  for (const lock of ['bedroom', 'final', 'sealed'] as const) {
    const f = fixture(1);
    try {
      const door = f.fixtures.doors[0]; door.lock = lock; door.initialOpen = false; f.fixtures.reset(f.progress);
      f.ghost.hear(f.player.position, 30); f.player.hidden = true;
      for (let i = 0; i < 240; i++) { f.tick(); assert.equal(f.ghost.openedDoor, null); }
      assert.equal(door.hinge.state, 'CLOSED'); assert(door.locked); assert(f.ghost.position.z > -3.7);
      assert(!f.progress.bedroomUnlocked && !f.progress.exitUnlocked);
    } finally { f.dispose(); }
  }
});

test('all search candidates are clear indoor positions and visible entering/exiting players remain vulnerable', () => {
  const f = fixture();
  try {
    const points = f.world.ghostNavigation!.searchPoints({ x: 0, y: 0, z: -8, level: 0 });
    assert(points.length > 5);
    for (const p of points) { assert(f.world.nav.point(p.x, p.z, p.level)); assert(p.x > -3 && p.x < 3 && p.z > -17 && p.z < -.25); }
    f.ghost.position = { x: 0, y: 0, z: -9.5, level: 0 }; f.ghost.state = 'Chase'; f.ghost.yaw = 0;
    f.player.hidden = false; let caught = false;
    for (let i = 0; i < 60; i++) caught ||= f.tick();
    assert(caught, 'Entry/exit must not grant early or lingering invulnerability');
    assert.equal(f.ghost.searchRemaining, 0); assert.equal(f.ghost.doorId, null);
  } finally { f.dispose(); }
});

function houseFixture() {
  const engine = new Babylon.NullEngine(), world = new World(engine);
  world.data = JSON.parse(readFileSync('public/assets/models/environments/haunted-house/house-manifest.json', 'utf8')) as HouseManifest;
  const replaced = new Set(['U03-wardrobe-074', ...world.data.props.filter(p => p.kind === 'open-door').map(p => p.id)]);
  world.data.colliders = world.data.colliders.filter(c => !replaced.has(c.id));
  world.nav = createNavigation(world.data);
  const fixtures = world.fixtures3d = new InteractiveFixtures(world), progress = freshProgress();
  // Collision fixture uses the authored dimensions and pivot placement; the
  // production fixture controller owns every animation, sweep and nav update.
  for (const d of world.data.doors) {
    const lock = d.id === 'outside-front--F01' ? 'final' : d.id === 'U00--U06' ? 'bedroom' : d.id === 'F08--outside-escape' ? 'sealed' : null;
    const id: HouseDoor['id'] = lock === 'final' ? 'front-door' : lock === 'bedroom' ? 'bedroom-door' : `door:${d.id}`;
    const root = new Babylon.TransformNode(d.id, world.scene), pivot = new Babylon.TransformNode(`${d.id}-pivot`, world.scene);
    root.position.copyFromFloats(...d.position); root.rotation.y = d.axis === 'z' ? Math.PI / 2 : 0;
    const width = d.width - .08; pivot.parent = root; pivot.position.x = width / 2;
    const frame = new Babylon.Mesh(`${d.id}-frame`, world.scene); frame.parent = root;
    fixtures.doors.push({ id, root, pivot, frame, width, height: d.height * .8224723 / .8635959,
      hinge: new Hinge((d.axis === 'z' && d.position[0] < 0 ? -1 : 1) * Math.PI / 2, .85),
      initialOpen: !lock, locked: !!lock, lock,
      hotspot: { id, room: d.source, kind: 'door', position: [d.position[0], d.position[1] + 1.12, d.position[2]], radius: .52, label: '' } });
  }
  for (const def of CABINETS) {
    const root = new Babylon.TransformNode(def.id, world.scene); root.position.copyFromFloats(...def.position); root.rotation.y = def.yaw;
    const node = (name: string, x: number, y: number, z: number) => { const n = new Babylon.TransformNode(name, world.scene); n.parent = root; n.position.set(x, y, z); return n; };
    const body = new Babylon.Mesh(def.id + '-body', world.scene); body.parent = root;
    fixtures.cabinets.push({ id: def.id, root, body, pivots: [node('left', -.59, 0, .36), node('right', .59, 0, .36)],
      hide: node('hide', 0, .015, .02), view: node('view', 0, 1.665, .02), entrance: node('entrance', 0, 0, .87), exit: node('exit', 0, 0, 1.28),
      hinge: new Hinge(98 * Math.PI / 180, .62), floor: def.room.startsWith('U') ? 1 : 0, yaw: Math.PI - def.yaw,
      hotspot: { id: def.id, label: 'Hide', room: def.room, kind: 'hide', radius: .5, position: [...def.position] }, solids: [] });
  }
  fixtures.reset(progress);
  return { world, fixtures, progress, dispose: () => { world.dispose(); engine.dispose(); } };
}

test('every usable authored house doorway can be searched through from both sides without collision', () => {
  const { world, fixtures, progress, dispose } = houseFixture();
  // The normal mission unlock, rather than the AI, enables the bedroom.
  progress.bedroomUnlocked = true;
  try {
    for (const door of fixtures.doors.filter(d => d.lock !== 'sealed' && d.lock !== 'final')) for (const side of [-1, 1]) {
      fixtures.doors.forEach(d => d.initialOpen = d.lock !== 'sealed' && d.lock !== 'final'); fixtures.reset(progress);
      const level = door.root.position.y > 1 ? 1 : 0, nx = Math.sin(door.root.rotation.y), nz = Math.cos(door.root.rotation.y);
      const sidePoint = (sign: number) => {
        for (const d of [1.65, 1.35, .85, 2.1]) for (const offset of [0, -.3, .3]) {
          const p = world.nav.point(door.root.position.x + nx * sign * d + nz * offset, door.root.position.z + nz * sign * d - nx * offset, level);
          if (p && world.clearSight([p.x, p.y + 1.45, p.z], door.hotspot.position)) return p;
        }
        throw Error(`No fixture position for ${door.id} side ${sign}`);
      };
      const start = sidePoint(side), target = sidePoint(-side), ghost = new GhostStateMachine();
      const player = { position: target, hidden: false, hideExposed: false };
      ghost.reset(true, target); ghost.grace = 0; ghost.position = start;
      ghost.yaw = Math.atan2(target.x - start.x, start.z - target.z);
      for (let i = 0; i < 30; i++) ghost.update(1 / 60, world, player, progress, () => {});
      assert.equal(ghost.state, 'Chase', `${door.id}: authored open doorway did not permit sight`);
      door.initialOpen = false; fixtures.reset(progress); player.hidden = true;
      let requests = 0, crossed = false;
      for (let i = 0; i < 1500; i++) {
        fixtures.update(1 / 60, [ghost.position, player.position]);
        assert(!ghost.update(1 / 60, world, player, progress, () => {}));
        assert(!world.collision.blocked(ghost.position), `${door.id} side ${side}: ghost clipped geometry`);
        if (ghost.openedDoor) requests++;
        const signed = (ghost.position.x - door.root.position.x) * nx + (ghost.position.z - door.root.position.z) * nz;
        if (signed * side < -.4) { crossed = true; break; }
      }
      assert(crossed, `${door.id} side ${side}: stuck ${JSON.stringify(ghost.position)} (${ghost.doorAction})`);
      assert.equal(requests, 1, `${door.id}: should use this closed door once instead of abandoning the doorway`);
      assert.equal(door.hinge.state, 'OPEN');
    }
  } finally { dispose(); }
});

test('both actual cabinets complete witnessed entry, protect a full search, and expose early exits on Medium and Hard', () => {
  const { world, fixtures, progress, dispose } = houseFixture();
  const player = new Player(), ghost = new GhostStateMachine();
  const input = { clear: () => {} } as InputSystem, hiding = new HidingSystem(player, input, world);
  const tick = () => {
    fixtures.update(1 / 60, [ghost.position, player.position]); hiding.update(1 / 60, ghost);
    const caught = ghost.update(1 / 60, world, player, progress, () => {});
    assert(!world.collision.blocked(ghost.position), 'Ghost entered cabinet/wall/door collision'); return caught;
  };
  try {
    for (const difficulty of ['medium', 'hard'] as const) for (const cabinet of fixtures.cabinets) {
      progress.difficulty = difficulty; ghost.difficulty = difficulty;
      for (let cycle = 0; cycle < 2; cycle++) {
        hiding.reset(); fixtures.reset(progress);
        const exit = anchorPosition(cabinet.exit, cabinet.floor), start = cabinetObserver(world, exit, ghost.tuning.detectionRange);
        player.reset(exit); player.halt(world); ghost.reset(true, exit); ghost.grace = 0; ghost.position = start;
        ghost.yaw = Math.atan2(exit.x - start.x, start.z - exit.z);
        for (let frame = 0; frame < 65 && ghost.state !== 'Chase'; frame++) assert(!tick());
        assert.equal(ghost.state, 'Chase'); assert(hiding.enter(cabinet, ghost)); assert(player.hideExposed);
        for (let frame = 0; frame < 200 && !player.hidden; frame++) assert(!tick(), `${cabinet.id} ${difficulty}: fixture was too close for entry`);
        assert(player.hidden && hiding.state === 'HIDDEN'); assert.equal(cabinet.hinge.state, 'CLOSED'); assert.equal(ghost.state, 'Search');
        const known = ghost.lastKnownPlayerPosition; let travelled = 0;
        for (let frame = 0; frame < (cycle ? 180 : 1798); frame++) {
          assert(!tick()); assert(!ghost.sees(player, world)); assert.equal(ghost.state, 'Search');
          assert.deepEqual(ghost.lastKnownPlayerPosition, known); travelled += ghost.distanceMoved;
        }
        if (!cycle) {
          assert(travelled > 3, `${cabinet.id} ${difficulty}: inactive search (${travelled}m)`);
          for (let frame = 0; frame < 3; frame++) tick();
          assert.equal(ghost.state, 'Patrol'); assert.equal(ghost.searchRemaining, 0);
        } else {
          const near = cabinetObserver(world, exit, ghost.tuning.detectionRange, true);
          ghost.position = near; ghost.yaw = Math.atan2(exit.x - near.x, near.z - exit.z);
          assert(hiding.exit()); assert(!player.hidden); let rediscovered = false, caught = false;
          for (let frame = 0; frame < 480; frame++) {
            caught = tick(); rediscovered ||= ghost.state === 'Chase';
            if (ghost.sees(player, world)) assert(ghost.state === 'Chase' || ghost.state === 'GrabStart', 'Visible exit did not immediately cancel search');
            if (caught) break;
          }
          assert(rediscovered, `${cabinet.id}: early exit never resumed chase`);
          // Ground captures reserve a full fall/drag envelope. A cabinet recess
          // may safely delay the grab, but must not grant hiding or cancel chase.
          if (!caught) {
            assert(!world.canGrab(player, ghost.position), `${cabinet.id}: valid-space capture stalled ${JSON.stringify({player:player.position,ghost:ghost.position})}`);
            assert.equal(ghost.state, 'Chase'); assert(!player.hidden);
          }
          assert.equal(ghost.searchRemaining, 0); assert.equal(ghost.doorAction, null);
        }
      }
    }
  } finally { dispose(); }
});
