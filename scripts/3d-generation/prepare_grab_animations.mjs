// Offline extraction only. No Three.js or FBX loader is shipped with the game.
// npm install --prefix .cache/fbx-import --ignore-scripts three@0.180.0
// node scripts/3d-generation/prepare_grab_animations.mjs <directory-containing-FBXs>
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { FBXLoader } from '../../.cache/fbx-import/node_modules/three/examples/jsm/loaders/FBXLoader.js';
import { AnimationMixer, LoopOnce, Quaternion, Vector3 } from '../../.cache/fbx-import/node_modules/three/build/three.module.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const out = resolve(root, 'public/assets/animations/grab');
const source = resolve(process.argv[2] || resolve(out, 'source'));
await mkdir(resolve(out, 'source'), { recursive: true });
const files = { run: 'Running Crawl.fbx', stumble: 'Stumble Backwards.fbx', crawl: 'Crawl Backwards.fbx', kick: 'Kicking Out.fbx' };
const clips = {}, report = {};
const basis = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI);
const rounded = values => values.map(v => +v.toFixed(6));
for (const [key, file] of Object.entries(files)) {
  const bytes = await readFile(resolve(source, file));
  const model = new FBXLoader().parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length), '');
  const mesh = model.getObjectByName('Beta_Surface');
  if (!mesh?.isSkinnedMesh) throw new Error(`${file}: inspected Mixamo skin missing`);
  // Beta_Joints contains duplicate display bones; only Beta_Surface drives motion.
  const bones = new Map(mesh.skeleton.bones.map(b => [b.name.replace('mixamorig', ''), b]));
  const names = ['Hips', 'Spine2', 'Head', 'LeftHand', 'RightHand', 'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'RightUpLeg', 'RightLeg', 'RightFoot'];
  for (const name of names) if (!bones.has(name)) throw new Error(`${file}: missing ${name}`);
  model.updateMatrixWorld(true);
  const rest = new Map([...bones].map(([name, bone]) => [name, bone.getWorldQuaternion(new Quaternion()).invert()]));
  const clip = model.animations.find(c => c.name === 'mixamo.com' && c.tracks.length);
  if (!clip) throw new Error(`${file}: animation missing`);
  const mixer = new AnimationMixer(model), action = mixer.clipAction(clip);
  action.setLoop(LoopOnce, 1); action.clampWhenFinished = true; action.play();
  const count = Math.round(clip.duration * 30) + 1, frames = [];
  for (let frame = 0; frame < count; frame++) {
    mixer.setTime(Math.min(clip.duration - 1e-7, frame / 30)); model.updateMatrixWorld(true);
    const position = name => bones.get(name).getWorldPosition(new Vector3()).multiplyScalar(.01);
    const hip = position('Hips');
    const delta = name => basis.clone().multiply(bones.get(name).getWorldQuaternion(new Quaternion()).multiply(rest.get(name))).multiply(basis.clone().invert()).normalize();
    const pelvis = delta('Hips'), legs = [];
    for (const side of ['Left', 'Right']) {
      let parent = pelvis;
      for (const part of ['UpLeg', 'Leg', 'Foot']) {
        const current = delta(side + part);
        legs.push(...rounded(parent.clone().invert().multiply(current).normalize().toArray())); parent = current;
      }
    }
    const chest = position('Spine2').sub(hip);
    frames.push({ legs, pelvis: rounded(pelvis.toArray()), height: +hip.y.toFixed(6),
      // Ghost is +Z facing; hands are root-relative, with navigation root motion removed.
      hands: ['RightHand', 'LeftHand'].flatMap(name => rounded(position(name).sub(hip).toArray())),
      bend: +Math.atan2(chest.z, chest.y).toFixed(6), root: rounded(hip.toArray()) });
  }
  clips[key] = { duration: +( (count - 1) / 30 ).toFixed(6), fps: 30, frames };
  report[key] = { source: file, sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length,
    clip: clip.name, duration: clip.duration, frames: count, tracks: clip.tracks.length, skeleton: 'Beta_Surface', bones: bones.size,
    rootDistance: +Math.abs(frames.at(-1).root[2] - frames[0].root[2]).toFixed(4) };
  if (resolve(source, file) !== resolve(out, 'source', file)) await copyFile(resolve(source, file), resolve(out, 'source', file));
  mixer.stopAllAction(); mixer.uncacheRoot(model);
}
await writeFile(resolve(out, 'grab-motion.json'), JSON.stringify({ version: 1, clips }) + '\n');
await writeFile(resolve(out, 'integration-report.json'), JSON.stringify({ converter: 'three 0.180.0 FBXLoader, 30 Hz',
  coordinateSystem: 'FBX Y-up centimetres. World joint bind deltas converted to player -Z basis; translations stay in collision controller.',
  kickSide: 'Left', grabbedSide: 'Right', clips: report }, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
