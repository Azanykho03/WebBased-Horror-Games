// This driver is included only by `vite build --mode validation`.
// It supplies ordinary movement, look and interaction input. It never teleports,
// grants items, freezes the enemy, bypasses gates or writes progress/save data.
import type { World } from '../src/world.ts';
import type { Player, InputSystem } from '../src/player.ts';
import type { GhostStateMachine } from '../src/ghost.ts';
import type { InteractionSystem } from '../src/interactions.ts';
import type { InteractionId, Position, Progress, Screen, Vec3 } from '../src/types.ts';
import { canEscape } from '../src/objectives.ts';

interface JourneyHost {
  world: World; player: Player; input: InputSystem; ghost: GhostStateMachine; interactions: InteractionSystem;
  progress(): Progress; screen(): Screen; revealing(): boolean; action(action: string): void;
  audioState(): string;
}
export function attachJourney(host: JourneyHost): (dt: number) => void {
  const panel = document.createElement('aside');
  panel.setAttribute('aria-label', 'Development validation');
  panel.style.cssText = 'position:fixed;right:12px;top:12px;z-index:20;max-width:360px;padding:12px;background:#08100fed;color:#fff;font:12px/1.5 monospace;border:1px solid #647566';
  panel.innerHTML = '<strong>DEVELOPMENT VALIDATION</strong><p>Normal collision, objectives and live enemy.</p><button>Run full journey</button><button id="journey-saved">Resume saved journey</button><button id="journey-retry" hidden>Continue journey from checkpoint</button><pre style="white-space:pre-wrap" role="status">Ready</pre>';
  document.body.append(panel);
  const button = panel.querySelector('button')!, status = panel.querySelector('pre')!;
  const retry = panel.querySelector<HTMLButtonElement>('#journey-retry')!;
  const savedRun = panel.querySelector<HTMLButtonElement>('#journey-saved')!;
  const steps: InteractionId[] = ['flashlight', 'note', 'fuse', 'tsinelas', 'battery-kitchen', 'breaker', 'letter', 'locket', 'music-box', 'cabinet', 'exit-key', 'exit'];
  let running = false, index = 0, route: Position[] | null = null, settle = 0, elapsed = 0, distance = 0, prior: Position | null = null, reportAt = 0, catches = 0;
  const seenStates = new Set<string>(), completed: string[] = [];
  const fps: number[] = [];
  let pauseSnapshot = '', pauseTime = 0;
  const report = (result: string) => { status.textContent = `${result}\n${completed.join(' → ')}\n${elapsed.toFixed(1)}s · ${distance.toFixed(1)}m · ${catches} captures\nGhost: ${[...seenStates].join(', ')}${fps.length ? `\nFPS avg ${(fps.reduce((a, b) => a + b) / fps.length).toFixed(0)} · min ${Math.min(...fps).toFixed(0)}` : ''}`; };
  const stop = (result: string) => { running = false; host.input.clear(); button.disabled = false; report(result); };
  button.addEventListener('click', () => {
    index = 0; catches = 0; elapsed = distance = settle = reportAt = 0; route = prior = null; completed.length = fps.length = 0; seenStates.clear(); retry.hidden = true;
    host.action('new'); host.action('resume'); running = true; button.disabled = true; report('Running');
  });
  savedRun.addEventListener('click', () => {
    host.action('continue');
    index = steps.findIndex(id => !done(id)); if (index < 0) index = steps.length;
    elapsed = distance = settle = reportAt = catches = 0; route = prior = null;
    fps.length = completed.length = 0; seenStates.clear(); retry.hidden = true;
    completed.push(`loaded checkpoint (${host.progress().collected.length} items, kitchen ${host.progress().kitchenSeen ? 'completed' : 'pending'})`);
    host.action('resume'); running = true; button.disabled = true; report('Running from saved checkpoint');
  });
  retry.addEventListener('click', () => {
    const items = [...host.progress().collected];
    host.action('retry');
    if (JSON.stringify(host.progress().collected) !== JSON.stringify(items)) { stop('FAIL · Collected items lost after retry'); return; }
    if (host.ghost.grace <= 0 || host.player.position.level === host.ghost.position.level) { stop('FAIL · Unsafe checkpoint restore'); return; }
    completed.push('checkpoint restored'); route = prior = null; settle = 0; retry.hidden = true;
    host.action('resume'); running = true; button.disabled = true;
  });
  function aim(at: Vec3): void {
    const eye = host.player.eye, dx = at[0] - eye[0], dz = at[2] - eye[2];
    host.player.yaw = Math.atan2(dx, -dz); host.player.pitch = Math.atan2(at[1] - eye[1], Math.hypot(dx, dz));
  }
  function approach(id: InteractionId): Position[] {
    const h = host.interactions.hotspots.find(h => h.id === id)!;
    const candidates: Position[] = [];
    for (const radius of [.8, 1.2, 1.6]) for (let i = 0; i < 24; i++) {
      const p = host.world.nav.point(h.position[0] + Math.sin(i * Math.PI / 12) * radius, h.position[2] + Math.cos(i * Math.PI / 12) * radius, h.position[1] >= 3.24 ? 1 : 0);
      if (!p) continue;
      const eye: Vec3 = [p.x, p.y + 1.65, p.z];
      if (Math.hypot(...h.position.map((v, i) => v - eye[i])) < 2.03 && host.world.clearSight(eye, h.position)) candidates.push(p);
    }
    const player = host.player.position;
    candidates.sort((a, b) => Math.hypot(a.x - player.x, a.y - player.y, a.z - player.z) - Math.hypot(b.x - player.x, b.y - player.y, b.z - player.z));
    for (const p of candidates) { try { return host.world.nav.path(player, p); } catch { /* Try another approach. */ } }
    throw new Error(`No usable approach for ${id}`);
  }
  function done(id: InteractionId): boolean {
    const p = host.progress();
    if (id === 'breaker') return p.power;
    if (id === 'cabinet') return p.cabinet;
    if (id === 'exit') return p.exitUnlocked;
    return p.collected.some(item => item === id);
  }
  return dt => {
    if (!running) return;
    seenStates.add(host.ghost.state);
    if (host.screen() === 'won') { stop(canEscape(host.progress()) ? 'PASS · Full escape with live ghost' : 'FAIL · Invalid escape'); return; }
    if (host.screen() === 'caught') { catches++; stop(`Capture verified · retry to continue at ${steps[index] ?? 'escape'}`); retry.hidden = false; return; }
    if (host.screen() === 'error') { stop('FAIL · Runtime error'); return; }
    if (host.screen() !== 'playing') {
      const snapshot = JSON.stringify([host.progress(), host.player.position, host.player.stamina, host.ghost.position, host.ghost.stateTime, host.ghost.grace]);
      if (!pauseSnapshot) pauseSnapshot = snapshot;
      pauseTime += dt;
      if (pauseTime > 1) report(snapshot === pauseSnapshot && host.audioState() !== 'running' ? 'PASS · Paused timers, player, enemy and audio frozen' : 'FAIL · Paused systems changed');
      return;
    }
    pauseSnapshot = ''; pauseTime = 0;
    elapsed += dt; reportAt += dt;
    if (prior) distance += Math.hypot(host.player.position.x - prior.x, host.player.position.z - prior.z);
    prior = { ...host.player.position };
    if (elapsed > 360) { stop(`FAIL · Timed out at ${steps[index] ?? 'escape'}`); return; }
    host.input.keys.clear();
    if (host.revealing()) return;
    const id = steps[index];
    if (id && done(id)) { completed.push(id); index++; route = null; settle = 0; return; }
    try {
      if (!route) route = id ? approach(id) : host.world.nav.path(host.player.position, { x: -2.5, z: -13.5, level: 0 });
      while (route.length && Math.hypot(route[0].x - host.player.position.x, route[0].z - host.player.position.z) < .09) route.shift();
      if (route.length) {
        const target = route[0]; aim([target.x, target.y + 1.65, target.z]);
        host.input.keys.add('KeyW'); host.input.keys.add('ShiftLeft');
      } else if (id) {
        const h = host.interactions.hotspots.find(h => h.id === id)!; aim(h.position); settle += dt;
        if (settle > .2) { host.input.queue('KeyE'); settle = 0; }
      }
      if (reportAt > .5) {
        reportAt = 0; if (elapsed > 5) fps.push(host.world.scene.getEngine().getFps());
        report(`Running · ${id ?? 'Crossing exit'}\nPosition ${host.player.position.x.toFixed(2)}, ${host.player.position.y.toFixed(2)}, ${host.player.position.z.toFixed(2)}`);
      }
    } catch (error) { stop(`FAIL · ${String(error)}`); }
  };
}
