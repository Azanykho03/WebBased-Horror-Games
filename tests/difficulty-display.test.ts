import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { difficultySettings } from '../src/difficulty.ts';
import type { Difficulty } from '../src/difficulty.ts';
import { freshProgress } from '../src/types.ts';
import type { HouseManifest } from '../src/types.ts';
import { parseSave } from '../src/storage.ts';
import { interact } from '../src/objectives.ts';
import { GhostStateMachine } from '../src/ghost.ts';
import { HorrorDirector } from '../src/horror.ts';
import { createNavigation } from '../scripts/3d-generation/house-navigation.mjs';
import { LandscapeFullscreen } from '../src/mobile-display.ts';

const data = JSON.parse(readFileSync('public/assets/models/environments/haunted-house/house-manifest.json', 'utf8')) as HouseManifest;
const nav = createNavigation(data), env = { nav, clearSight: () => true };
const player = { position: { x: 0, y: 0, z: -8, level: 0 as const }, hidden: false, hideExposed: false };
const modes: Difficulty[] = ['easy', 'medium', 'hard'];
test('difficulty persists and old checkpoints become Medium; invalid modes are rejected', () => {
  for (const difficulty of modes) assert.equal(parseSave(JSON.stringify({ version: 1, progress: freshProgress(difficulty) }))?.difficulty, difficulty);
  const legacy = { ...freshProgress(), difficulty: undefined };
  assert.equal(parseSave(JSON.stringify({ version: 1, progress: legacy }))?.difficulty, 'medium');
  assert.equal(parseSave(JSON.stringify({ version: 1, progress: { ...legacy, difficulty: 'impossible' } })), null);
});
test('each mode changes real movement, perception, reaction, capture, stun and resources', () => {
  const travelled: number[] = [], captures: number[] = [];
  for (const difficulty of modes) {
    const p = freshProgress(difficulty), ghost = new GhostStateMachine(); ghost.difficulty = difficulty;
    ghost.reset(true, player.position); assert.equal(ghost.grace, difficultySettings[difficulty].checkpointGrace);
    ghost.position = { x: 0, y: 0, z: -3, level: 0 }; ghost.grace = 0; ghost.yaw = 0;
    for (let i = 0; i < 60; i++) ghost.update(1 / 60, env, player, p, () => {});
    travelled.push(-3 - ghost.position.z); assert.equal(ghost.state, 'Chase');
    ghost.position = { ...player.position }; let capture = 0;
    while (capture < 1 && !ghost.update(.01, env, player, p, () => {})) capture += .01;
    captures.push(capture);
    ghost.reset(true, player.position); assert(ghost.stun());
    ghost.update(difficultySettings[difficulty].stunTime - .01, env, player, p, () => {}); assert.equal(ghost.state, 'Stunned');
    ghost.update(.02, env, player, p, () => {}); assert.equal(ghost.state, 'Search');
    p.battery = 0; interact(p, 'battery-kitchen'); assert.equal(p.battery, difficultySettings[difficulty].batteryPickup);
    ghost.position = { x: 0, y: 0, z: 2, level: 0 }; ghost.yaw = 0;
    assert.equal(ghost.sees(player, env), difficulty === 'hard');
  }
  assert(travelled[0] < travelled[1] && travelled[1] < travelled[2]);
  assert(captures[0] > captures[1] && captures[1] > captures[2]);
});
test('elevated player stays visible and ghost can approach furniture through the normal pathfinder', () => {
  const ghost = new GhostStateMachine(), p = freshProgress();
  const elevated = { ...player, position: { x: 6.15, y: .5, z: -3.3, level: 0 as const } };
  ghost.reset(true, elevated.position); ghost.position = { x: 6.15, y: 0, z: -1.9, level: 0 }; ghost.grace = 0;
  for (let i = 0; i < 120; i++) ghost.update(1 / 60, env, elevated, p, () => {});
  assert(ghost.position.z < -2.2); assert.equal(ghost.state, 'Catch');
});
test('difficulty changes encounter scheduling without disabling suppression', () => {
  const counts = modes.map(difficulty => {
    const director = new HorrorDirector(data, () => .25); director.difficulty = difficulty; director.reset();
    let count = 0;
    const input = { room: 'F01', player: player.position, eye: [0, 1.65, -8] as [number, number, number], direction: [0, 0, -1] as [number, number, number],
      ghost: null, ghostState: 'Dormant' as const, ghostGrace: 0, ghostOccluded: true, hidden: false, sprinting: false, stamina: 6, suppressed: false };
    for (let i = 0; i < 600; i++) count += director.update(1, input).events.filter(e => e.kind !== 'thunder').length;
    assert.equal(director.update(100, { ...input, suppressed: true }).events.length, 0);
    return count;
  });
  assert(counts[0] < counts[1] && counts[1] < counts[2], counts.join(','));
});
test('fullscreen rejection retries once on interaction and never spams resize/taps', async () => {
  let requests = 0, active = false, reject = true;
  const fullscreen = new LandscapeFullscreen({ supported: () => true, fullscreen: () => active,
    request: async () => { requests++; if (reject) throw new Error('activation required'); active = true; } });
  fullscreen.sync(true, false, true); fullscreen.interact(); assert.equal(requests, 0);
  fullscreen.sync(true, true, false); assert.equal(requests, 0);
  fullscreen.sync(true, true, true); await new Promise(resolve => setImmediate(resolve)); assert.equal(requests, 1);
  for (let i = 0; i < 10; i++) fullscreen.sync(true, true, true);
  assert.equal(requests, 1); reject = false; fullscreen.interact(); await new Promise(resolve => setImmediate(resolve));
  assert(active); assert.equal(requests, 2);
  fullscreen.changed(); active = false; fullscreen.changed();
  fullscreen.interact(); fullscreen.sync(true, true, true); assert.equal(requests, 2, 'Manual exit respected');
  fullscreen.sync(false, true, true); fullscreen.sync(true, true, true, true); await new Promise(resolve => setImmediate(resolve));
  assert.equal(requests, 3);
});
test('unsupported fullscreen and repeated denials leave gameplay usable', async () => {
  let requests = 0;
  const fullscreen = new LandscapeFullscreen({ supported: () => true, fullscreen: () => false,
    request: async () => { requests++; throw new Error('policy denied'); } });
  fullscreen.sync(true, true, true); await new Promise(resolve => setImmediate(resolve));
  fullscreen.interact(); await new Promise(resolve => setImmediate(resolve));
  for (let i = 0; i < 100; i++) { fullscreen.sync(true, true, true); fullscreen.interact(); }
  assert.equal(requests, 2);
  const unsupported = new LandscapeFullscreen({ supported: () => false, fullscreen: () => false, request: async () => { requests++; } });
  unsupported.sync(true, true, true, true); assert.equal(requests, 2);
});
