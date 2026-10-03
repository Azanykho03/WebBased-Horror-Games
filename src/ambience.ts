// The supplied WAV fades in over its first second and out after 74 seconds.
// Bake a three-second equal-power overlap into its steady interior once, so a
// single native Web Audio loop needs no timers or overlapping playback sources.
// The original recording on disk is never modified.
export function createAmbienceLoop(context: Pick<BaseAudioContext, 'createBuffer'>, recording: AudioBuffer): AudioBuffer {
  const rate = recording.sampleRate;
  const start = Math.round(rate), end = Math.min(recording.length, Math.round(74 * rate));
  const overlap = Math.min(Math.round(3 * rate), Math.floor((end - start) / 4));
  if (overlap < 2) throw new Error('Ambience recording is too short to loop');
  const length = end - start - overlap;
  const loop = context.createBuffer(recording.numberOfChannels, length, rate);
  for (let channel = 0; channel < recording.numberOfChannels; channel++) {
    const input = recording.getChannelData(channel), output = loop.getChannelData(channel);
    output.set(input.subarray(start + overlap, end));
    for (let i = 0; i < overlap; i++) {
      const phase = i / (overlap - 1) * Math.PI / 2;
      output[length - overlap + i] = input[end - overlap + i] * Math.cos(phase) + input[start + i] * Math.sin(phase);
    }
  }
  return loop;
}

// Before the existing Ambience slider, ducking and master limiter. The low-pass
// filter further softens the bed beneath the music box and foreground sounds.
export const HORROR_AMBIENCE_LEVEL = .055;
