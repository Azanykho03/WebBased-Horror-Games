import test from 'node:test';
import type { TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { BackgroundMusic } from '../src/music.ts';

function fixture(t: TestContext) {
  const instances: FakeMedia[] = [];
  class FakeMedia {
    loop = false; preload = ''; src = ''; currentTime = 0; paused = true; error = null;
    playCalls = 0; loadCalls = 0;
    nextPlay: Promise<void> | null = null;
    constructor() { instances.push(this); }
    setAttribute() {}
    removeAttribute() { this.src = ''; }
    play() { this.playCalls++; this.paused = false; return this.nextPlay ?? Promise.resolve(); }
    pause() { this.paused = true; }
    load() { this.loadCalls++; }
  }
  t.mock.method(globalThis, 'Audio', function () { return new FakeMedia() as unknown as HTMLAudioElement; });
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const node = { connect() {}, disconnect() {} };
  const context = { currentTime: 0, state: 'running',
    createGain: () => ({ ...node, gain: { value: 0, cancelScheduledValues() {}, setValueAtTime() {}, linearRampToValueAtTime() {} } }),
    createMediaElementSource: () => ({ ...node }),
  };
  const music = new BackgroundMusic(context as unknown as AudioContext, node as unknown as AudioNode, { menu: '/menu.mp3', game: '/game.mp3' });
  const advance = (seconds: number) => { context.currentTime += seconds; t.mock.timers.tick(seconds * 1000); };
  t.after(() => music.dispose());
  return { music, media: instances[0], instances, context, advance };
}

// Node has no Audio constructor; each test replaces this stub with its own media
// stand-in. Browser validation separately exercises actual MP3s and the mixer.
Object.defineProperty(globalThis, 'Audio', { value: function Audio() {}, configurable: true, writable: true });
const settled = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };

test('music fades the old recording to silence before switching a single looping player', async t => {
  const { music, media, instances, advance } = fixture(t);
  music.select('menu');
  assert.equal(media.playCalls, 0, 'selection alone must not autoplay');
  music.resume(); await settled(); advance(.8);
  assert.equal(media.src, '/menu.mp3'); assert.equal(media.loop, true);
  assert.equal(music.diagnostics.gain, 1);
  music.select('game'); advance(.4);
  assert.equal(media.src, '/menu.mp3'); assert.ok(Math.abs(music.diagnostics.gain - .5) < .001);
  advance(.4); await settled();
  assert.equal(media.src, '/game.mp3'); assert.equal(music.diagnostics.gain, 0);
  advance(.4); assert.ok(Math.abs(music.diagnostics.gain - .5) < .001);
  advance(.4); assert.ok(music.diagnostics.gain > .999);
  assert.equal(instances.length, 1); assert.equal(media.playCalls, 2);
});

test('repeated gestures and unchanged selections preserve playback and pending fades', async t => {
  const { music, media, advance } = fixture(t);
  music.select('menu'); music.resume(); await settled(); advance(1);
  media.currentTime = 24;
  for (let i = 0; i < 20; i++) { music.select('menu'); music.resume(); }
  assert.equal(media.currentTime, 24); assert.equal(media.playCalls, 1);
  music.select('game'); advance(.4);
  for (let i = 0; i < 20; i++) { music.select('game'); music.resume(); }
  advance(.4); await settled();
  assert.equal(media.src, '/game.mp3'); assert.equal(media.playCalls, 2);
});

test('returning to menu during fade-out cancels the obsolete game switch smoothly', async t => {
  const { music, media, advance } = fixture(t);
  music.select('menu'); music.resume(); await settled(); advance(1);
  music.select('game'); advance(.4);
  const level = music.diagnostics.gain;
  music.select('menu'); assert.equal(music.diagnostics.gain, level);
  advance(2);
  assert.equal(media.src, '/menu.mp3'); assert.equal(media.playCalls, 1); assert.equal(music.diagnostics.gain, 1);
});

test('pause keeps position, cancels delayed switches and only resumes the latest selection', async t => {
  const { music, media, advance } = fixture(t);
  music.select('menu'); music.resume(); await settled(); advance(1);
  media.currentTime = 31; music.pause(); advance(3);
  assert.equal(media.paused, true); assert.equal(media.currentTime, 31);
  music.resume(); await settled(); advance(1);
  assert.equal(media.currentTime, 31); assert.equal(music.diagnostics.playing, true);
  music.select('game'); advance(.3); music.pause(); advance(3);
  assert.equal(media.src, '/menu.mp3'); assert.equal(media.paused, true);
  music.resume(); await settled(); advance(1);
  assert.equal(media.src, '/game.mp3'); assert.equal(music.diagnostics.gain, 1);
});

test('an interrupted audio clock cannot finish a fade just because wall time passed', async t => {
  const { music, media, context, advance } = fixture(t);
  music.select('menu'); music.resume(); await settled(); advance(1);
  music.select('game'); context.state = 'suspended';
  t.mock.timers.tick(2000);
  assert.equal(media.src, '/menu.mp3'); assert.equal(music.diagnostics.playing, false);
  context.state = 'running'; advance(1); await settled();
  assert.equal(media.src, '/game.mp3');
});

test('a rejected autoplay request can retry on the next gesture without new players', async t => {
  const { music, media, instances } = fixture(t);
  const error = new Error('Gesture needed'); error.name = 'NotAllowedError';
  media.nextPlay = Promise.reject(error);
  music.select('menu'); music.resume(); media.paused = true; await settled();
  assert.equal(music.diagnostics.error, 'NotAllowedError');
  media.nextPlay = null; music.resume(); await settled();
  assert.equal(music.diagnostics.error, null); assert.equal(music.diagnostics.playing, true);
  assert.equal(media.playCalls, 2); assert.equal(instances.length, 1);
});

test('late play promises after pause or disposal cannot restart a song or restore gain', async t => {
  const { music, media, advance } = fixture(t);
  let finish!: () => void;
  media.nextPlay = new Promise<void>(resolve => { finish = resolve; });
  music.select('menu'); music.resume(); music.pause(); finish(); await settled(); advance(2);
  assert.equal(media.paused, true); assert.equal(music.diagnostics.gain, 0);
  media.nextPlay = null; music.resume(); await settled(); advance(1);
  music.select('game'); music.dispose(); advance(2); await settled();
  assert.equal(media.src, ''); assert.equal(media.paused, true); assert.equal(music.diagnostics.track, null);
  music.resume(); assert.equal(media.paused, true);
});
