import type * as Babylon from 'babylonjs';
import { B } from './world.ts';
import type { World } from './world.ts';
import type { Player } from './player.ts';
import type { GhostStateMachine } from './ghost.ts';
import type { Settings } from './types.ts';
import { GRAB } from './grab.ts';
import type { GrabSequence } from './grab.ts';
import { angleDifference, corazonModelYaw, mix, smoothStep } from './corazon-motion.ts';
import { haltPlayerCamera, orientPlayerCamera, shakeGrabCamera } from './player-camera.ts';

/** One coordinated presentation over the existing player physics and AI state. */
export class GrabPresentation {
  private world: World;
  private player: Player;
  private ghost: GhostStateMachine;
  private fill: Babylon.PointLight;
  private motionTime = 0;
  private dragged = 0;
  private recoil = 0;
  private fallStep = 0;
  private kickAge = GRAB.kickSeconds as number;
  private support = B.Vector3.Zero();
  private gripping = false;
  private saved?: {
    yaw: number; pitch: number; fov: number; ghostYaw: number; targetYaw: number; dx: number; dz: number; distance: number;
    groups: number[];
  };
  get gripTargets(): readonly Babylon.Vector3[] { return this.gripping ? [this.world.corazon.arms.grips[1]] : []; }
  get grabbedSide(): number | null { return this.gripping ? 1 : null; }
  constructor(world: World, player: Player, ghost: GhostStateMachine) {
    this.world = world; this.player = player; this.ghost = ghost;
    this.fill = new B.PointLight('grab-contact-light', B.Vector3.Zero(), world.scene);
    this.fill.parent = world.camera; this.fill.position.set(-.15, .1, -.1);
    this.fill.includedOnlyMeshes = [...world.ghost.getChildMeshes(), ...(world.legs?.meshes ?? [])]; this.fill.diffuse.set(.67, .74, .78);
    this.fill.range = 3.5; this.fill.radius = .5; this.fill.setEnabled(false); this.fill.renderPriority = 10;
  }
  start(): void {
    if (this.saved) return;
    const { player, world, ghost } = this;
    const dx = ghost.position.x - player.position.x, dz = ghost.position.z - player.position.z;
    const targetYaw = Math.atan2(dx, -dz);
    this.saved = { yaw: player.yaw, pitch: player.pitch, fov: world.camera.fov, ghostYaw: ghost.yaw,
      targetYaw, dx: Math.sin(targetYaw), dz: -Math.cos(targetYaw), distance: Math.hypot(dx,dz),
      groups: world.viewmodel.meshes.map(mesh => mesh.renderingGroupId) };
    player.halt(world); world.viewmodel.beginGrab(); world.viewmodel.poseGrab(0, 0, 0, false);
    for (const mesh of world.viewmodel.meshes) mesh.renderingGroupId = 0;
    this.fill.setEnabled(true); this.motionTime = this.dragged = this.recoil = this.fallStep = 0;
    this.kickAge = GRAB.kickSeconds; this.gripping = true;
  }
  press(final = false): void {
    if (!this.saved || !this.gripping) return;
    // Mash inputs advance one free-leg action. No alternating feet, action stacks,
    // or queue which could keep kicking after the QTE has ended.
    this.kickAge = final || this.kickAge >= GRAB.kickSeconds ? 0 : Math.min(GRAB.kickSeconds - .02, this.kickAge + .045);
  }
  update(dt: number, sequence: GrabSequence, settings: Settings): void {
    const saved = this.saved; if (!saved) return;
    const { world, player, ghost } = this, phase = sequence.phase;
    this.motionTime += dt; this.kickAge += dt;
    dt = Math.min(.05, dt); // Only collision integration is capped; effects use active time.
    const reaching = phase === 'grab-start', recovering = phase === 'recovery' || phase === 'idle';
    const reach = reaching ? smoothStep(sequence.time / GRAB.reachSeconds) : 1;
    const fall = reaching ? 0 : phase === 'falling' ? smoothStep(sequence.time / GRAB.fallSeconds) : 1;
    const release = phase === 'release' ? smoothStep(sequence.time / GRAB.releaseSeconds) : recovering ? 1 : 0;
    const recovery = recovering ? smoothStep(sequence.time / GRAB.recoverySeconds) : 0;
    const kill = phase === 'killing' ? smoothStep(sequence.time / GRAB.finishLeadSeconds) : 0;
    this.gripping = !['release', 'recovery', 'idle', 'killing'].includes(phase);
    if (!this.gripping) this.kickAge = GRAB.kickSeconds;
    const effort = Math.sin(Math.PI * Math.min(1, this.kickAge / GRAB.kickSeconds));
    // Step back as the legs extend during the fall. The ghost never snaps from
    // a standing ankle grip to a different ground-space contact.
    const retreat = Math.max(0, GRAB.groundDistance - saved.distance) * fall;
    ghost.position = world.nav.move(ghost.position, saved.dx * (retreat - this.fallStep), saved.dz * (retreat - this.fallStep), false);
    this.fallStep = retreat;
    const drag = ['grab-start', 'falling'].includes(phase) ? 0 : phase === 'dragging' ? smoothStep(sequence.time / GRAB.dragSeconds) : 1;
    const tug = phase === 'struggling' ? .012 * Math.sin(this.motionTime * 8) : 0;
    const desired = this.gripping ? GRAB.pullDistance * drag + tug : this.dragged, step = desired - this.dragged; this.dragged = desired;
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
    const contacts = world.legs.poseGrab(player, saved.targetYaw, fall, recovery, this.kickAge, sequence, this.motionTime);
    const prone = world.legs.fallAmount ?? fall * (1 - recovery);
    const turn = smoothStep(this.motionTime / .16) * (1 - recovery);
    player.yaw = saved.yaw + angleDifference(saved.targetYaw, saved.yaw) * turn;
    player.grabView = { height: mix(1.65, GRAB.eyeHeight, prone), back: GRAB.eyeBack * prone };
    player.pitch = mix(saved.pitch, mix(-.70, -.12, prone), turn);
    player.camera(world, settings); haltPlayerCamera(world.camera);
    if (!settings.reducedMotion) shakeGrabCamera(world.camera, this.motionTime,
      Math.max(0, 1 - this.motionTime / .45), drag * (1 + Math.abs(Math.sin(this.motionTime * 8)) * .4), effort, (1 - recovery) * (1 - kill));
    world.camera.fov = saved.fov + (settings.reducedMotion ? 0 : .035 * fall * (1 - recovery));
    ghost.yaw = saved.ghostYaw + angleDifference(saved.targetYaw + Math.PI, saved.ghostYaw) * reach;
    world.ghost.position.set(ghost.position.x, ghost.position.y + .015, ghost.position.z);
    world.ghost.rotationQuaternion!.copyFrom(B.Quaternion.RotationYawPitchRoll(corazonModelYaw(ghost.yaw), 0, 0));
    const bend = 1.54 * (1 - release * .65) * (1 - recovery) * (1 - kill);
    // Body/ankle basis belongs to the collision-space encounter direction, not
    // the cinematic camera turn. Looking away cannot swing the foot out of reach.
    const matrix = world.ghost.computeWorldMatrix(true);
    B.Vector3.TransformCoordinatesToRef(new B.Vector3(-.30, .055, .55), matrix, this.support);
    const freedHand = B.Vector3.TransformCoordinates(new B.Vector3(.35, .10, .48), matrix);
    const target = this.gripping ? contacts[1] : B.Vector3.Lerp(contacts[1], freedHand, release || recovery || kill);
    world.corazon.poseBody(this.support, target, 1 - recovery, bend, effort, 1 - recovery);
    // Existing arms and attached flashlight stay beside the torso while kicking.
    world.viewmodel.poseGrab(reach * (1 - recovery) * (1 - kill), effort * .25, this.motionTime, settings.reducedMotion);
    world.viewmodel.root.position.y -= .18 * prone;
    this.fill.intensity = .9 * (1 - recovery) * settings.brightness;
  }
  finish(restoreLook = true): void {
    const saved = this.saved; if (!saved) return;
    const { world, player } = this;
    world.corazon.resetBody(); world.viewmodel.endGrab(); world.legs.reset(); this.fill.setEnabled(false);
    world.viewmodel.meshes.forEach((mesh, i) => mesh.renderingGroupId = saved.groups[i]);
    world.camera.fov = saved.fov;
    if (restoreLook) { player.yaw = saved.yaw; player.pitch = saved.pitch; }
    // Failure keeps the grounded eye for the existing capture shot, but removes
    // every rotational/positional shake offset before handing the camera over.
    if (restoreLook) player.grabView = null;
    player.halt(world); world.camera.position.copyFromFloats(...player.eye); orientPlayerCamera(world.camera, player.yaw, player.pitch);
    this.gripping = false; this.kickAge = GRAB.kickSeconds; this.saved = undefined;
  }
  dispose(): void { this.finish(); this.fill.dispose(); }
}
