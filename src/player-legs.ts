import type * as Babylon from 'babylonjs';
import { B } from './world.ts';
import type { Player } from './player.ts';
import type { Settings } from './types.ts';
import { GRAB } from './grab.ts';
import type { GrabSequence } from './grab.ts';
import { mix, smoothStep } from './corazon-motion.ts';
import type { GrabMotion, MotionPose } from './grab-motion.ts';

/** Connected skinned derivative of female_skinny_bottom_part.glb; see asset report. */
export class PlayerLegs {
  readonly root: Babylon.TransformNode;
  readonly meshes: Babylon.AbstractMesh[];
  readonly skeleton: Babylon.Skeleton;
  readonly ankles: [Babylon.TransformNode, Babylon.TransformNode];
  // The supplied Kicking Out clip uses the left leg. This selection never changes mid-grab.
  readonly grabbedSide = 1;
  readonly freeSide = 0;
  fallAmount = 0;
  private motion?: GrabMotion;
  private joints: Babylon.TransformNode[];
  private phase = 0;
  private movement = 0;
  private landing = 0;
  private grounded = true;
  private contacts: [Babylon.Vector3, Babylon.Vector3] = [B.Vector3.Zero(), B.Vector3.Zero()];
  private contactOffsets = [new B.Vector3(-.06, .055, .01), new B.Vector3(.06, .055, .01)];
  private rotation = B.Quaternion.Identity();
  private floorPoint = B.Vector3.Zero();
  private soleCorners = [-.06,.06].flatMap(x => [-.10,.025].flatMap(y => [-.20,.055].map(z=>new B.Vector3(x,y,z))));
  constructor(scene: Babylon.Scene, imported: Babylon.ISceneLoaderAsyncResult, motion?: GrabMotion) {
    this.motion = motion;
    if (imported.skeletons.length !== 1) throw new Error('Expected the inspected connected lower-body rig.');
    this.skeleton = imported.skeletons[0];
    const names = ['Thigh.L', 'Shin.L', 'Foot.L', 'Thigh.R', 'Shin.R', 'Foot.R'];
    this.joints = names.map(name => {
      const joint = this.skeleton.bones.find(b => b.name === name)?.getTransformNode();
      if (!joint) throw new Error(`Missing lower-body joint ${name}`);
      joint.rotationQuaternion ??= B.Quaternion.Identity(); return joint;
    });
    this.ankles = [this.joints[2], this.joints[5]];
    this.root = new B.TransformNode('player-uniform-body', scene); this.root.rotationQuaternion = B.Quaternion.Identity();
    for (const mesh of imported.meshes) if (!mesh.parent) mesh.parent = this.root;
    this.meshes = imported.meshes.filter(mesh => mesh.getTotalVertices() > 0);
    for (const mesh of this.meshes) {
      mesh.isPickable = false; mesh.alwaysSelectAsActiveMesh = true; mesh.renderingGroupId = 0;
      if (mesh.material instanceof B.PBRMaterial) { mesh.material.maxSimultaneousLights = 4; mesh.material.environmentIntensity = .4; }
    }
    this.root.setEnabled(false);
  }
  private joint(index: number, x: number, y = 0, z = 0): void {
    B.Quaternion.FromEulerAnglesToRef(x, y, z, this.joints[index].rotationQuaternion!);
  }
  private place(player: Player, height: number, tilt: number, yaw = player.yaw): void {
    this.root.position.set(player.position.x, player.position.y + height, player.position.z);
    B.Quaternion.RotationYawPitchRollToRef(-yaw, tilt, 0, this.rotation);
    this.root.rotationQuaternion!.copyFrom(this.rotation); this.root.computeWorldMatrix(true);
  }
  private clearFloor(height: number): void {
    // A conservative sole envelope avoids scanning the skin each render frame.
    let floor = Infinity;
    for (const ankle of this.ankles) {
      const matrix = ankle.computeWorldMatrix(true);
      for (const corner of this.soleCorners) {
        B.Vector3.TransformCoordinatesToRef(corner, matrix, this.floorPoint);
        floor = Math.min(floor, this.floorPoint.y);
      }
    }
    if (floor < height + .012) {
      this.root.position.y += height + .012 - floor;
      this.root.computeWorldMatrix(true);
    }
  }
  reset(): void {
    this.phase = this.movement = this.landing = this.fallAmount = 0; this.grounded = true;
    for (let i = 0; i < 6; i++) this.joint(i, 0);
    this.root.setEnabled(false);
  }
  update(dt: number, player: Player, distance: number, settings: Settings): void {
    // Keep locomotion/rig state warm, but only the grab presentation may reveal it.
    this.root.setEnabled(false);
    this.phase += distance * (player.sprinting ? 7.8 : 9);
    this.movement += ((player.moving && player.grounded ? 1 : 0) - this.movement) * (1 - Math.exp(-12 * dt));
    if (player.grounded && !this.grounded) this.landing = 1;
    this.grounded = player.grounded; this.landing *= Math.exp(-8 * dt);
    const jump = player.grounded ? 0 : .7, amplitude = player.sprinting ? .55 : .32;
    for (let side = 0; side < 2; side++) {
      const swing = Math.sin(this.phase + side * Math.PI), i = side * 3;
      this.joint(i, swing * amplitude * this.movement + .24 * jump + .18 * this.landing);
      this.joint(i + 1, -.64 * Math.max(0, -swing) * this.movement - .44 * jump - .32 * this.landing);
      this.joint(i + 2, .16 * Math.max(0, -swing) * this.movement + .12 * jump);
    }
    this.place(player, .92 - .045 * this.landing + (settings.reducedMotion ? 0 : .008 * Math.sin(this.phase * 2) * this.movement), 0);
    if (player.grounded) this.clearFloor(player.position.y);
  }
  poseGrab(player: Player, yaw: number, fall: number, recovery: number, kickAge: number, sequence: GrabSequence, motionTime = sequence.time): [Babylon.Vector3, Babylon.Vector3] {
    this.root.setEnabled(true);
    const prone = fall * (1 - recovery), settle = smoothStep(recovery);
    this.fallAmount = prone;
    // Ankles remain above the floor. Hips and knees flex together while the
    // seven-bone skin deforms the cloth; no detached leg-object animation.
    const kick = Math.sin(Math.PI * Math.min(1, kickAge / GRAB.kickSeconds));
    for (let side = 0; side < 2; side++) {
      const i = side * 3, finalKick = side === this.freeSide ? kick : 0;
      this.joint(i, (.38 - .25 * finalKick) * prone + .45 * Math.sin(settle * Math.PI), 0, (side ? .22 : -.22) * prone);
      this.joint(i + 1, (-.55 + .35 * finalKick) * prone - .75 * Math.sin(settle * Math.PI));
      this.joint(i + 2, (.15 - .18 * finalKick) * prone);
    }
    this.place(player, mix(.92, GRAB.hipHeight, prone) - .07 * Math.sin(settle * Math.PI), Math.PI / 2 * prone, yaw);
    if (this.motion) this.animateGrab(player, yaw, recovery, kickAge, sequence, motionTime);
    // A small conservative sole envelope keeps the posed shoes above support
    // during the fall/get-up arc, without simulating cloth or scanning vertices.
    this.clearFloor(player.position.y);
    for (let i = 0; i < 2; i++) {
      this.ankles[i].computeWorldMatrix(true);
      // Contact sits on the outer cloth surface of the lower calf, not inside it.
      B.Vector3.TransformCoordinatesToRef(this.contactOffsets[i], this.ankles[i].getWorldMatrix(), this.contacts[i]);
    }
    return this.contacts;
  }
  private animateGrab(player: Player, yaw: number, recovery: number, kickAge: number, sequence: GrabSequence, motionTime: number): void {
    const motion = this.motion!, phase = sequence.phase;
    const stumbling = phase === 'grab-start' || phase === 'falling';
    // The source stays upright through .65 s, then collapses. Fit those two
    // sections to the existing reach/fall phases instead of lowering the body early.
    const stumbleTime = phase === 'grab-start' ? sequence.time / GRAB.reachSeconds * .65
      : .65 + sequence.time / GRAB.fallSeconds * (motion.duration('stumble') - .65);
    const base = motion.sample('crawl', 0);
    // Use the presentation's continuous encounter clock. Resetting phase time at
    // struggle/release/recovery must not restart the player's crawl underneath it.
    const crawlTime = Math.max(0, motionTime - GRAB.reachSeconds - GRAB.fallSeconds);
    let pose: MotionPose = stumbling ? motion.sample('stumble', stumbleTime) : motion.sample('crawl', crawlTime, true);
    let held = base, pelvis = stumbling ? pose.pelvis : base.pelvis, height = stumbling ? pose.height : base.height;
    if (phase === 'dragging') {
      const end = motion.sample('stumble', motion.duration('stumble')), t = smoothStep(sequence.time / .2);
      pose = { ...pose, legs: pose.legs.map((q, i) => B.Quaternion.Slerp(end.legs[i], q, t)),
        pelvis: B.Quaternion.Slerp(end.pelvis, pose.pelvis, t), height: mix(end.height, pose.height, t) };
      // Settle the held chain AND its pelvis from the final fall pose into one
      // stable anchor. Do not switch from an animated pelvis at the QTE boundary.
      held = { ...base, legs: base.legs.map((q, i) => B.Quaternion.Slerp(end.legs[i], q, t)) };
      pelvis = B.Quaternion.Slerp(end.pelvis, base.pelvis, t); height = mix(end.height, base.height, t);
    }
    const kickActive = kickAge < GRAB.kickSeconds && (phase === 'struggling' || phase === 'escape-kick');
    const kicking = kickActive ? motion.sample('kick', kickAge / GRAB.kickSeconds * motion.duration('kick')) : null;
    for (let i = 0; i < 6; i++) {
      // Lock only the right chain to a stable pulled pose after falling. The left
      // leg retains the crawl motion and is the sole recipient of the kick clip.
      let rotation = !stumbling && i >= 3 ? held.legs[i] : pose.legs[i];
      // The source shifts its pelvis while crawling. Express the free thigh in
      // our constrained pelvis frame, otherwise it folds underneath the floor
      // and the floor correction lifts the entire body into the camera.
      if (i === 0) rotation = pelvis.conjugate().multiply(pose.pelvis).multiply(rotation);
      if (kicking && i < 3) {
        const target = i === 0 ? pelvis.conjugate().multiply(kicking.pelvis).multiply(kicking.legs[i]) : kicking.legs[i];
        rotation = B.Quaternion.Slerp(rotation, target, Math.sin(Math.PI * kickAge / GRAB.kickSeconds));
      }
      B.Quaternion.SlerpToRef(rotation, B.Quaternion.Identity(), recovery, this.joints[i].rotationQuaternion!);
    }
    // Root motion belongs to the collision controller. Preserve only the authored
    // fall height/tilt; keep a stable pelvis while crawling so the held chain cannot skate.
    height = Math.max(GRAB.hipHeight, height * .8823);
    this.fallAmount = Math.max(0, Math.min(1, (.8623 - height) / (.8623 - base.height * .8823))) * (1 - recovery);
    this.root.position.set(player.position.x, player.position.y + mix(height, .92, recovery), player.position.z);
    this.root.rotationQuaternion!.copyFrom(B.Quaternion.RotationYawPitchRoll(-yaw, 0, 0)
      .multiply(B.Quaternion.Slerp(pelvis, B.Quaternion.Identity(), recovery)));
    this.root.computeWorldMatrix(true);
  }
}
