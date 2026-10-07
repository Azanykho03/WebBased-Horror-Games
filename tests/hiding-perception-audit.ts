import type { HidingAuditHost } from './hiding-audit.ts';
import { anchorPosition } from '../src/fixtures.ts';

/** Deliberate encounter fixtures, with the real live ghost and capture/retry path. */
export function attachHidingPerceptionAudit(parent: Element, host: HidingAuditHost): (dt: number) => void {
  const button = document.createElement('button'), out = document.createElement('pre');
  button.textContent = 'Check Corazon cabinet search'; out.setAttribute('aria-label', 'Cabinet perception validation'); parent.append(button, out);
  let phase = -1, time = 0, total = 0, witnessed = false, seenHidden = false, prior = 0, travel = 0;
  const reports: string[] = [];
  const check = (ok: unknown, text: string) => { if (!ok) throw new Error(text); };
  const use = () => { window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE', bubbles: true })); window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyE', bubbles: true })); };
  const prepare = () => {
    host.action('new'); host.action('start-game'); host.action('skip-intro'); host.input.setTouchMode(false);
    const c = host.world.fixtures3d.cabinets[0], exit = anchorPosition(c.exit, c.floor);
    host.player.reset(exit); host.player.yaw = -c.root.rotation.y; host.player.pitch = -.42; host.player.halt(host.world); host.player.camera(host.world, host.settings());
    host.progress().collected.push('flashlight', 'note'); host.progress().kitchenSeen = true;
    host.world.viewmodel.reset(true); host.ghost.reset(true, host.player.position); host.ghost.grace = 0;
    host.ghost.position = witnessed ? { x: 3.5, y: 0, z: -20.3, level: 0 } : { x: 0, y: 0, z: -13.5, level: 0 };
    host.ghost.yaw = witnessed ? Math.PI / 2 : 0;
    host.ghost.hear(exit, 40); host.world.ghost.setEnabled(true);
    seenHidden = false; phase = time = total = travel = 0; prior = host.ghost.position.x + host.ghost.position.z;
  };
  button.onclick = () => { reports.length = 0; witnessed = false; button.disabled = true; prepare(); };
  const stop = (error?: unknown) => { host.input.clear(); phase = -1; button.disabled = false; out.textContent = `${error ? `FAIL · ${String(error)}` : 'PASS · Live cabinet perception, capture and retry'}\n${reports.join('\n')}`; };
  return dt => {
    if (phase < 0) return;
    try {
      total += dt; time += dt; check(total < 35, `Encounter timed out in phase ${phase}`);
      if (host.screen() === 'caught') {
        check(witnessed && seenHidden && host.player.hideExposed, 'Unexpected or unwitnessed capture');
        reports.push('Witnessed entry: Corazon searched the known cabinet and captured the hidden player');
        host.action('retry'); host.action('skip-intro');
        check(host.player.hidingState === 'NORMAL' && !host.player.hidden && host.player.verticalVelocity === 0, 'Retry retained hiding physics');
        check(host.world.fixtures3d.cabinets.every(c => c.hinge.state === 'CLOSED'), 'Retry retained open cabinet doors');
        phase = 3; time = 0; return;
      }
      if (host.screen() !== 'playing') return;
      if (phase === 0 && time > .3) {
        check(host.interactions.target?.id === 'hide-dining', 'Encounter cabinet prompt missing'); use(); phase = 1; time = 0;
      } else if (phase === 1) {
        if (host.player.hideExposed) check(witnessed, 'Unseen player was marked as witnessed');
        if (host.player.hidden) { seenHidden = true; phase = 2; time = 0; }
      } else if (phase === 2 && !witnessed) {
        check(!host.ghost.sees(host.player, host.world) && !host.player.hideExposed, 'Corazon directly tracked an unseen hidden player');
        const now = host.ghost.position.x + host.ghost.position.z; travel += Math.abs(now - prior); prior = now;
        if (time > 4) {
          check(host.ghost.state !== 'Dormant' && travel > .2, 'AI stopped while the player was hidden');
          reports.push('Unwitnessed entry: concealed player, active nearby investigation, no capture'); witnessed = true; prepare();
        }
      } else if (phase === 3) {
        host.input.keys.add('KeyW');
        if (time > .35) { check(host.player.moving && host.world.camera.rotation.z === 0, 'Retry did not restore upright movement'); reports.push('Capture → retry: closed doors, restored camera and walking'); stop(); }
      }
      if (phase >= 0) out.textContent = `RUNNING · ${witnessed ? 'witnessed' : 'unwitnessed'} · ${host.player.hidingState} · Corazon ${host.ghost.state}\n${reports.join('\n')}`;
    } catch (error) { stop(error); }
  };
}
