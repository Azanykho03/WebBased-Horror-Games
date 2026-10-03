import { B, World } from '../src/world.ts';
import { DEFAULT_SETTINGS, freshProgress } from '../src/types.ts';
import { CORAZON_SCARE, scareFrame } from '../src/corazon-motion.ts';
import type { ScareKind } from '../src/corazon-motion.ts';
import { GhostStateMachine } from '../src/ghost.ts';

const canvas = document.querySelector<HTMLCanvasElement>('canvas')!, output = document.querySelector('output')!;
const selects = document.querySelectorAll('select'), slider = document.querySelector<HTMLInputElement>('input[type="range"]')!;
const reduced = document.querySelector<HTMLInputElement>('#reduced')!, gentle = document.querySelector<HTMLInputElement>('#gentle')!;
const engine = new B.Engine(canvas, true, { preserveDrawingBuffer: true }), world = new World(engine), ghost = new GhostStateMachine();
const settings = { ...DEFAULT_SETTINGS }, progress = freshProgress();
const player = { x: 0, y: 0, z: -2.5, level: 0 as const };
let time = 1.6, playing = false, kind: ScareKind = 'jumpscare', last = performance.now();
function reset() {
  world.corazon.finish(); settings.reducedMotion = reduced.checked; settings.gentleScares = gentle.checked;
  kind = selects[0].value as ScareKind; slider.max = String(CORAZON_SCARE[kind].duration);
  const yaw = Number(selects[1].value), pitch = Number(selects[2].value);
  const direction = new B.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
  world.camera.position.set(player.x, 1.65, player.z); world.camera.setTarget(world.camera.position.add(direction));
  ghost.position = { ...player, z: player.z - .7 }; ghost.yaw = Math.PI;
  world.corazon.updateLocomotion(0, ghost, settings); world.ghost.setEnabled(true);
  world.update(player, direction, settings, progress, false, 0); world.arms.setEnabled(false);
  world.corazon.start(kind, settings); time = Math.min(Number(slider.value), CORAZON_SCARE[kind].duration);
}
try {
  await world.load(label => { output.value = label; }); reset();
  for (const input of [...selects, reduced, gentle]) input.addEventListener('change', () => { playing = false; reset(); });
  slider.addEventListener('input', () => { playing = false; time = Number(slider.value); });
  document.querySelector('#play')!.addEventListener('click', () => { reset(); time = 0; playing = true; });
  engine.runRenderLoop(() => {
    const now = performance.now(), dt = Math.min(.05, (now - last) / 1000); last = now;
    if (playing) { time = Math.min(time + dt, CORAZON_SCARE[kind].duration); if (time === CORAZON_SCARE[kind].duration) playing = false; }
    slider.value = String(time); world.corazon.timeline.time = time; world.corazon.update(0, settings);
    // This visual scrubber deliberately bypasses the live reveal latch.
    if (world.corazon.timeline.time !== time) { world.corazon.timeline.time = time; world.corazon.update(0, settings); }
    document.querySelector<HTMLElement>('#fade')!.style.opacity = String(scareFrame(kind, time).fade);
    world.scene.render();
    const face = B.Vector3.TransformCoordinates(world.corazon.facePosition(), world.camera.getViewMatrix(true));
    output.value = `${kind} · ${time.toFixed(2)} s\nFace in camera: ${face.asArray().map(v => v.toFixed(3)).join(', ')}\n${world.ghost.getChildMeshes().filter(m => m.getTotalVertices() > 0).length} original meshes · no skeleton · transforms only\n${engine.getRenderWidth()} × ${engine.getRenderHeight()}`;
  });
} catch (error) { output.value = `FAIL: ${String(error)}`; console.error(error); }
window.addEventListener('resize', () => engine.resize());
window.addEventListener('pagehide', () => { world.dispose(); engine.dispose(); });
