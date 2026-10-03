// This driver is included only by `vite build --mode validation`.
// It supplies ordinary movement, look and interaction input. It never teleports,
// grants items, freezes the enemy, bypasses gates or writes progress/save data.
import type { World } from '../src/world.ts';
import type { Player, InputSystem } from '../src/player.ts';
import type { GhostStateMachine } from '../src/ghost.ts';
import type { InteractionSystem } from '../src/interactions.ts';
import type { InteractionId, Position, Progress, Screen, Vec3 } from '../src/types.ts';
import { canEscape } from '../src/objectives.ts';
import type { Atmosphere, HauntEvent } from '../src/horror.ts';
import { TouchDriver } from './touch-driver.ts';
import { attachAudioAudit } from './audio-audit.ts';
import { attachMusicAudit } from './music-audit.ts';
import { attachAmbienceAudit } from './ambience-audit.ts';
import type { AudioSystem } from '../src/audio.ts';
import { attachJumpAudit } from './jump-audit.ts';
import { attachDisplayAudit } from './display-audit.ts';
import { attachCorazonAudioAudit } from './corazon-audio-audit.ts';

interface JourneyHost {
  world: World; player: Player; input: InputSystem; ghost: GhostStateMachine; interactions: InteractionSystem;
  progress(): Progress; screen(): Screen; revealing(): boolean; action(action: string): void;
  audioState(): string;
  audioDiagnostics(): AudioSystem['diagnostics'];
  atmosphere(): Atmosphere;
  haunt(event: HauntEvent): void;
  touchSensitivity(): number;
}
export function attachJourney(host: JourneyHost): (dt: number) => void {
  const panel = document.createElement('aside');
  panel.setAttribute('aria-label', 'Development validation');
  panel.style.cssText = 'position:fixed;right:12px;top:72px;z-index:20;max-width:min(360px,75vw);max-height:75vh;overflow:auto;padding:8px;background:#08100fed;color:#fff;font:11px/1.4 monospace;border:1px solid #647566';
  panel.innerHTML = '<details open><summary>DEVELOPMENT VALIDATION</summary><div><p>Normal collision, objectives and live enemy.</p><button>Run full journey</button><button id="journey-touch">Run touch journey</button><button id="journey-mode">Preview touch controls</button><button id="journey-saved">Resume saved journey</button><button id="journey-retry" hidden>Continue journey from checkpoint</button><pre style="white-space:pre-wrap" role="status">Ready</pre></div></details>';
  document.body.append(panel);
  const content = panel.querySelector('details > div')!;
  const jumpAudit = attachJumpAudit(content, host);
  attachDisplayAudit(content, host.world);
  attachAudioAudit(content, () => host.action('journal'));
  attachMusicAudit(content, () => host.action('journal'));
  attachAmbienceAudit(content, () => host.action('journal'));
  attachCorazonAudioAudit(content, () => host.action('journal'));
  const captureAudio = document.createElement('pre'); captureAudio.setAttribute('aria-label', 'Face audio synchronization'); content.append(captureAudio);
  let faceVisible = false, faceStarts = 0, faceEvents = 0;
  const face = document.querySelector<HTMLElement>('#face-overlay')!;
  new MutationObserver(() => {
    const visible = !face.hidden, clip = host.audioDiagnostics().recordings?.jumpscare;
    if (visible && !faceVisible) {
      const startedOnce = clip?.starts === faceStarts + 1;
      faceEvents++; faceStarts = clip?.starts ?? 0;
      captureAudio.textContent = `${startedOnce && clip?.playing && clip.sources === 1 && !clip.loop ? 'PASS' : 'FAIL'} · Face event ${faceEvents}: audio started in the face-visibility frame (starts ${faceStarts})`;
    } else if (visible && clip?.starts !== faceStarts) captureAudio.textContent = 'FAIL · Jumpscare restarted while face remained visible';
    else if (!visible && faceVisible) captureAudio.textContent += `\nSequence finished · ${clip?.starts === faceStarts ? 'one audio trigger' : 'FAIL duplicate trigger'} · tail ${clip?.playing ? 'playing' : 'stopped'}`;
    faceVisible = visible;
  }).observe(face, { attributes: true, attributeFilter: ['hidden'] });
  const mix = document.createElement('pre'); mix.setAttribute('aria-label', 'Audio diagnostics'); content.append(mix);
  const recordings = document.createElement('pre'); recordings.setAttribute('aria-label', 'Corazon recording diagnostics'); content.append(recordings);
  const audition = document.createElement('button'); audition.textContent = 'Audition weather / haunt'; content.append(audition);
  let auditionIndex = 0, mixTime = 0;
  const auditionKinds: HauntEvent['kind'][] = ['thunder', 'light', 'whisper', 'object', 'footsteps', 'window', 'curtain', 'radio', 'shadow', 'apparition'];
  audition.addEventListener('click', () => {
    if (host.screen() !== 'playing') return;
    const kind = auditionKinds[auditionIndex++ % auditionKinds.length], p = host.player.position;
    host.haunt({ kind, room: host.world.room(p).id, position: [p.x + 1, p.y + 1, p.z - 4], duration: 4, strength: .65, voice: 'whisper-1', delay: .8, caption: `Validation: ${kind}` });
  });
  const button = panel.querySelector('button')!, status = panel.querySelector('pre')!;
  const retry = panel.querySelector<HTMLButtonElement>('#journey-retry')!;
  const savedRun = panel.querySelector<HTMLButtonElement>('#journey-saved')!;
  const touchRun = panel.querySelector<HTMLButtonElement>('#journey-touch')!;
  panel.querySelector('#journey-mode')!.addEventListener('click', () => host.input.setTouchMode(true));
  const touch = new TouchDriver(host.input, host.player, host.touchSensitivity);
  let touchMode = false, controlsChecked = false, checkStage = 0, checkTime = 0, startYaw = 0, startPitch = 0;
  let steps: InteractionId[] = [];
  let running = false, index = 0, extraStep = 0, route: Position[] | null = null, settle = 0, elapsed = 0, distance = 0, prior: Position | null = null, reportAt = 0, catches = 0;
  const seenStates = new Set<string>(), completed: string[] = [];
  const fps: number[] = [];
  let pauseSnapshot = '', pauseTime = 0;
  const report = (result: string) => { status.textContent = `${result}\n${completed.join(' → ')}\n${elapsed.toFixed(1)}s · ${distance.toFixed(1)}m · ${catches} captures\nGhost: ${[...seenStates].join(', ')}${fps.length ? `\nFPS avg ${(fps.reduce((a, b) => a + b) / fps.length).toFixed(0)} · min ${Math.min(...fps).toFixed(0)}` : ''}`; };
  const stop = (result: string) => { running = false; touch.release(); host.input.clear(); button.disabled = touchRun.disabled = false; report(result); };
  const begin = (mobile: boolean) => {
    touch.release(); touchMode = mobile; controlsChecked = !mobile; checkStage = checkTime = 0;
    steps = ['flashlight', 'note', 'fuse', 'tsinelas', 'battery-kitchen', 'breaker', 'letter', 'locket', ...(mobile ? ['hide-guest' as const] : []), 'music-box', 'cabinet', 'exit-key', 'exit'];
    host.input.setTouchMode(mobile);
    index = extraStep = 0; catches = 0; elapsed = distance = settle = reportAt = 0; route = prior = null; completed.length = fps.length = 0; seenStates.clear(); retry.hidden = true;
    host.action('new'); host.action('start-game'); host.action('resume'); running = true; button.disabled = touchRun.disabled = true; report(mobile ? 'Running with touch pointers' : 'Running');
  };
  button.addEventListener('click', () => begin(false));
  touchRun.addEventListener('click', () => begin(true));
  savedRun.addEventListener('click', () => {
    steps = ['flashlight', 'note', 'fuse', 'tsinelas', 'battery-kitchen', 'breaker', 'letter', 'locket', 'music-box', 'cabinet', 'exit-key', 'exit'];
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
    if (touchMode) { touch.aim(at); return; }
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
    if (id === 'hide-guest') return host.player.hidden;
    const p = host.progress();
    if (id === 'breaker') return p.power;
    if (id === 'cabinet') return p.cabinet;
    if (id === 'exit') return p.exitUnlocked;
    return p.collected.some(item => item === id);
  }
  return dt => {
    jumpAudit(dt);
    if (mixTime + dt > .25) {
      const clips = host.audioDiagnostics().recordings;
      recordings.textContent = clips ? (['menu', 'gameplay', 'proximity', 'jumpscare'] as const).map(name => {
        const clip = clips[name];
        return `${name}: ${clip.status} ${clip.playing ? 'playing' : 'stopped'} · ${clip.time.toFixed(2)}s · gain ${clip.gain.toFixed(3)} · sources ${clip.sources} · starts ${clip.starts}`;
      }).join('\n') : 'Recordings await first interaction';
    }
    mixTime += dt;
    if (mixTime > .25) { mixTime = 0; const a = host.audioDiagnostics(); mix.textContent = `${a.soundtrack} · ${a.state}\nBGM ${a.background?.track ?? 'none'} → ${a.background?.requested ?? 'none'} · ${a.background?.playing ? 'playing' : 'paused'} · ${(a.background?.time ?? 0).toFixed(1)} s\nMixkit ${a.ambience.status} · ${a.ambience.playing ? 'playing' : 'quiet'} · ${a.ambience.time.toFixed(1)} s · gain ${a.ambience.gain.toFixed(3)}\nDuck music ${a.ducking.music.toFixed(2)} / ambience ${a.ducking.ambience.toFixed(2)}\nVoices ${a.transientVoices}/20 · loops ${a.permanentSources}\nFear ${host.atmosphere().fear.toFixed(2)} · proximity ${host.atmosphere().proximity.toFixed(2)}`; }
    if (!running) return;
    if (host.screen() === 'intro') return;
    seenStates.add(host.ghost.state);
    if (host.screen() === 'won') { stop(canEscape(host.progress()) ? `PASS · Full ${touchMode ? 'touch' : 'desktop'} escape with live ghost` : 'FAIL · Invalid escape'); return; }
    if (host.screen() === 'caught') { catches++; stop(`Capture verified · retry to continue at ${steps[index] ?? 'escape'}`); retry.hidden = false; return; }
    if (host.screen() === 'error') { stop('FAIL · Runtime error'); return; }
    if (host.screen() !== 'playing') {
      touch.release();
      const snapshot = JSON.stringify([host.progress(), host.player.position, host.player.stamina, host.ghost.position, host.ghost.stateTime, host.ghost.grace]);
      if (!pauseSnapshot) pauseSnapshot = snapshot;
      pauseTime += dt;
      if (pauseTime > 1) {
        const frozen = snapshot === pauseSnapshot && host.audioState() !== 'running';
        if (!frozen) { stop('FAIL · Paused systems changed'); return; }
        report('PASS · Paused timers, player, enemy and audio frozen');
        if (touchMode && (checkStage === 3 || checkStage === 4)) {
          completed.push(checkStage === 3 ? 'touch pause / resume' : 'touch journal / resume'); checkStage++;
          document.querySelector<HTMLButtonElement>('#panel [data-action="resume"]')!.click();
        }
      }
      return;
    }
    pauseSnapshot = ''; pauseTime = 0;
    elapsed += dt; reportAt += dt;
    if (prior) distance += Math.hypot(host.player.position.x - prior.x, host.player.position.z - prior.z);
    prior = { ...host.player.position };
    if (elapsed > 360) { stop(`FAIL · Timed out at ${steps[index] ?? 'escape'}`); return; }
    host.input.keys.clear();
    if (touchMode && !controlsChecked) {
      checkTime += dt;
      if (checkStage === 0) { startYaw = host.player.yaw; startPitch = host.player.pitch; touch.move(.7, .7); touch.drag(30, -20); touch.sprint(); checkStage = 1; return; }
      if (checkStage === 1 && checkTime > .15) {
        if (host.input.moveX <= 0 || host.input.moveForward <= 0 || host.player.yaw <= startYaw || host.player.pitch <= startPitch || !host.player.moving || !host.player.sprinting) { stop('FAIL · Simultaneous diagonal joystick / camera / sprint'); return; }
        touch.release(true); checkStage = 2; return;
      }
      if (checkStage === 2) {
        if (host.input.moveX || host.input.moveForward) { stop('FAIL · Pointer cancel left movement active'); return; }
        completed.push('multitouch diagonal / look / sprint / cancel'); checkStage = 3; touch.button('Pause'); return;
      }
      if (checkStage === 4) { touch.button('Tab'); return; }
      if (checkStage === 5) { controlsChecked = true; touch.release(); }
      else return;
    }
    if (host.revealing()) return;
    const id = steps[index];
    if (id && done(id)) {
      if (touchMode) {
        touch.move(0, 0);
        if (id === 'flashlight') {
          if (extraStep === 0) { if (touch.button('KeyF')) extraStep = 1; return; }
          if (extraStep === 1) { if (host.player.flashlight) { stop('FAIL · Touch flashlight off'); return; } if (touch.button('KeyF')) extraStep = 2; return; }
          if (!host.player.flashlight) { stop('FAIL · Touch flashlight on'); return; }
          completed.push('touch flashlight off / on');
        }
        if (id === 'tsinelas') {
          if (extraStep === 0) { if (touch.button('Throw')) extraStep = 1; return; }
          if (host.interactions.slipperInHand) { stop('FAIL · Touch throw'); return; }
          completed.push('touch throw');
        }
        if (id === 'hide-guest') touch.button('Hide');
      }
      completed.push(id); index++; extraStep = 0; route = null; settle = 0; return;
    }
    try {
      if (!route) route = id ? approach(id) : host.world.nav.path(host.player.position, { x: -2.5, z: -13.5, level: 0 });
      while (route.length && Math.hypot(route[0].x - host.player.position.x, route[0].z - host.player.position.z) < .09) route.shift();
      if (route.length) {
        const target = route[0]; aim([target.x, target.y + 1.65, target.z]);
        if (touchMode) { touch.move(0, 1); touch.sprint(); }
        else { host.input.keys.add('KeyW'); host.input.keys.add('ShiftLeft'); }
      } else if (id) {
        const h = host.interactions.hotspots.find(h => h.id === id)!; aim(h.position); settle += dt;
        if (touchMode) touch.move(0, 0);
        if (settle > .2) { if (touchMode) touch.button(id === 'hide-guest' ? 'Hide' : 'KeyE'); else host.input.queue('KeyE'); settle = 0; }
      }
      if (reportAt > .5) {
        reportAt = 0; if (elapsed > 5) fps.push(host.world.scene.getEngine().getFps());
        report(`Running · ${id ?? 'Crossing exit'}\nPosition ${host.player.position.x.toFixed(2)}, ${host.player.position.y.toFixed(2)}, ${host.player.position.z.toFixed(2)}`);
      }
    } catch (error) { stop(`FAIL · ${String(error)}`); }
  };
}
