// Development-only review: real World, Player, interactions and objectives.
// Its isolated inventory never reads or writes the game's saved checkpoint.
import { B, World } from '../src/world.ts';
import { Player } from '../src/player.ts';
import type { InputSystem } from '../src/player.ts';
import { InteractionSystem } from '../src/interactions.ts';
import { interact } from '../src/objectives.ts';
import { DEFAULT_SETTINGS, freshProgress } from '../src/types.ts';
import { FLASHLIGHT_PICKUP } from '../src/config.ts';
import { auditFemaleArm } from './female-arm-audit.ts';

const canvas = document.querySelector<HTMLCanvasElement>('#review')!;
const metrics = document.querySelector<HTMLOutputElement>('#metrics')!;
const walk = document.querySelector<HTMLInputElement>('#walk')!;
const run = document.querySelector<HTMLInputElement>('#run')!;
const hide = document.querySelector<HTMLInputElement>('#hide')!;
const steady = document.querySelector<HTMLInputElement>('#steady')!;
const slow = document.querySelector<HTMLInputElement>('#slow')!;
const freeze = document.querySelector<HTMLInputElement>('#freeze')!;
let step = 0;
document.querySelector('#step')!.addEventListener('click', () => { step += .1; });
const engine = new B.Engine(canvas, true, { preserveDrawingBuffer: true });
const world = new World(engine), player = new Player(), progress = freshProgress();
const settings = { ...DEFAULT_SETTINGS }, keys = new Set<string>(), queued = new Set<string>();
const input = { keys, look: () => [0, 0], consume: (key: string) => { const exists = queued.has(key); queued.delete(key); return exists; } } as unknown as InputSystem;
let interactions: InteractionSystem, last = performance.now(), elapsed = 0, sample = 0;
let message = '', studio = false, orbitAngle = 0, orbit: InstanceType<typeof B.ArcRotateCamera> | null = null;
let inspectionTarget: 'grip' | 'note' = 'grip';
const aim = (at: readonly number[]) => {
  const eye = player.eye, dx = at[0] - eye[0], dz = at[2] - eye[2];
  player.yaw = Math.atan2(dx, -dz); player.pitch = Math.atan2(at[1] - eye[1], Math.hypot(dx, dz));
};
const fresh = () => {
  Object.assign(progress, freshProgress()); world.viewmodel.reset(false);
  player.reset({ x: 5.9, y: 0, z: -2.1, level: 0 });
  aim(FLASHLIGHT_PICKUP.position); interactions.reset(progress);
  player.camera(world, settings); message = 'Fresh pickup state — no equipped arm.';
};
document.querySelector('#audit')!.addEventListener('click', () => {
  walk.checked = run.checked = hide.checked = slow.checked = freeze.checked = false;
  try { document.querySelector<HTMLOutputElement>('#audit-result')!.value = auditFemaleArm(world, player, interactions, progress); }
  catch (error) { document.querySelector<HTMLOutputElement>('#audit-result')!.value = 'FAIL · ' + String(error); console.error(error); }
  last = performance.now();
});
document.querySelector('#fresh')!.addEventListener('click', fresh);
document.querySelector('#equipped')!.addEventListener('click', () => {
  if (!progress.collected.includes('flashlight')) progress.collected.push('flashlight');
  world.viewmodel.reset(true); player.flashlight = true; player.pitch = 0; interactions.sync(progress);
  message = 'Restored inventory: arm ready without replaying pickup.';
});
document.querySelector('#pickup')!.addEventListener('click', () => queued.add('KeyE'));
document.querySelector('#toggle')!.addEventListener('click', () => queued.add('KeyF'));
document.querySelector('#note')!.addEventListener('click', () => aim(interactions.hotspots.find(h => h.id === 'note')!.position));
document.querySelector('#level')!.addEventListener('click', () => { player.pitch = 0; });
document.querySelector('#turn')!.addEventListener('click', () => { player.yaw += Math.PI / 6; });
document.querySelector('#studio')!.addEventListener('click', event => {
  inspectionTarget = 'grip';
  studio = !studio; (event.currentTarget as HTMLButtonElement).setAttribute('aria-pressed', String(studio));
  world.scene.activeCamera = studio ? orbit : world.camera;
});
document.querySelector('#note-view')!.addEventListener('click', () => {
  inspectionTarget = 'note'; studio = true; world.scene.activeCamera = orbit;
});
document.querySelector('#orbit')!.addEventListener('click', () => { orbitAngle += Math.PI / 3; });
document.querySelector('#portrait')!.addEventListener('click', event => {
  const button = event.currentTarget as HTMLButtonElement, portrait = button.getAttribute('aria-pressed') !== 'true';
  button.setAttribute('aria-pressed', String(portrait));
  canvas.style.width = portrait ? '360px' : '100%'; canvas.style.height = portrait ? '640px' : '100%'; engine.resize();
});
window.addEventListener('keydown', event => {
  if (['KeyE', 'KeyF'].includes(event.code) && !event.repeat) queued.add(event.code);
});
try {
  await world.load((label, percent) => { metrics.value = `${label} · ${percent}%`; });
  interactions = new InteractionSystem(world);
  const vm = world.viewmodel, meshes = vm.meshes, socket = vm.lens;
  const triangles = meshes.reduce((sum, m) => sum + m.getTotalIndices() / 3, 0);
  const emitter = meshes.map(m => m.material).find(m => m?.name === 'Flashlight_emitter');
  if (!(emitter instanceof B.PBRMaterial)) throw new Error('Missing PBR emitter');
  if (meshes.some(m => !(m.material instanceof B.PBRMaterial))) throw new Error('Viewmodel lost its PBR materials');
  const originalMatrices = Array.from(vm.skeleton.getTransformMatrices(vm.rightArm));
  orbit = new B.ArcRotateCamera('rig-review-orbit', 0, Math.PI / 2, .6, B.Vector3.Zero(), world.scene);
  orbit.minZ = .005; world.scene.activeCamera = world.camera;
  fresh();
  engine.runRenderLoop(() => {
    const now = performance.now(), dt = step || (freeze.checked ? 0 : Math.min(.05, (now - last) / 1000) * (slow.checked ? .1 : 1));
    step = 0;
    last = now; elapsed += dt; sample += dt;
    if (walk.checked || run.checked) keys.add('KeyW'); else keys.delete('KeyW');
    if (run.checked) keys.add('ShiftLeft'); else keys.delete('ShiftLeft');
    player.hidden = hide.checked; settings.reducedMotion = steady.checked;
    player.update(dt, input, world, progress, settings, () => {}, () => {});
    const target = interactions.focus(player, progress);
    if (input.consume('KeyE') && target) {
      const result = interact(progress, target.id); message = result.message;
      if (result.changed && target.id === 'flashlight') { player.flashlight = false; vm.pickup(); }
      interactions.sync(progress);
    }
    world.update(player.position, player.direction, settings, progress, player.flashlight, elapsed);
    if (studio && orbit) {
      orbit.setTarget(inspectionTarget === 'note' ? B.Vector3.FromArray(interactions.hotspots.find(h => h.id === 'note')!.position) : vm.socket.getAbsolutePosition());
      orbit.setPosition(orbit.target.add(inspectionTarget === 'note' ? new B.Vector3(0, .43, .14) : new B.Vector3(Math.sin(orbitAngle) * .47, .09, Math.cos(orbitAngle) * .47)));
    }
    world.scene.render();
    if (sample > .2 || slow.checked || freeze.checked) {
      sample = 0;
      const offset = B.Vector3.Distance(world.flashlight.position, socket.getAbsolutePosition());
      const beam = socket.getDirection(new B.Vector3(0, 0, -1)).normalize();
      const angularError = Math.acos(Math.min(1, B.Vector3.Dot(beam, world.flashlight.direction))) * 180 / Math.PI;
      const lit = world.flashlight.intensity > 0;
      const attached = vm.lamp.parent === vm.socket && vm.socket.parent === vm.hand;
      const matrices = vm.skeleton.getTransformMatrices(vm.rightArm);
      const deforming = matrices.some((v, i) => Math.abs(v - originalMatrices[i]) > .001);
      const passed = offset < .0001 && angularError < .05 && !vm.leftArm.isEnabled() && (!progress.collected.includes('flashlight') || attached);
      metrics.value = `${passed ? 'PASS' : 'FAIL'} · World / Player / InteractionSystem · Babylon ${B.Engine.Version}
${triangles.toLocaleString()} active triangles · 1 visible skinned arm · ${vm.skeleton.bones.length} original joints
Original PBR textures ready: ${meshes.every(m => m.material!.getActiveTextures().every(t => t.isReady()))}
Phase: ${vm.state.phase} ${vm.state.progress.toFixed(2)} · light: ${lit ? 'ON' : 'OFF'} · hidden: ${!vm.visible}
Hand.R_027 → FlashlightSocket → lamp: ${attached}
Left arm disabled: ${!vm.leftArm.isEnabled()} · skin matrices change: ${deforming}
Beam error: ${(offset * 1000).toFixed(3)} mm / ${angularError.toFixed(4)}°
Position: ${Object.values(player.position).slice(0, 3).map(v => v.toFixed(2)).join(', ')}
Socket local: ${vm.socket.position.asArray().map(v => v.toFixed(3)).join(', ')}
${target ? 'E · ' + target.label : 'No target'} · ${engine.getFps().toFixed(0)} FPS
${message}`;
    }
  });
} catch (error) { metrics.value = `FAIL · ${String(error)}`; console.error(error); }
window.addEventListener('resize', () => engine.resize());
window.addEventListener('pagehide', () => { world.dispose(); engine.dispose(); });
