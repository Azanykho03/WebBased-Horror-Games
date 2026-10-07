import type * as Babylon from 'babylonjs';
import { createNavigation } from '../scripts/3d-generation/house-navigation.mjs';
import type { Navigation } from '../scripts/3d-generation/house-navigation.mjs';
import type { Collider, HouseManifest, Position, Progress, Settings, Vec3 } from './types.ts';
import { assetUrl, ASSETS, GHOST_PROFILE } from './config.ts';
import { FlashlightViewmodel } from './flashlight-viewmodel.ts';
import { worldHit } from './geometry.ts';
import { HauntedEnvironment } from './haunting.ts';
import { calmAtmosphere } from './horror.ts';
import type { Atmosphere } from './horror.ts';
import { AbandonedInterior } from './decay.ts';
import { PlayerCollision } from './player-physics.ts';
import { CorazonPresentation } from './corazon.ts';
import { CABINETS, InteractiveFixtures } from './fixtures.ts';

export const B = (window as unknown as { BABYLON: typeof Babylon }).BABYLON;
export const vector = (p: Vec3) => B.Vector3.FromArray(p);
export class World {
  readonly scene: Babylon.Scene;
  readonly camera: Babylon.FreeCamera;
  readonly flashlight: Babylon.SpotLight;
  readonly sky: Babylon.HemisphericLight;
  data!: HouseManifest;
  nav!: Navigation;
  private playerCollision?: PlayerCollision;
  get collision(): PlayerCollision { return this.playerCollision ??= new PlayerCollision(this.data, this.nav); }
  meshes: Babylon.AbstractMesh[] = [];
  ghost!: Babylon.TransformNode;
  corazon!: CorazonPresentation;
  arms!: Babylon.TransformNode;
  viewmodel!: FlashlightViewmodel;
  key!: Babylon.TransformNode;
  masterKey!: Babylon.TransformNode;
  fixtures3d!: InteractiveFixtures;
  private fixtures: { definition: HouseManifest['lights'][number]; light: Babylon.PointLight }[] = [];
  private dynamic: Collider[] = [];
  private shadow: Babylon.ShadowGenerator;
  private shadowQuality = '';
  private viewmodelFill?: Babylon.PointLight;
  private flashlightSocket?: Babylon.TransformNode;
  private flashlightEmitter?: Babylon.PBRMaterial;
  kitchenBlackout = false;
  environment!: HauntedEnvironment;
  interior?: AbandonedInterior;
  atmosphere: Atmosphere = calmAtmosphere();

  constructor(engine: Babylon.Engine) {
    this.scene = new B.Scene(engine);
    this.scene.useRightHandedSystem = true;
    this.scene.clearColor = new B.Color4(.012, .017, .018, 1);
    this.scene.fogMode = B.Scene.FOGMODE_EXP2;
    this.scene.fogDensity = .018;
    this.scene.fogColor = new B.Color3(.029, .034, .033);
    this.camera = new B.FreeCamera('player-camera', vector([0, 1.65, -2.5]), this.scene);
    this.camera.minZ = .045; this.camera.maxZ = 80; this.camera.fov = 1.16;
    this.scene.activeCamera = this.camera;
    this.sky = new B.HemisphericLight('ambient', vector([.1, 1, .2]), this.scene);
    this.sky.diffuse.set(.74, .8, .83);
    this.sky.groundColor = new B.Color3(.14, .16, .14);
    this.flashlight = new B.SpotLight('player-flashlight', this.camera.position.clone(), vector([0, 0, -1]), 1.08, 18, this.scene);
    this.flashlight.diffuse = new B.Color3(.94, .90, .74); this.flashlight.range = 14;
    this.shadow = new B.ShadowGenerator(512, this.flashlight);
    this.shadow.usePercentageCloserFiltering = true;
    this.shadow.filteringQuality = B.ShadowGenerator.QUALITY_LOW;
    this.shadow.bias = .003; this.shadow.normalBias = .025;
  }

  async load(report: (text: string, percent: number) => void): Promise<void> {
    report('Reading the house layout', 8);
    const response = await fetch(assetUrl(ASSETS.manifest));
    if (!response.ok) throw new Error(`House manifest could not load (${response.status}).`);
    this.data = await response.json() as HouseManifest;
    if (this.data.version !== 1 || !Array.isArray(this.data.colliders) || this.data.rooms.length !== 17) throw new Error('The house manifest is incompatible.');
    const replacements = new Set(CABINETS.map(c => c.replaces as string).filter(Boolean));
    for (const p of this.data.props) if (p.kind === 'open-door') replacements.add(p.id);
    const removedFurniture = this.data.colliders.filter(c => replacements.has(c.id));
    this.data.colliders = this.data.colliders.filter(c => !replacements.has(c.id));
    this.nav = createNavigation(this.data);
    report('Opening the old house', 20);
    const house = await this.import(ASSETS.house);
    this.meshes = house.meshes.filter(m => m.getTotalVertices() > 0 && ![...replacements].some(id => m.name.startsWith(id)));
    for (const mesh of house.meshes) if ([...replacements].some(id => mesh.name.startsWith(id))) mesh.setEnabled(false);
    // House furniture is batched by room/material. Remove only the triangles
    // contained in the replaced wardrobe's authored bounds, not the room mesh.
    for (const mesh of this.meshes) for (const c of removedFurniture) {
      if (!c.center || !mesh.name.startsWith(`${c.room}__`)) continue;
      const positions = mesh.getVerticesData(B.VertexBuffer.PositionKind), indices = mesh.getIndices();
      if (!positions || !indices) continue;
      const keep: number[] = [];
      for (let i = 0; i < indices.length; i += 3) {
        const triangle = [indices[i], indices[i + 1], indices[i + 2]];
        const inside = triangle.every(index => {
          const x = positions[index * 3] - c.center![0], z = positions[index * 3 + 2] - c.center![2];
          return Math.abs(x * Math.cos(c.yaw) - z * Math.sin(c.yaw)) < c.size[0] / 2 + .08
            && Math.abs(x * Math.sin(c.yaw) + z * Math.cos(c.yaw)) < c.size[2] / 2 + .08
            && Math.abs(positions[index * 3 + 1] - c.center![1]) < c.size[1] / 2 + .08;
        });
        if (!inside) keep.push(...triangle);
      }
      if (mesh instanceof B.Mesh) mesh.setIndices(keep);
    }
    this.standardMaterials(this.meshes, true);
    for (const mesh of this.meshes) {
      mesh.freezeWorldMatrix(); mesh.receiveShadows = true;
      if (!/floor|ceiling|stain|roof/.test(mesh.name)) this.shadow.addShadowCaster(mesh);
    }
    report('Settling dust in the abandoned rooms', 49);
    this.interior = new AbandonedInterior(this);
    this.meshes.push(...this.interior.meshes);
    report('Preparing the rooms and lights', 55);
    for (const definition of this.data.lights) this.addLight(definition);
    for (const [i, w] of this.data.windows.entries()) this.addLight({ id: `window-${i}`, room: w.room, position: [w.position[0], w.position[1] + w.height * .6, w.position[2]], intensity: .58, range: 4.5, color: [.49, .63, .71], period: 18, phase: i, electric: false });
    this.fixtures3d = new InteractiveFixtures(this); await this.fixtures3d.load();
    const interactiveMeshes = [...this.fixtures3d.cabinets.flatMap(c => c.root.getChildMeshes()), ...this.fixtures3d.doors.flatMap(d => d.root.getChildMeshes())];
    for (const mesh of interactiveMeshes) { this.shadow.addShadowCaster(mesh); mesh.receiveShadows = true; }
    this.meshes.push(...interactiveMeshes);
    for (const f of this.fixtures) f.light.includedOnlyMeshes.push(...interactiveMeshes.filter(m => m.name.startsWith(f.definition.room)));
    report(`Loading ${GHOST_PROFILE.name}, your flashlight, and the keys`, 65);
    const [ghost, rig, flashlight, key, masterKey] = await Promise.all([
      this.model(GHOST_PROFILE.model, 'ghost'), this.import(ASSETS.arms),
      this.model(ASSETS.flashlight, 'held-flashlight', true), this.model(ASSETS.key, 'exit-key'),
      this.model(ASSETS.masterKey, 'master-key'),
    ]);
    this.ghost = ghost; this.key = key; this.masterKey = masterKey;
    this.corazon = new CorazonPresentation(this.scene, this.camera, ghost);
    this.viewmodel = new FlashlightViewmodel(this.scene, this.camera, rig, flashlight);
    this.arms = this.viewmodel.root;
    this.ghost.setEnabled(false);
    for (const mesh of this.ghost.getChildMeshes()) this.shadow.addShadowCaster(mesh);
    const armMeshes = this.viewmodel.meshes;
    this.flashlightSocket = this.viewmodel.lens;
    this.flashlightEmitter = armMeshes.map(mesh => mesh.material).find((m): m is Babylon.PBRMaterial => m instanceof B.PBRMaterial && m.name === 'Flashlight_emitter');
    this.viewmodelFill = new B.PointLight('viewmodel-fill', vector([-.25, .18, -.05]), this.scene);
    this.viewmodelFill.parent = this.camera;
    this.viewmodelFill.includedOnlyMeshes = armMeshes;
    this.viewmodelFill.diffuse.set(.79, .84, .91); this.viewmodelFill.range = 1.3; this.viewmodelFill.radius = .3;
    this.flashlight.excludedMeshes = armMeshes;
    // Only the foreground arm clears depth; it cannot clip into a nearby wall.
    this.scene.setRenderingAutoClearDepthStencil(1, true, true, true);
    this.normalizeItem(this.key, .24); this.key.position.set(.58, 1.38, -13.5); this.key.setEnabled(false);
    this.normalizeItem(this.masterKey, .25); this.masterKey.position.set(-4.3, 3.99, -7.17);
    this.environment = new HauntedEnvironment(this);
    report('Waiting for textures', 94);
    // Fixtures start disabled. Compiling every room light at once can exceed
    // WebGL uniform limits before the first frame applies the light budget.
    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error('The renderer could not prepare the house. Reload the page or try a browser with WebGL 2 support.')), 30000);
      this.scene.whenReadyAsync().then(() => { window.clearTimeout(timeout); resolve(); }, error => { window.clearTimeout(timeout); reject(error); });
    });
    report('Ready', 100);
  }

  private import(path: string) {
    const url = assetUrl(path), slash = url.lastIndexOf('/');
    return B.SceneLoader.ImportMeshAsync(null, url.slice(0, slash + 1), url.slice(slash + 1), this.scene);
  }
  private async model(path: string, name: string, preservePbr = false): Promise<Babylon.TransformNode> {
    const result = await this.import(path), root = new B.TransformNode(name, this.scene);
    for (const mesh of result.meshes) if (!mesh.parent) mesh.parent = root;
    if (preservePbr) {
      for (const mesh of result.meshes) if (mesh.material instanceof B.PBRMaterial) {
        mesh.material.maxSimultaneousLights = 4;
        mesh.material.environmentIntensity = .25;
      }
    } else this.standardMaterials(result.meshes.filter(m => m.getTotalVertices() > 0), false);
    return root;
  }
  private standardMaterials(meshes: Babylon.AbstractMesh[], house: boolean): void {
    const converted = new Map<Babylon.Material, Babylon.StandardMaterial>();
    for (const mesh of meshes) {
      if (!(mesh.material instanceof B.PBRMaterial)) continue;
      const old = mesh.material;
      let material = converted.get(old);
      if (!material) {
        material = new B.StandardMaterial(`${old.name}-game`, this.scene);
        material.diffuseColor = old.albedoColor.clone(); material.diffuseTexture = old.albedoTexture;
        material.specularColor.set(.07, .065, .05); material.specularPower = 24; material.maxSimultaneousLights = 8;
        material.emissiveColor = old.emissiveColor.clone();
        if (!house) material.emissiveColor.set(.045, .045, .04);
        if (old.name === 'window') { material.emissiveColor.set(.06, .09, .10); material.alpha = .22; material.backFaceCulling = false; }
        if (old.name === 'stain' && material.diffuseTexture) { material.useAlphaFromDiffuseTexture = true; material.diffuseTexture.hasAlpha = true; material.backFaceCulling = false; material.disableLighting = true; }
        if (old.name === 'cabinet-glass') { material.alpha = .13; material.backFaceCulling = false; }
        converted.set(old, material);
      }
      mesh.material = material;
    }
    for (const old of converted.keys()) old.dispose(false, false);
  }
  private addLight(definition: HouseManifest['lights'][number]): void {
    const light = new B.PointLight(definition.id, vector(definition.position), this.scene);
    light.setEnabled(false);
    light.diffuse = B.Color3.FromArray(definition.color); light.range = definition.range; light.radius = .3;
    light.includedOnlyMeshes = this.meshes.filter(m => m.name.startsWith(definition.room) || definition.room === 'U00' && m.name.startsWith('F03') || m.name === 'F00-ceiling__plaster');
    this.fixtures.push({ definition, light });
  }
  private normalizeItem(root: Babylon.TransformNode, length: number): void {
    const bounds = root.getHierarchyBoundingVectors(true), center = bounds.min.add(bounds.max).scale(.5);
    const size = bounds.max.subtract(bounds.min), scale = length / Math.max(size.x, size.y, size.z);
    for (const child of root.getChildren()) if (child instanceof B.TransformNode) child.position.subtractInPlace(center);
    root.scaling.setAll(scale);
  }
  setFixtureColliders(colliders: Collider[]): void {
    this.dynamic = colliders; this.nav.setDynamicColliders(colliders); this.collision.setDynamicColliders(colliders);
  }
  syncProgress(p: Progress): void {
    this.fixtures3d.syncProgress(p);
    this.key.setEnabled(p.cabinet && !p.collected.includes('exit-key'));
    this.masterKey.setEnabled(!p.collected.includes('master-key'));
  }
  get colliders(): Collider[] { return this.data.colliders.concat(this.dynamic); }
  clearSight(a: Vec3, b: Vec3): boolean { const hit = worldHit(a, b, this.colliders); return hit === null || hit > .985; }
  room(p: Position): { id: string; name: string } {
    const [x0, x1, z0, z1] = this.data.stair.rect;
    if (p.x >= x0 && p.x <= x1 && p.z >= z0 && p.z <= z1) return { id: 'F03', name: 'Hardwood staircase' };
    return this.data.rooms.find(r => r.floor === p.level && r.id !== 'F03' && r.rects.some(([x0, x1, z0, z1]) => p.x >= x0 && p.x <= x1 && p.z >= z0 && p.z <= z1)) ?? { id: 'OUT', name: 'Outside' };
  }
  update(p: Position, direction: Babylon.Vector3, settings: Settings, progress: Progress, flashlightOn: boolean, time: number): void {
    const room = this.room(p).id, upper = p.level === 1 || room === 'F03' && p.y > 2, nearStairs = p.x > -1.4 && p.x < 3.7 && p.z > -8;
    for (const mesh of this.meshes) {
      const name = mesh.name;
      mesh.setEnabled(!name.startsWith('roof') && (!name.startsWith('U') || upper || nearStairs) && (!name.startsWith('F') || !upper || nearStairs || name.startsWith('F03') || name.includes('ceiling')));
    }
    const nearest = this.fixtures.filter(f => (f.definition.room.startsWith('U') ? 1 : 0) === (upper ? 1 : 0) || f.definition.room === 'F03')
      .map(f => ({ f, distance: B.Vector3.Distance(f.light.position, this.camera.position) + (f.definition.room === room ? -3 : 0) }))
      .sort((a, b) => a.distance - b.distance).slice(0, settings.quality === 'low' ? 4 : 6).map(x => x.f);
    for (const f of this.fixtures) {
      f.light.setEnabled(nearest.includes(f));
    }
    this.interior?.update(p, settings);
    this.lighting(direction, settings, progress, flashlightOn, time);
    if (this.shadowQuality !== settings.quality) {
      this.shadowQuality = settings.quality;
      this.shadow.mapSize = settings.quality === 'low' ? 256 : 512;
      this.shadow.usePercentageCloserFiltering = settings.quality !== 'low';
    }
    this.flashlight.shadowEnabled = true;
  }
  lighting(direction: Babylon.Vector3, settings: Settings, progress: Progress, flashlightOn: boolean, time: number): void {
    this.flashlight.position.copyFrom(this.camera.position); this.flashlight.direction.copyFrom(direction);
    if (this.flashlightSocket) {
      this.flashlightSocket.computeWorldMatrix(true);
      this.flashlight.position.copyFrom(this.flashlightSocket.getAbsolutePosition());
      this.flashlight.direction.copyFrom(this.flashlightSocket.getDirection(vector([0, 0, -1])).normalize());
    }
    const e = this.environment;
    this.flashlight.intensity = flashlightOn && progress.collected.includes('flashlight') && this.viewmodel.ready && progress.battery > 0 ? 2.3 * settings.brightness * (1 - (e?.flashlightDip ?? 0)) : 0;
    if (this.viewmodelFill) { this.viewmodelFill.intensity = .5 * settings.brightness; this.viewmodelFill.setEnabled(this.viewmodel.visible); }
    if (this.flashlightEmitter) {
      const lit = this.flashlight.intensity > 0;
      this.flashlightEmitter.emissiveColor.set(lit ? .85 : .012, lit ? .76 : .012, lit ? .46 : .009);
    }
    this.sky.intensity = (.19 + (e?.lightning ?? 0) * .23) * settings.brightness;
    for (const f of this.fixtures) {
      if (!f.light.isEnabled()) continue;
      const d = f.definition;
      const power = d.electric && this.kitchenBlackout && d.room === 'F05' && !settings.reducedFlicker ? .06 : d.electric && !progress.power ? .3 : 1;
      const flicker = settings.reducedFlicker || !d.electric ? 1 : .94 + .06 * Math.sin(time * Math.PI * 2 / d.period + d.phase);
      const dim = d.electric ? (1 - this.atmosphere.proximity * .18) * (1 - (e?.affectedRoom === d.room ? e.lightDip : 0)) : 1 + (e?.lightning ?? 0) * 2;
      f.light.intensity = d.intensity * power * flicker * dim * settings.brightness * (d.electric ? .82 : 1);
    }
  }
  weather(p: Position): { rainExposure: number; window: Vec3 | null } {
    const room = this.room(p).id, windows = this.data.windows.filter(w => w.room === room);
    windows.sort((a, b) => Math.hypot(a.position[0] - p.x, a.position[2] - p.z) - Math.hypot(b.position[0] - p.x, b.position[2] - p.z));
    const nearest = windows[0];
    return { window: nearest ? [nearest.position[0], nearest.position[1] + .7, nearest.position[2]] : null,
      rainExposure: room === 'U07' || room === 'OUT' ? 1 : nearest ? Math.max(.1, .65 - Math.hypot(nearest.position[0] - p.x, nearest.position[2] - p.z) * .08) : .04 };
  }
  dispose(): void { this.environment?.dispose(); this.scene.dispose(); }
}
