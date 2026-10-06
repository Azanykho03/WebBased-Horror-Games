import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import Babylon from 'babylonjs';
import { corazonModelYaw, CORAZON_SCARE, ScareTimeline, scareFrame, angleDifference } from '../src/corazon-motion.ts';
import { GhostStateMachine } from '../src/ghost.ts';
import { DEFAULT_SETTINGS, freshProgress } from '../src/types.ts';
import type { HouseManifest } from '../src/types.ts';
import { createNavigation } from '../scripts/3d-generation/house-navigation.mjs';

(globalThis as unknown as { window: EventTarget & { BABYLON: typeof Babylon } }).window = Object.assign(new EventTarget(), { BABYLON: Babylon });
const { CorazonPresentation } = await import('../src/corazon.ts');
const bytes = readFileSync('public/assets/models/enemies/ghost/ghost.glb');
const jsonLength = bytes.readUInt32LE(12), gltf = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString());
function fixture(width = 1280, height = 720) {
  const engine = new Babylon.NullEngine({ renderWidth: width, renderHeight: height, textureSize: 512, deterministicLockstep: false, lockstepMaxSteps: 4 }), scene = new Babylon.Scene(engine); scene.useRightHandedSystem = true;
  const camera = new Babylon.FreeCamera('test-camera', new Babylon.Vector3(0, 1.65, 0), scene); camera.minZ = .045;
  const root = new Babylon.TransformNode('original-ghost', scene);
  for (const model of gltf.meshes) {
    const mesh = new Babylon.Mesh(model.name, scene); mesh.parent = root;
    const a = gltf.accessors[model.primitives[0].attributes.POSITION], v = gltf.bufferViews[a.bufferView];
    const start = 28 + jsonLength + (v.byteOffset ?? 0) + (a.byteOffset ?? 0), positions = [];
    for (let i = 0; i < a.count; i++) for (let k = 0; k < 3; k++) positions.push(bytes.readFloatLE(start + i * (v.byteStride ?? 12) + k * 4));
    mesh.setVerticesData(Babylon.VertexBuffer.PositionKind, positions);
  }
  return { engine, scene, camera, root, presentation: new CorazonPresentation(scene, camera, root) };
}
test('preserved GLB is unrigged; all headings map its +Z face to gameplay forward', () => {
  assert.equal(gltf.skins, undefined); assert.equal(gltf.animations, undefined);
  assert.deepEqual(gltf.meshes.map((m: { name: string }) => m.name), ['Ghost_body', 'Ghost_head']);
  for (let yaw = -Math.PI; yaw <= Math.PI; yaw += Math.PI / 8) {
    const face = Babylon.Vector3.TransformNormal(Babylon.Vector3.Forward(), Babylon.Matrix.RotationY(corazonModelYaw(yaw)));
    assert(Babylon.Vector3.Dot(face, new Babylon.Vector3(Math.sin(yaw), 0, -Math.cos(yaw))) > .999999);
  }
});
test('reference durations, duplicate suppression and one reveal survive dropped frames and reset', () => {
  for (const kind of ['jumpscare', 'capture'] as const) for (const dt of [1 / 144, 1 / 60, 1 / 20, .8, 5]) {
    const timeline = new ScareTimeline(); assert(timeline.start(kind)); assert(!timeline.start(kind));
    let reveals = 0, finished = false;
    while (!finished) {
      const event = timeline.update(dt); reveals += Number(event.reveal); finished = event.finished;
      if (event.reveal) {
        assert.equal(timeline.time, CORAZON_SCARE[kind].reveal);
        assert(!event.finished, 'A slow frame must render the face before ending');
      }
    }
    assert.equal(reveals, 1); assert(!timeline.update(0).reveal);
    assert(timeline.time >= CORAZON_SCARE[kind].duration); assert(!timeline.start(kind));
    timeline.reset(); assert(timeline.start(kind)); assert.equal(timeline.time, 0);
  }
});
test('camera-relative face stays centered and clear of clipping at every heading and extreme pitch', () => {
  const { presentation: p, camera, root, engine } = fixture();
  const originalVertices = p.head.getVerticesData(Babylon.VertexBuffer.PositionKind)!.slice();
  for (const kind of ['jumpscare', 'capture'] as const) for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) for (const pitch of [-1.35, 0, 1.35]) {
    camera.position.set(3, 2.2, -4); camera.setTarget(camera.position.add(new Babylon.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch))));
    const originalPosition = camera.position.clone(), originalFov = camera.fov;
    root.position.set(3, .5, -3.3); root.rotationQuaternion = Babylon.Quaternion.Identity();
    assert(p.start(kind, DEFAULT_SETTINGS));
    assert(Babylon.Vector3.Distance(camera.position, originalPosition) < .00001);
    let reveals = 0;
    for (let i = 0; i < Math.ceil(CORAZON_SCARE[kind].duration * 60); i++) {
      const event = p.update(1 / 60, DEFAULT_SETTINGS); reveals += Number(event.reveal);
      assert(Babylon.Vector3.Distance(camera.position, originalPosition) < .00001, 'Scares must not translate/drop the camera');
      if (p.timeline.time < CORAZON_SCARE[kind].settle) continue;
      const face = p.facePosition(), local = Babylon.Vector3.TransformCoordinates(face, camera.getViewMatrix(true));
      assert(Math.abs(local.x) < .015 && Math.abs(local.y) < .015, `${kind} ${yaw}/${pitch}: face ${local.asArray()}`);
      assert(local.z < -.2);
      const forward = camera.getForwardRay().direction;
      for (const corner of p.head.getBoundingInfo().boundingBox.vectorsWorld) assert(Babylon.Vector3.Dot(corner.subtract(camera.position), forward) >= camera.minZ + .099);
    }
    assert.equal(reveals, 1); p.finish();
    assert(Babylon.Vector3.Distance(camera.position, originalPosition) < .00001); assert.equal(camera.fov, originalFov);
    assert.equal(p.head.renderingGroupId, 0); assert.equal(p.head.visibility, 1);
  }
  assert.deepEqual(p.head.getVerticesData(Babylon.VertexBuffer.PositionKind), originalVertices); engine.dispose();
});
test('accessibility retains timing, increases distance and reduces head/camera motion', () => {
  for (const kind of ['capture', 'jumpscare'] as const) {
    const normal = scareFrame(kind, .75), reduced = scareFrame(kind, .75, true), gentle = scareFrame(kind, .75, false, true);
    assert.equal(reduced.revealed, normal.revealed);
    assert(Math.abs(reduced.roll) < Math.abs(normal.roll)); assert(gentle.distance > normal.distance);
  }
});
test('the face is fully visible and close on the single audio reveal beat', () => {
  for (const kind of ['capture', 'jumpscare'] as const) {
    const frame = scareFrame(kind, CORAZON_SCARE[kind].reveal);
    assert.equal(frame.approach, 1); assert.equal(frame.visibility, 1);
    assert(frame.distance <= .66);
  }
  assert.equal(scareFrame('jumpscare', CORAZON_SCARE.jumpscare.reveal - .001).visibility, 0);
});
test('portrait and landscape keep the whole head within the camera frustum', () => {
  for (const [width, height] of [[390, 844], [844, 390]]) {
    const { engine, camera, presentation: p, root } = fixture(width, height);
    root.position.set(0, 0, -.7); root.rotationQuaternion = Babylon.Quaternion.Identity();
    for (const kind of ['jumpscare', 'capture'] as const) {
      p.start(kind, DEFAULT_SETTINGS);
      for (let i = 0; i < 140; i++) {
        p.update(1 / 60, DEFAULT_SETTINGS);
        if (p.timeline.time < CORAZON_SCARE[kind].settle) continue;
        p.facePosition();
        const tangent = Math.tan(camera.fov / 2);
        for (const corner of p.head.getBoundingInfo().boundingBox.vectorsWorld) {
          const local = Babylon.Vector3.TransformCoordinates(corner, camera.getViewMatrix(true));
          assert(Math.abs(local.x / (-local.z * tangent * width / height)) < .921);
          assert(Math.abs(local.y / (-local.z * tangent)) < .921);
        }
      }
      p.finish();
    }
    engine.dispose();
  }
});
test('pursuit turns smoothly with forward travel and bounded acceleration', () => {
  const data = JSON.parse(readFileSync('public/assets/models/environments/haunted-house/house-manifest.json', 'utf8')) as HouseManifest;
  const nav = createNavigation({ ...data, colliders: [], props: [], rooms: [{ id: 'TEST', name: 'test', floor: 0, rects: [[-10, 10, -20, 10]] }], stair: { ...data.stair, rect: [30, 31, 30, 31] } });
  const g = new GhostStateMachine(), progress = freshProgress(); g.state = 'Chase'; g.position = { x: 0, y: 0, z: 0, level: 0 };
  const player = { position: { x: 0, y: 0, z: 1.8, level: 0 as const }, hidden: false, hideExposed: false };
  let moved = 0, caught = false;
  for (let i = 0; i < 300 && !caught; i++) {
    const before = { ...g.position }, yaw = g.yaw, speed = g.speed;
    caught = g.update(1 / 60, { nav, clearSight: () => true }, player, progress, () => {});
    assert(Math.abs(angleDifference(g.yaw, yaw)) <= 5.5 / 60 + .00001);
    assert(g.speed - speed <= 6 / 60 + .00001);
    const dx = g.position.x - before.x, dz = g.position.z - before.z, distance = Math.hypot(dx, dz);
    if (distance > .00001) { assert((dx * Math.sin(g.yaw) - dz * Math.cos(g.yaw)) / distance > .999); moved += distance; }
  }
  assert(moved > 1); assert(caught);
});
