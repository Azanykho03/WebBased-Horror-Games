import type { HidingAuditHost } from './hiding-audit.ts';
import type { HouseDoor } from '../src/fixtures.ts';
import type { Position } from '../src/types.ts';

/** Explicit encounter fixtures. Every hinge and AI step runs in the game loop. */
export function attachGhostDoorAudit(parent: Element, host: HidingAuditHost): (dt: number) => void {
  const button = document.createElement('button'), out = document.createElement('pre');
  button.textContent = 'Check Celestina door navigation'; out.setAttribute('aria-label', 'Celestina door validation');
  out.style.whiteSpace = 'pre-wrap'; parent.append(button, out);
  let cases: { door: HouseDoor; side: number }[] = [], index = 0, phase = -1, time = 0, requests = 0, seenSearch = false, last = '';
  const reports: string[] = [];
  const check = (ok: unknown, message: string) => { if (!ok) throw Error(message); };
  const stop = (error?: unknown) => {
    phase = -1; button.disabled = false; host.input.clear();
    out.textContent = `${error ? `FAIL · ${String(error)}` : 'PASS · All usable doors from both sides, live chase/search, shared hinges and mission guards'}\n${reports.join('\n')}`;
  };
  const prepare = () => {
    host.action('new'); host.action('start-game'); host.action('skip-intro');
    const progress = host.progress(); progress.bedroomUnlocked = true; progress.kitchenSeen = true;
    // The initial guard check below runs before this deliberate unlocked fixture.
    host.world.fixtures3d.reset(progress); host.world.syncProgress(progress);
    const { door, side } = cases[index], yaw = door.root.rotation.y;
    if (door.hinge.state === 'CLOSED') { door.hinge.request(true); host.world.fixtures3d.update(1, []); }
    const point = (sign: number): Position => {
      for (const gap of [1.65, 1.35, .85, 2.1]) for (const offset of [0, -.3, .3]) {
        const p = host.world.nav.point(door.root.position.x + Math.sin(yaw) * sign * gap + Math.cos(yaw) * offset,
          door.root.position.z + Math.cos(yaw) * sign * gap - Math.sin(yaw) * offset, door.root.position.y > 1 ? 1 : 0);
        if (p && host.world.clearSight([p.x, p.y + 1.45, p.z], door.hotspot.position)) return p;
      }
      throw Error(`${door.id}: no visible encounter approach on side ${sign}`);
    };
    const start = point(side), target = point(-side);
    host.player.reset(target); host.player.halt(host.world); host.player.yaw = Math.atan2(start.x - target.x, target.z - start.z);
    host.player.camera(host.world, host.settings()); host.ghost.reset(true, target); host.ghost.grace = 0;
    host.ghost.position = start; host.ghost.yaw = Math.atan2(target.x - start.x, start.z - target.z); host.world.ghost.setEnabled(true);
    phase = time = requests = 0; seenSearch = false;
  };
  button.onclick = () => {
    try {
      reports.length = 0; index = 0; button.disabled = true;
      host.action('new'); host.action('start-game'); host.action('skip-intro');
      const access = host.world.ghostNavigation!;
      for (const d of host.world.fixtures3d.doors.filter(d => d.lock)) check(!access.canOpen(d), `${d.id}: AI bypassed a mission lock`);
      check(!host.progress().bedroomUnlocked && !host.progress().exitUnlocked, 'Initial mission gates changed');
      reports.push('Bedroom, final entrance and sealed service lock guards PASS');
      cases = host.world.fixtures3d.doors.filter(d => d.lock !== 'final' && d.lock !== 'sealed').flatMap(door => [-1, 1].map(side => ({ door, side })));
      prepare();
    } catch (error) { stop(error); }
  };
  return dt => {
    if (phase < 0 || document.hidden) return;
    try {
      check(host.screen() !== 'caught' && host.screen() !== 'error' && host.ghost.state !== 'Catch', 'Encounter ended before door traversal');
      if (host.screen() !== 'playing') return;
      time += dt; check(time < 27, `Door traversal timed out: ${cases[index].door.id} / ${host.ghost.doorAction}`);
      const { door, side } = cases[index], p = host.ghost.position, yaw = door.root.rotation.y;
      check(!host.world.collision.blocked(p), `${door.id}: Celestina penetrated collision`);
      check(!host.progress().exitUnlocked, 'Door AI changed final mission progress');
      if (phase === 0 && host.ghost.state === 'Chase') {
        check(door.hinge.request(false), `${door.id}: player could not close the door`); phase = 1; time = 0;
        if (side === 1) {
          // Remove sight while retaining the actual visible target in AI memory.
          host.player.reset(p.level ? { x: 0, y: 0, z: -2.5, level: 0 } : { x: 0, y: 3.24, z: -14, level: 1 });
          host.player.halt(host.world);
        }
      } else if (phase === 1) {
        if (host.ghost.openedDoor && host.ghost.doorId === door.id) requests++;
        check(requests <= 1, `${door.id}: opening restarted`);
        seenSearch ||= host.ghost.state === 'Search';
        if (host.ghost.doorAction === 'WaitingForDoor') check(host.ghost.distanceMoved === 0, 'Walked while waiting for a door');
        const signed = (p.x - door.root.position.x) * Math.sin(yaw) + (p.z - door.root.position.z) * Math.cos(yaw);
        if (signed * side < -.4) {
          check(door.hinge.state === 'OPEN', `${door.id}: crossed before opening finished`);
          check(side !== 1 || seenSearch, 'Lost player without searching');
          check(side !== -1 || host.ghost.state === 'Chase', 'Visible player did not restore pursuit');
          reports.push(`${door.id} side ${side}: ${side === 1 ? 'Search' : 'Chase'}, ${requests} open request, clear traversal`);
          index++; if (index === cases.length) stop(); else prepare();
        }
      }
      const status = `${index}:${phase}:${Math.floor(time * 2)}`;
      if (phase >= 0 && status !== last) { last = status; out.textContent = `RUNNING · ${cases[index].door.id} · ${host.ghost.state} · ${host.ghost.doorAction ?? 'moving'}\n${reports.join('\n')}`; }
    } catch (error) { stop(error); }
  };
}
