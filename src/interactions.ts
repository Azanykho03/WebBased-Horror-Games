import type * as Babylon from 'babylonjs';
import { B, vector } from './world.ts';
import type { World } from './world.ts';
import type { Player } from './player.ts';
import type { GhostStateMachine } from './ghost.ts';
import { HOTSPOTS } from './config.ts';
import { has } from './objectives.ts';
import type { Hotspot, ItemId, Position, Progress, Vec3 } from './types.ts';
import { sphereHit, worldHit } from './geometry.ts';

export class InteractionSystem {
  readonly hotspots = structuredClone(HOTSPOTS);
  target: Hotspot | null = null;
  private visuals = new Map<string, Babylon.TransformNode>();
  private marker!: Babylon.Mesh;
  private projectile: { position: Vec3; velocity: Vec3; time: number; origin: Position } | null = null;
  slipperInHand = false;
  private world: World;

  constructor(world: World) { this.world = world; this.build(); }
  private build(): void {
    const scene = this.world.scene;
    const brass = new B.StandardMaterial('pickup-brass', scene); brass.diffuseColor.set(.6, .39, .13); brass.emissiveColor.set(.11, .06, .018);
    const paper = new B.StandardMaterial('pickup-paper', scene); paper.diffuseColor.set(.67, .61, .43);
    const red = new B.StandardMaterial('pickup-red', scene); red.diffuseColor.set(.39, .15, .10);
    const metal = new B.StandardMaterial('pickup-metal', scene); metal.diffuseColor.set(.52, .57, .49);
    for (const h of this.hotspots) {
      if (h.kind !== 'pickup' && h.kind !== 'note' || h.id === 'exit-key' || h.id === 'flashlight') continue;
      const root = new B.TransformNode(`item-${h.id}`, scene); root.position.copyFromFloats(...h.position);
      let mesh: Babylon.Mesh;
      if (h.id === 'locket') {
        mesh = B.MeshBuilder.CreateTorus('family-locket', { diameter: .14, thickness: .025, tessellation: 20 }, scene); mesh.material = brass;
      } else if (h.id === 'tsinelas') {
        mesh = B.MeshBuilder.CreateSphere('slipper-sole', { diameter: 1, segments: 8 }, scene); mesh.scaling.set(.15, .035, .32); mesh.material = red;
        const strap = B.MeshBuilder.CreateTorus('slipper-strap', { diameter: .12, thickness: .025, tessellation: 12 }, scene);
        strap.parent = root; strap.position.set(0, .045, -.05); strap.rotation.x = Math.PI / 2; strap.scaling.y = .7; strap.material = red;
      } else if (h.id === 'fuse' || h.id.startsWith('battery')) {
        mesh = B.MeshBuilder.CreateCylinder(h.id, { height: .17, diameter: .055, tessellation: 12 }, scene); mesh.rotation.z = Math.PI / 2; mesh.material = h.id === 'fuse' ? brass : metal;
      } else {
        mesh = B.MeshBuilder.CreateBox(h.id, h.id === 'music-box' ? { width: .23, height: .16, depth: .17 } : h.id === 'note' ? { width: .26, height: .006, depth: .33 } : { width: .24, height: .015, depth: .16 }, scene);
        mesh.material = h.id === 'music-box' ? red : paper;
        if (h.id === 'note') {
          const ink = new B.DynamicTexture('living-room-warning-print', { width: 512, height: 640 }, scene, false);
          // Correct the horizontal canvas UV orientation in the RH game scene.
          ink.uScale = -1; ink.uOffset = 1;
          const context = ink.getContext(); context.fillStyle = '#b8aa80'; context.fillRect(0, 0, 512, 640);
          context.fillStyle = '#30291f'; context.font = 'bold 42px serif'; context.fillText('AYAW PAGSULOD.', 35, 85);
          context.font = '28px serif';
          ['Return what belongs', 'to this house.', '', 'Find the kitchen fuse.', 'Restore the lights.', '', 'Break her line of sight.', 'Hide only when unseen.'].forEach((line, i) => context.fillText(line, 36, 160 + i * 48));
          ink.update();
          const face = new B.StandardMaterial('warning-print', scene); face.diffuseTexture = ink; face.specularColor.setAll(0); face.backFaceCulling = false;
          face.emissiveColor.set(.08, .065, .04);
          const page = B.MeshBuilder.CreateGround('warning-note-text', { width: .25, height: .32, subdivisions: 1 }, scene);
          page.parent = root; page.position.y = .004; page.material = face;
          root.rotation.y = Math.PI - .1;
        }
      }
      mesh.parent = root; this.visuals.set(h.id, root);
    }
    // One physical flashlight is loaded once, then moved to the real hand socket.
    this.visuals.set('flashlight', this.world.viewmodel.pickupRoot);
    const hint = new B.StandardMaterial('focus-marker', scene); hint.emissiveColor.set(.78, .70, .43); hint.disableLighting = true;
    this.marker = B.MeshBuilder.CreateTorus('interaction-ring', { diameter: .055, thickness: .008, tessellation: 12 }, scene); this.marker.material = hint; this.marker.isPickable = false;
    for (const root of this.visuals.values()) for (const mesh of root.getChildMeshes()) mesh.isPickable = false;
  }
  reset(progress: Progress): void {
    this.projectile = null; this.slipperInHand = has(progress, 'tsinelas'); this.target = null;
    const start = HOTSPOTS.find(h => h.id === 'tsinelas')!;
    this.hotspots.find(h => h.id === 'tsinelas')!.position = [...start.position];
    const slipper = this.visuals.get('tsinelas')!;
    slipper.position.copyFromFloats(...start.position); slipper.rotation.setAll(0);
    this.sync(progress);
  }
  sync(progress: Progress): void {
    for (const h of this.hotspots) this.visuals.get(h.id)?.setEnabled(this.available(h, progress));
  }
  available(h: Hotspot, progress: Progress): boolean {
    if (h.id === 'tsinelas') return progress.kitchenSeen && !this.slipperInHand && !this.projectile;
    if (h.id === 'exit-key') return progress.cabinet && !has(progress, 'exit-key');
    if (h.id === 'cabinet') return !progress.cabinet;
    if (h.id === 'bedroom-door') return !progress.power;
    if (h.id === 'note') return true;
    if (h.kind === 'pickup') return !has(progress, h.id as ItemId);
    return true;
  }
  focus(player: Player, progress: Progress): Hotspot | null {
    this.target = null;
    if (player.hidden) { this.marker.setEnabled(false); return null; }
    const eye = player.eye, dir = player.direction.asArray() as Vec3;
    let best = Infinity;
    for (const h of this.hotspots) {
      if (!this.available(h, progress) || Math.abs(h.position[1] - (player.position.y + .9)) > 1.8) continue;
      const delta = h.position.map((v, i) => v - eye[i]), distance = Math.hypot(...delta);
      if (distance > 2.15) continue;
      const along = delta.reduce((sum, v, i) => sum + v * dir[i], 0);
      if (along < 0) continue;
      const offAxis = Math.sqrt(Math.max(0, distance * distance - along * along));
      if (offAxis > h.radius || !this.world.clearSight(eye, h.position)) continue;
      if (distance < best) { this.target = h; best = distance; }
    }
    this.marker.setEnabled(this.target !== null);
    if (this.target) { this.marker.position.copyFromFloats(...this.target.position); this.marker.lookAt(this.world.camera.position); this.marker.rotation.x += Math.PI / 2; }
    return this.target;
  }
  takeSlipper(progress: Progress): void {
    this.slipperInHand = true; if (!has(progress, 'tsinelas')) progress.collected.push('tsinelas'); this.sync(progress);
  }
  throw(player: Player): boolean {
    if (!this.slipperInHand || this.projectile || player.hidden) return false;
    this.slipperInHand = false;
    const start: Vec3 = [...player.eye];
    const direction = player.direction.asArray() as Vec3;
    this.projectile = { position: start, velocity: [direction[0] * 12, direction[1] * 12 + 1.3, direction[2] * 12], time: 0, origin: { ...player.position } };
    this.visuals.get('tsinelas')?.setEnabled(true); return true;
  }
  updateProjectile(dt: number, ghost: GhostStateMachine, noise: (p: Position, radius: number) => void, onHit: () => void): void {
    const shot = this.projectile;
    if (!shot) return;
    shot.time += dt;
    const next = shot.position.map((v, i) => v + shot.velocity[i] * dt) as Vec3;
    shot.velocity[1] -= 11 * dt;
    const wall = worldHit(shot.position, next, this.world.colliders, .035);
    const ghostHit = ghost.state === 'Dormant' ? null : sphereHit(shot.position, next, [ghost.position.x, ghost.position.y + 1, ghost.position.z], .65);
    const floor = this.world.nav.height(next[0], next[2], shot.origin.level);
    const hitGhost = ghostHit !== null && (wall === null || ghostHit < wall);
    const hitFloor = floor !== null && next[1] <= floor + .1;
    if (hitGhost || wall !== null || hitFloor || shot.time > 2.5 || next[1] < -.5) {
      if (hitGhost && ghost.stun()) onHit();
      const landing = this.findLanding(next, shot.origin);
      this.hotspots.find(h => h.id === 'tsinelas')!.position = [landing.x, landing.y + .1, landing.z];
      this.visuals.get('tsinelas')!.position.copyFromFloats(landing.x, landing.y + .1, landing.z);
      this.visuals.get('tsinelas')!.rotation.setAll(0);
      this.projectile = null; noise(landing, 8);
    } else {
      shot.position = next;
      const visual = this.visuals.get('tsinelas')!; visual.position.copyFrom(vector(next)); visual.rotation.x += dt * 15;
    }
  }
  private findLanding(at: Vec3, fallback: Position): Position {
    for (const radius of [0, .3, .6, .9]) for (let i = 0; i < 8; i++) {
      const p = this.world.nav.point(at[0] + Math.sin(i * Math.PI / 4) * radius, at[2] + Math.cos(i * Math.PI / 4) * radius, fallback.level);
      if (p) { try { this.world.nav.path(fallback, p); return p; } catch { /* Try another reachable floor point. */ } }
    }
    return fallback;
  }
}
