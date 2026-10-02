import type { Collider, Vec3 } from './types.ts';

// Return the fraction of a finite segment at the first box hit, including oriented furniture.
export function boxHit(a: Vec3, b: Vec3, box: Collider, padding = 0): number | null {
  let start = a, end = b, min: Vec3, max: Vec3;
  if (box.center) {
    const center = box.center, c = Math.cos(box.yaw), s = Math.sin(box.yaw);
    const local = (p: Vec3): Vec3 => [(p[0] - center[0]) * c - (p[2] - center[2]) * s, p[1] - center[1], (p[0] - center[0]) * s + (p[2] - center[2]) * c];
    start = local(a); end = local(b);
    min = box.size.map(v => -v / 2 - padding) as Vec3;
    max = box.size.map(v => v / 2 + padding) as Vec3;
  } else {
    min = box.min.map(v => v - padding) as Vec3;
    max = box.max.map(v => v + padding) as Vec3;
  }
  let near = 0, far = 1;
  for (let i = 0; i < 3; i++) {
    const delta = end[i] - start[i];
    if (Math.abs(delta) < 1e-9) { if (start[i] < min[i] || start[i] > max[i]) return null; continue; }
    let low = (min[i] - start[i]) / delta, high = (max[i] - start[i]) / delta;
    if (low > high) [low, high] = [high, low];
    near = Math.max(near, low); far = Math.min(far, high);
    if (near > far) return null;
  }
  return near;
}
export function worldHit(a: Vec3, b: Vec3, boxes: Collider[], padding = 0): number | null {
  let first: number | null = null;
  for (const box of boxes) {
    const hit = boxHit(a, b, box, padding);
    if (hit !== null && (first === null || hit < first)) first = hit;
  }
  return first;
}
export function sphereHit(a: Vec3, b: Vec3, center: Vec3, radius: number): number | null {
  const d = b.map((v, i) => v - a[i]), m = a.map((v, i) => v - center[i]);
  const aa = d.reduce((sum, v) => sum + v * v, 0);
  const bb = m.reduce((sum, v, i) => sum + v * d[i], 0);
  const cc = m.reduce((sum, v) => sum + v * v, 0) - radius * radius;
  if (cc <= 0) return 0;
  const disc = bb * bb - aa * cc;
  if (aa === 0 || disc < 0) return null;
  const t = (-bb - Math.sqrt(disc)) / aa;
  return t >= 0 && t <= 1 ? t : null;
}
