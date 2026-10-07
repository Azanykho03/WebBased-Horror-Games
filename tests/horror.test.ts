import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HorrorDirector, ghostProximity, soundDirection, surfaceForRoom } from '../src/horror.ts';
import type { HorrorInput, HauntKind } from '../src/horror.ts';
import { DEFAULT_SETTINGS } from '../src/types.ts';
import type { HouseManifest } from '../src/types.ts';
import { parseSettings } from '../src/storage.ts';
import { detectTouch, joystickVector } from '../src/touch.ts';
import { PerformanceProfile } from '../src/performance.ts';

const data = JSON.parse(readFileSync('public/assets/models/environments/haunted-house/house-manifest.json', 'utf8')) as HouseManifest;
const input = (): HorrorInput => ({ room: 'F01', player: { x: 0, y: 0, z: -5, level: 0 }, eye: [0, 1.65, -5], direction: [0, 0, -1], ghost: null, ghostState: 'Dormant', ghostGrace: 0, ghostOccluded: true, hidden: false, sprinting: false, stamina: 6, suppressed: false });
const rng = () => { let n = 42; return () => ((n = Math.imul(n, 1664525) + 1013904223 | 0) >>> 0) / 4294967296; };

test('proximity uses walls and floors; direction captions follow camera orientation', () => {
  const p = input().player, close = { ...p, z: -7 };
  assert.equal(ghostProximity(p, null, false), 0);
  assert(ghostProximity(p, close, false) > ghostProximity(p, close, true));
  assert(ghostProximity(p, close, true) > ghostProximity(p, { ...close, y: 6.48 }, true));
  assert.equal(soundDirection([0, 1.65, 0], [0, 0, -1], [3, 1, 0]), 'to your right');
  assert.equal(soundDirection([0, 1.65, 0], [0, 0, -1], [0, 1, 3]), 'behind you');
  assert.equal(soundDirection([0, 1.65, 0], [0, 0, -1], [0, 4, -3]), 'upstairs');
});
test('soundtrack detects once, enters chase, quiets while hiding, and recovers gradually', () => {
  const director = new HorrorDirector(data, rng()), state = input(); director.reset();
  state.ghost = { ...state.player, z: -7 }; state.ghostState = 'Chase';
  assert.equal(director.update(.05, state).atmosphere.state, 'CELESTINA_DETECTED_PLAYER');
  for (let i = 0; i < 100; i++) director.update(.05, state);
  assert.equal(director.atmosphere.state, 'CHASE'); assert(director.atmosphere.fear > .95);
  state.hidden = true; state.ghostState = 'Search';
  assert.equal(director.update(.05, state).atmosphere.state, 'HIDING');
  state.ghost = null; state.hidden = false; state.ghostState = 'Patrol';
  const before = director.atmosphere.fear; director.update(.05, state);
  assert(director.atmosphere.fear > before * .9, 'fear must not collapse on the first escape frame');
  for (let i = 0; i < 800; i++) director.update(.05, state);
  assert(director.atmosphere.fear < .02);
  director.scare(.7); assert.equal(director.update(.1, state).atmosphere.state, 'JUMPSCARE');
  assert.equal(director.update(1, state).atmosphere.state, 'POST_JUMPSCARE');
});
test('haunts are bounded, non-repeating, room-aware and suppressed during chases or checkpoint grace', () => {
  const director = new HorrorDirector(data, rng()), state = input(), recent: HauntKind[] = [], seen = new Set<HauntKind>();
  director.reset(); let last = -100, count = 0;
  for (let t = 0; t < 1800; t += .5) {
    for (const event of director.update(.5, state).events) {
      assert(event.position.every(Number.isFinite));
      if (event.kind === 'thunder' || event.kind === 'whisper' && t - last < 8) continue;
      assert(t - last >= 20, 'ambient events cannot spam'); last = t; count++;
      assert(!recent.includes(event.kind)); recent.push(event.kind); if (recent.length > 4) recent.shift(); seen.add(event.kind);
    }
  }
  assert(count > 20 && count < 75); assert(seen.size >= 7);
  state.ghostState = 'Chase';
  for (let i = 0; i < 100; i++) assert.equal(director.update(1, state).events.length, 0);
  director.reset(); state.ghostState = 'Patrol'; state.ghostGrace = 12;
  for (let i = 0; i < 100; i++) assert(director.update(1, state).events.every(e => e.kind === 'thunder'));
  director.reset(); state.suppressed = true;
  for (let i = 0; i < 100; i++) assert.equal(director.update(1, state).events.length, 0);
  director.reset(); assert.equal(director.atmosphere.fear, 0); assert.equal(director.atmosphere.silence, 0);
});
test('silence schedules one delayed whisper and reset removes pending activity', () => {
  const director = new HorrorDirector(data, rng()), state = input(); director.reset();
  let silence = false, whisper = false;
  for (let i = 0; i < 1200; i++) {
    const result = director.update(.5, state);
    if (result.events.some(e => e.kind === 'silence')) silence = true;
    if (silence && result.events.some(e => e.kind === 'whisper')) { whisper = true; break; }
  }
  assert(silence && whisper);
  director.reset(); for (let i = 0; i < 10; i++) assert.equal(director.update(1, state).events.length, 0);
});
test('surface palette matches house floors and settings migrate without discarding saved preferences', () => {
  assert.equal(surfaceForRoom('F03'), 'wood'); assert.equal(surfaceForRoom('F09'), 'tile');
  assert.equal(surfaceForRoom('U01', { x: 8, y: 3.24, z: -1, level: 1 }), 'tile');
  assert.equal(surfaceForRoom('OUT'), 'concrete');
  const s = parseSettings('{"volume":0.3,"ambience":0,"sensitivity":1.5,"music":2,"effects":0,"voice":0.7,"touchSensitivity":99}');
  assert.equal(s.volume, .3); assert.equal(s.music, DEFAULT_SETTINGS.music); assert.equal(s.ambience, 0); assert.equal(s.effects, 0); assert.equal(s.voice, .7); assert.equal(s.touchSensitivity, 1); assert.equal(s.quality, 'auto');
});
test('joystick deadzone and diagonal strength are bounded; auto resolution adapts with hysteresis', () => {
  assert.deepEqual(joystickVector(2, 2, 50), [0, 0]);
  assert.deepEqual(joystickVector(0, -50, 50), [0, 1]);
  const diagonal = joystickVector(50, -50, 50); assert(Math.abs(Math.hypot(...diagonal) - 1) < 1e-6);
  assert(joystickVector(25, 0, 50)[0] < .6);
  const profile = new PerformanceProfile(); assert(profile.low(DEFAULT_SETTINGS, true)); assert(!profile.low(DEFAULT_SETTINGS, false));
  assert.equal(profile.scale(DEFAULT_SETTINGS, true, 4), 1.25);
  for (let i = 0; i < 220; i++) profile.update(.05, DEFAULT_SETTINGS, true);
  assert(profile.scale(DEFAULT_SETTINGS, true, 4) > 1.25);
  for (let i = 0; i < 3000; i++) profile.update(1 / 60, DEFAULT_SETTINGS, true);
  assert.equal(profile.scale(DEFAULT_SETTINGS, true, 4), 1.25);
});

test('automatic touch controls use pointer capability rather than a user-agent string', () => {
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const originalMedia = Object.getOwnPropertyDescriptor(globalThis, 'matchMedia');
  let coarse = true, hover = false;
  try {
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { maxTouchPoints: 5, userAgent: 'arbitrary' } });
    Object.defineProperty(globalThis, 'matchMedia', { configurable: true, value: (query: string) => ({ matches: query === '(pointer: coarse)' ? coarse : hover }) });
    assert.equal(detectTouch(), true);
    coarse = false; assert.equal(detectTouch(), false);
    hover = true; assert.equal(detectTouch(), true);
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { maxTouchPoints: 0, userAgent: 'Android' } });
    assert.equal(detectTouch(), false);
  } finally {
    if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator); else Reflect.deleteProperty(globalThis, 'navigator');
    if (originalMedia) Object.defineProperty(globalThis, 'matchMedia', originalMedia); else Reflect.deleteProperty(globalThis, 'matchMedia');
  }
});
