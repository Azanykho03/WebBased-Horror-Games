// Validation-only fixtures exercise the real Game tick, keyboard/mouse events
// and TouchControls. All scares run in one session to expose accumulated state.
import { B } from '../src/world.ts';
import type { World } from '../src/world.ts';
import type { Player, InputSystem } from '../src/player.ts';
import type { AudioSystem } from '../src/audio.ts';
import type { Screen, Position, Settings } from '../src/types.ts';
import type { ScareKind } from '../src/corazon-motion.ts';
import { TouchDriver } from './touch-driver.ts';

interface Host {
  world: World; player: Player; input: InputSystem;
  action(action: string): void; startScare(kind: ScareKind): void;
  screen(): Screen; settings(): Settings; touchSensitivity(): number; audioDiagnostics(): AudioSystem['diagnostics'];
}
export function attachScareRecoveryAudit(parent: Element, host: Host): (dt: number) => void {
  const button = document.createElement('button'), output = document.createElement('pre');
  button.textContent = 'Check scare recovery'; output.setAttribute('aria-label', 'Scare recovery validation');
  output.style.whiteSpace = 'pre-wrap'; parent.append(button, output);
  const touch = new TouchDriver(host.input, host.player, host.touchSensitivity);
  const cases = [false, true].flatMap(mobile => [false, true].flatMap(air =>
    [[.8, .7], [3.12, -1.1], [-1.7, 1.35]].map(([yaw, pitch]) => ({ touch: mobile, air, yaw, pitch }))));
  const directions = [['KeyW', 0, 1], ['KeyS', 0, -1], ['KeyA', -1, 0], ['KeyD', 1, 0]] as const;
  let index = -1, phase = 0, time = 0, total = 0, starts = 0, reveals = 0, paused = false, direction = 0;
  let body = '', camera = '', look = '', pauseClock = 0, pauseAudio = 0, locked = false, maxHorizonError = 0;
  let origin: Position, yaw = 0, pitch = 0;
  const report: string[] = [];
  const key = (code: string, down: boolean) => window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, bubbles: true, cancelable: true }));
  const check = (ok: unknown, text: string) => { if (!ok) throw new Error(text); };
  const release = () => { touch.release(); host.input.clear(); for (const [code] of directions) key(code, false); };
  const stop = (error?: unknown) => {
    release(); host.action('menu'); index = -1; button.disabled = false;
    output.textContent = `${error ? `FAIL · ${String(error)}` : 'PASS · 12 consecutive scare recoveries'}\n${report.join('\n')}\nMaximum rendered right-vector Y: ${maxHorizonError.toExponential(3)}`;
  };
  const turn = (dyaw: number, dpitch: number) => {
    if (cases[index].touch) {
      const scale = .0022 * host.touchSensitivity() * 680 / Math.max(320, Math.min(innerWidth, innerHeight));
      touch.drag(dyaw / scale, -dpitch / scale);
    } else {
      // Exercise the real mousemove handler, with the existing drag-look
      // fallback when this browser does not grant pointer lock.
      const scale = .0022 * host.settings().sensitivity;
      host.input.dragging = !host.input.pointerLocked;
      document.dispatchEvent(new MouseEvent('mousemove', { movementX: dyaw / scale, movementY: -dpitch / scale, bubbles: true }));
      host.input.dragging = false;
    }
  };
  const upright = () => {
    const c = host.world.camera, matrix = c.getViewMatrix(true).clone().invert();
    maxHorizonError = Math.max(maxHorizonError, Math.abs(matrix.m[1]));
    check(Math.abs(matrix.m[1]) < .000001 && matrix.m[5] > 0, `Camera banked in phase ${phase}: ${matrix.m[1]}`);
    check(c.rotation.z === 0 && c.rotationQuaternion === null && c.parent === null, 'Camera retained roll/quaternion/parent transform');
    check(B.Vector3.Dot(c.getForwardRay().direction, host.player.direction) > .999999, 'Camera and player headings diverged');
    check(c.cameraDirection.lengthSquared() === 0 && c.cameraRotation.lengthSquared() === 0, 'Camera retained native motion');
  };
  const prepare = () => {
    release(); host.input.setTouchMode(cases[index].touch);
    if (index === 0) { host.action('new'); host.action('start-game'); host.action('skip-intro'); }
    turn(cases[index].yaw - host.player.yaw, cases[index].pitch - host.player.pitch);
    phase = time = total = reveals = 0;
  };
  const scare = () => {
    release();
    body = JSON.stringify(host.player.position); camera = JSON.stringify(host.world.camera.position.asArray());
    look = JSON.stringify([host.player.yaw, host.player.pitch]); locked = host.input.pointerLocked;
    starts = host.audioDiagnostics().recordings?.jumpscare.starts ?? 0;
    host.startScare('jumpscare'); phase = 2; time = 0;
  };
  const move = () => {
    release(); origin = { ...host.player.position }; yaw = host.player.yaw;
    const [code, side, forward] = directions[direction];
    if (cases[index].touch) touch.move(side, forward); else key(code, true);
    phase = 3; time = 0;
  };
  button.addEventListener('click', () => { index = 0; report.length = 0; paused = false; maxHorizonError = 0; button.disabled = true; prepare(); });
  return dt => {
    if (index < 0) return;
    total += dt; time += dt;
    try {
      check(total < 12, 'Recovery fixture timed out');
      const p = host.player, presentation = host.world.corazon, clip = host.audioDiagnostics().recordings?.jumpscare;
      upright();
      if (phase === 0 && time > .15) {
        if (!clip || clip.status === 'loading') return;
        check(p.grounded, 'Starting floor is unsupported');
        // MouseEvent movement is integer-valued in Chromium; allow <1 pixel.
        check(Math.abs(p.yaw - cases[index].yaw) < .005 && Math.abs(p.pitch - cases[index].pitch) < .005, 'Look did not reach the requested test angle');
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
          check(host.input.keys.size === 0 && host.input.look().every(n => n === 0) && !host.input.consume('Space'), 'Recovery retained stale input');
          if (index > 0) check(host.input.pointerLocked === locked, 'Scare changed pointer lock');
          check(JSON.stringify([p.yaw, p.pitch]) === look, 'Recovery changed player orientation');
          direction = 0; move(); // Start moving on the first frame after recovery.
        }
      } else if (phase === 5) {
        check(presentation.timeline.time === pauseClock && JSON.stringify(p.position) === body, 'Pause advanced the scare');
        if (time < .1) pauseAudio = clip?.time ?? 0;
        else if (time > .2) check(clip?.time === pauseAudio, 'Paused sound advanced');
        if (time > .35) { host.action('resume'); phase = 2; time = 0; }
      } else if (phase === 3 && time > .16) {
        const [, side, forward] = directions[direction], dx = p.position.x - origin.x, dz = p.position.z - origin.z;
        const vx = Math.sin(yaw) * forward + Math.cos(yaw) * side, vz = -Math.cos(yaw) * forward + Math.sin(yaw) * side;
        check(dx * vx + dz * vz > .15 && Math.abs(dx * vz - dz * vx) < .00001, `${directions[direction][0]} moved in the wrong direction or remained locked`);
        direction++;
        if (direction < directions.length) move();
        else { release(); yaw = p.yaw; pitch = p.pitch; turn(.45, -.25); phase = 4; time = 0; }
      } else if (phase === 4 && time > .1) {
        check(Math.abs(p.yaw - yaw) > .4 && Math.abs(p.pitch - pitch) > .2, 'Mouse/touch look remained locked');
        release(); origin = { ...p.position }; yaw = p.yaw; pitch = p.pitch; phase = 6; time = 0;
      } else if (phase === 6 && time > .3) {
        check(p.grounded && p.position.y === 0 && p.verticalVelocity === 0, 'Normal floor/gravity did not recover');
        check(p.position.x === origin.x && p.position.z === origin.z && p.yaw === yaw && p.pitch === pitch, 'Residual drift or rotation after input release');
        check(host.world.camera.position.equalsWithEpsilon(new B.Vector3(p.position.x, p.position.y + host.world.data.eyeHeight, p.position.z), .000001), 'Camera retained an animation offset');
        report.push(`${index + 1}. ${cases[index].touch ? 'Touch' : 'Desktop'} / ${cases[index].air ? 'airborne' : 'grounded'} / yaw ${cases[index].yaw}, pitch ${cases[index].pitch}: upright; immediate W/S/A/D; look; no drift; one impact, no tail; ${locked ? 'pointer lock' : 'touch/drag fallback'} retained`);
        index++;
        if (index === cases.length) { report.push('Same session throughout. Pause/resume: frozen presentation and recording; no replay.'); stop(); return; }
        prepare();
      }
      if (index >= 0) output.textContent = `Running recovery ${index + 1}/${cases.length} · phase ${phase}\n${report.join('\n')}`;
    } catch (error) { stop(error); }
  };
}
