import type * as Babylon from 'babylonjs';
import { B } from './world.ts';
import type { World } from './world.ts';
import { HOTSPOTS } from './config.ts';
import type { Position, Settings, Vec3 } from './types.ts';
import { clearOfPlaySpace, insideFootprint, planDebris, seededRandom } from './decay-layout.ts';
import { ATLAS_CELLS, createDecayAtlas, weatherHouse } from './decay-textures.ts';
import type { DecalKind } from './decay-textures.ts';

/** One static vertex buffer per room/material. No individual litter draw calls. */
class Batch {
  positions: number[] = []; indices: number[] = []; normals: number[] = []; uvs: number[] = []; colors: number[] = [];
  quad(points: Vec3[], tile: DecalKind | null = null, shade = 1): void {
    const start = this.positions.length / 3, cell = tile ? ATLAS_CELLS[tile] : 0;
    const x = cell % 4 / 4, y = Math.floor(cell / 4) / 4, a = tile ? .25 : 1, pad = tile ? .004 : 0;
    this.positions.push(...points.flat());
    this.indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
    this.uvs.push(x + pad, y + a - pad, x + a - pad, y + a - pad, x + a - pad, y + pad, x + pad, y + pad);
    for (let i = 0; i < 4; i++) this.colors.push(shade, shade, shade, 1);
  }
  box(center: Vec3, size: Vec3, yaw = 0, tilt = 0, shade = 1): void {
    const data = B.VertexData.CreateBox({ width: size[0], height: size[1], depth: size[2] });
    const start = this.positions.length / 3, c = Math.cos(yaw), s = Math.sin(yaw), ct = Math.cos(tilt), st = Math.sin(tilt);
    const p = data.positions!;
    for (let i = 0; i < p.length; i += 3) {
      const x = p[i] * ct - p[i + 1] * st, y = p[i] * st + p[i + 1] * ct, z = p[i + 2];
      this.positions.push(center[0] + x * c + z * s, center[1] + y, center[2] - x * s + z * c);
      this.colors.push(shade, shade * .99, shade * .94, 1);
    }
    this.indices.push(...Array.from(data.indices!, v => v + start)); this.uvs.push(...data.uvs!);
  }
  build(name: string, material: Babylon.Material, scene: Babylon.Scene): Babylon.Mesh {
    const mesh = new B.Mesh(name, scene), data = new B.VertexData();
    B.VertexData.ComputeNormals(this.positions, this.indices, this.normals);
    data.positions = this.positions; data.indices = this.indices; data.normals = this.normals; data.uvs = this.uvs; data.colors = this.colors;
    data.applyToMesh(mesh, false); mesh.material = material; mesh.isPickable = false; mesh.checkCollisions = false;
    mesh.receiveShadows = true; mesh.freezeWorldMatrix(); return mesh;
  }
}

type Surface = 'wood' | 'plaster' | 'rust' | 'glass' | 'dirt' | 'cutout' | 'web' | 'moon';
export class AbandonedInterior {
  readonly meshes: Babylon.Mesh[] = [];
  readonly debris;
  private batches = new Map<string, Batch>();
  private materials = new Map<Surface, Babylon.StandardMaterial>();
  private random = seededRandom(13071947);
  private world: World;

  constructor(world: World) {
    this.world = world;
    this.distressFurniture();
    weatherHouse(world.scene, world.meshes);
    const atlas = createDecayAtlas(world.scene);
    for (const surface of ['wood', 'plaster', 'rust', 'glass', 'dirt', 'cutout', 'web', 'moon'] as Surface[]) {
      let material: Babylon.StandardMaterial;
      if (['wood', 'plaster', 'rust', 'glass'].includes(surface)) {
        const source = world.scene.materials.find(m => m.name === `${surface === 'wood' ? 'woodlight' : surface === 'glass' ? 'damp' : surface}-game`);
        material = source instanceof B.StandardMaterial ? source : new B.StandardMaterial(`decay-${surface}`, world.scene);
      } else {
        material = new B.StandardMaterial(`decay-${surface}`, world.scene);
        material.diffuseTexture = atlas; material.useAlphaFromDiffuseTexture = true;
        material.backFaceCulling = false; material.twoSidedLighting = true; material.specularColor.setAll(0);
        material.maxSimultaneousLights = 8;
        material.transparencyMode = surface === 'cutout' ? B.Material.MATERIAL_ALPHATEST : B.Material.MATERIAL_ALPHABLEND;
        material.alphaCutOff = .28; material.zOffset = -1;
        if (surface === 'moon') { material.disableLighting = true; material.emissiveColor.set(.52, .63, .68); material.alpha = .6; }
        if (surface === 'web') material.alpha = .7;
      }
      this.materials.set(surface, material);
    }
    this.debris = planDebris(world.data, HOTSPOTS);
    this.walls(); this.corners(); this.windows(); this.furniture(); this.floors(); this.doorFrames();
    for (const piece of this.debris) {
      if (piece.kind === 'paper') this.floorPatch(piece.room, piece.position, piece.size[0], piece.size[2], 'paper', piece.yaw, 'cutout');
      else this.batch(piece.room, piece.kind === 'timber' ? 'wood' : 'plaster').box(piece.position, piece.size, piece.yaw, .04, .72 + this.random() * .26);
    }
    for (const [key, batch] of this.batches) {
      if (!batch.indices.length) continue;
      const [room, surface] = key.split(':') as [string, Surface];
      const mesh = batch.build(`${room}-decay-${surface}`, this.materials.get(surface)!, world.scene);
      mesh.metadata = { decorative: true, room, surface, triangles: batch.indices.length / 3 };
      this.meshes.push(mesh);
    }
    this.batches.clear();
  }
  private batch(room: string, surface: Surface): Batch {
    const key = `${room}:${surface}`;
    if (!this.batches.has(key)) this.batches.set(key, new Batch());
    return this.batches.get(key)!;
  }
  private wallPatch(room: string, at: Vec3, width: number, height: number, yaw: number, kind: DecalKind, surface: Surface = 'dirt'): void {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    const points: Vec3[] = [[-width / 2, -height / 2, 0], [width / 2, -height / 2, 0], [width / 2, height / 2, 0], [-width / 2, height / 2, 0]];
    this.batch(room, surface).quad(points.map(([x, y]) => [at[0] + x * c, at[1] + y, at[2] - x * s]), kind);
  }
  private floorPatch(room: string, at: Vec3, width: number, depth: number, kind: DecalKind, yaw = 0, surface: Surface = 'dirt'): void {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    const points: Vec3[] = [[-width / 2, 0, -depth / 2], [width / 2, 0, -depth / 2], [width / 2, 0, depth / 2], [-width / 2, 0, depth / 2]];
    this.batch(room, surface).quad(points.map(([x, , z]) => [at[0] + x * c + z * s, at[1], at[2] - x * s + z * c]), kind);
  }
  private walls(): void {
    // Follow actual wall colliders; openings, room partitions and the stair void
    // are therefore respected instead of treating every room rectangle as a wall.
    for (const collider of this.world.data.colliders) {
      if (!collider.min) continue;
      const size = collider.max.map((v, i) => v - collider.min[i]);
      if (size[1] < 1 || Math.min(size[0], size[2]) > .3) continue;
      const alongX = size[0] > size[2], length = alongX ? size[0] : size[2];
      if (length < .6) continue;
      const floor = collider.min[1] > 2.9 ? 1 : 0;
      for (const side of [-1, 1]) {
        const center: Vec3 = collider.min.map((v, i) => (v + collider.max[i]) / 2) as Vec3;
        center[alongX ? 2 : 0] += side * ((alongX ? size[2] : size[0]) / 2 + .012);
        const room = this.world.data.rooms.find(r => r.floor === floor && r.id !== 'F03' && r.rects.some(([x0, x1, z0, z1]) => center[0] > x0 && center[0] < x1 && center[2] > z0 && center[2] < z1));
        if (!room) continue;
        const yaw = alongX ? 0 : Math.PI / 2, base = floor * this.world.data.floorRise;
        const count = Math.max(1, Math.floor(length / 2.4));
        for (let i = 0; i < count; i++) {
          const p: Vec3 = [...center]; p[alongX ? 0 : 2] += ((i + .5) / count - .5) * length;
          const width = Math.min(length / count * .86, 2.8);
          const bottom = Math.max(collider.min[1], base + .1), top = Math.min(collider.max[1], base + 2.98), height = top - bottom;
          if (height < .45) continue;
          p[1] = bottom + height / 2;
          this.wallPatch(room.id, p, width, height, yaw, 'damp');
          if (height > 1.4 && this.random() > .34) {
            const q: Vec3 = [...p]; q[1] = base + 1.05 + this.random() * .7; q[alongX ? 2 : 0] += side * .003;
            const peel = (['peel', 'peelTall', 'peelSmall'] as const)[Math.floor(this.random() * 3)];
            this.wallPatch(room.id, q, width * (.36 + this.random() * .28), .55 + this.random() * .6, yaw, peel, 'cutout');
            q[1] = base + 2.15; q[alongX ? 2 : 0] += side * .002;
            this.wallPatch(room.id, q, width * .68, 1.05, yaw, 'crack');
          }
        }
      }
    }
  }
  private distressFurniture(): void {
    // Edit only visual triangles in a few existing furniture components. The
    // structural shell, furniture silhouettes at foot level and manifest stay put.
    for (const mesh of this.world.meshes) {
      const room = mesh.name.slice(0, 3);
      const curtains = /__(linen|lace|velvet)$/.test(mesh.name) ? this.world.data.windows.filter(w => w.room === room && w.height > 1) : [];
      const chairs = room === 'F04' && /__(wood|woodlight)$/.test(mesh.name) ? this.world.data.props.filter(p => p.kind === 'dining-chair' && p.position[2] < -19) : [];
      const coffeeTop = mesh.name === 'F02__woodlight';
      const cabinet = room === 'F09' && /__(wood|woodlight)$/.test(mesh.name) ? this.world.data.props.find(p => p.kind === 'damaged-cabinet') : undefined;
      if (!curtains.length && !chairs.length && !coffeeTop && !cabinet) continue;
      const positions = mesh.getVerticesData(B.VertexBuffer.PositionKind), indices = mesh.getIndices();
      if (!positions || !indices) continue;
      const kept: number[] = [];
      for (let i = 0; i < indices.length; i += 3) {
        const p: Vec3 = [0, 0, 0];
        for (let j = 0; j < 3; j++) for (let axis = 0; axis < 3; axis++) p[axis] += positions[indices[i + j] * 3 + axis] / 3;
        const brokenChair = chairs.some(chair => {
          const dx = p[0] - chair.position[0], dz = p[2] - chair.position[2], c = Math.cos(chair.yaw), s = Math.sin(chair.yaw);
          const x = dx * c - dz * s, z = dx * s + dz * c;
          return Math.abs(x) < .2 && z > -.27 && z < -.18 && p[1] > .67;
        });
        const raggedHem = curtains.some(w => {
          const along = w.axis === 'x' ? p[0] - w.position[0] : p[2] - w.position[2];
          const depth = w.axis === 'x' ? p[2] - w.position[2] : p[0] - w.position[0];
          return Math.abs(depth) < .23 && Math.abs(along) > w.width * .28 && Math.abs(along) < w.width * .55 && p[1] < w.position[1] + .18 + Math.sin(along * 51) * .23 && p[1] > w.position[1] - .7;
        });
        const brokenTop = coffeeTop && p[0] > 5.29 && p[0] < 7.01 && p[1] > .384 && p[1] < .476 && p[2] > -3.74 && p[2] < -2.86;
        let missingPanel = false;
        if (cabinet) {
          const dx = p[0] - cabinet.position[0], dz = p[2] - cabinet.position[2], c = Math.cos(cabinet.yaw), s = Math.sin(cabinet.yaw);
          const x = dx * c - dz * s, z = dx * s + dz * c;
          missingPanel = x > .04 && x < .66 && z > .3 && z < .43 && p[1] > .15 && p[1] < 1.52;
        }
        if (!brokenChair && !raggedHem && !brokenTop && !missingPanel) kept.push(indices[i], indices[i + 1], indices[i + 2]);
      }
      if (kept.length !== indices.length) mesh.setIndices(kept, mesh.getTotalVertices());
    }
  }
  private corners(): void {
    for (const room of this.world.data.rooms) {
      if (room.id === 'U07' || room.id === 'F03') continue;
      const base = room.floor * this.world.data.floorRise;
      for (const [x0, x1, z0, z1] of room.rects) for (const [x, z, sx, sz] of [[x0, z0, 1, 1], [x1, z1, -1, -1], [x0, z1, 1, -1]]) {
        const reach = .62 + this.random() * .42, y = base + 3.0;
        // Sagging triangular sheets joining two walls and the ceiling.
        const a: Vec3 = [x + sx * .13, y, z + sz * .13], b: Vec3 = [a[0] + sx * reach, y - .06, a[2]], d: Vec3 = [a[0], y - reach * .75, a[2] + sz * reach * .55];
        this.batch(room.id, 'web').quad([a, b, [b[0], d[1], d[2]], d], 'web');
        this.floorPatch(room.id, [x + sx * .5, base + 3.035, z + sz * .5], .95, .95, 'damp');
      }
    }
    // Webs stay above head height along the long, otherwise empty passages.
    for (const [room, x, z, y] of [['F01', -1.27, -4.6, 2.95], ['F08', 1.27, -20.8, 2.98], ['U00', -1.27, -8.1, 6.21], ['U00', 1.27, -20.8, 6.2], ['F03', 3.2, -5.8, 5.9]] as [string, number, number, number][]) {
      this.wallPatch(room, [x, y - .3, z], .85, .72, Math.PI / 2, 'web', 'web');
    }
  }
  private windows(): void {
    for (const [index, w] of this.world.data.windows.entries()) {
      const y0 = w.room.startsWith('U') ? this.world.data.floorRise : 0;
      const inward = w.axis === 'x' ? (w.position[2] < -10 ? 1 : -1) : (w.position[0] < 0 ? 1 : -1);
      const yaw = w.axis === 'x' ? 0 : Math.PI / 2;
      const point = (along: number, y: number, depth: number): Vec3 => [w.position[0] + (w.axis === 'x' ? along : inward * depth), y, w.position[2] + (w.axis === 'z' ? along : inward * depth)];
      this.wallPatch(w.room, point(0, (w.position[1] + y0) / 2, .109), w.width * 1.1, w.position[1] - y0 - .04, yaw, 'damp');
      this.wallPatch(w.room, point(w.width * .31, w.position[1] + w.height - .26, .21), .68, .65, yaw, 'web', 'web');
      this.wallPatch(w.room, point(-w.width * .16, w.position[1] + w.height * .6, .022), .6, .9, yaw, 'crack');
      // A few uneven, split shutters. Never board a gameplay door or window route.
      if (index % 3 === 0 && w.height > 1) {
        for (let i = 0; i < 2; i++) {
          const at = point(.04, w.position[1] + .36 + i * .65, .14);
          this.batch(w.room, 'wood').box(at, [w.width * .72, .11, .035], yaw, i ? -.09 : .12, .65);
          this.batch(w.room, 'rust').box(point(w.width * .29, at[1], .166), [.018, .025, .026]);
        }
      }
      for (const side of [-1, 1]) {
        const length = Math.min(1.75, w.position[1] + w.height - y0 - .3);
        this.wallPatch(w.room, point(side * (w.width / 2 - .1), w.position[1] + w.height - length / 2, .255), .4, length, yaw, 'cloth', 'cutout');
        this.wallPatch(w.room, point(side * (w.width / 2 - .14), w.position[1] + w.height * .44, .29), .26, .72, yaw, 'tear', 'cutout');
      }
      const floor = point(0, y0 + .039, 1.15);
      this.floorPatch(w.room, floor, w.axis === 'x' ? w.width : 1.9, w.axis === 'x' ? 1.9 : w.width, 'dust');
      // Cheap moonlight shafts: two depth-tested sheets, only on Standard, culled
      // outside this room. No extra lights, shadow maps or postprocess passes.
      if (w.width > 1.5) {
        const edgeA = point(-w.width * .35, w.position[1] + w.height * .83, .17);
        const edgeB = point(w.width * .35, edgeA[1], .17);
        const endA = point(-w.width * .36 + .28, y0 + .07, 2.4), endB = point(w.width * .36 + .28, y0 + .07, 2.4);
        this.batch(w.room, 'moon').quad([edgeA, edgeB, endB, endA], 'moon');
        this.floorPatch(w.room, point(.2, y0 + .052, 1.55), w.axis === 'x' ? w.width * .85 : 2.0, w.axis === 'x' ? 2.0 : w.width * .85, 'moon', w.axis === 'x' ? 0 : Math.PI / 2, 'moon');
      }
    }
  }
  private furniture(): void {
    for (const prop of this.world.data.props) {
      const collider = this.world.data.colliders.find(c => c.id === prop.id);
      if (!collider?.center) continue;
      const [w, height, d] = collider.size, yaw = prop.yaw, [x, y, z] = prop.position;
      const local = (a: number, b: number, c: number): Vec3 => [x + a * Math.cos(yaw) + c * Math.sin(yaw), y + b, z - a * Math.sin(yaw) + c * Math.cos(yaw)];
      const room = prop.room;
      this.floorPatch(room, [x, y + .031, z], w * 1.09, d * 1.09, 'contact', yaw);
      if (/shelf|cabinet|wardrobe|dresser/.test(prop.kind)) {
        this.floorPatch(room, local(0, height + .008, 0), w * .84, d * .8, 'dust', yaw);
        this.wallPatch(room, local(-w * .29, height * .86, d / 2 + .014), Math.min(.66, w * .7), .49, yaw, 'web', 'web');
        this.wallPatch(room, local(w * .15, height * .36, d / 2 + .01), w * .55, height * .6, yaw, 'grime');
        this.wallPatch(room, local(-w * .2, height * .26, d / 2 + .016), Math.min(.38, w * .36), height * .28, yaw, 'rot', 'cutout');
        // A detached shelf and its splinters sit inside the furniture's solid base.
        const shelf = local(0, .19, 0);
        if (w > 1.2 && clearOfPlaySpace(this.world.data, HOTSPOTS, shelf, .45) && insideFootprint(shelf, collider, .1)) {
          this.batch(room, 'wood').box(shelf, [w * .72, .045, d * .69], yaw, .09, .76);
          this.batch(room, 'wood').box(local(.13, .045, .02), [.075, .035, d * .85], yaw + .35, 0, .65);
        }
      }
      if (/table|counter|workbench/.test(prop.kind)) {
        // Surface heights match the original authored furniture, including its tops.
        const top = prop.kind === 'dining-table' ? .826 : prop.kind === 'coffee-table' ? .478 : prop.kind === 'workbench' ? .91 : prop.kind === 'counter' ? .994 : height + .005;
        if (prop.kind === 'coffee-table') {
          // Reuse the table's legs/apron; replace only the top with split boards
          // shortened toward the damaged corner, all inside its original bounds.
          for (const [i, length] of [.8, .82, .77, .72, .57, .42].entries()) {
            this.batch(room, 'wood').box(local((i - 2.5) * .275, .444, -(d - length) / 2), [.263, .05, length], yaw, (i % 3 - 1) * .008, .82 + i * .025);
          }
          this.batch(room, 'wood').box(local(.55, .057, .22), [.08, .035, .32], yaw + .27, 0, .7);
        }
        for (const side of [-1, 1]) {
          const at = local(side * w * .29, top + .008, 0);
          if (clearOfPlaySpace(this.world.data, HOTSPOTS, at, .25)) this.floorPatch(room, at, w * .36, d * .78, 'dust', yaw);
        }
        if (prop.kind === 'dining-table') {
          this.floorPatch(room, local(0, .84, .35), .7, 1.3, 'grime', yaw);
          this.wallPatch(room, local(w / 2 - .08, .65, .15), .65, .6, yaw + Math.PI / 2, 'cloth', 'cutout');
        }
      }
      if (/sofa|armchair|bed$|covered-furniture/.test(prop.kind)) {
        const front = d / 2 + .012;
        this.wallPatch(room, local(-w * .2, prop.kind === 'bed' ? .48 : .68, front), Math.min(.75, w * .65), .5, yaw, 'tear', 'cutout');
        this.floorPatch(room, local(0, prop.kind === 'bed' ? .712 : .615, .05), w * .76, d * .55, 'dust', yaw);
      }
      if (prop.kind === 'box') {
        this.floorPatch(room, local(0, height + .011, 0), w * .9, d * .9, 'dust', yaw);
        this.batch(room, 'wood').box(local(.06, height + .035, 0), [w * .68, .022, d * .81], yaw, -.08, .61);
      }
      // A snapped, fallen chair back beneath the existing dining chair. Its
      // footprint and collision continue to agree; it never intrudes into a route.
      if (prop.kind === 'dining-chair' && z < -19 && clearOfPlaySpace(this.world.data, HOTSPOTS, prop.position, .4)) {
        this.batch(room, 'wood').box(local(0, .075, .02), [.38, .055, .38], yaw + .1, 0, .66);
        for (const a of [-.15, .15]) this.batch(room, 'wood').box(local(a, .19, .03), [.027, .30, .03], yaw, -.22, .63);
        this.wallPatch(room, local(0, .76, -.18), .42, .43, yaw, 'web', 'web');
      }
    }
    // Workshop containers, discarded medicine bottles and a fallen picture stay
    // on known blocked storage footprints. None is a new invisible obstruction.
    for (const prop of this.world.data.props.filter(p => ['box', 'damaged-cabinet'].includes(p.kind))) {
      const c = this.world.data.colliders.find(c => c.id === prop.id);
      if (!c?.center || !clearOfPlaySpace(this.world.data, HOTSPOTS, prop.position, .45)) continue;
      const [x, y, z] = prop.position, top = c.size[1];
      this.batch(prop.room, 'rust').box([x, y + top + .105, z], [.14, .20, .13], .12, 0, .65);
      this.batch(prop.room, 'glass').box([x + .17, y + top + .08, z + .08], [.07, .16, .075], -.15, 0, .7);
      this.batch(prop.room, 'glass').box([x + .17, y + top + .18, z + .08], [.03, .07, .03], -.15);
    }
    for (const [room, x, z, yaw] of [['F02', 8.91, -.9, .27], ['U02', -7.15, -7.35, -.2], ['U06', 8.94, -21.36, .7]] as [string, number, number, number][]) {
      const y = (room.startsWith('U') ? this.world.data.floorRise : 0) + .055;
      if (!clearOfPlaySpace(this.world.data, HOTSPOTS, [x, y, z], .45)) continue;
      this.floorPatch(room, [x, y, z], .32, .40, 'paper', yaw, 'cutout');
      for (const side of [-1, 1]) this.batch(room, 'wood').box([x + side * .2, y + .005, z], [.027, .035, .5], yaw, 0, .6);
      this.batch(room, 'wood').box([x, y + .006, z - .24], [.42, .036, .03], yaw + .08);
    }
  }
  private floors(): void {
    for (const room of this.world.data.rooms) {
      if (room.id === 'F03' || room.id === 'U07') continue;
      const base = room.floor * this.world.data.floorRise;
      for (const [x0, x1, z0, z1] of room.rects) {
        for (const [x, z] of [[x0 + .53, z0 + .64], [x1 - .6, z1 - .55], [x0 + .5, (z0 + z1) / 2]]) {
          this.floorPatch(room.id, [x, base + .04, z], .9, 1.05, 'dust');
        }
      }
      // Dark splintered recesses suggest lost floorboards without opening a
      // fall-through hole in the player's collision floor.
      if (room.floor === 1 && room.id !== 'U05' || room.id === 'F02') {
        const [x0, , z0] = room.rects[0], at: Vec3 = [x0 + .42, base + .043, z0 + 1.0];
        if (!clearOfPlaySpace(this.world.data, HOTSPOTS, at, .48) || room.id === 'U00') continue;
        this.floorPatch(room.id, at, .27, .78, 'rot', 0, 'cutout');
        for (let i = 0; i < 3; i++) this.batch(room.id, 'wood').box([at[0] - .10 + i * .085, base + .065, at[2] + (i % 2 ? -.29 : .26)], [.045, .023, .18 + this.random() * .1], this.random() * .16, 0, .75);
      }
    }
  }
  private doorFrames(): void {
    for (const d of this.world.data.doors) {
      const room = d.source.startsWith('outside') ? d.destination : d.source;
      const yaw = d.axis === 'x' ? 0 : Math.PI / 2, p: Vec3 = [...d.position];
      p[1] += d.height + .09;
      // The top web and chipped trim stay outside the full opening clearance.
      p[d.axis === 'x' ? 0 : 2] -= d.width * .32;
      p[d.axis === 'x' ? 2 : 0] += .11;
      this.wallPatch(room, p, .46, .23, yaw, 'web', 'web');
      p[1] += .19; this.wallPatch(room, p, .44, .25, yaw, 'peel', 'cutout');
    }
  }
  update(p: Position, settings: Settings): void {
    const room = this.world.room(p).id, low = settings.quality === 'low';
    for (const mesh of this.meshes) {
      const meta = mesh.metadata as { room: string; surface: Surface };
      const sameFloor = meta.room.startsWith('U') === (p.level === 1 || room === 'F03' && p.y > 2), bounds = mesh.getBoundingInfo().boundingBox;
      const distance = Math.hypot(Math.max(bounds.minimumWorld.x - p.x, 0, p.x - bounds.maximumWorld.x), Math.max(bounds.minimumWorld.z - p.z, 0, p.z - bounds.maximumWorld.z));
      const visible = (sameFloor || meta.room === 'F03') && distance < (low ? 11 : 18);
      mesh.setEnabled(visible && (meta.surface !== 'moon' || !low && meta.room === room));
    }
  }
  get triangles(): number { return this.meshes.reduce((sum, mesh) => sum + mesh.getTotalIndices() / 3, 0); }
}
