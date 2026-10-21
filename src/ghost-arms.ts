import type * as Babylon from 'babylonjs';
import { B } from './world.ts';
import { smoothStep } from './corazon-motion.ts';

type Arm = { side: number; shoulder: Babylon.Vector3; elbow: Babylon.Vector3; palm: Babylon.Vector3; vertices: { offset: number; weight: number; lower: number }[] };

/** Bounded two-link solution. A fixed outward/downward pole prevents elbow flips. */
export function solveArm(shoulder: Babylon.Vector3, elbow: Babylon.Vector3, palm: Babylon.Vector3, target: Babylon.Vector3, side: number) {
  const upperLength = B.Vector3.Distance(shoulder, elbow), lowerLength = B.Vector3.Distance(elbow, palm);
  const delta = target.subtract(shoulder), distance = Math.max(Math.abs(upperLength - lowerLength) + .001, Math.min(delta.length(), upperLength + lowerLength - .015));
  const direction = delta.lengthSquared() > .000001 ? delta.normalize() : new B.Vector3(0, 0, 1);
  const end = shoulder.add(direction.scale(distance));
  const pole = new B.Vector3(side * .8, -.8, -.2);
  const perpendicular = pole.subtract(direction.scale(B.Vector3.Dot(pole, direction)));
  if (perpendicular.lengthSquared() < .000001) {
    const fallback = Math.abs(direction.z) < .9 ? B.Axis.Z : B.Axis.X;
    perpendicular.copyFrom(fallback.subtract(direction.scale(B.Vector3.Dot(fallback, direction))));
  }
  perpendicular.normalize();
  const along = (upperLength ** 2 - lowerLength ** 2 + distance ** 2) / (2 * distance);
  const height = Math.sqrt(Math.max(0, upperLength ** 2 - along ** 2));
  return { elbow: shoulder.add(direction.scale(along)).add(perpendicular.scale(height)), palm: end };
}

/**
 * Celestina's preserved body has no skin or joints. Bend its connected upper body
 * and rotate inspected arm regions from rest vertices; blend shoulder and elbow. No
 * re-meshing, material changes, global scaling or accumulated deformation.
 */
export class GhostArms {
  readonly grips: [Babylon.Vector3, Babylon.Vector3] = [B.Vector3.Zero(), B.Vector3.Zero()];
  private mesh: Babylon.Mesh;
  private positions: Float32Array;
  private normals: Float32Array | null;
  private posed: Float32Array;
  private posedNormals: Float32Array | null;
  private arms: Arm[];
  private dirty = false;
  constructor(root: Babylon.TransformNode) {
    const mesh = root.getChildMeshes().find(mesh => mesh.name === 'Ghost_body');
    if (!(mesh instanceof B.Mesh)) throw new Error('The original Celestina body is required for the grab pose.');
    this.mesh = mesh;
    this.positions = new Float32Array(mesh.getVerticesData(B.VertexBuffer.PositionKind)!);
    const normals = mesh.getVerticesData(B.VertexBuffer.NormalKind);
    this.normals = normals ? new Float32Array(normals) : null;
    this.posed = this.positions.slice(); this.posedNormals = this.normals?.slice() ?? null;
    mesh.markVerticesDataAsUpdatable(B.VertexBuffer.PositionKind, true);
    if (normals) mesh.markVerticesDataAsUpdatable(B.VertexBuffer.NormalKind, true);
    // The generated body is asymmetric: its -X hand is already forward by .33m.
    // These anchors are measured separately, never mirrored from the other arm.
    this.arms = [
      { side: -1, shoulder: new B.Vector3(-.22, 1.43, .02), elbow: new B.Vector3(-.28, 1.12, .12), palm: new B.Vector3(-.32, .78, .33), vertices: [] },
      { side: 1, shoulder: new B.Vector3(.19, 1.43, -.065), elbow: new B.Vector3(.265, 1.13, -.085), palm: new B.Vector3(.398, .77, -.065), vertices: [] },
    ];
    for (let i = 0; i < this.positions.length; i += 3) {
      const x = this.positions[i], y = this.positions[i + 1], z = this.positions[i + 2];
      // Below the shoulder the arms are separated from the dress by a visible
      // gap. The x/y boundary follows that gap; the back/front mask excludes hair.
      if (y < .60 || y > 1.48) continue;
      const arm = this.arms[x < 0 ? 0 : 1];
      const a = y < arm.elbow.y ? arm.elbow : arm.shoulder, b = y < arm.elbow.y ? arm.palm : arm.elbow;
      const t = Math.max(0, Math.min(1, (a.y - y) / (a.y - b.y))), centerZ = a.z + (b.z - a.z) * t;
      const edge = y < .94 ? (x < 0 ? .23 : .27) : y < 1.23 ? .17 + (1.23 - y) * (x < 0 ? .20 : .30) : .165;
      const depth = 1 - smoothStep((Math.abs(z - centerZ) - .09) / .06);
      const weight = smoothStep((Math.abs(x) - edge) / .04) * (1 - smoothStep((y - 1.33) / .15)) * depth;
      if (weight <= 0) continue;
      arm.vertices.push({ offset: i, weight, lower: 1 - smoothStep((y - 1.08) / .11) });
    }
  }
  pose(left: Babylon.Vector3, right: Babylon.Vector3, amount: number, bend = 0): void {
    if (amount <= 0 && bend === 0) { this.reset(); return; }
    this.dirty = true; this.mesh.computeWorldMatrix(true);
    const inverse = B.Matrix.Invert(this.mesh.getWorldMatrix());
    // Fixed hand identities. Sorting moving targets can silently swap the held ankle.
    const targets = [left, right].map(target => B.Vector3.TransformCoordinates(target, inverse));
    const pivot = new B.Vector3(0, .63, 0), spine = B.Matrix.RotationX(bend);
    const original = B.Vector3.Zero(), a = B.Vector3.Zero(), b = B.Vector3.Zero(), normal = B.Vector3.Zero(), relative = B.Vector3.Zero();
    // Bend the connected upper dress/body around the same spine pivot as the
    // head. The hem and lower dress stay on the floor, unlike a whole-mesh tilt.
    for (let offset = 0; offset < this.positions.length; offset += 3) {
      original.copyFromFloats(this.positions[offset], this.positions[offset + 1], this.positions[offset + 2]);
      const weight = smoothStep((original.y - .55) / .40);
      original.subtractToRef(pivot, relative); B.Vector3.TransformNormalToRef(relative, spine, a); a.addInPlace(pivot);
      B.Vector3.LerpToRef(original, a, weight, a); a.toArray(this.posed, offset);
      if (this.normals && this.posedNormals) {
        normal.copyFromFloats(this.normals[offset], this.normals[offset + 1], this.normals[offset + 2]);
        B.Vector3.TransformNormalToRef(normal, spine, a); B.Vector3.LerpToRef(normal, a, weight, a);
        a.normalize().toArray(this.posedNormals, offset);
      }
    }
    // Match sides in the body's actual coordinate basis, without crossing arms.
    for (const [index, arm] of this.arms.entries()) {
      const target = targets[index];
      const bent = (point: Babylon.Vector3) => B.Vector3.TransformNormal(point.subtract(pivot), spine).addInPlace(pivot);
      const shoulder = bent(arm.shoulder), elbow = bent(arm.elbow), palm = bent(arm.palm);
      const solution = solveArm(shoulder, elbow, palm, target, arm.side);
      B.Vector3.TransformCoordinatesToRef(solution.palm, this.mesh.getWorldMatrix(), this.grips[index]);
      const upper = B.Quaternion.Identity(), lower = B.Quaternion.Identity();
      B.Quaternion.FromUnitVectorsToRef(arm.elbow.subtract(arm.shoulder).normalize(), solution.elbow.subtract(shoulder).normalize(), upper);
      B.Quaternion.FromUnitVectorsToRef(arm.palm.subtract(arm.elbow).normalize(), solution.palm.subtract(solution.elbow).normalize(), lower);
      const upperMatrix = B.Matrix.FromQuaternionToRef(upper, B.Matrix.Identity()), lowerMatrix = B.Matrix.FromQuaternionToRef(lower, B.Matrix.Identity());
      for (const { offset, weight, lower: blend } of arm.vertices) {
        original.copyFromFloats(this.positions[offset], this.positions[offset + 1], this.positions[offset + 2]);
        original.subtractToRef(arm.shoulder, relative); B.Vector3.TransformNormalToRef(relative, upperMatrix, a); a.addInPlace(shoulder);
        original.subtractToRef(arm.elbow, relative); B.Vector3.TransformNormalToRef(relative, lowerMatrix, b); b.addInPlace(solution.elbow);
        B.Vector3.LerpToRef(a, b, blend, a);
        original.copyFromFloats(this.posed[offset], this.posed[offset + 1], this.posed[offset + 2]);
        B.Vector3.LerpToRef(original, a, weight * amount, a);
        a.toArray(this.posed, offset);
        if (this.normals && this.posedNormals) {
          normal.copyFromFloats(this.normals[offset], this.normals[offset + 1], this.normals[offset + 2]);
          B.Vector3.TransformNormalToRef(normal, upperMatrix, a); B.Vector3.TransformNormalToRef(normal, lowerMatrix, b);
          B.Vector3.LerpToRef(a, b, blend, a);
          normal.copyFromFloats(this.posedNormals[offset], this.posedNormals[offset + 1], this.posedNormals[offset + 2]);
          B.Vector3.LerpToRef(normal, a, weight * amount, a); a.normalize().toArray(this.posedNormals, offset);
        }
      }
    }
    this.mesh.updateVerticesData(B.VertexBuffer.PositionKind, this.posed, true, false);
    // Updating extents reconstructs Babylon's bounds in local space. The static
    // parent can keep a cached matrix, so explicitly refresh world-space culling.
    this.mesh.getBoundingInfo().update(this.mesh.getWorldMatrix());
    if (this.posedNormals) this.mesh.updateVerticesData(B.VertexBuffer.NormalKind, this.posedNormals, false, false);
  }
  reset(): void {
    if (!this.dirty) return;
    this.mesh.updateVerticesData(B.VertexBuffer.PositionKind, this.positions, true, false);
    this.mesh.getBoundingInfo().update(this.mesh.getWorldMatrix());
    if (this.normals) this.mesh.updateVerticesData(B.VertexBuffer.NormalKind, this.normals, false, false);
    this.dirty = false;
  }
}
