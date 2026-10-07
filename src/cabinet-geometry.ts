/** Clip the supplied fused surface, interpolating every attribute at panel seams.
 * Coordinates here are baked, Y-up metres: front is +Z, never the source Z-up axis.
 * The original GLB, UVs and textures are retained. No centroid-based missing triangles.
 */
export type SurfaceVertex = { p: number[]; n: number[]; uv: number[] };
export type Surface = { positions: number[]; normals: number[]; uvs: number[]; indices: number[] };
const empty = (): Surface => ({ positions: [], normals: [], uvs: [], indices: [] });
type Plane = [axis: number, sign: number, limit: number];
function clip(poly: SurfaceVertex[], [axis, sign, limit]: Plane): [SurfaceVertex[], SurfaceVertex[]] {
  const inside: SurfaceVertex[] = [], outside: SurfaceVertex[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const da = a.p[axis] * sign - limit, db = b.p[axis] * sign - limit;
    (da <= 0 ? inside : outside).push(a);
    if ((da <= 0) !== (db <= 0)) {
      const t = da / (da - db), mix = (x: number[], y: number[]) => x.map((v, j) => v + (y[j] - v) * t);
      const v = { p: mix(a.p, b.p), n: mix(a.n, b.n), uv: mix(a.uv, b.uv) };
      inside.push(v); outside.push(v);
    }
  }
  return [inside, outside];
}
function append(out: Surface, poly: SurfaceVertex[]): void {
  if (poly.length < 3) return;
  for (let i = 1; i < poly.length - 1; i++) for (const v of [poly[0], poly[i], poly[i + 1]]) {
    out.indices.push(out.positions.length / 3); out.positions.push(...v.p); out.normals.push(...v.n); out.uvs.push(...v.uv);
  }
}
export function cabinetPanels(source: Surface): { body: Surface; left: Surface; right: Surface } {
  const body = empty(), left = empty(), right = empty();
  const vertex = (i: number): SurfaceVertex => ({ p: source.positions.slice(i * 3, i * 3 + 3), n: source.normals.slice(i * 3, i * 3 + 3), uv: source.uvs.slice(i * 2, i * 2 + 2) });
  // Inspected source: front z=.19.. .26, side edges x=+/-.338, top y=1.744.
  // After normalization to 1.30 x 2.36 x .92, leave fixed side/top/bottom rails.
  const panel: Plane[] = [[2, -1, -.325], [0, 1, .59], [0, -1, .59], [1, 1, 2.28], [1, -1, -.12]];
  const slot: Plane[] = [[0, 1, .095], [0, -1, .095], [1, 1, 1.675], [1, -1, -1.625]];
  for (let i = 0; i < source.indices.length; i += 3) {
    let poly = source.indices.slice(i, i + 3).map(vertex);
    for (const plane of panel) { const [inside, outside] = clip(poly, plane); append(body, outside); poly = inside; if (!poly.length) break; }
    if (!poly.length) continue;
    // A real narrow viewing slot, not a transparent door or camera placed outside.
    const pieces: SurfaceVertex[][] = [];
    for (const plane of slot) { const [inside, outside] = clip(poly, plane); if (outside.length) pieces.push(outside); poly = inside; if (!poly.length) break; }
    for (const piece of pieces) { const [a, b] = clip(piece, [0, 1, 0]); append(left, a); append(right, b); }
  }
  return { body, left, right };
}
