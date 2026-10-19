import type * as Babylon from 'babylonjs';
import { B } from './world.ts';
import type { World } from './world.ts';
import type { Player } from './player.ts';
import type { GhostStateMachine } from './ghost.ts';
import type { Settings } from './types.ts';
import { GRAB } from './grab.ts';
import type { GrabSequence } from './grab.ts';
import { angleDifference, corazonModelYaw, mix, smoothStep } from './corazon-motion.ts';
import { GhostArms } from './ghost-arms.ts';
import { haltPlayerCamera, orientPlayerCamera } from './player-camera.ts';

/** One coordinated presentation over the existing player physics and AI state. */
export class GrabPresentation {
  private world: World;
  private player: Player;
  private ghost: GhostStateMachine;
  private arms: GhostArms;
  private fill: Babylon.PointLight;
  private spine: Babylon.TransformNode;
  private motionTime = 0;
  private dragged = 0;
  private recoil = 0;
  private fallStep = 0;
  private kickAge: [number, number] = [1, 1];
  private kicks: [number, number] = [0, 0];
  private pressCount = 0;
  private saved?: {
    yaw: number; pitch: number; fov: number; ghostYaw: number; targetYaw: number; dx: number; dz: number; distance: number;
    torso: Babylon.Quaternion; head: Babylon.Quaternion; headPosition: Babylon.Vector3; headScale: Babylon.Vector3;
    groups: number[];
  };
  get gripTargets(): readonly Babylon.Vector3[] { return this.arms.grips; }
  constructor(world: World, player: Player, ghost: GhostStateMachine) {
    this.world = world; this.player = player; this.ghost = ghost;
    this.arms = new GhostArms(world.ghost);
    this.spine = new B.TransformNode('celestina-grab-spine', world.scene);
    this.spine.parent = world.corazon.torso; this.spine.position.y = .63;
    this.spine.rotationQuaternion = B.Quaternion.Identity();
    this.fill = new B.PointLight('grab-contact-light', B.Vector3.Zero(), world.scene);
    this.fill.parent = world.camera; this.fill.position.set(-.15, .1, -.1);
    this.fill.includedOnlyMeshes = [...world.ghost.getChildMeshes(), ...(world.legs?.meshes ?? [])]; this.fill.diffuse.set(.67, .74, .78);
    this.fill.range = 3.5; this.fill.radius = .5; this.fill.setEnabled(false); this.fill.renderPriority = 10;
  }
  start(): void {
    const { player, world, ghost } = this;
    const dx = ghost.position.x - player.position.x, dz = ghost.position.z - player.position.z;
    const targetYaw = Math.atan2(dx, -dz), head = world.corazon.head;
    this.saved = { yaw: player.yaw, pitch: player.pitch, fov: world.camera.fov, ghostYaw: ghost.yaw,
      targetYaw, dx: Math.sin(targetYaw), dz: -Math.cos(targetYaw), distance: Math.hypot(dx,dz), torso: world.corazon.torso.rotationQuaternion!.clone(),
      head: head.rotationQuaternion!.clone(), headPosition: head.position.clone(), headScale: head.scaling.clone(),
      groups: world.viewmodel.meshes.map(mesh => mesh.renderingGroupId) };
    this.spine.rotationQuaternion!.copyFromFloats(0, 0, 0, 1); head.setParent(this.spine);
    player.halt(world); world.viewmodel.beginGrab(); world.viewmodel.poseGrab(0, 0, 0, false);
    for (const mesh of world.viewmodel.meshes) mesh.renderingGroupId = 0;
    this.fill.setEnabled(true); this.motionTime = this.dragged = this.recoil = this.pressCount = this.fallStep = 0;
    this.kickAge[0] = this.kickAge[1] = 1;
  }
  press(): void { this.kickAge[this.pressCount++ % 2] = 0; }
  update(dt: number, sequence: GrabSequence, settings: Settings): void {
    const saved = this.saved; if (!saved) return;
    const { world, player, ghost } = this, phase = sequence.phase;
    this.motionTime += dt;
    for (let side = 0; side < 2; side++) {
      this.kickAge[side] += dt;
      this.kicks[side] = Math.sin(Math.PI * Math.min(1, this.kickAge[side] / .28));
    }
    const reaching = phase === 'grab-start', recovering = phase === 'recovery' || phase === 'idle';
    const reach = reaching ? smoothStep(sequence.time / GRAB.reachSeconds) : 1;
    const fall = reaching ? 0 : phase === 'falling' ? smoothStep(sequence.time / GRAB.fallSeconds) : 1;
    const release = phase === 'release' ? smoothStep(sequence.time / GRAB.releaseSeconds) : recovering ? 1 : 0;
    const recovery = recovering ? smoothStep(sequence.time / GRAB.recoverySeconds) : 0;
    const final = phase === 'escape-kick' ? smoothStep(sequence.time / .20) : phase === 'release' ? 1 - release : 0;
    const kill = phase === 'killing' ? smoothStep(sequence.time / GRAB.finishLeadSeconds) : 0;
    const held = reach * (1 - release) * (1 - kill), prone = fall * (1 - recovery);
    const effort = Math.max(this.kicks[0], this.kicks[1], final);
    // Step back as the legs extend during the fall. The ghost never snaps from
    // a standing ankle grip to a different ground-space contact.
    const retreat = Math.max(0, GRAB.groundDistance - saved.distance) * fall;
    ghost.position = world.nav.move(ghost.position, saved.dx * (retreat - this.fallStep), saved.dz * (retreat - this.fallStep), false);
    this.fallStep = retreat;
    const drag = ['grab-start', 'falling'].includes(phase) ? 0 : phase === 'dragging' ? smoothStep(sequence.time / GRAB.dragSeconds) : 1;
    const desired = GRAB.pullDistance * drag, step = desired - this.dragged; this.dragged = desired;
    // Both actors move through the same collision-checked segment. A blocked
    // pull cannot teleport the player or pull the ghost through a closed door.
    const before = { ...player.position }, oldGhost = { ...ghost.position };
    const next = world.nav.move(oldGhost, saved.dx * step, saved.dz * step, false);
    const travel = (next.x - oldGhost.x) * saved.dx + (next.z - oldGhost.z) * saved.dz;
    player.moveHeld(dt, saved.dx * travel, saved.dz * travel, world);
    const actual = (player.position.x - before.x) * saved.dx + (player.position.z - before.z) * saved.dz;
    ghost.position = world.nav.move(oldGhost, saved.dx * actual, saved.dz * actual, false);
    const desiredRecoil = GRAB.separationDistance * release;
    ghost.position = world.nav.move(ghost.position, saved.dx * (desiredRecoil - this.recoil), saved.dz * (desiredRecoil - this.recoil), false);
    this.recoil = desiredRecoil;
    const turn = reach * (1 - recovery);
    player.yaw = saved.yaw + angleDifference(saved.targetYaw, saved.yaw) * turn;
    player.grabView = { height: mix(1.65, GRAB.eyeHeight, prone), back: GRAB.eyeBack * prone };
    player.pitch = mix(saved.pitch, mix(-.48, -.08, fall), turn);
    player.camera(world, settings); haltPlayerCamera(world.camera);
    const shake = settings.reducedMotion ? 0 : (.003 * Math.sin(this.motionTime * 21) * drag + effort * .012) * (1 - recovery);
    orientPlayerCamera(world.camera, player.yaw, player.pitch + shake);
    world.camera.fov = saved.fov + (settings.reducedMotion ? 0 : .035 * fall * (1 - recovery));
    ghost.yaw = saved.ghostYaw + angleDifference(saved.targetYaw + Math.PI, saved.ghostYaw) * reach;
    world.ghost.position.set(ghost.position.x, ghost.position.y + .015, ghost.position.z);
    world.ghost.rotationQuaternion!.copyFrom(B.Quaternion.RotationYawPitchRoll(corazonModelYaw(ghost.yaw), 0, 0));
    B.Quaternion.SlerpToRef(saved.torso, B.Quaternion.Identity(), reach, world.corazon.torso.rotationQuaternion!);
    const bend = mix(1.53, 1.54 - effort * .01, fall) * reach * (1 - release * .65) * (1 - recovery) * (1 - kill);
    B.Quaternion.FromEulerAnglesToRef(bend, 0, 0, this.spine.rotationQuaternion!);
    world.corazon.head.rotationQuaternion!.copyFrom(saved.head.multiply(B.Quaternion.FromEulerAngles(-bend * .65 - effort * .04, (this.kicks[0] - this.kicks[1]) * .035, 0)));
    const contacts = world.legs.poseGrab(player, player.yaw, fall, recovery, this.kicks, final);
    this.arms.pose(contacts[0], contacts[1], held, bend);
    // Existing arms and attached flashlight stay beside the torso while kicking.
    world.viewmodel.poseGrab(reach * (1 - recovery) * (1 - kill), effort * .25, this.motionTime, settings.reducedMotion);
    world.viewmodel.root.position.y -= .18 * prone;
    this.fill.intensity = .9 * reach * (1 - recovery) * settings.brightness;
  }
  finish(restoreLook = true): void {
    const saved = this.saved; if (!saved) return;
    const { world, player } = this, head = world.corazon.head;
    this.arms.reset(); world.viewmodel.endGrab(); this.fill.setEnabled(false);
    head.setParent(world.corazon.torso); head.position.copyFrom(saved.headPosition); head.scaling.copyFrom(saved.headScale);
    head.rotationQuaternion!.copyFrom(saved.head); this.spine.rotationQuaternion!.copyFromFloats(0, 0, 0, 1);
    world.corazon.torso.rotationQuaternion!.copyFrom(saved.torso);
    world.viewmodel.meshes.forEach((mesh, i) => mesh.renderingGroupId = saved.groups[i]);
    world.camera.fov = saved.fov;
    if (restoreLook) { player.yaw = saved.yaw; player.pitch = saved.pitch; player.grabView = null; }
    player.halt(world); this.saved = undefined;
  }
  dispose(): void { this.finish(); this.fill.dispose(); this.spine.dispose(); }
}
