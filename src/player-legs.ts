import type * as Babylon from 'babylonjs';
import { B } from './world.ts';
import type { Player } from './player.ts';
import type { Settings } from './types.ts';
import { GRAB } from './grab.ts';
import { mix, smoothStep } from './corazon-motion.ts';

/** Connected skinned derivative of female_skinny_bottom_part.glb; see asset report. */
export class PlayerLegs {
  readonly root: Babylon.TransformNode;
  readonly meshes: Babylon.AbstractMesh[];
  readonly skeleton: Babylon.Skeleton;
  readonly ankles: [Babylon.TransformNode, Babylon.TransformNode];
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
  constructor(scene: Babylon.Scene, imported: Babylon.ISceneLoaderAsyncResult) {
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
    this.phase = this.movement = this.landing = 0; this.grounded = true;
    for (let i = 0; i < 6; i++) this.joint(i, 0);
    this.root.setEnabled(false);
  }
  update(dt: number, player: Player, distance: number, settings: Settings): void {
    this.root.setEnabled(!player.hidden && player.hidingState === 'NORMAL');
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
  poseGrab(player: Player, yaw: number, fall: number, recovery: number, kicks: readonly [number, number], final: number): [Babylon.Vector3, Babylon.Vector3] {
    this.root.setEnabled(true);
    const prone = fall * (1 - recovery), settle = smoothStep(recovery);
    // Ankles remain above the floor. Hips and knees flex together while the
    // seven-bone skin deforms the cloth; no detached leg-object animation.
    for (let side = 0; side < 2; side++) {
      const i = side * 3, kick = kicks[side], finalKick = side === 1 ? final : final * .4;
      this.joint(i, (.38 - .14 * kick - .25 * finalKick) * prone + .45 * Math.sin(settle * Math.PI), 0, (side ? .22 : -.22) * prone);
      this.joint(i + 1, (-.55 + .20 * kick + .35 * finalKick) * prone - .75 * Math.sin(settle * Math.PI));
      this.joint(i + 2, (.15 - .12 * kick - .18 * finalKick) * prone);
    }
    this.place(player, mix(.92, GRAB.hipHeight, prone) - .07 * Math.sin(settle * Math.PI), Math.PI / 2 * prone, yaw);
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
}
