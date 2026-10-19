// Deliberate capture fixtures, separate from the ordinary full-journey driver.
// Captures still enter through the actual ghost attack and Game tick/state flow.
import { B } from '../src/world.ts';
import type { World } from '../src/world.ts';
import type { Player, InputSystem } from '../src/player.ts';
import type { GhostStateMachine } from '../src/ghost.ts';
import type { AudioSystem } from '../src/audio.ts';
import type { Settings, Screen } from '../src/types.ts';
import type { ScareKind } from '../src/corazon-motion.ts';

interface Host {
  world: World; player: Player; ghost: GhostStateMachine; input: InputSystem;
  screen(): Screen; settings(): Settings; audioDiagnostics(): AudioSystem['diagnostics'];
  action(action: string): void; startScare(kind: ScareKind): void;
}
export function attachCorazonAudit(parent: Element, host: Host): (dt: number) => void {
  const button = document.createElement('button'); button.textContent = 'Check capture angles';
  const preview = document.createElement('button'); preview.textContent = 'Preview 3D jumpscare';
  const output = document.createElement('pre'); output.setAttribute('aria-label', 'Celestina motion validation');
  parent.append(button, preview, output);
  const cases = [[0, 0], [Math.PI / 2, .7], [Math.PI, 0], [-Math.PI / 2, -.7], [Math.PI, 1.35], [Math.PI, -1.35]];
  let index = -1, elapsed = 0, starts = 0, checkedReveal = false, pausedAt = -1, pauseTime = 0, didPause = false;
  let firstPosition = '', firstLook = '', failures: string[] = [], report: string[] = [], pending = false, captureStarted = false;
  const error = (message: string) => { if (!failures.includes(message)) failures.push(message); };
  function prepare(): void {
    host.action('new'); host.action('start-game'); host.action('resume'); host.action('skip-intro');
    host.player.yaw = cases[index][0]; host.player.pitch = cases[index][1]; host.player.camera(host.world, host.settings());
    const p = host.player.position;
    host.ghost.state = 'Chase'; host.ghost.grace = 0; host.ghost.position = { ...p, z: p.z - .98 }; host.ghost.yaw = Math.PI;
    host.world.ghost.setEnabled(true); host.world.corazon.updateLocomotion(0, host.ghost, host.settings());
    elapsed = 0; starts = host.audioDiagnostics().recordings?.jumpscare.starts ?? 0; checkedReveal = false;
    captureStarted = false;
  }
  button.addEventListener('click', () => { index = 0; failures = []; report = []; didPause = false; button.disabled = true; prepare(); });
  preview.addEventListener('click', () => {
    if (host.screen() !== 'playing') { host.action('new'); host.action('start-game'); host.action('resume'); host.action('skip-intro'); }
    host.startScare('jumpscare');
  });
  return dt => {
    if (index < 0) return;
    const p = host.world.corazon, clip = host.audioDiagnostics().recordings?.jumpscare;
    if (pausedAt >= 0) {
      pauseTime += dt;
      if (p.timeline.time !== pausedAt) error('Pause advanced the presentation clock');
      if (pauseTime > .3) { pausedAt = -1; host.action('resume'); }
      return;
    }
    if (pending) {
      elapsed += dt;
      if (elapsed > .2) { pending = false; prepare(); }
      return;
    }
    elapsed += dt;
    if (p.active) {
      // A recoverable grab now precedes the finishing presentation. The grab
      // intentionally pulls and turns the player; only the finishing clip locks
      // that resulting body pose while it frames the face.
      if (!captureStarted) {
        captureStarted = true;
        firstPosition = JSON.stringify(host.player.position); firstLook = JSON.stringify([host.player.yaw, host.player.pitch]);
      }
      const camera = host.world.camera, basis = camera.getViewMatrix(true).clone().invert();
      if (Math.abs(basis.m[1]) > .000001 || basis.m[5] <= 0 || camera.rotation.z !== 0 || camera.rotationQuaternion !== null || camera.parent !== null) error('Capture rolled the camera');
      if (JSON.stringify(host.player.position) !== firstPosition || JSON.stringify([host.player.yaw, host.player.pitch]) !== firstLook) error('Player moved during capture');
      host.input.keys.add('KeyW'); host.input.queue('Space'); host.input.queue('KeyF'); host.input.addLook(20, 10);
      if (p.timeline.time >= .4 && !checkedReveal) {
        checkedReveal = true;
        if (clip?.starts !== starts + 1 || !clip.playing || clip.sources !== 1 || clip.loop) error(`Capture ${index + 1}: audio did not start once at reveal`);
        const local = B.Vector3.TransformCoordinates(p.facePosition(), host.world.camera.getViewMatrix(true));
        if (Math.abs(local.x) > .02 || Math.abs(local.y) > .02 || local.z >= -.2) error(`Capture ${index + 1}: face framing failed`);
      }
      if (checkedReveal && clip?.starts !== starts + 1) error('Jumpscare audio duplicated');
      if (index === 2 && !didPause && p.timeline.time > .8) {
        didPause = true; pausedAt = p.timeline.time; pauseTime = 0; host.action('journal'); return;
      }
    }
    if (host.screen() === 'caught') {
      if (!checkedReveal) error('Capture skipped the face reveal');
      if (p.active) error('Game-over retained active presentation');
      if (host.input.active) error('Game-over retained player input');
      if (clip?.sources !== 0) error('Game-over retained scare audio');
      report.push(`Capture ${index + 1}: yaw ${cases[index][0].toFixed(2)}, pitch ${cases[index][1].toFixed(2)} · real attack → upright camera, centered face + one sound → caught`);
      index++; elapsed = 0;
      if (index === cases.length) {
        host.action('retry');
        if (host.world.corazon.active || host.world.ghost.isEnabled() || !host.world.ghost.getChildMeshes().every(m => m.renderingGroupId === 0 && m.visibility === 1)) error('Retry did not restore the model/presentation');
        report.push('Pause/resume: frozen camera/sequence, single audio source. Retry: restored camera/model and checkpoint UI.');
        host.action('menu');
        output.textContent = `${failures.length ? 'FAIL' : 'PASS'} · Six capture directions\n${report.join('\n')}\n${failures.join('\n')}`;
        index = -1; button.disabled = false; return;
      }
      pending = true;
    }
    if (elapsed > 14) { error('Capture fixture timed out'); output.textContent = `FAIL · ${failures.join('\n')}`; index = -1; button.disabled = false; return; }
    output.textContent = `Running capture ${index + 1}/${cases.length} · ${host.screen()} · ${p.timeline.time.toFixed(2)}s\n${failures.join('\n')}`;
  };
}
