import type * as Babylon from 'babylonjs';
import { B, vector } from './world.ts';
import type { World } from './world.ts';
import type { HauntEvent } from './horror.ts';
import type { Position, Settings, Vec3 } from './types.ts';
import { worldHit } from './geometry.ts';

// Temporary, non-colliding details layered onto the existing room/material batches.
// The original furniture, colliders, textures and GLBs stay intact.
export class HauntedEnvironment {
  private world: World;
  private active: { event: HauntEvent; elapsed: number } | null = null;
  private storm = 0;
  private stormStrength = 0;
  private rain: Babylon.LinesMesh;
  private drops: { start: Babylon.Vector3; end: Babylon.Vector3; x: number; z: number; y: number; height: number; phase: number; room: string }[] = [];
  private lines: Babylon.Vector3[][];
  private dust: Babylon.Mesh;
  private dustMatrices = new Float32Array(48 * 16);
  private dustSightTick = 0;
  private dustReach = 4;
  private matrix = B.Matrix.Identity();
  private dustPosition = new B.Vector3();
  private apparition: Babylon.TransformNode | null;
  private apparitionMaterials: Babylon.StandardMaterial[] = [];
  private rag: Babylon.Mesh;
  private debris: Babylon.Mesh;
  private screenMaterial: Babylon.StandardMaterial | null = null;
  private screenColor = new B.Color3();
  lightDip = 0;
  lightning = 0;
  flashlightDip = 0;
  affectedRoom = '';
  constructor(world: World) {
    this.world = world;
    for (const w of world.data.windows.filter(w => w.exterior)) for (let i = 0; i < 9; i++) {
      const offset = (i / 8 - .5) * w.width, side = w.axis === 'x' ? (w.position[2] < -10 ? -.18 : .18) : (w.position[0] < 0 ? -.18 : .18);
      const x = w.position[0] + (w.axis === 'x' ? offset : side), z = w.position[2] + (w.axis === 'z' ? offset : side);
      this.drops.push({ start: vector([x, 0, z]), end: vector([x, 0, z]), x, z, y: w.position[1], height: w.height, phase: Math.random(), room: w.room });
    }
    this.lines = this.drops.map(d => [d.start, d.end]);
    this.rain = B.MeshBuilder.CreateLineSystem('exterior-rain', { lines: this.lines, updatable: true }, world.scene);
    this.rain.color.set(.48, .63, .7); this.rain.alpha = .4; this.rain.isPickable = false; this.rain.alwaysSelectAsActiveMesh = true;
    this.dust = B.MeshBuilder.CreateSphere('flashlight-dust', { diameter: .006, segments: 3 }, world.scene);
    const dust = new B.StandardMaterial('dust-motes', world.scene); dust.disableLighting = true; dust.emissiveColor.set(.46, .43, .32); dust.alpha = .23;
    this.dust.material = dust; this.dust.isPickable = false; this.dust.alwaysSelectAsActiveMesh = true;
    this.dust.thinInstanceSetBuffer('matrix', this.dustMatrices, 16, false);
    this.apparition = world.ghost.clone('corazon-afterimage', null, false);
    if (this.apparition) {
      for (const mesh of this.apparition.getChildMeshes()) {
        mesh.isPickable = false; mesh.receiveShadows = false;
        if (mesh.material instanceof B.StandardMaterial) {
          const material = mesh.material.clone(`${mesh.material.name}-afterimage`);
          material.alpha = .5; material.emissiveColor.set(.03, .04, .035); mesh.material = material; this.apparitionMaterials.push(material);
        }
      }
      this.apparition.setEnabled(false);
    }
    const cloth = new B.StandardMaterial('loose-curtain-edge', world.scene); cloth.diffuseColor.set(.32, .31, .23); cloth.alpha = .45; cloth.backFaceCulling = false;
    this.rag = B.MeshBuilder.CreatePlane('stirring-curtain-edge', { width: .35, height: 1.25, sideOrientation: B.Mesh.DOUBLESIDE }, world.scene);
    this.rag.material = cloth; this.rag.isPickable = false; this.rag.setEnabled(false);
    this.debris = B.MeshBuilder.CreateBox('loose-picture-moulding', { width: .52, height: .035, depth: .045 }, world.scene);
    this.debris.material = world.scene.materials.find(m => m.name === 'wood-game') ?? null; this.debris.isPickable = false; this.debris.setEnabled(false);
    const screen = world.meshes.find(m => m.name === 'F06__screen');
    if (screen?.material instanceof B.StandardMaterial) {
      this.screenMaterial = screen.material.clone('haunted-crt-screen'); this.screenColor.copyFrom(this.screenMaterial.emissiveColor); screen.material = this.screenMaterial;
    }
  }
  reset(): void {
    this.active = null; this.storm = this.stormStrength = this.lightDip = this.flashlightDip = this.lightning = 0;
    this.apparition?.setEnabled(false); this.rag.setEnabled(false); this.debris.setEnabled(false);
    this.screenMaterial?.emissiveColor.copyFrom(this.screenColor);
  }
  trigger(event: HauntEvent): void {
    if (event.kind === 'thunder') { this.storm = 1.4; this.stormStrength = event.strength; return; }
    if (!['light', 'shadow', 'apparition', 'radio', 'curtain', 'object', 'door', 'window'].includes(event.kind)) return;
    this.resetEvent(); this.active = { event, elapsed: 0 };
    if ((event.kind === 'apparition' || event.kind === 'shadow') && this.apparition && this.world.nav.point(event.position[0], event.position[2], event.position[1] > 2 ? 1 : 0)) {
      this.apparition.position.copyFromFloats(...event.position); this.apparition.rotation.setAll(0); this.apparition.setEnabled(true);
    }
    if (event.kind === 'curtain' || event.kind === 'window') {
      const w = this.world.data.windows.find(w => w.room === event.room);
      if (w) {
        const side = w.axis === 'x' ? (w.position[2] < -10 ? .06 : -.06) : (w.position[0] < 0 ? .06 : -.06);
        this.rag.position.set(w.position[0] + (w.axis === 'z' ? side : w.width * .35), w.position[1] + .6, w.position[2] + (w.axis === 'x' ? side : w.width * .35));
        this.rag.rotation.set(0, w.axis === 'z' ? Math.PI / 2 : 0, 0); this.rag.setEnabled(true);
      }
    }
    if (event.kind === 'object') { this.debris.position.copyFromFloats(...event.position); this.debris.rotation.setAll(0); this.debris.setEnabled(true); }
  }
  private resetEvent(): void {
    this.active = null; this.lightDip = this.flashlightDip = 0; this.affectedRoom = '';
    this.apparition?.setEnabled(false); this.rag.setEnabled(false); this.debris.setEnabled(false);
    this.screenMaterial?.emissiveColor.copyFrom(this.screenColor);
  }
  update(dt: number, p: Position, direction: Babylon.Vector3, flashlight: boolean, settings: Settings, time: number): void {
    this.storm = Math.max(0, this.storm - dt);
    // Reduced flicker disables lightning pulses and flashlight interruption entirely.
    this.lightning = settings.reducedFlicker ? 0 : Math.sin(Math.PI * this.storm / 1.4) ** 6 * this.stormStrength;
    const room = this.world.room(p).id, low = settings.quality === 'low';
    for (const [i, d] of this.drops.entries()) {
      const visible = d.room === room && (!low || i % 3 === 0);
      const y = d.y + d.height * (1 - (time * 2.3 + d.phase) % 1);
      d.start.set(d.x, y, d.z); d.end.set(d.x + (visible ? .028 : 0), y - (visible ? .21 : 0), d.z);
    }
    B.MeshBuilder.CreateLineSystem('exterior-rain', { lines: this.lines, instance: this.rain });
    this.dust.setEnabled(flashlight);
    if (flashlight) {
      this.dustSightTick -= dt;
      if (this.dustSightTick <= 0) {
        this.dustSightTick = .2;
        const eye: Vec3 = [p.x, p.y + 1.65, p.z], end: Vec3 = [eye[0] + direction.x * 4.3, eye[1] + direction.y * 4.3, eye[2] + direction.z * 4.3];
        this.dustReach = Math.max(.12, Math.min(4, (worldHit(eye, end, this.world.colliders) ?? 1) * 4.3 - .2));
      }
      const count = low ? 12 : 48, drift = settings.reducedMotion ? 0 : time;
      this.dust.setEnabled(this.dustReach > .75);
      this.dust.thinInstanceCount = count;
      for (let i = 0; i < count; i++) {
        const depth = .75 + (i * .317 % 1) * Math.max(0, this.dustReach - .75), spread = Math.min(.55, depth * .15);
        this.dustPosition.set(p.x + direction.x * depth + Math.sin(i * 8.73 + drift * .09) * spread, p.y + 1.65 + direction.y * depth + Math.sin(i * 3.12 + drift * .13) * spread, p.z + direction.z * depth + Math.cos(i * 5.37 + drift * .09) * spread);
        B.Matrix.TranslationToRef(this.dustPosition.x, this.dustPosition.y, this.dustPosition.z, this.matrix); this.matrix.copyToArray(this.dustMatrices, i * 16);
      }
      this.dust.thinInstanceBufferUpdated('matrix');
    }
    if (!this.active) return;
    const { event } = this.active; this.active.elapsed += dt;
    const t = this.active.elapsed, progress = Math.min(1, t / event.duration), envelope = Math.sin(progress * Math.PI);
    this.affectedRoom = event.room;
    if (event.kind === 'light') {
      this.lightDip = envelope * (settings.reducedFlicker ? .2 : .8);
      this.flashlightDip = settings.reducedFlicker ? 0 : t > 1.3 && t < 1.5 ? .4 : 0;
    }
    if (event.kind === 'radio' && this.screenMaterial) this.screenMaterial.emissiveColor.setAll(settings.reducedFlicker ? envelope * .12 : envelope * (.16 + Math.sin(t * 8) * .04));
    if (this.rag.isEnabled()) this.rag.rotation.z = settings.reducedMotion ? .035 * envelope : Math.sin(t * 1.7) * .09 * envelope;
    if (this.debris.isEnabled()) {
      const floor = event.position[1] > 3.3 ? this.world.data.floorRise : 0;
      this.debris.position.y = Math.max(floor + .025, event.position[1] - t * t * 3); this.debris.rotation.z = settings.reducedMotion ? 0 : Math.min(1.7, t * 2.7);
    }
    if (this.apparition?.isEnabled()) {
      const delta = this.apparition.position.add(vector([0, 1.4, 0])).subtract(this.world.camera.position), distance = delta.length();
      const illuminated = flashlight && distance < 13 && B.Vector3.Dot(delta.normalize(), direction) > .88 && this.world.clearSight(this.world.camera.position.asArray() as Vec3, this.apparition.position.add(vector([0, 1.4, 0])).asArray() as Vec3);
      if (illuminated && t > .25 || settings.gentleScares && event.kind === 'apparition') this.apparition.setEnabled(false);
      else {
        this.apparition.rotation.y = Math.atan2(p.x - event.position[0], p.z - event.position[2]);
        this.apparition.position.x = event.position[0] + (event.kind === 'shadow' && !settings.reducedMotion ? Math.sin(progress * Math.PI) * .6 : 0);
        for (const material of this.apparitionMaterials) material.alpha = envelope * (event.kind === 'shadow' ? .18 : .55);
      }
    }
    if (progress >= 1) this.resetEvent();
  }
  get doorShudder(): number { return this.active?.event.kind === 'door' ? Math.sin(this.active.elapsed * 22) * Math.exp(-this.active.elapsed * 2) * .013 : 0; }
  dispose(): void { this.reset(); /* Scene disposal owns all meshes/materials. */ }
}
