import type * as Babylon from 'babylonjs';
import { B } from './world.ts';
import { FLASHLIGHT_PICKUP, VIEWMODEL } from './config.ts';
import { FlashlightEquipState } from './flashlight-state.ts';

type Transform = { position: Babylon.Vector3; rotation: Babylon.Quaternion; scale: Babylon.Vector3 };
type Joint = { node: Babylon.TransformNode; rest: Transform; hold: Transform };
export interface ArmMotion { owned: boolean; hidden: boolean; distance: number; moving: boolean; sprinting: boolean; reducedMotion: boolean }
const smooth = (x: number) => x * x * (3 - 2 * x);

/** Uses the uploaded GLB unchanged, including both original skins and their rig. */
export class FlashlightViewmodel {
  readonly root: Babylon.TransformNode;
  readonly pickupRoot: Babylon.TransformNode;
  readonly socket: Babylon.TransformNode;
  readonly lens: Babylon.TransformNode;
  readonly lamp: Babylon.TransformNode;
  readonly rightArm: Babylon.AbstractMesh;
  readonly leftArm: Babylon.AbstractMesh;
  readonly skeleton: Babylon.Skeleton;
  readonly sourcePoses: Babylon.AnimationGroup[];
  readonly state = new FlashlightEquipState();
  readonly meshes: Babylon.AbstractMesh[];
  readonly hand: Babylon.TransformNode;
  private camera: Babylon.Camera;
  private joints = new Map<string, Joint>();
  private lampMeshes: Babylon.AbstractMesh[];
  private time = 0;
  private stride = 0;
  private movement = 0;
  private toggleTime = 0;
  private lampStartRotation = B.Quaternion.Identity();
  private lampStartPosition = B.Vector3.Zero();
  private lampStartScale = B.Vector3.One();
  private grabSaved?: { root: Transform; enabled: boolean; left: boolean; lamp: boolean; lampPose: Transform; heldLamp: boolean; joints: Map<string, Transform> };

  constructor(scene: Babylon.Scene, camera: Babylon.Camera, rig: Babylon.ISceneLoaderAsyncResult, flashlight: Babylon.TransformNode) {
    this.camera = camera;
    this.sourcePoses = rig.animationGroups;
    this.sourcePoses.forEach(group => group.stop());
    if (rig.skeletons.length !== 1) throw new Error('The supplied FPS arms must contain their original single skeleton.');
    this.skeleton = rig.skeletons[0];
    const bone = (name: string) => {
      const match = this.skeleton.bones.find(b => b.name === name);
      if (!match?.getTransformNode()) throw new Error(`FPS arm rig is missing the inspected joint ${name}. Flashlight attachment cancelled.`);
      return match.getTransformNode()!;
    };
    // Names confirmed by inspecting the uploaded file, including the complete
    // right finger chains. glTF animates the linked TransformNodes of its bones.
    this.hand = bone('Hand.R_027');
    bone('Shoulder.R_024'); bone('Shoulder_2.R_025'); bone('Forearm.R_026');
    const rightIndices = new Set(this.skeleton.bones.filter(b => /\.R_/.test(b.name)).map(b => b.getIndex()));
    const skinned = rig.meshes.filter(mesh => mesh.skeleton === this.skeleton && mesh.getTotalVertices() > 0);
    const influence = (mesh: Babylon.AbstractMesh) => {
      const indices = mesh.getVerticesData(B.VertexBuffer.MatricesIndicesKind), weights = mesh.getVerticesData(B.VertexBuffer.MatricesWeightsKind);
      if (!indices || !weights) throw new Error(`Missing original skin weights on ${mesh.name}`);
      let right = 0, total = 0;
      for (let i = 0; i < weights.length; i++) { total += weights[i]; if (rightIndices.has(indices[i])) right += weights[i]; }
      return right / Math.max(total, 1e-6);
    };
    const scores = skinned.map(mesh => ({ mesh, right: influence(mesh) }));
    const right = scores.find(item => item.right > .99), left = scores.find(item => item.right < .01);
    if (skinned.length !== 2 || !right || !left) throw new Error('Cannot safely identify the separate right/left meshes in the supplied FPS arms.');
    this.rightArm = right.mesh; this.leftArm = left.mesh;
    this.leftArm.setEnabled(false); // Retain its geometry, joints, weights and clips.
    // The source bounds describe an outstretched arm. A camera-attached posed
    // skin must not be culled using that bind-pose bounding box.
    this.rightArm.alwaysSelectAsActiveMesh = true;
    this.root = new B.TransformNode('female-fps-arm', scene); this.root.parent = camera;
    const metres = new B.TransformNode('fps-source-scale', scene); metres.parent = this.root;
    // The source has a uniform Sketchfab display scale of 2.3424489498. Undo
    // only that display scale, preserving every authored node/bind transform.
    metres.scaling.setAll(1 / 2.3424489498138428);
    for (const mesh of rig.meshes) if (!mesh.parent) mesh.parent = metres;
    for (const b of this.skeleton.bones.filter(b => /\.[LR]_/.test(b.name))) {
      const node = b.getTransformNode(); if (!node) continue;
      const rest = this.capture(node);
      this.joints.set(node.name, { node, rest, hold: this.copy(rest) });
    }
    const grip = this.sourcePoses.find(group => group.name === 'Fists Pose');
    if (!grip) throw new Error('The inspected Fists Pose is missing from the original FPS arms.');
    for (const track of grip.targetedAnimations) {
      const joint = this.joints.get(track.target.name), key = track.animation.getKeys()[0];
      if (!joint || !key) continue;
      if (track.animation.targetProperty === 'rotationQuaternion') joint.hold.rotation.copyFrom(key.value);
      if (track.animation.targetProperty === 'position') joint.hold.position.copyFrom(key.value);
      if (track.animation.targetProperty === 'scaling') joint.hold.scale.copyFrom(key.value);
    }
    for (const [name, joint] of this.joints) {
      if (name.startsWith('Finger_')) {
        // Relax the authored fist around the 43 mm flashlight barrel. This is
        // a reversible joint pose, never a mesh/weight or bind-pose edit.
        const curl = name.startsWith('Finger_5.') ? .94 : .84;
        joint.hold.rotation = B.Quaternion.Slerp(joint.rest.rotation, joint.hold.rotation, curl);
      }
    }
    const wrist = this.joints.get('Hand.R_027')!;
    wrist.hold.rotation = wrist.hold.rotation.multiply(B.Quaternion.RotationAxis(B.Axis.X, -.25));
    this.socket = new B.TransformNode('FlashlightSocket', scene);
    this.socket.parent = this.hand; this.socket.position.set(.024, .074, .010);
    this.socket.rotationQuaternion = B.Quaternion.RotationAxis(B.Axis.Y, Math.PI);
    this.lamp = flashlight; this.lampMeshes = flashlight.getChildMeshes().filter(mesh => mesh.getTotalVertices() > 0);
    this.pickupRoot = new B.TransformNode('living-room-flashlight', scene);
    this.pickupRoot.position.copyFromFloats(...FLASHLIGHT_PICKUP.position);
    this.pickupRoot.rotation.set(...FLASHLIGHT_PICKUP.rotation);
    this.lens = new B.TransformNode('Flashlight_beam_socket', scene);
    this.lens.parent = flashlight; this.lens.position.set(0, 0, -.171);
    this.meshes = [this.rightArm, this.leftArm, ...this.lampMeshes];
    this.leftArm.alwaysSelectAsActiveMesh = true;
    for (const mesh of rig.meshes) { mesh.isPickable = false; mesh.renderingGroupId = 1; mesh.applyFog = false; }
    for (const mesh of this.meshes) if (mesh.material instanceof B.PBRMaterial) mesh.material.maxSimultaneousLights = 4;
    this.reset(false);
  }
  private capture(node: Babylon.TransformNode): Transform {
    return { position: node.position.clone(), rotation: node.rotationQuaternion?.clone() ?? B.Quaternion.FromEulerVector(node.rotation), scale: node.scaling.clone() };
  }
  private copy(pose: Transform): Transform { return { position: pose.position.clone(), rotation: pose.rotation.clone(), scale: pose.scale.clone() }; }
  private anchor(): void {
    const aspect = this.root.getScene().getEngine().getAspectRatio(this.camera);
    this.root.position.set(VIEWMODEL.position[0] - .27 * (1 - Math.min(1, aspect / 1.3)), VIEWMODEL.position[1], VIEWMODEL.position[2]);
    this.root.rotationQuaternion = B.Quaternion.Identity(); this.root.scaling.setAll(1);
  }
  private heldLamp(): void {
    this.lamp.parent = this.socket; this.lamp.position.setAll(0);
    this.lamp.rotation.setAll(0); this.lamp.rotationQuaternion = B.Quaternion.Identity(); this.lamp.scaling.setAll(1);
    this.lamp.setEnabled(true);
    this.lampMeshes.forEach(mesh => { mesh.renderingGroupId = 1; mesh.applyFog = false; mesh.isPickable = false; });
  }
  reset(owned: boolean): void {
    this.endGrab();
    this.state.reset(owned); this.time = this.stride = this.movement = this.toggleTime = 0;
    this.anchor(); this.applyPose(1, 0, 0, false);
    this.pickupRoot.setEnabled(!owned); this.root.setEnabled(owned); this.leftArm.setEnabled(false);
    if (owned) this.heldLamp();
    else {
      this.lamp.parent = this.pickupRoot; this.lamp.position.setAll(0); this.lamp.rotation.setAll(0);
      this.lamp.rotationQuaternion = B.Quaternion.Identity(); this.lamp.scaling.setAll(1); this.lamp.setEnabled(true);
      this.lampMeshes.forEach(mesh => { mesh.renderingGroupId = 0; mesh.applyFog = true; mesh.isPickable = false; });
    }
  }
  pickup(): void {
    if (!this.state.pickup()) return;
    this.root.setEnabled(true); this.anchor(); this.lowerForEquip(0); this.applyPose(.35, 0, 0, false);
    this.lamp.computeWorldMatrix(true); const before = this.lamp.getWorldMatrix().clone();
    this.socket.computeWorldMatrix(true);
    // Preserve the table transform when parenting. The lamp travels down into
    // the reaching hand before it rises; never move the severed source shoulder
    // into the room or stretch its skin to bridge an interaction-distance gap.
    const local = before.multiply(B.Matrix.Invert(this.socket.getWorldMatrix()));
    local.decompose(this.lampStartScale, this.lampStartRotation, this.lampStartPosition);
    this.heldLamp();
    this.lamp.position.copyFrom(this.lampStartPosition); this.lamp.rotationQuaternion!.copyFrom(this.lampStartRotation); this.lamp.scaling.copyFrom(this.lampStartScale);
    this.pickupRoot.setEnabled(false);
  }
  toggle(): void { this.toggleTime = .18; }
  beginGrab(): void {
    if (this.grabSaved) return;
    this.grabSaved = { root: this.capture(this.root), enabled: this.root.isEnabled(), left: this.leftArm.isEnabled(), lamp: this.lamp.isEnabled(),
      lampPose: this.capture(this.lamp), heldLamp: this.lamp.parent === this.socket,
      joints: new Map([...this.joints].map(([name, joint]) => [name, this.capture(joint.node)])) };
    this.root.setEnabled(true); this.leftArm.setEnabled(true);
    // An uncollected lamp stays on its table. The player's bare arms still react.
  }
  poseGrab(amount: number, effort: number, time: number, reduced: boolean): void {
    const saved = this.grabSaved!;
    const motion = reduced ? .15 : 1, tug = Math.sin(time * 8) * .015 * motion + effort * .035;
    this.anchor(); this.root.position.x -= .13; this.root.position.y += -.025 + tug; this.root.position.z -= .025;
    // Preserve an interrupted equip/breathing pose at both ends of the grab.
    // Previously invisible arms rise from below the camera instead of popping in.
    const from = saved.root.position.clone(); if (!saved.enabled) from.y -= .5;
    B.Vector3.LerpToRef(from, this.root.position, amount, this.root.position);
    B.Quaternion.SlerpToRef(saved.root.rotation, B.Quaternion.Identity(), amount, this.root.rotationQuaternion!);
    B.Vector3.LerpToRef(saved.root.scale, B.Vector3.One(), amount, this.root.scaling);
    for (const [name, joint] of this.joints) {
      const start = saved.joints.get(name)!;
      joint.node.position.copyFrom(start.position);
      joint.node.rotationQuaternion ??= B.Quaternion.Identity();
      let pose = joint.hold.rotation;
      if (name.startsWith('Forearm.')) pose = pose.multiply(B.Quaternion.FromEulerAngles(-.12 - tug, 0, 0));
      if (name.startsWith('Hand.')) pose = pose.multiply(B.Quaternion.FromEulerAngles(effort * -.10, 0, 0));
      B.Quaternion.SlerpToRef(start.rotation, pose, amount, joint.node.rotationQuaternion);
    }
    this.root.computeWorldMatrix(true);
    for (const [name, x] of [['Shoulder.L_00', -.12], ['Shoulder.R_024', .08]] as const) {
      const node = this.joints.get(name)!.node, parent = node.parent as Babylon.TransformNode;
      parent.computeWorldMatrix(true);
      const lower = name === 'Shoulder.L_00' && !saved.left ? -.65 * (1 - amount) : 0;
      const offset = B.Vector3.TransformNormal(new B.Vector3(x * amount, lower, 0), this.camera.getWorldMatrix());
      node.position.addInPlace(B.Vector3.TransformNormal(offset, B.Matrix.Invert(parent.getWorldMatrix())));
    }
    if (saved.heldLamp) {
      B.Vector3.LerpToRef(saved.lampPose.position, B.Vector3.Zero(), amount, this.lamp.position);
      B.Quaternion.SlerpToRef(saved.lampPose.rotation, B.Quaternion.Identity(), amount, this.lamp.rotationQuaternion!);
      B.Vector3.LerpToRef(saved.lampPose.scale, B.Vector3.One(), amount, this.lamp.scaling);
    }
    this.lens.computeWorldMatrix(true);
  }
  endGrab(): void {
    const saved = this.grabSaved; if (!saved) return;
    this.root.position.copyFrom(saved.root.position); this.root.rotationQuaternion = saved.root.rotation.clone(); this.root.scaling.copyFrom(saved.root.scale);
    this.root.setEnabled(saved.enabled); this.leftArm.setEnabled(saved.left); this.lamp.setEnabled(saved.lamp);
    this.lamp.position.copyFrom(saved.lampPose.position); this.lamp.rotationQuaternion = saved.lampPose.rotation.clone(); this.lamp.scaling.copyFrom(saved.lampPose.scale);
    for (const [name, pose] of saved.joints) {
      const node = this.joints.get(name)!.node;
      node.position.copyFrom(pose.position); node.rotationQuaternion = pose.rotation.clone(); node.scaling.copyFrom(pose.scale);
    }
    this.grabSaved = undefined;
  }
  private lowerForEquip(equipped: number): void {
    this.root.position.y -= .44 * (1 - equipped);
    this.root.position.z -= .06 * (1 - equipped);
  }
  update(dt: number, motion: ArmMotion): boolean {
    // Also support restoring inventory outside Game.begin (e.g. checkpoint
    // review), keeping the physical lamp and presentation state in sync.
    if (motion.owned && this.state.phase === 'unowned') this.reset(true);
    if (!motion.owned && this.state.phase !== 'unowned') this.reset(false);
    const completed = this.state.update(dt, motion.owned, motion.hidden);
    this.root.setEnabled(this.state.visible);
    if (!motion.owned) return completed;
    this.time += dt; this.stride += motion.distance * 8;
    const target = motion.moving ? motion.sprinting ? 1.65 : 1 : 0;
    this.movement += (target - this.movement) * (1 - Math.exp(-dt * 10));
    this.toggleTime = Math.max(0, this.toggleTime - dt);
    this.anchor();
    const equipped = smooth(this.state.progress);
    if (this.state.phase === 'equipping') {
      this.lowerForEquip(equipped);
      const settle = smooth(Math.min(1, this.state.progress / .45));
      this.lamp.position.copyFrom(this.lampStartPosition.scale(1 - settle));
      B.Quaternion.SlerpToRef(this.lampStartRotation, B.Quaternion.Identity(), settle, this.lamp.rotationQuaternion!);
      B.Vector3.LerpToRef(this.lampStartScale, B.Vector3.One(), settle, this.lamp.scaling);
    } else {
      this.lamp.position.setAll(0); this.lamp.rotationQuaternion!.copyFromFloats(0, 0, 0, 1); this.lamp.scaling.setAll(1);
    }
    const amplitude = motion.reducedMotion ? .18 : 1;
    const breathing = Math.sin(this.time * 1.6) * .006 * amplitude;
    const sway = Math.sin(this.stride) * this.movement * .022 * amplitude;
    this.applyPose(.35 + .65 * smooth(Math.min(1, this.state.progress / .65)), breathing, sway, motion.reducedMotion,
      this.state.phase === 'equipping' ? Math.sin(this.state.progress * Math.PI) : 0);
    // Force current joint transforms before the per-frame beam update, so the
    // spotlight cannot lag one render frame behind the animated skin/socket.
    this.lens.computeWorldMatrix(true);
    return completed;
  }
  private applyPose(grip: number, breathing: number, sway: number, reduced: boolean, equip = 0): void {
    for (const [name, joint] of this.joints) {
      joint.node.position.copyFrom(joint.hold.position); joint.node.scaling.copyFrom(joint.hold.scale);
      joint.node.rotationQuaternion ??= B.Quaternion.Identity();
      if (name.startsWith('Finger_')) B.Quaternion.SlerpToRef(joint.rest.rotation, joint.hold.rotation, grip, joint.node.rotationQuaternion);
      else joint.node.rotationQuaternion.copyFrom(joint.hold.rotation);
    }
    const rotate = (name: string, x: number, y: number, z: number) => {
      const joint = this.joints.get(name)!;
      joint.node.rotationQuaternion!.copyFrom(joint.hold.rotation.multiply(B.Quaternion.FromEulerAngles(x, y, z)));
    };
    rotate('Shoulder_2.R_025', breathing + sway * .22 + equip * .08, 0, sway * .15 + equip * .05);
    rotate('Forearm.R_026', breathing * .6 + sway * .5 - equip * .16, sway * .3, 0);
    const toggle = reduced ? 0 : Math.sin(this.toggleTime / .18 * Math.PI) * .025;
    rotate('Hand.R_027', sway * .25 + toggle + equip * .08, sway * .3, breathing * .3);
  }
  get ready(): boolean { return this.state.ready; }
  get visible(): boolean { return !!this.grabSaved || this.state.visible; }
}
