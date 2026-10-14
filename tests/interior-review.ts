import { B, World, vector } from '../src/world.ts';
import type * as Babylon from 'babylonjs';
import { DEFAULT_SETTINGS, freshProgress } from '../src/types.ts';
import type { Position, Vec3 } from '../src/types.ts';
import { BROKEN_BULBS } from '../src/interior-lighting.ts';

const canvas = document.querySelector<HTMLCanvasElement>('#review')!;
const room = document.querySelector<HTMLSelectElement>('#room')!, quality = document.querySelector<HTMLSelectElement>('#quality')!;
const torch = document.querySelector<HTMLInputElement>('#torch')!, power = document.querySelector<HTMLInputElement>('#power')!;
const steady = document.querySelector<HTMLInputElement>('#steady')!;
const metrics = document.querySelector<HTMLOutputElement>('#metrics')!;
const views: { name: string; at: Vec3; target: Vec3; level: 0 | 1 }[] = [
  { name: 'Living room', at: [4.15, 0, -1.35], target: [8.2, 1.35, -5.2], level: 0 },
  { name: 'Entrance and stair', at: [0, 0, -2.5], target: [1.5, 1.65, -7.2], level: 0 },
  { name: 'Dining room', at: [2.7, 0, -16.5], target: [7.1, .98, -20.2], level: 0 },
  { name: 'Kitchen', at: [-3.2, 0, -18.0], target: [-6.2, 1.45, -21.4], level: 0 },
  { name: 'TV room', at: [-2.7, 0, -9.1], target: [-6.2, 1.4, -10.8], level: 0 },
  { name: 'Book passage', at: [3.1, 0, -10.7], target: [4.05, 1.6, -7.5], level: 0 },
  { name: 'Garage', at: [-2.9, 0, -5.9], target: [-6.4, 1.25, -1.3], level: 0 },
  { name: 'Upper hallway', at: [0, 3.24, -6.1], target: [-.3, 4.92, -13.4], level: 1 },
  { name: 'Guest bedroom', at: [3.4, 3.24, -10.5], target: [7.4, 4.7, -13.5], level: 1 },
  { name: 'Study', at: [-3.8, 3.24, -2.0], target: [-6.4, 4.65, -6.4], level: 1 },
  { name: 'Twin bedroom', at: [-3.15, 3.24, -10.3], target: [-6.4, 4.3, -12.6], level: 1 },
  { name: 'Far master bedroom', at: [3.4, 3.24, -16.6], target: [7.3, 4.7, -20.8], level: 1 },
  { name: 'Hallway toward breaker', at: [0, 3.24, -9], target: [-.15, 5.15, -3.9], level: 1 },
  { name: 'Private CR / broken bulb', at: [7.6, 3.24, -2.2], target: [8.25, 5.98, -1.5], level: 1 },
];
for (const [i, view] of views.entries()) room.add(new Option(view.name, String(i)));
const engine = new B.Engine(canvas, true, { preserveDrawingBuffer: true });
const world = new World(engine), progress = freshProgress();
let p: Position = { x: 4.15, y: 0, z: -1.35, level: 0 }, direction = vector([0, 0, -1]);
const settings = { ...DEFAULT_SETTINGS, quality: 'standard' as 'standard' | 'low' };
let clock = 0, sample = 0, last = performance.now(), ready = false;
function view(): void {
  const v = views[Number(room.value)];
  p = { x: v.at[0], y: v.at[1], z: v.at[2], level: v.level };
  world.camera.position.set(p.x, p.y + 1.65, p.z); world.camera.setTarget(vector(v.target));
  direction = vector(v.target).subtract(world.camera.position).normalize();
  settings.quality = quality.value === 'low' ? 'low' : 'standard'; progress.power = power.checked;
  settings.reducedFlicker = steady.checked;
  engine.setHardwareScalingLevel(settings.quality === 'low' ? 1.25 : 1); engine.resize();
  world.syncProgress(progress); world.update(p, direction, settings, progress, torch.checked, clock);
}
function reviewLight(): void {
  world.lighting(direction, settings, progress, torch.checked, clock);
  // This viewer has no player/arm animation. Aim the existing spotlight from
  // the review camera; the playable game's flashlight path is unchanged.
  world.flashlight.position.copyFrom(world.camera.position); world.flashlight.direction.copyFrom(direction);
  world.flashlight.intensity = torch.checked ? 2.3 * settings.brightness : 0;
}
try {
  await world.load((label, percent) => { metrics.value = `${label} · ${percent}%`; });
  if (world.interior!.meshes.some(m => m.isPickable || m.checkCollisions)) throw new Error('Decoration affects collision or picking');
  if (world.interior!.triangles > 9000 || world.interior!.meshes.length > 110) throw new Error(`Interior exceeds its geometry / batching budget: ${world.interior!.triangles} triangles / ${world.interior!.meshes.length} batches`);
  ready = true; view();
  for (const input of [room, quality, torch, power, steady]) input.addEventListener('change', view);
  document.querySelector('#save')!.addEventListener('click', () => {
    world.scene.render();
    const link = document.createElement('a'); link.download = `interior-${views[Number(room.value)].name.toLowerCase().replaceAll(' ', '-').replaceAll('/', '')}-${settings.quality}.png`;
    link.href = canvas.toDataURL('image/png'); link.click();
  });
  engine.runRenderLoop(() => {
    const now = performance.now(), dt = Math.min(.05, (now - last) / 1000); last = now; clock += dt; sample += dt;
    world.environment.update(dt, p, direction, torch.checked, settings, clock); reviewLight(); world.scene.render();
    if (sample > .5) {
      sample = 0;
      const interior = world.interior!, visible = interior.meshes.filter(m => m.isEnabled()), dust = world.scene.getMeshByName('flashlight-dust');
      const bulbs = world.data.lights.filter(light => light.electric);
      const lightStateValid = bulbs.every(light => {
        const lamp = world.scene.getLightByName(light.id), glow = world.scene.getMaterialByName(`bulb-${light.id}`);
        const lit = power.checked && !BROKEN_BULBS.has(light.id);
        return lamp && (lamp.intensity > 0) === lit && glow instanceof B.StandardMaterial
          && (glow.emissiveColor.r + glow.emissiveColor.g + glow.emissiveColor.b > 0) === lit;
      });
      metrics.value = `${views[Number(room.value)].name} · ${settings.quality} · ${engine.getFps().toFixed(0)} FPS\nDecay: ${interior.triangles} triangles / ${interior.meshes.length} room batches (${visible.length} enabled)\n${interior.debris.length} shallow debris pieces · ${dust?.isEnabled() ? (dust as Babylon.Mesh).thinInstanceCount : 0} dust motes\nRuntime ${world.data.colliders.length} colliders · all decay non-colliding / non-pickable\nBulb light / glow state: ${lightStateValid ? 'PASS' : 'FAIL'} (${bulbs.length} fixtures)\n${engine.getRenderWidth()} × ${engine.getRenderHeight()} · flashlight shadow ${settings.quality === 'low' ? 256 : 512}px`;
    }
  });
} catch (error) { metrics.value = `FAIL: ${error instanceof Error ? error.message : String(error)}`; console.error(error); }
window.addEventListener('resize', () => { if (ready) engine.resize(); });
window.addEventListener('pagehide', () => { world.dispose(); engine.dispose(); });
