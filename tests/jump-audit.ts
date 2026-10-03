// Validation build only. Navigate with the actual controller; never set transforms or grant items.
import type { World } from '../src/world.ts';
import type { Player, InputSystem } from '../src/player.ts';
import type { Position, Screen } from '../src/types.ts';
import { TouchDriver } from './touch-driver.ts';

interface JumpHost {
  world: World; player: Player; input: InputSystem;
  action(action: string): void; screen(): Screen; touchSensitivity(): number;
}
export function attachJumpAudit(root: Element, host: JumpHost): (dt: number) => void {
  const button = document.createElement('button'), touchButton = document.createElement('button'), status = document.createElement('pre');
  button.textContent = 'Check desktop jumping'; touchButton.textContent = 'Check touch jumping';
  status.setAttribute('aria-label', 'Jump validation'); status.style.whiteSpace = 'pre-wrap';
  root.append(button, touchButton, status);
  const touch = new TouchDriver(host.input, host.player, host.touchSensitivity);
  let mobile = false, phase = -1, elapsed = 0, phaseTime = 0, route: Position[] = [], peak = 0, initialYaw = 0;
  const key = (code: string, down: boolean, repeat = false) => window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, bubbles: true, cancelable: true, repeat }));
  const stop = (text: string) => {
    phase = -1; touch.release(); host.input.clear(); button.disabled = touchButton.disabled = false;
    status.textContent = text;
  };
  const begin = (isMobile: boolean) => {
    mobile = isMobile; host.input.setTouchMode(mobile);
    host.action('new'); host.action('start-game'); host.action('skip-intro');
    route = host.world.nav.path(host.player.position, { x: 6.15, z: -2.12, level: 0 });
    phase = 0; elapsed = phaseTime = peak = 0; button.disabled = touchButton.disabled = true;
    status.textContent = 'Running: walk to the living-room table';
  };
  button.addEventListener('click', () => begin(false)); touchButton.addEventListener('click', () => begin(true));
  const move = (forward: number) => {
    if (mobile) touch.move(0, forward);
    else { key('KeyW', forward > 0); key('KeyS', forward < 0); }
  };
  const aim = (x: number, y: number, z: number) => {
    if (mobile) touch.aim([x, y, z]);
    else {
      const yaw = Math.atan2(x - host.player.position.x, host.player.position.z - z);
      const delta = Math.atan2(Math.sin(yaw - host.player.yaw), Math.cos(yaw - host.player.yaw));
      host.input.addLook(delta / .0022, host.player.pitch / .0022);
    }
  };
  return dt => {
    if (phase < 0) return;
    if (host.screen() !== 'playing') { touch.release(); return; }
    elapsed += dt; phaseTime += dt;
    const p = host.player.position;
    if (elapsed > 45) { stop(`FAIL: jumping phase ${phase} timed out at ${JSON.stringify(p)}`); return; }
    if (phase === 0) {
      while (route.length && Math.hypot(route[0].x - p.x, route[0].z - p.z) < .065) route.shift();
      if (route.length) { const target = route[0]; aim(target.x, target.y + 1.65, target.z); move(1); return; }
      move(0); aim(6.15, 1.65, -4); phase = 1; phaseTime = 0; return;
    }
    if (phase === 1) {
      if (phaseTime < .1) return;
      initialYaw = host.player.yaw;
      move(1);
      if (mobile) { touch.drag(3, 0); touch.button('Space'); }
      else key('Space', true);
      phase = 2; phaseTime = 0; return;
    }
    if (phase === 2) {
      peak = Math.max(peak, p.y);
      if (phaseTime > .16 && phaseTime < .25) {
        if (mobile) touch.button('Space'); else key('Space', true, true);
      }
      if (p.z < -3.15) move(0);
      if (phaseTime > .8 && host.player.grounded) {
        if (Math.abs(p.y - .5) > .01 || peak < .9 || peak > 1.01 || mobile && host.player.yaw === initialYaw) {
          stop(`FAIL: table jump/air rejection: y=${p.y}, peak=${peak}`); return;
        }
        status.textContent = 'PASS: table landing, jump height, mid-air rejection, simultaneous move/look/jump. Checking held input.';
        phase = 3; phaseTime = 0;
      }
      return;
    }
    if (phase === 3) {
      if (!mobile) key('Space', true, true);
      if (Math.abs(p.y - .5) > .01) { stop('FAIL: held/repeated Space jumped after landing'); return; }
      if (phaseTime < .4) return;
      key('Space', false); move(-1); phase = 4; phaseTime = 0; return;
    }
    if (phase === 4) {
      if (p.z > -2.1) move(0);
      if (phaseTime > 1 && host.player.grounded && p.y < .01) {
        stop(`PASS: ${mobile ? 'touch pointers' : 'Space keyboard'} jump onto living-room table; peak ${peak.toFixed(3)} m; stable landing; no air jump or held-key repeat; walk-off gravity. ${elapsed.toFixed(1)} s`);
      }
    }
  };
}
