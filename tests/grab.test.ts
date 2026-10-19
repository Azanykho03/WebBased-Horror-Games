import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import Babylon from 'babylonjs';
import { GrabSequence, GRAB, StruggleInput, escapeRequirement } from '../src/grab.ts';
import { GhostStateMachine } from '../src/ghost.ts';
import { difficultySettings } from '../src/difficulty.ts';
import { DEFAULT_SETTINGS, freshProgress } from '../src/types.ts';
import type { HouseManifest } from '../src/types.ts';
import { createNavigation } from '../scripts/3d-generation/house-navigation.mjs';
import { PlayerCollision } from '../src/player-physics.ts';
import type { World } from '../src/world.ts';
import { hasGrabSpace } from '../src/grab-space.ts';

function ground(qte: GrabSequence) {
  assert.equal(qte.update(20), 'falling');
  assert.equal(qte.update(20, false), null);
  assert.equal(qte.update(0, true), 'dragging');
  assert.equal(qte.update(20, false), null);
  assert.equal(qte.update(0, true), 'interactive');
}

for (const difficulty of ['easy', 'medium', 'hard'] as const) {
  test(`${difficulty}: full response window, exact press requirement, one success and clean reset`, () => {
    const qte = new GrabSequence(), tuning = difficultySettings[difficulty];
    assert(qte.start(difficulty)); assert(!qte.start('easy')); assert(!qte.press());
    ground(qte); assert.equal(qte.remaining, tuning.struggleSeconds);
    for (let n = 0; n < tuning.strugglePresses - 1; n++) { assert(qte.press()); qte.update(.03); }
    assert.equal(qte.phase, 'struggling'); assert(qte.press()); assert.equal(qte.phase, 'escape-kick');
    assert(!qte.press()); assert.equal(qte.update(GRAB.kickSeconds), 'release');
    assert.equal(qte.update(GRAB.releaseSeconds), 'recovery');
    assert.equal(qte.update(GRAB.recoverySeconds), 'released'); assert.equal(qte.update(10), null);
    qte.reset(); assert.equal(qte.presses, 0); assert.equal(qte.remaining, 0); assert(qte.start(difficulty));
  });
  test(`${difficulty}: deadline rejects final press and killing cannot fire twice`, () => {
    const qte = new GrabSequence(); qte.start(difficulty); ground(qte);
    for (let i = 0; i < qte.required - 1; i++) qte.press();
    qte.update(qte.remaining - .01); assert.equal(qte.phase, 'struggling');
    assert.equal(qte.update(.011), 'failed'); assert(!qte.press()); assert(!qte.start(difficulty));
    assert.equal(qte.update(GRAB.finishLeadSeconds), 'kill');
    assert.equal(qte.update(100), null); qte.reset(); assert(!qte.active);
  });
}
test('pause does not advance state; invalid deltas and pre-QTE inputs do not shorten the window', () => {
  const qte = new GrabSequence(); qte.start('hard');
  qte.update(.3); const time = qte.time;
  for (let i = 0; i < 60; i++) { assert(!qte.press()); qte.update(0); }
  assert.equal(qte.time, time); qte.update(NaN); qte.update(-20); assert.equal(qte.time, time);
  qte.update(.32); const snapshot = JSON.stringify(qte); qte.update(0); assert.equal(JSON.stringify(qte), snapshot);
});
test('holding E, repeated keydown and rapid input between renders have distinct semantics', () => {
  const input = new StruggleInput(); assert(input.keyDown(false));
  for (let i = 0; i < 20; i++) { assert(!input.keyDown(true)); assert(!input.keyDown(false)); }
  input.keyUp(); assert(!input.keyDown(true)); assert(input.keyDown(false));
  input.keyUp(); const qte = new GrabSequence(); qte.start('easy'); ground(qte);
  for (let i = 0; i < 8; i++) { if (input.keyDown(false)) qte.press(); input.keyUp(); }
  assert.equal(qte.phase, 'escape-kick');
});

test('successive grabs scale by difficulty, cap and reset only on a fresh run', () => {
  const expected = { easy: [[8,7],[10,6.5],[12,6],[14,5.5]], medium: [[12,6],[15,5.5],[18,5],[21,4.5]], hard: [[16,5],[20,4.5],[24,4],[28,4]] };
  for (const difficulty of ['easy','medium','hard'] as const) {
    const qte = new GrabSequence();
    for (const [presses, seconds] of expected[difficulty]) {
      qte.start(difficulty); assert.equal(qte.required, presses); assert.equal(qte.remaining, seconds);
      ground(qte); while (qte.press()) { /* Count distinct accepted edges. */ }
      qte.update(GRAB.kickSeconds); qte.update(GRAB.releaseSeconds); qte.update(GRAB.recoverySeconds); qte.reset();
    }
    assert.equal(qte.attempts, 4); qte.resetRun(); qte.start(difficulty);
    assert.equal(qte.attempts, 1); assert.equal(qte.required, expected[difficulty][0][0]);
    const cap = escapeRequirement(difficulty, 9999), tuning = difficultySettings[difficulty];
    assert.equal(cap.presses, tuning.struggleMaxPresses); assert.equal(cap.seconds, tuning.struggleMinSeconds);
  }
});

const data = JSON.parse(readFileSync('public/assets/models/environments/haunted-house/house-manifest.json', 'utf8')) as HouseManifest;
const nav = createNavigation(data), env = { nav, clearSight: () => true };
test('floor encounter rejects walls, uneven support, overlapping bodies and stairs', () => {
  const collision = new PlayerCollision(data, nav), p = { x: 0, y: 0, z: -8, level: 0 as const };
  assert(hasGrabSpace(p, { ...p, z: -9 }, collision));
  assert(!hasGrabSpace(p, { ...p, y: .2, z: -9 }, collision));
  assert(!hasGrabSpace(p, { ...p, z: -8.1 }, collision));
  collision.setDynamicColliders([{ id: 'closed-door', room: 'F01', center: [0, 1, -8.7], size: [2, 2, .2], yaw: 0 }]);
  assert(!hasGrabSpace(p, { ...p, z: -9 }, collision));
});
test('an interrupted cabinet overlap permits only outward recovery, preserving entry and solid-wall collision', () => {
  const collision = new PlayerCollision(data, nav);
  const reserved = { id: 'hide-dining-reserved', room: 'F04', center: [8.75, 1.18, -20.3] as [number, number, number], size: [1.30, 2.36, .92] as [number, number, number], yaw: -Math.PI / 2 };
  collision.setDynamicColliders([reserved]);
  let p = { x: 8.15, y: 0, z: -20.3, level: 0 as const }; assert(collision.blocked(p));
  assert.deepEqual(collision.horizontal(p, .02, 0, true), p, 'Cannot move deeper into the cabinet');
  for (let i = 0; i < 16; i++) p = collision.horizontal(p, -.02, 0, true) as typeof p;
  assert(!collision.blocked(p)); assert(p.x < 7.9, 'Recovery must move the real body out gradually');
  for (let i = 0; i < 30; i++) { p = collision.horizontal(p, .02, 0, true) as typeof p; assert(!collision.blocked(p), 'Normal entry still blocked'); }
  collision.setDynamicColliders([{ ...reserved, id: 'actual-wall' }]);
  const overlapping = { ...p, x: 8.15 };
  assert.deepEqual(collision.horizontal(overlapping, -.02, 0, true), overlapping, 'Never exempt a real solid');
});
test('grab owns AI; sound, projectiles, navigation and overlapping catches cannot interrupt it', () => {
  const ghost = new GhostStateMachine(), progress = freshProgress();
  const player = { position: { x: 0, y: 0, z: -8, level: 0 as const }, hidden: false, hideExposed: false };
  ghost.state = 'Chase'; ghost.position = { ...player.position, z: -7.4 };
  assert(ghost.update(.3, env, player, progress, () => {})); assert.equal(ghost.state, 'GrabStart');
  const position = { ...ghost.position };
  for (const state of ['GrabStart', 'Falling', 'Dragging', 'Struggling', 'EscapeKick', 'Releasing', 'Recovering', 'Killing'] as const) {
    ghost.state = state; ghost.hear(player.position, 20); assert(!ghost.stun());
    assert(!ghost.update(1, env, player, progress, () => {})); assert.equal(ghost.state, state); assert.deepEqual(ghost.position, position);
  }
  ghost.resumeAfterEscape(); assert.equal(ghost.state, 'Chase');
  for (let i = 0; i < 170; i++) assert(!ghost.update(1 / 60, env, player, progress, () => {}));
  assert(ghost.grabProtection > 0);
  let grabbed = false; for (let i = 0; i < 60; i++) grabbed ||= ghost.update(1 / 60, env, player, progress, () => {});
  assert(grabbed); ghost.reset(true, player.position); assert.equal(ghost.grabProtection, 0); assert(!ghost.holding);
});

(globalThis as unknown as { window: EventTarget & { BABYLON: typeof Babylon } }).window = Object.assign(new EventTarget(), { BABYLON: Babylon });
const { GhostArms, solveArm } = await import('../src/ghost-arms.ts');
const { Player } = await import('../src/player.ts');
const { CorazonPresentation } = await import('../src/corazon.ts');
const { GrabPresentation } = await import('../src/grab-presentation.ts');
const bytes = readFileSync('public/assets/models/enemies/ghost/ghost.glb');
const jsonLength = bytes.readUInt32LE(12), gltf = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString());
function fixture() {
  const engine = new Babylon.NullEngine(), scene = new Babylon.Scene(engine); scene.useRightHandedSystem = true;
  const camera = new Babylon.FreeCamera('camera', new Babylon.Vector3(0, 1.65, -8), scene);
  const root = new Babylon.TransformNode('ghost', scene);
  for (const model of gltf.meshes) {
    const mesh = new Babylon.Mesh(model.name, scene); mesh.parent = root;
    for (const [key, kind] of [['POSITION', Babylon.VertexBuffer.PositionKind], ['NORMAL', Babylon.VertexBuffer.NormalKind]]) {
      if (model.primitives[0].attributes[key] === undefined) {
        const normals = new Float32Array(mesh.getTotalVertices() * 3);
        for (let i = 1; i < normals.length; i += 3) normals[i] = 1;
        mesh.setVerticesData(kind, normals); continue;
      }
      const a = gltf.accessors[model.primitives[0].attributes[key]], v = gltf.bufferViews[a.bufferView];
      const start = 28 + jsonLength + (v.byteOffset ?? 0) + (a.byteOffset ?? 0), values = [];
      for (let i = 0; i < a.count; i++) for (let k = 0; k < 3; k++) values.push(bytes.readFloatLE(start + i * (v.byteStride ?? 12) + k * 4));
      mesh.setVerticesData(kind, values);
    }
  }
  return { engine, scene, camera, root };
}
test('procedural reach keeps link lengths, preserves the original face/dress and restores exact vertices', () => {
  const { root, engine } = fixture();
  try {
    const mesh = root.getChildMeshes()[0], original = Array.from(mesh.getVerticesData(Babylon.VertexBuffer.PositionKind)!);
    const normals = Array.from(mesh.getVerticesData(Babylon.VertexBuffer.NormalKind)!);
    const arms = new GhostArms(root);
    for (const side of [-1, 1]) {
      const shoulder = new Babylon.Vector3(side * .19, 1.43, -.065), elbow = new Babylon.Vector3(side * .265, 1.13, -.085), palm = new Babylon.Vector3(side * .398, .77, -.065);
      for (const target of [new Babylon.Vector3(0, 1.4, .4), new Babylon.Vector3(2, 3, 4), shoulder.clone(), shoulder.add(new Babylon.Vector3(side * .4, -.4, -.1))]) {
        const pose = solveArm(shoulder, elbow, palm, target, side);
        assert(Math.abs(Babylon.Vector3.Distance(shoulder, pose.elbow) - Babylon.Vector3.Distance(shoulder, elbow)) < 1e-6);
        assert(Math.abs(Babylon.Vector3.Distance(pose.elbow, pose.palm) - Babylon.Vector3.Distance(elbow, palm)) < 1e-6);
      }
    }
    arms.pose(new Babylon.Vector3(.2, 1.4, .4), new Babylon.Vector3(-.2, 1.4, .4), 1);
    const posed = mesh.getVerticesData(Babylon.VertexBuffer.PositionKind)!;
    const moved = [0, 0];
    for (let i = 0; i < posed.length; i += 3) {
      assert(Number.isFinite(posed[i] + posed[i + 1] + posed[i + 2]));
      if (Math.abs(original[i]) < .15 || original[i + 1] < .6) assert.deepEqual(Array.from(posed.slice(i, i + 3)), original.slice(i, i + 3));
      if (Math.abs(posed[i + 1] - original[i + 1]) > .1) moved[original[i] < 0 ? 0 : 1]++;
    }
    assert(moved.every(count => count > 200), `Both original arms must reach: ${moved}`);
    root.position.z = -9; root.computeWorldMatrix(true);
    arms.pose(new Babylon.Vector3(.2, 1.4, -8.6), new Babylon.Vector3(-.2, 1.4, -8.6), 1);
    assert(mesh.getBoundingInfo().boundingBox.maximumWorld.z < -8, 'Deformed body bounds must stay with the ghost, not at the origin');
    arms.reset(); assert.deepEqual(Array.from(mesh.getVerticesData(Babylon.VertexBuffer.PositionKind)!), original);
    assert.deepEqual(Array.from(mesh.getVerticesData(Babylon.VertexBuffer.NormalKind)!), normals);
  } finally { engine.dispose(); }
});
test('pull and release use collision/gravity; repeated recoveries restore the camera and movement basis', () => {
  const { root, engine, scene, camera } = fixture();
  const collision = new PlayerCollision(data, nav), player = new Player(), ghost = new GhostStateMachine();
  const viewRoot = new Babylon.TransformNode('arms', scene);
  const world = { ghost: root, scene, camera, data, collision, nav,
    corazon: new CorazonPresentation(scene, camera, root),
    legs: { meshes: [], poseGrab() { return [new Babylon.Vector3(-.15, .4, -8.8), new Babylon.Vector3(.15, .4, -8.8)]; } },
    viewmodel: { root: viewRoot, meshes: [], beginGrab() {}, endGrab() {}, poseGrab() { viewRoot.position.setAll(0); } },
  } as unknown as World;
  const presentation = new GrabPresentation(world, player, ghost);
  try {
    for (const [yaw, pitch] of [[0, 0], [3.12, 1.3], [-1.8, -1.2]]) {
      player.reset({ x: 0, y: .3, z: -8, level: 0 }); player.yaw = yaw; player.pitch = pitch; player.camera(world, DEFAULT_SETTINGS);
      ghost.position = { x: 0, y: 0, z: -9.02, level: 0 }; ghost.yaw = Math.PI;
      world.corazon.updateLocomotion(0, ghost, DEFAULT_SETTINGS);
      const qte = new GrabSequence(); qte.start('easy'); presentation.start();
      for (let i = 0; i < 140; i++) {
        qte.update(1 / 60); presentation.update(1 / 60, qte, DEFAULT_SETTINGS);
        assert(!collision.blocked(player.position)); assert.equal(camera.rotation.z, 0); assert.equal(camera.rotationQuaternion, null);
      }
      assert.equal(player.position.y, 0, 'Airborne capture must settle to the floor');
      assert(Math.abs(player.eye[1] - GRAB.eyeHeight) < 1e-6, 'Camera settles at ground height');
      assert(player.pitch < 0 && player.pitch > -.15, 'Ground view tracks the ghost and legs');
      assert(player.position.z < -8.1, 'Grab pulls the real body');
      for (let i = 0; i < 8; i++) qte.press();
      for (let i = 0; i < 120; i++) { qte.update(1 / 60); presentation.update(1 / 60, qte, DEFAULT_SETTINGS); }
      presentation.finish(); player.camera(world, DEFAULT_SETTINGS);
      assert(Math.hypot(ghost.position.x - player.position.x, ghost.position.z - player.position.z) > 1.3, 'Ghost recoil creates real separation');
      assert.equal(player.yaw, yaw); assert.equal(player.pitch, pitch); assert.equal(player.verticalVelocity, 0);
      player.yaw += .5; player.camera(world, DEFAULT_SETTINGS); scene.render();
      assert(Math.abs(camera.getViewMatrix(true).clone().invert().m[1]) < 1e-6);
      assert(Babylon.Vector3.Dot(camera.getForwardRay().direction, player.direction) > .999999);
    }
    player.reset({ x: .48, y: 0, z: -2.5, level: 0 }); player.halt(world);
    for (let i = 0; i < 30; i++) { player.moveHeld(1 / 60, .02, 0, world); assert(!collision.blocked(player.position)); }
  } finally { presentation.dispose(); engine.dispose(); }
});
