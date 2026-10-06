// Validation-only fixtures use the real Game scare and controller, including
// actual keyboard events and simultaneous TouchControls pointers after recovery.
import type { World } from '../src/world.ts';
import type { Player, InputSystem } from '../src/player.ts';
import type { AudioSystem } from '../src/audio.ts';
import type { Screen, Position } from '../src/types.ts';
import type { ScareKind } from '../src/corazon-motion.ts';
import { TouchDriver } from './touch-driver.ts';

interface Host {
  world: World; player: Player; input: InputSystem;
  action(action: string): void; startScare(kind: ScareKind): void;
  screen(): Screen; touchSensitivity(): number; audioDiagnostics(): AudioSystem['diagnostics'];
}
export function attachScareRecoveryAudit(parent: Element, host: Host): (dt: number) => void {
  const button = document.createElement('button'), output = document.createElement('pre');
  button.textContent = 'Check scare recovery'; output.setAttribute('aria-label', 'Scare recovery validation');
  output.style.whiteSpace = 'pre-wrap'; parent.append(button, output);
  const touch = new TouchDriver(host.input, host.player, host.touchSensitivity);
  const cases = [{ touch: false, air: false }, { touch: true, air: false }, { touch: false, air: true }, { touch: true, air: true }];
  let index = -1, phase = 0, time = 0, total = 0, starts = 0, reveals = 0, paused = false;
  let body = '', camera = '', look = '', pauseClock = 0, pauseAudio = 0;
  let origin: Position, yaw = 0;
  const report: string[] = [];
  const key = (code: string, down: boolean) => window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, bubbles: true, cancelable: true }));
  const stop = (error?: unknown) => {
    touch.release(); host.input.clear(); host.action('menu'); index = -1; button.disabled = false;
    output.textContent = `${error ? `FAIL · ${String(error)}` : 'PASS · Scare recovery'}\n${report.join('\n')}`;
  };
  const check = (ok: unknown, text: string) => { if (!ok) throw new Error(text); };
  const prepare = () => {
    host.input.setTouchMode(cases[index].touch);
    host.action('new'); host.action('start-game'); host.action('skip-intro');
    phase = time = total = reveals = 0;
  };
  const scare = () => {
    touch.release(); host.input.clear();
    body = JSON.stringify(host.player.position); camera = JSON.stringify(host.world.camera.position.asArray());
    look = JSON.stringify([host.player.yaw, host.player.pitch]);
    starts = host.audioDiagnostics().recordings?.jumpscare.starts ?? 0;
    host.startScare('jumpscare'); phase = 2; time = 0;
  };
  button.addEventListener('click', () => { index = 0; report.length = 0; paused = false; button.disabled = true; prepare(); });
  return dt => {
    if (index < 0) return;
    total += dt; time += dt;
    try {
      check(total < 12, 'Recovery fixture timed out');
      const p = host.player, presentation = host.world.corazon, clip = host.audioDiagnostics().recordings?.jumpscare;
      if (phase === 0 && time > .15) {
        if (!clip || clip.status === 'loading') return;
        check(p.grounded, 'Starting floor is unsupported');
        if (cases[index].air) { if (cases[index].touch) touch.button('Space'); else key('Space', true); phase = 1; time = 0; }
        else scare();
      } else if (phase === 1 && time > .12) {
        check(!p.grounded && p.position.y > .1, 'Real jump did not start'); key('Space', false); scare();
      } else if (phase === 2) {
        if (presentation.active) {
          check(JSON.stringify(p.position) === body, 'Scare moved the player body');
          check(JSON.stringify(host.world.camera.position.asArray()) === camera, 'Scare lowered/moved the camera');
          check(JSON.stringify([p.yaw, p.pitch]) === look, 'Input rotated the player during the scare');
          check(p.verticalVelocity === 0, 'Scare retained jump velocity');
          host.input.keys.add('KeyW'); host.input.queue('Space'); host.input.addLook(30, 20);
          if (!document.querySelector<HTMLElement>('#face-overlay')!.hidden && !reveals) {
            reveals++; check(clip?.starts === starts + 1 && clip.sources === 1 && clip.playing, 'Reveal did not start one recording');
          }
          if (reveals) check(clip?.starts === starts + 1, 'Scare duplicated its sound');
          if (index === 0 && !paused && presentation.timeline.time > .5) {
            paused = true; pauseClock = presentation.timeline.time; host.action('journal'); phase = 5; time = 0;
          }
        } else {
          check(reveals === 1 && clip?.sources === 0, 'Finished scare skipped reveal or leaked audio');
          check(host.screen() === 'playing' && host.input.active, 'Controls were not restored');
          check(p.verticalVelocity === 0, 'Recovery retained velocity');
          phase = 3; time = 0;
        }
      } else if (phase === 5) {
        check(presentation.timeline.time === pauseClock && JSON.stringify(p.position) === body, 'Pause advanced the scare');
        if (time < .1) pauseAudio = clip?.time ?? 0;
        else if (time > .2) check(clip?.time === pauseAudio, 'Paused sound advanced');
        if (time > .35) { host.action('resume'); phase = 2; time = 0; }
      } else if (phase === 3 && time > .6) {
        check(p.grounded && p.position.y === 0 && p.verticalVelocity === 0, 'Normal floor/gravity did not recover');
        const before = JSON.parse(body) as Position;
        check(p.position.x === before.x && p.position.z === before.z, 'Stale movement drifted after the scare');
        origin = { ...p.position }; yaw = p.yaw;
        if (cases[index].touch) { touch.move(0, 1); touch.drag(24, 0); }
        else { key('KeyW', true); key('ArrowRight', true); }
        phase = 4; time = 0;
      } else if (phase === 4 && time > .35) {
        check(Math.hypot(p.position.x - origin.x, p.position.z - origin.z) > .25, 'Movement remained frozen');
        check(Math.abs(p.yaw - yaw) > .01, 'Camera input remained frozen');
        touch.release(); host.input.clear(); key('KeyW', false); key('ArrowRight', false);
        report.push(`${cases[index].touch ? 'Touch' : 'Desktop'} / ${cases[index].air ? 'airborne' : 'grounded'}: fixed body/camera, one impact, no tail, stable gravity, walk + look restored`);
        index++;
        if (index === cases.length) { report.push('Pause/resume: frozen presentation and recording; no replay.'); stop(); return; }
        prepare();
      }
      if (index >= 0) output.textContent = `Running recovery ${index + 1}/${cases.length} · phase ${phase}\n${report.join('\n')}`;
    } catch (error) { stop(error); }
  };
}
