import type * as Babylon from 'babylonjs';
import { B } from './world.ts';
import type { GhostStateMachine } from './ghost.ts';
import type { Settings } from './types.ts';
import { corazonModelYaw, CORAZON_SCARE, mix, scareFrame, ScareTimeline, smoothStep } from './corazon-motion.ts';
import type { ScareKind } from './corazon-motion.ts';

// Transform-only animation for the supplied static assembly. Vertices, UVs,
// textures and mesh scale stay untouched; no replacement model or face plane.
export class CorazonPresentation {
  readonly timeline = new ScareTimeline();
  readonly torso: Babylon.TransformNode;
  readonly head: Babylon.Mesh;
  private root: Babylon.TransformNode;
  private camera: Babylon.FreeCamera;
  private meshes: Babylon.AbstractMesh[];
  private fill: Babylon.PointLight;
  private phase = 0;
  private movement = 0;
  private clock = 0;
  private faceAnchor: Babylon.Vector3;
  private saved?: {
    position: Babylon.Vector3; rotation: Babylon.Quaternion; enabled: boolean;
    torso: Babylon.Quaternion; head: Babylon.Quaternion;
    cameraPosition: Babylon.Vector3; cameraRotation: Babylon.Quaternion; cameraFov: number;
    targetRotation: Babylon.Quaternion;
    meshes: { group: number; visibility: number; fog: boolean }[];
  };
  constructor(scene: Babylon.Scene, camera: Babylon.FreeCamera, root: Babylon.TransformNode) {
    this.root = root; this.camera = camera; this.meshes = root.getChildMeshes();
    const head = this.meshes.find(m => m.name === 'Ghost_head');
    if (!(head instanceof B.Mesh)) throw new Error('Corazon’s existing head mesh is missing.');
    this.head = head;
    this.torso = new B.TransformNode('corazon-body-motion', scene);
    for (const child of root.getChildren()) if (child !== this.torso) child.parent = this.torso;
    this.torso.parent = root;
    this.torso.setPivotPoint(new B.Vector3(0, .95, 0));
    this.head.setPivotPoint(new B.Vector3(-.01, 1.55, .10));
    this.root.rotationQuaternion = B.Quaternion.Identity();
    this.torso.rotationQuaternion = B.Quaternion.Identity();
    this.head.rotationQuaternion = B.Quaternion.Identity();
    // The visible facial surface is forward of the head's volume center.
    const bounds = head.getBoundingInfo().boundingBox;
    this.faceAnchor = bounds.center.clone(); this.faceAnchor.z = bounds.maximum.z - .035;
    this.fill = new B.PointLight('corazon-scare-fill', new B.Vector3(-.18, .18, 0), scene);
    this.fill.parent = camera; this.fill.diffuse.set(.83, .87, .91);
    this.fill.includedOnlyMeshes = this.meshes; this.fill.range = 4; this.fill.radius = .4;
    this.fill.setEnabled(false);
    scene.setRenderingAutoClearDepthStencil(2, true, true, true);
  }
  get active(): boolean { return this.timeline.kind !== null; }
  get kind(): ScareKind | null { return this.timeline.kind; }
  facePosition(): Babylon.Vector3 {
    this.root.computeWorldMatrix(true); this.torso.computeWorldMatrix(true); this.head.computeWorldMatrix(true);
    return B.Vector3.TransformCoordinates(this.faceAnchor, this.head.getWorldMatrix());
  }
  updateLocomotion(dt: number, ghost: GhostStateMachine, settings: Settings): void {
    if (this.active) return;
    this.clock += dt; this.phase += ghost.distanceMoved * 5.2;
    const speed = dt > 0 ? ghost.distanceMoved / dt : 0;
    this.movement = mix(this.movement, Math.min(1, speed / 2.4), 1 - Math.exp(-10 * dt));
    const amount = settings.reducedMotion ? .25 : 1;
    // Her floor-length static dress glides. The sway follows actual distance,
    // not elapsed time, and blends away when stopped, stunned or attacking.
    const sway = Math.sin(this.phase) * .018 * this.movement * amount;
    this.root.position.set(ghost.position.x, ghost.position.y + .015 + Math.sin(this.clock * 1.7) * .006 * amount, ghost.position.z);
    this.root.rotationQuaternion!.copyFrom(B.Quaternion.RotationYawPitchRoll(corazonModelYaw(ghost.yaw), 0, 0));
    const attack = ghost.attacking ? -.065 : 0;
    const torso = B.Quaternion.RotationYawPitchRoll(0, -this.movement * .045 + attack, ghost.state === 'Stunned' ? .14 : sway);
    const head = B.Quaternion.RotationYawPitchRoll(0, attack * .4, -sway * .6);
    B.Quaternion.SlerpToRef(this.torso.rotationQuaternion!, torso, 1 - Math.exp(-10 * dt), this.torso.rotationQuaternion!);
    B.Quaternion.SlerpToRef(this.head.rotationQuaternion!, head, 1 - Math.exp(-12 * dt), this.head.rotationQuaternion!);
  }
  start(kind: ScareKind, settings: Settings): boolean {
    if (!this.timeline.start(kind)) return false;
    const cameraRotation = this.camera.rotationQuaternion?.clone() ?? B.Quaternion.FromEulerVector(this.camera.rotation);
    const cameraPosition = this.camera.position.clone();
    let targetRotation = cameraRotation.clone();
    if (kind === 'capture') {
      const face = this.facePosition();
      if (B.Vector3.Distance(face, cameraPosition) > .05) {
        // Turn toward the actual captor first, even when she caught us from behind.
        // This keeps her travel outside the camera instead of crossing its plane.
        this.camera.rotationQuaternion = null; this.camera.setTarget(face);
        targetRotation = B.Quaternion.FromEulerVector(this.camera.rotation);
      }
    }
    this.saved = {
      position: this.root.position.clone(), rotation: this.root.rotationQuaternion!.clone(), enabled: this.root.isEnabled(),
      torso: this.torso.rotationQuaternion!.clone(), head: this.head.rotationQuaternion!.clone(),
      cameraPosition, cameraRotation, cameraFov: this.camera.fov, targetRotation,
      meshes: this.meshes.map(m => ({ group: m.renderingGroupId, visibility: m.visibility, fog: m.applyFog })),
    };
    this.camera.rotationQuaternion = cameraRotation.clone();
    this.root.setEnabled(true); this.fill.setEnabled(true);
    for (const mesh of this.meshes) { mesh.renderingGroupId = 2; mesh.applyFog = false; }
    this.render(settings); return true;
  }
  update(dt: number, settings: Settings) {
    const event = this.timeline.update(dt);
    if (this.active) this.render(settings);
    return event;
  }
  private render(settings: Settings): void {
    const saved = this.saved!, kind = this.timeline.kind!;
    const frame = scareFrame(kind, this.timeline.time, settings.reducedMotion, settings.gentleScares);
    const camera = this.camera;
    B.Quaternion.SlerpToRef(saved.cameraRotation, saved.targetRotation, frame.approach, camera.rotationQuaternion!);
    camera.position.copyFrom(saved.cameraPosition); camera.position.y -= frame.recoil;
    const cameraWeight = frame.approach * (kind === 'jumpscare' ? 1 - smoothStep((this.timeline.time - 1.48) / .27) : 1);
    camera.fov = mix(saved.cameraFov, settings.reducedMotion ? saved.cameraFov : 1.02, cameraWeight);
    camera.getViewMatrix(true);
    this.root.rotationQuaternion!.copyFrom(kind === 'jumpscare' ? camera.rotationQuaternion! : B.Quaternion.Slerp(saved.rotation, saved.targetRotation, frame.approach));
    const headRotation = B.Quaternion.RotationYawPitchRoll(frame.yaw, frame.pitch - frame.bodyPitch, frame.roll);
    const torsoRotation = B.Quaternion.RotationYawPitchRoll(0, frame.bodyPitch, 0);
    this.head.rotationQuaternion!.copyFrom(B.Quaternion.Slerp(saved.head, headRotation, frame.approach));
    this.torso.rotationQuaternion!.copyFrom(B.Quaternion.Slerp(saved.torso, torsoRotation, frame.approach));
    this.root.position.copyFrom(saved.position);
    const forward = camera.getForwardRay().direction;
    const destinationForward = kind === 'capture' ? B.Vector3.TransformNormal(new B.Vector3(0, 0, -1), B.Matrix.Compose(B.Vector3.One(), saved.targetRotation, B.Vector3.Zero())) : forward;
    const target = camera.position.add(destinationForward.scale(frame.distance));
    const delta = target.subtract(this.facePosition());
    this.root.position.addInPlace(delta.scale(kind === 'jumpscare' ? 1 : frame.approach));
    // Keep the animated head inside the near plane AND the viewport. Portrait
    // cameras need more room horizontally than the same vertical FOV on desktop.
    this.head.computeWorldMatrix(true);
    const headBounds = this.head.getBoundingInfo().boundingBox;
    if (frame.approach === 1) {
      const vertical = Math.tan(camera.fov / 2) * .92, horizontal = vertical * camera.getEngine().getAspectRatio(camera);
      let clearance = 0;
      for (const point of headBounds.vectorsWorld) {
        const local = B.Vector3.TransformCoordinates(point, camera.getViewMatrix());
        clearance = Math.max(clearance, camera.minZ + .1 + local.z, Math.abs(local.x) / horizontal + local.z, Math.abs(local.y) / vertical + local.z);
      }
      if (clearance > 0) this.root.position.addInPlace(forward.scale(clearance));
    }
    const revealLight = this.timeline.time >= CORAZON_SCARE[kind].reveal ? smoothStep((this.timeline.time - CORAZON_SCARE[kind].reveal + .016) / .045) : 0;
    this.fill.intensity = (settings.gentleScares ? .85 : 1.3) * settings.brightness * (1 - frame.fade) * revealLight;
    for (const [i, mesh] of this.meshes.entries()) mesh.visibility = saved.meshes[i].visibility * frame.visibility;
  }
  finish(): void {
    const saved = this.saved;
    if (saved) {
      this.root.position.copyFrom(saved.position); this.root.rotationQuaternion!.copyFrom(saved.rotation); this.root.setEnabled(saved.enabled);
      this.torso.rotationQuaternion!.copyFrom(saved.torso); this.head.rotationQuaternion!.copyFrom(saved.head);
      this.camera.position.copyFrom(saved.cameraPosition); this.camera.fov = saved.cameraFov;
      this.camera.rotationQuaternion = null; this.camera.rotation.copyFrom(saved.cameraRotation.toEulerAngles());
      for (const [i, mesh] of this.meshes.entries()) {
        mesh.renderingGroupId = saved.meshes[i].group; mesh.visibility = saved.meshes[i].visibility; mesh.applyFog = saved.meshes[i].fog;
      }
    }
    this.fill.setEnabled(false); this.saved = undefined; this.timeline.reset();
  }
  reset(): void {
    this.finish(); this.phase = this.movement = this.clock = 0;
    this.torso.rotationQuaternion!.copyFrom(B.Quaternion.Identity()); this.head.rotationQuaternion!.copyFrom(B.Quaternion.Identity());
  }
}
