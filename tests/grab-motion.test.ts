import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import Babylon from 'babylonjs';
import { GrabSequence, GRAB } from '../src/grab.ts';
import { cameraNoise, orientPlayerCamera, shakeGrabCamera } from '../src/player-camera.ts';
import { DEFAULT_SETTINGS } from '../src/types.ts';

(globalThis as unknown as { window: EventTarget & { BABYLON: typeof Babylon } }).window = Object.assign(new EventTarget(), { BABYLON: Babylon });
const { GrabMotion } = await import('../src/grab-motion.ts');
const { PlayerLegs } = await import('../src/player-legs.ts');
const { Player } = await import('../src/player.ts');
const directory = 'public/assets/animations/grab/';
const data = JSON.parse(readFileSync(directory + 'grab-motion.json', 'utf8'));
const motion = new GrabMotion(data);

test('all four runtime clips come from the exact supplied FBX files, with finite unit rotations', () => {
  const report = JSON.parse(readFileSync(directory + 'integration-report.json', 'utf8'));
  for (const key of ['run', 'stumble', 'crawl', 'kick'] as const) {
    const source = report.clips[key];
    assert.equal(createHash('sha256').update(readFileSync(directory + 'source/' + source.source)).digest('hex'), source.sha256);
    assert(source.tracks > 0); assert.equal(data.clips[key].frames.length, source.frames);
    for (let t = 0; t < motion.duration(key) + .1; t += .013) {
      const pose = motion.sample(key, t);
      for (const q of [...pose.legs, pose.pelvis]) { assert(q.asArray().every(Number.isFinite)); assert(Math.abs(q.length() - 1) < 1e-6); }
    }
    const loopA = motion.sample(key, .12, true), loopB = motion.sample(key, .12 + motion.duration(key), true);
    assert(Math.abs(Babylon.Quaternion.Dot(loopA.legs[0], loopB.legs[0])) > .999999);
  }
  assert.equal(report.grabbedSide, 'Right'); assert.equal(report.kickSide, 'Left');
  assert.throws(() => new GrabMotion({ ...data, clips: { ...data.clips, kick: null } }));
});

test('Perlin shake is continuous, bounded, deterministic and clears without rotational drift', () => {
  const engine = new Babylon.NullEngine(), scene = new Babylon.Scene(engine);
  const camera = new Babylon.FreeCamera('shake-test', Babylon.Vector3.Zero(), scene);
  try {
    for (let i = 0; i < 600; i++) {
      const t = i / 60;
      assert.equal(cameraNoise(t, 31), cameraNoise(t, 31));
      assert(Math.abs(cameraNoise(t, 31) - cameraNoise(t + .00001, 31)) < .0001);
      assert(Math.abs(cameraNoise(t, 31)) <= 1);
      orientPlayerCamera(camera, 3.12, -.8); camera.position.set(0, .47, 0);
      shakeGrabCamera(camera, t, 1, 1.4, .8, 1);
      assert(Math.abs(camera.rotation.z) <= .12); assert(camera.position.y > .43 && camera.position.y < .51);
    }
    orientPlayerCamera(camera, 3.12, -.8); camera.position.set(0, .47, 0);
    shakeGrabCamera(camera, 17, 1, 1, 1, 0);
    assert.equal(Math.abs(camera.rotation.z), 0); assert.equal(camera.rotation.x, -.8); assert.equal(camera.position.y, .47);
  } finally { engine.dispose(); }
});

test('real leg bind hierarchy hides during movement and masks every kick off the held right chain', () => {
  const engine = new Babylon.NullEngine(), scene = new Babylon.Scene(engine); scene.useRightHandedSystem = true;
  const bytes = readFileSync('public/assets/models/player/legs/student-uniform-legs.glb');
  const gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
  const root = new Babylon.Mesh('__root__', scene), skeleton = new Babylon.Skeleton('legs', 'legs', scene);
  const nodes = new Map<number, Babylon.TransformNode>(), bones = new Map<number, Babylon.Bone>();
  for (const index of gltf.skins[0].joints as number[]) {
    const definition = gltf.nodes[index], node = new Babylon.TransformNode(definition.name, scene);
    node.position.copyFromFloats(...(definition.translation ?? [0, 0, 0]) as [number, number, number]);
    node.rotationQuaternion = Babylon.Quaternion.Identity(); node.parent = root; nodes.set(index, node);
    const parentIndex = [...nodes.keys()].find(n => gltf.nodes[n].children?.includes(index));
    if (parentIndex !== undefined) node.parent = nodes.get(parentIndex)!;
    const bone = new Babylon.Bone(definition.name, skeleton, parentIndex === undefined ? null : bones.get(parentIndex)!);
    bone.linkTransformNode(node); bones.set(index, bone);
  }
  const imported = { meshes: [root], skeletons: [skeleton] } as unknown as Babylon.ISceneLoaderAsyncResult;
  const legs = new PlayerLegs(scene, imported, motion), player = new Player(), sequence = new GrabSequence();
  try {
    player.position = { x: 0, y: 0, z: 0, level: 0 }; player.grabbed = false;
    for (const pitch of [-1.35, -.8, 0, 1.35]) {
      player.pitch = pitch; player.moving = player.sprinting = true;
      legs.update(.05, player, .2, DEFAULT_SETTINGS); assert(!legs.root.isEnabled());
    }
    sequence.start('easy'); sequence.phase = 'struggling'; sequence.time = .4;
    const baseline = legs.poseGrab(player, 0, 1, 0, GRAB.kickSeconds, sequence)[1].clone();
    const held = skeleton.bones.filter(b => /\.R$/.test(b.name)).map(b => b.getTransformNode()!.rotationQuaternion!.clone());
    const left = skeleton.bones.find(b => b.name === 'Thigh.L')!.getTransformNode()!;
    const initialLeft = left.rotationQuaternion!.clone(); let moved = false;
    for (let frame = 0; frame < 32; frame++) {
      const contacts = legs.poseGrab(player, 0, 1, 0, frame / 100, sequence);
      assert(legs.root.isEnabled()); assert(Babylon.Vector3.Distance(baseline, contacts[1]) < .00001, 'Kick cannot displace held ankle');
      skeleton.bones.filter(b => /\.R$/.test(b.name)).forEach((bone, i) => assert(Math.abs(Babylon.Quaternion.Dot(held[i], bone.getTransformNode()!.rotationQuaternion!)) > .999999));
      moved ||= Math.abs(Babylon.Quaternion.Dot(initialLeft, left.rotationQuaternion!)) < .995;
    }
    assert(moved, 'Actual imported clip must move the free left thigh');
    // Phase transitions retain the same fall endpoint and advancing crawl pose.
    sequence.phase = 'falling'; sequence.time = GRAB.fallSeconds;
    const fallEnd = legs.poseGrab(player, 0, 1, 0, GRAB.kickSeconds, sequence, 1.5)[1].clone();
    sequence.phase = 'dragging'; sequence.time = 0;
    const dragStart = legs.poseGrab(player, 0, 1, 0, GRAB.kickSeconds, sequence, 1.5)[1].clone();
    assert(Babylon.Vector3.Distance(fallEnd, dragStart) < .00001, 'Fall-to-drag cannot snap the held ankle');
    sequence.time = GRAB.dragSeconds;
    const dragEnd = legs.poseGrab(player, 0, 1, 0, GRAB.kickSeconds, sequence, 2.15)[1].clone();
    const freeBefore = left.rotationQuaternion!.clone();
    sequence.phase = 'struggling'; sequence.time = 0;
    const struggleStart = legs.poseGrab(player, 0, 1, 0, GRAB.kickSeconds, sequence, 2.15)[1].clone();
    assert(Babylon.Vector3.Distance(dragEnd, struggleStart) < .00001, 'QTE entry cannot displace the held ankle');
    assert(Math.abs(Babylon.Quaternion.Dot(freeBefore, left.rotationQuaternion!)) > .999999, 'QTE entry cannot restart the free-leg crawl');
    legs.reset(); assert(!legs.root.isEnabled());
  } finally { engine.dispose(); }
});
