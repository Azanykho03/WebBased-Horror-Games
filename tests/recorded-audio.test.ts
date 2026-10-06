import test from 'node:test';
import type { TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { RecordedAudio, proximityLevel } from '../src/recorded-audio.ts';
import { CORAZON_AUDIO } from '../src/config.ts';

function fixture(t: TestContext, loop = true) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const sources: { loop: boolean; stopped: boolean; offset: number; onended: (() => void) | null }[] = [];
  const context = { currentTime: 0, state: 'running',
    createGain: () => ({ connect() {}, disconnect() {}, gain: { value: 0, cancelScheduledValues() {}, setValueAtTime() {}, linearRampToValueAtTime() {} } }),
    createBufferSource: () => {
      const source = { loop: false, stopped: false, offset: 0, onended: null as (() => void) | null,
        connect() {}, disconnect() {}, start(_time: number, offset: number) { this.offset = offset; }, stop() { this.stopped = true; } };
      sources.push(source); return source;
    },
  };
  const clip = new RecordedAudio(context as unknown as AudioContext, {} as AudioNode, loop);
  const buffer = { duration: 6 } as AudioBuffer;
  const advance = (seconds: number) => { context.currentTime += seconds; t.mock.timers.tick(seconds * 1000); };
  t.after(() => clip.dispose());
  return { clip, context, buffer, sources, advance };
}

test('one loop survives repeated updates and a reversed fade without overlapping sources', t => {
  const { clip, buffer, sources, advance } = fixture(t);
  clip.setBuffer(buffer); clip.setLevel(.3, .8); advance(1);
  for (let i = 0; i < 30; i++) clip.setLevel(.3, .8);
  assert.equal(sources.length, 1); assert.equal(sources[0].loop, true);
  clip.setLevel(0, .8); advance(.4); assert.ok(Math.abs(clip.diagnostics.gain - .15) < .001);
  clip.setLevel(.3, .8); advance(2);
  assert.equal(sources.length, 1); assert.equal(sources[0].stopped, false);
  clip.setLevel(0, .8); advance(1);
  assert.equal(clip.diagnostics.sources, 0); assert.equal(sources[0].stopped, true);
  clip.setLevel(.3, .8); assert.equal(sources.length, 2);
  assert.equal(clip.diagnostics.sources, 1);
});

test('a suspended audio clock cannot finish a fade or advance a clip', t => {
  const { clip, context, buffer, sources, advance } = fixture(t);
  clip.setBuffer(buffer); clip.setLevel(.3, .8); advance(1); clip.setLevel(0, .8);
  context.state = 'suspended'; const position = clip.diagnostics.time;
  t.mock.timers.tick(2000);
  assert.equal(clip.diagnostics.playing, false); assert.equal(clip.diagnostics.time, position);
  assert.equal(sources[0].stopped, false);
  context.state = 'running'; advance(1); assert.equal(sources[0].stopped, true);
});

test('late or unavailable buffers cannot start a previously requested sound', t => {
  const { clip, buffer, sources } = fixture(t, false);
  clip.setLevel(.8, 0); clip.setBuffer(buffer);
  assert.equal(sources.length, 0, 'a late jumpscare must never replay');
  clip.setBuffer(null); clip.setLevel(.8, 0);
  assert.equal(clip.diagnostics.status, 'unavailable'); assert.equal(sources.length, 0);
  clip.dispose(); clip.setBuffer(buffer); clip.setLevel(.8, 0);
  assert.equal(sources.length, 0);
});

test('a one-shot never loops, stacks, or retains its source after ending', t => {
  const { clip, buffer, sources, advance } = fixture(t, false);
  clip.setBuffer(buffer); clip.setLevel(.8, .006);
  for (let i = 0; i < 20; i++) clip.setLevel(.8, .006);
  assert.equal(sources.length, 1); assert.equal(sources[0].loop, false);
  advance(6); sources[0].onended!();
  assert.equal(clip.diagnostics.sources, 0); assert.equal(clip.diagnostics.gain, 0);
});

test('proximity has separate entry and exit thresholds and monotonic intensity', () => {
  const tune = CORAZON_AUDIO.proximity;
  assert.equal(proximityLevel(8.1, false, tune).nearby, false);
  assert.equal(proximityLevel(8, false, tune).nearby, true);
  for (const distance of [7.9, 8.1, 9, 8, 10.9, 11]) assert.equal(proximityLevel(distance, true, tune).nearby, true);
  assert.equal(proximityLevel(11.1, true, tune).nearby, false);
  assert.equal(proximityLevel(Infinity, true, tune).volume, 0);
  assert.equal(proximityLevel(NaN, true, tune).volume, 0);
  assert.ok(proximityLevel(3, true, tune).volume > proximityLevel(7, true, tune).volume);
  assert.equal(proximityLevel(0, true, tune).volume, tune.volume);
});

test('the scare starts at the measured impact and stops with no live tail', t => {
  const { clip, buffer, sources, advance } = fixture(t, false);
  clip.setBuffer(buffer); clip.setLevel(.85, .003, CORAZON_AUDIO.jumpscare.offset);
  assert.equal(sources[0].offset, .2); assert.equal(clip.diagnostics.time, .2);
  advance(1.5); clip.stop();
  assert(sources[0].stopped); assert.equal(clip.diagnostics.sources, 0); assert.equal(clip.diagnostics.gain, 0);
  clip.setLevel(.85, .003, CORAZON_AUDIO.jumpscare.offset);
  assert.equal(clip.diagnostics.sources, 1); assert.equal(sources[1].offset, .2);
});
