import type * as Babylon from 'babylonjs';
import { B } from './world.ts';
import type { World } from './world.ts';
import { ASSETS, assetUrl } from './config.ts';
import type { Collider, Hotspot, InteractionId, Position, Progress, Vec3 } from './types.ts';
import { Hinge } from './hinge.ts';
import { cabinetPanels } from './cabinet-geometry.ts';
import type { Surface } from './cabinet-geometry.ts';
import { boxHit } from './geometry.ts';

export const CABINETS = [
  { id: 'hide-dining', room: 'F04', position: [8.75, 0, -20.3] as Vec3, yaw: -Math.PI / 2, replaces: '' },
  { id: 'hide-guest', room: 'U03', position: [2.17, 3.24, -13] as Vec3, yaw: Math.PI / 2, replaces: 'U03-wardrobe-074' },
] as const;
export interface HidingCabinet {
  id: string; root: Babylon.TransformNode; body: Babylon.Mesh; pivots: Babylon.TransformNode[];
  hide: Babylon.TransformNode; entrance: Babylon.TransformNode; exit: Babylon.TransformNode; view: Babylon.TransformNode;
  hinge: Hinge; floor: 0 | 1; yaw: number; hotspot: Hotspot; solids: Collider[];
}
export interface HouseDoor {
  id: InteractionId; root: Babylon.TransformNode; pivot: Babylon.TransformNode; frame: Babylon.AbstractMesh;
  hinge: Hinge; width: number; height: number; hotspot: Hotspot; locked: boolean; initialOpen: boolean;
  lock: 'final' | 'bedroom' | 'sealed' | null;
}
const load = (world: World, path: string) => { const url = assetUrl(path), i = url.lastIndexOf('/'); return B.SceneLoader.ImportMeshAsync(null, url.slice(0, i + 1), url.slice(i + 1), world.scene); };
function baked(mesh: Babylon.AbstractMesh, map: (p: Babylon.Vector3) => Babylon.Vector3): Surface {
  mesh.computeWorldMatrix(true);
  const p = mesh.getVerticesData(B.VertexBuffer.PositionKind)!, n = mesh.getVerticesData(B.VertexBuffer.NormalKind)!;
  const surface: Surface = { positions: [], normals: [], uvs: Array.from(mesh.getVerticesData(B.VertexBuffer.UVKind)!), indices: Array.from(mesh.getIndices()!) };
  const matrix = mesh.getWorldMatrix();
  for (let i = 0; i < p.length; i += 3) {
    surface.positions.push(...map(B.Vector3.TransformCoordinates(B.Vector3.FromArray(p, i), matrix)).asArray());
    surface.normals.push(...B.Vector3.TransformNormal(B.Vector3.FromArray(n, i), matrix).normalize().asArray());
  }
  return surface;
}
function meshFrom(name: string, data: Surface, material: Babylon.Material | null, world: World): Babylon.Mesh {
  const mesh = new B.Mesh(name, world.scene), vd = new B.VertexData();
  vd.positions = data.positions; vd.indices = data.indices; vd.uvs = data.uvs;
  // Non-uniform model normalization requires normals in the final coordinate space.
  vd.normals = []; B.VertexData.ComputeNormals(vd.positions, vd.indices, vd.normals, { useRightHandedSystem: true });
  vd.applyToMesh(mesh); mesh.material = material; mesh.receiveShadows = true; return mesh;
}
export function anchorPosition(anchor: Babylon.TransformNode, level: 0 | 1): Position {
  anchor.computeWorldMatrix(true); const p = anchor.getAbsolutePosition(); return { x: p.x, y: p.y, z: p.z, level };
}
export class InteractiveFixtures {
  readonly cabinets: HidingCabinet[] = [];
  readonly doors: HouseDoor[] = [];
  private world: World;
  constructor(world: World) { this.world = world; }
  async load(): Promise<void> {
    const world = this.world;
    const cabinet = await load(world, ASSETS.hidingCabinet), original = cabinet.meshes.find(m => m.getTotalVertices() > 0)!;
    const surfaces = cabinetPanels(baked(original, p => new B.Vector3(p.x * 1.30 / .676316, (p.y + .0006) * 2.36 / 1.7444, p.z * .92 / .520886)));
    const material = original.material;
    if (material instanceof B.PBRMaterial) { material.maxSimultaneousLights = 4; material.emissiveColor.set(.025, .028, .03); }
    for (const c of CABINETS) {
      const root = new B.TransformNode(`${c.room}-${c.id}-CabinetRoot`, world.scene); root.position.copyFromFloats(...c.position); root.rotation.y = c.yaw;
      const body = meshFrom(`${c.room}-${c.id}-CabinetBody`, surfaces.body, material, world); body.parent = root;
      const pivots = (['left', 'right'] as const).map((side, i) => {
        const pivot = new B.TransformNode(`${c.id}-${side}-DoorPivot`, world.scene); pivot.parent = root; pivot.position.set(i === 0 ? -.59 : .59, 0, .36);
        const leaf = meshFrom(`${c.room}-${c.id}-${side}-CabinetDoor`, surfaces[side], material, world); leaf.parent = pivot; leaf.position.copyFrom(pivot.position.negate()); return pivot;
      });
      const anchor = (name: string, xyz: Vec3) => { const node = new B.TransformNode(`${c.id}-${name}`, world.scene); node.parent = root; node.position.copyFromFloats(...xyz); return node; };
      const hide = anchor('HidePosition', [0, .015, .02]), view = anchor('HidingCameraPosition', [0, 1.665, .02]);
      const entrance = anchor('EntrancePosition', [0, 0, .87]), exit = anchor('ExitPosition', [0, 0, 1.28]);
      const target = anchor('InteractionTarget', [0, 1.3, .50]); target.computeWorldMatrix(true);
      const hotspot: Hotspot = { id: c.id, label: 'Hide', room: c.room, kind: 'hide', radius: .5, position: target.getAbsolutePosition().asArray() as Vec3 };
      const solids: Collider[] = [];
      const liner = new B.StandardMaterial(`${c.id}-inside`, world.scene); liner.diffuseColor.set(.075, .085, .08); liner.emissiveColor.set(.009, .013, .013); liner.specularColor.setAll(0);
      for (const [name, center, size] of [
        ['back', [0, 1.18, -.41], [1.2, 2.36, .055]], ['left', [-.62, 1.18, 0], [.055, 2.36, .85]],
        ['right', [.62, 1.18, 0], [.055, 2.36, .85]], ['top', [0, 2.32, 0], [1.25, .045, .85]], ['bottom', [0, -.025, 0], [1.25, .05, .85]],
      ] as [string, Vec3, Vec3][]) {
        const panel = B.MeshBuilder.CreateBox(`${c.room}-${c.id}-lining-${name}`, { width: size[0], height: size[1], depth: size[2] }, world.scene);
        panel.parent = root; panel.position.copyFromFloats(...center); panel.material = liner; panel.computeWorldMatrix(true);
        solids.push({ id: `${c.id}-${name}`, room: c.room, center: panel.getAbsolutePosition().asArray() as Vec3, size, yaw: c.yaw });
      }
      this.cabinets.push({ id: c.id, root, body, pivots, hide, entrance, exit, view, hinge: new Hinge(98 * Math.PI / 180, .62), floor: c.room.startsWith('U') ? 1 : 0, yaw: Math.PI - c.yaw, hotspot, solids });
    }
    cabinet.meshes.forEach(m => m.dispose());
    const source = await load(world, ASSETS.door);
    const pieces = source.meshes.filter(m => m.getTotalVertices() > 0).map(m => ({ name: m.name, material: m.material, surface: baked(m, p => p) }));
    for (const d of world.data.doors) {
      const lock = d.id === 'outside-front--F01' ? 'final' : d.id === 'U00--U06' ? 'bedroom' : d.id === 'F08--outside-escape' ? 'sealed' : null;
      const id: InteractionId = lock === 'final' ? 'front-door' : lock === 'bedroom' ? 'bedroom-door' : `door:${d.id}`;
      const root = new B.TransformNode(`${d.source}-DoorRoot-${d.id}`, world.scene); root.position.copyFromFloats(...d.position); root.rotation.y = d.axis === 'z' ? Math.PI / 2 : 0;
      const width = d.width - .08, height = d.height * .8224723 / .8635959;
      const pivot = new B.TransformNode(`${d.id}-DoorPivot`, world.scene); pivot.parent = root; pivot.position.x = width / 2;
      let frame!: Babylon.AbstractMesh;
      for (const piece of pieces) {
        const data = { ...piece.surface, positions: piece.surface.positions.map((v, i) => i % 3 === 0 ? (v + .16449444) * width / .32898887 : i % 3 === 1 ? v * d.height / .8635959 : v * 1.5) };
        const mesh = meshFrom(`${d.source}-${d.id}-${piece.name}`, data, piece.material, world);
        if (piece.name.startsWith('DoorFrame')) { mesh.parent = root; frame = mesh; }
        else { mesh.parent = pivot; mesh.position.x = -width / 2; }
      }
      const initialOpen = lock === null;
      const direction = d.axis === 'z' && d.position[0] < 0 ? -1 : 1;
      const hinge = new Hinge(direction * Math.PI / 2, lock === 'final' ? 1.3 : .85); hinge.reset(initialOpen); pivot.rotation.y = hinge.angle;
      const hotspot: Hotspot = { id, label: '', position: [d.position[0], d.position[1] + 1.12, d.position[2]], room: d.source, kind: 'door', radius: .52 };
      this.doors.push({ id, root, pivot, frame, hinge, width, height, hotspot, locked: lock !== null, lock, initialOpen });
    }
    source.meshes.forEach(m => m.dispose()); this.sync();
  }
  reset(progress: Progress): void {
    for (const c of this.cabinets) { c.hinge.reset(); c.pivots.forEach(p => p.rotation.y = 0); }
    for (const d of this.doors) { d.hinge.reset(d.initialOpen); d.pivot.rotation.y = d.hinge.angle; }
    this.syncProgress(progress); this.sync();
  }
  syncProgress(progress: Progress): void {
    for (const d of this.doors) d.locked = d.lock === 'sealed' || d.lock === 'final' && !progress.exitUnlocked || d.lock === 'bedroom' && !progress.bedroomUnlocked;
  }
  label(door: HouseDoor): string { return door.locked ? door.lock === 'sealed' ? 'Inspect jammed service door' : door.lock === 'final' ? 'Unlock main entrance' : 'Unlock master bedroom' : door.hinge.state === 'OPEN' ? 'Close door' : 'Open door'; }
  collider(door: HouseDoor, angle = door.hinge.angle): Collider {
    const co = Math.cos(door.root.rotation.y), si = Math.sin(door.root.rotation.y), x = door.width / 2 * (1 - Math.cos(angle)), z = door.width / 2 * Math.sin(angle);
    return { id: `leaf-${door.id}`, room: door.hotspot.room, center: [door.root.position.x + x * co + z * si, door.root.position.y + door.height / 2, door.root.position.z - x * si + z * co], size: [door.width, door.height, .055], yaw: door.root.rotation.y + angle };
  }
  update(dt: number, actors: Position[]): void {
    let changed = false;
    for (const d of this.doors) {
      const moved = d.hinge.update(dt, angle => actors.every(p => boxHit([p.x, p.y + .9, p.z], [p.x, p.y + .9, p.z], this.collider(d, angle), .26) === null));
      if (moved) { d.pivot.rotation.y = d.hinge.angle; changed = true; }
    }
    for (const c of this.cabinets) if (c.hinge.update(dt)) { c.pivots[0].rotation.y = -c.hinge.angle; c.pivots[1].rotation.y = c.hinge.angle; changed = true; }
    if (changed) this.sync();
  }
  private sync(): void {
    const solids = this.doors.map(d => this.collider(d));
    for (const c of this.cabinets) {
      solids.push(...c.solids);
      // Reserve the cabinet footprint for navigation even while the controlled
      // entry animation moves inside. Ghosts approach its external search anchor.
      solids.push({ id: `${c.id}-reserved`, room: c.hotspot.room, center: [c.root.position.x, c.root.position.y + 1.18, c.root.position.z], size: [1.30, 2.36, .92], yaw: c.root.rotation.y });
    }
    this.world.setFixtureColliders(solids);
  }
}
