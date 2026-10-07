// Deliberate validation fixtures: position the player at each fixture, then use
// the real Game tick, raycast, keyboard/touch controls, camera and physics.
import type { World } from '../src/world.ts';
import type { Player, InputSystem } from '../src/player.ts';
import type { GhostStateMachine } from '../src/ghost.ts';
import type { InteractionSystem } from '../src/interactions.ts';
import type { HidingSystem } from '../src/hiding.ts';
import type { HidingCabinet, HouseDoor } from '../src/fixtures.ts';
import { anchorPosition } from '../src/fixtures.ts';
import type { Progress, Screen, Settings, Position } from '../src/types.ts';
import { interact } from '../src/objectives.ts';
import { TouchDriver } from './touch-driver.ts';

export interface HidingAuditHost {
  world: World; player: Player; input: InputSystem; ghost: GhostStateMachine; interactions: InteractionSystem; hiding: HidingSystem;
  action(action: string): void; screen(): Screen; progress(): Progress; settings(): Settings; touchSensitivity(): number;
}
export function attachHidingAudit(parent: Element, host: HidingAuditHost): (dt: number) => void {
  const desktop = document.createElement('button'), mobile = document.createElement('button'), doors = document.createElement('button'), touchDoors = document.createElement('button'), out = document.createElement('pre');
  desktop.textContent = 'Check cabinet cycles'; mobile.textContent = 'Check touch cabinet cycles'; doors.textContent = 'Check all hinged doors';
  touchDoors.textContent = 'Check touch hinged doors';
  out.setAttribute('aria-label', 'Hiding and doors validation'); out.style.whiteSpace = 'pre-wrap'; parent.prepend(desktop, mobile, doors, touchDoors, out);
  const touch = new TouchDriver(host.input, host.player, host.touchSensitivity);
  let mode: 'cabinet' | 'door' | null = null, isTouch = false, index = 0, phase = 0, time = 0, total = 0, motion = 0, openAngle = 0;
  let cabinet: HidingCabinet, door: HouseDoor, start: Position, body = '', paused = false, pauseClock = 0, last = '';
  let doorChanges = 0, priorDoorState = '', jumpHeight = 0;
  const reports: string[] = [];
  const check = (ok: unknown, message: string) => { if (!ok) throw new Error(message); };
  const key = (code: string) => { window.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true })); window.dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true })); };
  const use = () => isTouch ? touch.button('KeyE') : key('KeyE');
  const matrix = (node: HidingCabinet['body'] | HouseDoor['frame']) => { node.computeWorldMatrix(true); return JSON.stringify(node.getWorldMatrix().asArray()); };
  const release = () => { touch.release(); host.input.clear(); };
  const status = () => out.textContent = `${mode === null ? 'PASS' : 'RUNNING'} · ${isTouch ? 'touch' : 'desktop'} ${mode ?? 'fixtures'} · case ${index + 1} · phase ${phase}\n${reports.join('\n')}\n${host.player.hidingState} · ${cabinet?.hinge.state ?? ''} · ${host.player.position.x.toFixed(2)}, ${host.player.position.y.toFixed(2)}, ${host.player.position.z.toFixed(2)}`;
  const stop = (error?: unknown) => { release(); mode = null; desktop.disabled = mobile.disabled = doors.disabled = touchDoors.disabled = false; status(); if (error) out.textContent = `FAIL · ${String(error)}\n${reports.join('\n')}`; };
  const begin = (next: 'cabinet' | 'door', mobileMode = false) => {
    host.action('new'); host.action('start-game'); host.action('skip-intro');
    mode = next; isTouch = mobileMode; index = 0; reports.length = 0; paused = false;
    host.input.setTouchMode(isTouch); desktop.disabled = mobile.disabled = doors.disabled = touchDoors.disabled = true;
    try { if (mode === 'cabinet') prepareCabinet(); else prepareDoor(); } catch (error) { stop(error); }
  };
  function aim(position: number[]): void {
    const p = host.player, eye = p.eye, dx = position[0] - eye[0], dz = position[2] - eye[2];
    p.yaw = Math.atan2(dx, -dz); p.pitch = Math.atan2(position[1] - eye[1], Math.hypot(dx, dz)); p.camera(host.world, host.settings());
  }
  function prepareCabinet(): void {
    release(); cabinet = host.world.fixtures3d.cabinets[Math.floor(index / 3)];
    host.player.reset(anchorPosition(cabinet.exit, cabinet.floor)); host.player.halt(host.world); aim(cabinet.hotspot.position);
    body = matrix(cabinet.body); start = { ...host.player.position }; phase = time = total = motion = openAngle = 0;
    status();
  }
  function prepareDoor(): void {
    release(); door = host.world.fixtures3d.doors[index];
    const p = host.progress();
    if (door.lock === 'sealed') {
      check(door.locked && !interact(p, door.id).changed, 'Service latch became an escape bypass'); reports.push(`${door.id}: sealed lock preserved`); nextDoor(); return;
    }
    if (door.locked) {
      check(!interact(p, door.id).changed, 'Mission door unlocked without prerequisites');
      for (const id of ['flashlight', 'note', 'fuse', 'breaker', 'master-key', 'bedroom-door', 'locket', 'letter', 'music-box', 'cabinet', 'exit-key'] as const) interact(p, id);
      // Keep the front lock intact until its interaction consumes the real final-key guard.
      host.world.syncProgress(p); host.interactions.sync(p);
    }
    const candidates: Position[] = [];
    const sides = index === 1 ? [-1, 1] : [-Math.sign(door.hinge.openAngle), Math.sign(door.hinge.openAngle)];
    for (const side of sides) for (const distance of index === 1 ? [1.2, 1.65] : [1.65, 1.2]) {
      const x = door.root.position.x + Math.sin(door.root.rotation.y) * side * distance;
      const z = door.root.position.z + Math.cos(door.root.rotation.y) * side * distance;
      const point = host.world.nav.point(x, z, door.root.position.y > 1 ? 1 : 0); if (point) candidates.push(point);
    }
    check(candidates.length > 0, `${door.id}: no clear approach`);
    host.player.reset(candidates[0]); host.player.halt(host.world); aim(door.hotspot.position);
    body = matrix(door.frame); start = { ...host.player.position }; phase = time = total = doorChanges = 0; priorDoorState = door.hinge.state; status();
  }
  function nextDoor(): void { index++; if (index === host.world.fixtures3d.doors.length) stop(); else prepareDoor(); }
  desktop.onclick = () => begin('cabinet'); mobile.onclick = () => begin('cabinet', true); doors.onclick = () => begin('door');
  touchDoors.onclick = () => begin('door', true);
  for (const [i, label] of ['Preview dining cabinet', 'Preview upstairs cabinet'].entries()) {
    const preview = document.createElement('button'); preview.textContent = label; parent.append(preview);
    preview.onclick = () => {
      stop(); host.action('new'); host.action('start-game'); host.action('skip-intro');
      const c = host.world.fixtures3d.cabinets[i]; host.player.reset(anchorPosition(c.exit, c.floor)); host.player.halt(host.world); aim(c.hotspot.position);
      host.progress().collected.push('flashlight'); host.world.viewmodel.reset(true); host.player.flashlight = true;
    };
  }
  return dt => {
    if (!mode) return;
    try {
      if (host.screen() === 'journal' && paused) {
        check(cabinet.hinge.angle === pauseClock, 'Cabinet animation advanced while paused'); time += dt;
        if (time > .35) { host.action('resume'); phase = 1; time = 0; } return;
      }
      if (host.screen() !== 'playing') return;
      total += dt; time += dt; check(total < 18, `${mode} ${index}: timed out in phase ${phase} (${door?.hinge.state}, ${host.player.hidingState})`);
      const p = host.player, world = host.world;
      check(world.camera.rotation.z === 0 && world.camera.rotationQuaternion === null && world.camera.parent === null, 'Camera roll or parent leaked');
      if (mode === 'cabinet') {
        check(matrix(cabinet.body) === body, 'Cabinet body moved with doors');
        openAngle = Math.max(openAngle, Math.abs(cabinet.pivots[0].rotation.y));
        if (p.movementLocked) check(p.verticalVelocity === 0 && !p.moving && !p.sprinting, 'Velocity or movement during hiding');
        if (phase === 0 && time > .2) {
          check(host.interactions.target?.id === cabinet.id, `${cabinet.id}: missing raycast prompt`);
          use(); phase = 1; time = 0;
        } else if (phase === 1) {
          check(time < .15 || p.hidingState !== 'NORMAL', 'Entry input ignored');
          if (!paused && index === 0 && time > .22) { paused = true; pauseClock = cabinet.hinge.angle; host.action('journal'); time = 0; return; }
          if (p.hidingState !== 'HIDDEN' && time > .15) { use(); motion++; }
          if (p.hidden) {
            check(openAngle > 1.65 && motion > 2, 'Door or player transition snapped');
            const anchor = anchorPosition(cabinet.hide, cabinet.floor);
            check(Math.hypot(p.position.x - anchor.x, p.position.y - anchor.y, p.position.z - anchor.z) < .001, 'Player is outside hide anchor');
            check(cabinet.hinge.state === 'CLOSED', 'Hidden before cabinet closed');
            check(!host.ghost.sees(p, world), 'Unwitnessed hide remained visible');
            start = { ...p.position }; phase = 2; time = 0;
          }
        } else if (phase === 2) {
          if (isTouch) { touch.move(1, 1); touch.drag(150, -80); touch.button('Space'); touch.button('Throw'); }
          else { host.input.keys.add('KeyW'); host.input.keys.add('Space'); host.input.addLook(800, -500); key('Throw'); }
          check(JSON.stringify(p.position) === JSON.stringify(start), 'Hidden body drifted');
          check(!host.interactions.target, 'Unrelated interaction while hidden');
          check(Math.abs(p.pitch) <= .22 && Math.abs(Math.atan2(Math.sin(p.yaw - cabinet.yaw), Math.cos(p.yaw - cabinet.yaw))) <= .421, 'Hidden look escaped its limits');
          if (time > .5) { release(); use(); phase = 3; time = 0; }
        } else if (phase === 3 && !p.movementLocked) {
          check(!p.hidden && !p.hideExposed && p.hidingAt === null, 'Hiding state leaked after exit');
          check(cabinet.hinge.state === 'CLOSED' && p.verticalVelocity === 0 && p.grounded, 'Exit physics or door not restored');
          start = { ...p.position }; phase = 4; time = 0;
        } else if (phase === 4) {
          if (isTouch) touch.move(0, 1); else host.input.keys.add('KeyW');
          if (time > .25) {
            check(Math.hypot(p.position.x - start.x, p.position.z - start.z) > .18, 'Walking did not return');
            release(); start = { ...p.position }; jumpHeight = start.y; phase = 5; time = 0;
            if (isTouch) { touch.button('Space'); touch.drag(150, -150); }
            else { key('Space'); host.input.addLook(400, -400); }
          }
        } else if (phase === 5) {
          jumpHeight = Math.max(jumpHeight, p.position.y);
          if (time > .2) check(p.pitch > .22, 'Normal camera look stayed clamped after exit');
          if (time > 1.5) {
            check(jumpHeight > start.y + .3 && p.grounded && p.verticalVelocity === 0 && Math.abs(p.position.y - start.y) < .001, 'Jump, gravity or grounded state did not recover');
            reports.push(`${cabinet.id} cycle ${index % 3 + 1}: prompt, smooth entry/exit, fixed body, no drift, upright camera, walking, free look, jump and landing PASS`);
            index++; if (index === 6) stop(); else prepareCabinet();
          }
        }
      } else {
        check(matrix(door.frame) === body, `${door.id}: frame moved`);
        if (phase === 0 && time > .2) {
          check(host.interactions.target?.id === door.id, `${door.id}: missing prompt (${host.interactions.target?.id})`);
          use(); phase = 1; time = 0;
        } else if (phase === 1) {
          if (index === 1 && doorChanges === 0 && time > 1.1 && time < 1.4) {
            check(!world.collision.blocked(p.position), 'Closing leaf penetrated the player');
            if (isTouch) touch.move(0, -1); else host.input.keys.add('KeyS');
          } else { if (isTouch) touch.move(0, 0); host.input.keys.delete('KeyS'); }
          if (door.hinge.busy) { use(); }
          if (time > 1.6 && !door.hinge.busy) {
            check(door.pivot.rotation.y === door.hinge.angle && door.hinge.state !== priorDoorState, 'Visual/logical hinge mismatch or ignored interaction');
            priorDoorState = door.hinge.state; doorChanges++;
            if (doorChanges === 4) { reports.push(`${door.id}: two open/close cycles, repeat-input guard, stationary frame${index === 1 ? ', blocked swing resumed after walking clear' : ''} PASS`); nextDoor(); }
            else { use(); time = 0; }
          }
        }
      }
      const now = `${phase}:${Math.floor(time * 2)}:${reports.length}`; if (now !== last) { last = now; status(); }
    } catch (error) { stop(error); }
  };
}
