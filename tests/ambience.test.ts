import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createAmbienceLoop } from '../src/ambience.ts';

function buffer(channels: number, length: number, sampleRate: number): AudioBuffer {
  const samples = Array.from({ length: channels }, () => new Float32Array(length));
  return { numberOfChannels: channels, length, sampleRate, duration: length / sampleRate,
    getChannelData: (channel: number) => samples[channel] } as AudioBuffer;
}

// Exercise the actual supplied PCM, including its quiet outro, rather than a
// mock waveform that might hide a gap or click in the intended recording.
const wav = readFileSync(new URL('../public/assets/audio/mixkit-horror-ambience-2482.wav', import.meta.url));
let format = 0, pcm = Buffer.alloc(0);
for (let offset = 12; offset + 8 <= wav.length;) {
  const size = wav.readUInt32LE(offset + 4), id = wav.toString('ascii', offset, offset + 4);
  if (id === 'fmt ') format = offset + 8;
  if (id === 'data') pcm = wav.subarray(offset + 8, offset + 8 + size);
  offset += 8 + size + (size % 2);
}
assert.equal(wav.readUInt16LE(format), 1, 'Expected PCM WAV');
assert.equal(wav.readUInt16LE(format + 14), 16, 'Expected 16-bit samples');
const channels = wav.readUInt16LE(format + 2), rate = wav.readUInt32LE(format + 4);
const recording = buffer(channels, pcm.length / (channels * 2), rate);
for (let channel = 0; channel < channels; channel++) {
  const data = recording.getChannelData(channel);
  for (let i = 0; i < data.length; i++) data[i] = pcm.readInt16LE((i * channels + channel) * 2) / 32768;
}
const loop = createAmbienceLoop({ createBuffer: buffer }, recording);

test('supplied ambience retains stereo and has no silent windows or clipped samples across the loop', () => {
  assert.equal(loop.numberOfChannels, 2); assert.equal(loop.sampleRate, rate);
  assert.ok(loop.duration > 60 && loop.duration < recording.duration);
  for (let channel = 0; channel < channels; channel++) {
    const data = loop.getChannelData(channel), window = Math.round(rate * .1);
    for (let start = 0; start < data.length; start += window) {
      let energy = 0;
      for (let i = 0; i < window; i++) {
        const sample = data[(start + i) % data.length];
        assert.ok(Number.isFinite(sample) && Math.abs(sample) < 1, 'Invalid/clipped loop sample'); energy += sample * sample;
      }
      assert.ok(Math.sqrt(energy / window) > .015, 'Loop contains a quiet gap');
    }
    const jump = Math.abs(data[0] - data[data.length - 1]);
    let nearbyJump = 0;
    for (let i = 1; i < window; i++) nearbyJump = Math.max(nearbyJump, Math.abs(data[i] - data[i - 1]));
    assert.ok(jump <= nearbyJump, `Loop seam introduces a click: ${jump}`);
  }
});

test('preparing the loop does not alter the supplied recording or its quiet outro', () => {
  assert.notEqual(loop, recording);
  for (let channel = 0; channel < channels; channel++) {
    const data = recording.getChannelData(channel);
    for (let i = 0; i < data.length; i++) assert.equal(data[i], pcm.readInt16LE((i * channels + channel) * 2) / 32768);
  }
});

test('invalid short ambience cannot create a zero-length or broken loop', () => {
  assert.throws(() => createAmbienceLoop({ createBuffer: buffer }, buffer(2, rate, rate)), /too short/);
});
