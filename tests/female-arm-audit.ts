import { B } from '../src/world.ts';
import type { World } from '../src/world.ts';
import type { Player, InputSystem } from '../src/player.ts';
import type { InteractionSystem } from '../src/interactions.ts';
import type { Progress } from '../src/types.ts';
import { freshProgress, DEFAULT_SETTINGS } from '../src/types.ts';
import { interact } from '../src/objectives.ts';

/** Real loaded skin, matrices and production controllers; development UI only. */
export function auditFemaleArm(world: World, player: Player, interactions: InteractionSystem, progress: Progress): string {
  const vm = world.viewmodel, checks: string[] = [], originalSkeletons = world.scene.skeletons.length;
  const assert = (ok: boolean, label: string) => { if (!ok) throw new Error(label); checks.push(label); };
  const originalIndices = vm.rightArm.getVerticesData(B.VertexBuffer.MatricesIndicesKind)!.slice();
  const originalWeights = vm.rightArm.getVerticesData(B.VertexBuffer.MatricesWeightsKind)!.slice();
  const originalPoses = vm.skeleton.bones.map(bone => Array.from(bone.getBindMatrix().asArray()));
  const queued = new Set<string>(), keys = new Set<string>();
  const input = { keys, look: () => [0, 0], consume: (key: string) => { const hit = queued.has(key); queued.delete(key); return hit; } } as unknown as InputSystem;
  const settings = { ...DEFAULT_SETTINGS, reducedMotion: false };
  const tick = (dt = 1 / 60) => {
    player.update(dt, input, world, progress, settings, () => {}, () => {});
    world.lighting(player.direction, settings, progress, player.flashlight, 0);
  };
  const aim = (id: 'flashlight' | 'note') => {
    const at = interactions.hotspots.find(h => h.id === id)!.position, eye = player.eye;
    player.yaw = Math.atan2(at[0] - eye[0], -(at[2] - eye[2]));
    player.pitch = Math.atan2(at[1] - eye[1], Math.hypot(at[0] - eye[0], at[2] - eye[2]));
    player.camera(world, settings);
  };
  Object.assign(progress, freshProgress()); player.reset({ x: 5.9, y: 0, z: -2.1, level: 0 });
  vm.reset(false); interactions.reset(progress); tick();
  queued.add('KeyF'); tick();
  assert(!player.flashlight && !vm.visible && vm.pickupRoot.isEnabled(), 'Fresh game: table lamp only; F is inert');
  aim('flashlight');
  assert(interactions.focus(player, progress)?.id === 'flashlight', 'Table flashlight is reachable through the existing focus system');
  const before = vm.lamp.getAbsolutePosition().clone();
  interact(progress, 'flashlight'); vm.pickup(); interactions.sync(progress); vm.lamp.computeWorldMatrix(true);
  assert(B.Vector3.Distance(before, vm.lamp.getAbsolutePosition()) < .0001, 'Pickup preserves lamp world position at reparent');
  assert(vm.lamp.parent === vm.socket && vm.socket.parent === vm.hand, 'Original Hand.R_027 owns socket and flashlight');
  queued.add('KeyF'); tick(.2);
  assert(!player.flashlight && !vm.ready && !vm.pickupRoot.isEnabled(), 'Equip gates F and removes the table instance');
  tick(.58);
  assert(vm.ready && player.flashlight && world.flashlight.intensity > 0, 'Equip finishes at 0.78 seconds and enables the beam');
  assert(!interactions.available(interactions.hotspots.find(h => h.id === 'flashlight')!, progress), 'Collected flashlight cannot be picked up twice');
  aim('note');
  assert(interactions.focus(player, progress)?.id === 'note' && interact(progress, 'note').changed, 'Warning remains readable on the same table');
  queued.add('KeyF'); tick(); assert(!player.flashlight && world.flashlight.intensity === 0, 'F turns the beam off');
  queued.add('KeyF'); tick(); assert(player.flashlight && world.flashlight.intensity > 0, 'F turns the beam on');
  let maxBeamError = 0, minDirectionDot = 1;
  const shoulder = vm.skeleton.bones.find(b => b.name === 'Shoulder_2.R_025')!.getTransformNode()!;
  const elbow = vm.skeleton.bones.find(b => b.name === 'Forearm.R_026')!.getTransformNode()!;
  const baseline = [shoulder, elbow, vm.hand].map(n => n.rotationQuaternion!.clone());
  const changed = [false, false, false];
  for (const mode of ['idle', 'walk', 'run'] as const) {
    keys.clear();
    player.reset({ x: 0, y: 0, z: -3, level: 0 }); player.flashlight = true;
    if (mode !== 'idle') keys.add('KeyW');
    if (mode === 'run') keys.add('ShiftLeft');
    for (let frame = 0; frame < 60; frame++) {
      player.yaw = Math.sin(frame / 50) * .5; player.pitch = Math.sin(frame / 40) * .6;
      tick();
      maxBeamError = Math.max(maxBeamError, B.Vector3.Distance(vm.lens.getAbsolutePosition(), world.flashlight.position));
      minDirectionDot = Math.min(minDirectionDot, B.Vector3.Dot(vm.lens.getDirection(new B.Vector3(0, 0, -1)).normalize(), world.flashlight.direction));
      [shoulder, elbow, vm.hand].forEach((n, i) => { changed[i] ||= 1 - Math.abs(B.Quaternion.Dot(n.rotationQuaternion!, baseline[i])) > 1e-8; });
      if (vm.leftArm.isEnabled()) throw new Error('Second arm reappeared');
    }
  }
  assert(changed.every(Boolean), 'Shoulder, elbow and wrist all animate; only the right skin is visible');
  assert(maxBeamError < .0001 && minDirectionDot > .999999, 'Beam follows the lens through movement and camera turns');
  player.hidden = true; tick(); assert(!vm.visible && !player.flashlight && !vm.ready, 'Hiding disables the arm and beam');
  player.hidden = false; tick(); assert(vm.visible && !vm.leftArm.isEnabled(), 'Leaving cover restores only the right arm');
  vm.reset(true); const first = [shoulder, elbow, vm.hand].map(n => n.computeWorldMatrix(true).clone());
  for (let i = 0; i < 100; i++) { vm.reset(false); vm.reset(true); }
  const drift = [shoulder, elbow, vm.hand].some((n, i) => {
    n.computeWorldMatrix(true); return n.getWorldMatrix().asArray().some((x, j) => Math.abs(x - first[i].asArray()[j]) > .0001);
  });
  assert(!drift && vm.ready && !vm.pickupRoot.isEnabled(), '100 checkpoint/new-game cycles restore the pose without drift');
  assert(world.scene.skeletons.length === originalSkeletons && vm.sourcePoses.every(g => !g.isPlaying), 'No extra skeleton or conflicting source-pose playback');
  assert(originalIndices.every((v, i) => v === vm.rightArm.getVerticesData(B.VertexBuffer.MatricesIndicesKind)![i])
    && originalWeights.every((v, i) => v === vm.rightArm.getVerticesData(B.VertexBuffer.MatricesWeightsKind)![i])
    && originalPoses.every((matrix, i) => matrix.every((v, j) => v === vm.skeleton.bones[i].getBindMatrix().asArray()[j])),
  'Original joint indices, skin weights and bind matrices remain unchanged');
  player.reset({ x: 5.9, y: 0, z: -2.1, level: 0 }); player.flashlight = true; keys.clear(); tick(0);
  return `PASS · ${checks.length} loaded-rig checks\n${checks.map(x => '✓ ' + x).join('\n')}\nMaximum beam error: ${(maxBeamError * 1000).toFixed(6)} mm\nMinimum beam direction dot: ${minDirectionDot.toFixed(9)}`;
}
