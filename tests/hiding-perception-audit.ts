import type { HidingAuditHost } from './hiding-audit.ts';
import { anchorPosition } from '../src/fixtures.ts';
import { TouchDriver } from './touch-driver.ts';
import { cabinetObserver } from './cabinet-observer.ts';

/** Deliberate encounter setup; subsequent hiding, AI and capture use Game.tick. */
export function attachHidingPerceptionAudit(parent: Element, host: HidingAuditHost): (dt: number) => void {
  const button = document.createElement('button'), mobile = document.createElement('button'), out = document.createElement('pre');
  button.textContent = 'Check Celestina cabinet search'; mobile.textContent = 'Check touch Celestina cabinet search';
  out.setAttribute('aria-label', 'Cabinet perception validation'); out.style.whiteSpace = 'pre-wrap'; parent.append(button, mobile, out);
  const touch = new TouchDriver(host.input, host.player, host.touchSensitivity);
  let phase = -1, time = 0, total = 0, index = 0, travel = 0, isTouch = false, paused = false, pauseClock = 0;
  let known = '', seenChase = false, searchTime = 0;
  const reports: string[] = [], cells = new Set<string>();
  const check = (ok: unknown, text: string) => { if (!ok) throw new Error(text); };
  const use = () => { if (isTouch) return touch.button('Hide'); host.input.queue('KeyE'); return true; };
  const cabinet = () => host.world.fixtures3d.cabinets[index % 2];
  const observer = (near = false) => {
    const exit = anchorPosition(cabinet().exit, cabinet().floor), p = cabinetObserver(host.world, exit, host.ghost.tuning.detectionRange, near);
    host.ghost.position = p; host.ghost.yaw = Math.atan2(exit.x - p.x, p.z - exit.z);
  };
  const prepare = () => {
    host.action('new'); host.action(`difficulty:${index < 2 ? 'medium' : 'hard'}`); host.action('start-game'); host.action('skip-intro'); host.input.setTouchMode(isTouch);
    const c = cabinet(), exit = anchorPosition(c.exit, c.floor);
    host.player.reset(exit); host.player.yaw = -c.root.rotation.y; host.player.pitch = -.42;
    host.player.halt(host.world); host.player.camera(host.world, host.settings());
    host.progress().collected.push('flashlight', 'note'); host.progress().kitchenSeen = true;
    host.world.viewmodel.reset(true); host.ghost.reset(true, exit); host.ghost.grace = 0;
    observer(); host.world.ghost.setEnabled(true);
    phase = time = total = travel = searchTime = 0; paused = seenChase = false; cells.clear(); known = '';
  };
  const stop = (error?: unknown) => {
    touch.release(); host.input.clear(); phase = -1; button.disabled = mobile.disabled = false;
    out.textContent = `${error ? `FAIL · ${String(error)}` : 'PASS · Both cabinets: concealment, 30-second search, early exit, capture and retry'}\n${reports.join('\n')}`;
  };
  const begin = (mobileMode: boolean) => {
    reports.length = 0; index = 0; isTouch = mobileMode; button.disabled = mobile.disabled = true;
    try { prepare(); } catch (error) { stop(error); }
  };
  button.onclick = () => begin(false); mobile.onclick = () => begin(true);
  const next = () => { index++; if (index === 4) stop(); else prepare(); };
  return dt => {
    if (phase < 0 || document.hidden) return;
    try {
      if (host.screen() === 'journal' && paused) {
        check(host.ghost.stateTime === pauseClock, 'Search clock advanced during pause'); time += dt;
        if (time > .5) { host.action('resume'); phase = 2; time = 0; } return;
      }
      if (host.screen() === 'caught') {
        check(index >= 2 && seenChase && !host.player.hidden, 'Capture bypassed concealment');
        check(host.ghost.searchRemaining === 0 && host.ghost.doorAction === null, 'Capture retained search or door work');
        reports.push(`${cabinet().id} Hard: early exit → visible → Chase → capture`);
        host.action('retry'); host.action('skip-intro');
        check(host.player.hidingState === 'NORMAL' && !host.player.hidden && host.player.verticalVelocity === 0, 'Retry retained hiding physics');
        check(host.ghost.searchRemaining === 0 && host.ghost.lastKnownPlayerPosition === null, 'Retry retained AI memory/timer');
        check(host.world.fixtures3d.cabinets.every(c => c.hinge.state === 'CLOSED'), 'Retry retained cabinet animation');
        reports.push('Retry: cleared search, closed cabinets, restored player'); next(); return;
      }
      check(host.screen() !== 'error', 'Game reported a runtime error');
      if (host.screen() !== 'playing') return;
      total += dt; time += dt; check(total < 52, `${cabinet().id}: encounter timed out in phase ${phase}`);
      if (phase === 0 && host.ghost.state === 'Chase') {
        check(host.interactions.target?.id === cabinet().id, 'Cabinet prompt missing');
        if (use()) { phase = 1; time = 0; }
      } else if (phase === 1) {
        if (host.player.hidden) {
          check(host.player.hidingState === 'HIDDEN' && cabinet().hinge.state === 'CLOSED', 'Concealment started before the doors closed');
          check(host.ghost.state === 'Search', 'Completed hide did not start search');
          known = JSON.stringify(host.ghost.lastKnownPlayerPosition); phase = 2; time = 0;
        }
      } else if (phase === 2) {
        check(host.player.hidden && !host.ghost.sees(host.player, host.world), 'Celestina directly detected a hidden player');
        check(JSON.stringify(host.ghost.lastKnownPlayerPosition) === known, 'Search read hidden coordinates');
        check(!host.world.corazon.active && host.ghost.state !== 'Catch', 'Capture or jumpscare through cabinet');
        travel += host.ghost.distanceMoved; searchTime += dt; cells.add(`${Math.round(host.ghost.position.x)},${Math.round(host.ghost.position.z)}`);
        if (!paused && host.ghost.stateTime > 1) { paused = true; pauseClock = host.ghost.stateTime; host.action('journal'); time = 0; return; }
        if (index >= 2 && host.ghost.stateTime > 3) {
          observer(true); if (use()) { phase = 3; time = 0; }
        } else if (index < 2 && host.ghost.state !== 'Search') {
          check(host.ghost.state === 'Patrol' && host.ghost.stateTime < .2, 'Search did not end in patrol');
          check(searchTime > 29.8 && searchTime < 30.2 && travel > 3 && cells.size > 3, `Search was too short or stationary (${searchTime.toFixed(1)}s, ${travel.toFixed(1)}m)`);
          reports.push(`${cabinet().id}: concealed after witnessed entry; 30s search, ${travel.toFixed(1)}m travelled, pause frozen, then patrol`); next();
        }
      } else if (phase === 3) {
        check(!host.player.hidden, 'Exit retained invisibility');
        if (host.ghost.state === 'Chase') { seenChase = true; check(host.ghost.searchRemaining === 0, 'Rediscovery retained search timer'); }
      }
      if (phase >= 0) out.textContent = `RUNNING · ${isTouch ? 'touch' : 'desktop'} · ${cabinet().id} · ${host.player.hidingState} · Celestina ${host.ghost.state} ${host.ghost.searchRemaining.toFixed(1)}s\n${reports.join('\n')}`;
    } catch (error) { stop(error); }
  };
}
