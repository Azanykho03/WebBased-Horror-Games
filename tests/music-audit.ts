import { AudioSystem } from '../src/audio.ts';
import { MUSIC_AUDIO } from '../src/config.ts';
import { DEFAULT_SETTINGS } from '../src/types.ts';
import type { MusicTrack } from '../src/music.ts';

// Validation-only controls: use real recordings, the real mixer and a trusted
// button gesture. No autoplay-policy override or simulated audio output.
export function attachMusicAudit(panel: Element, pauseGame: () => void): void {
  const button = document.createElement('button'); button.textContent = 'Check background music';
  const status = document.createElement('pre'); status.setAttribute('aria-label', 'Music audit result'); status.style.whiteSpace = 'pre-wrap';
  panel.append(button, status);
  button.addEventListener('click', async () => {
    pauseGame(); button.disabled = true; status.textContent = 'Checking supplied MP3 playback…';
    const settings = { ...DEFAULT_SETTINGS, volume: .08, music: .65 };
    const audio = new AudioSystem(settings);
    const mixer = () => audio as unknown as { context: AudioContext; master: GainNode; buses: Record<string, GainNode>; background: { media: HTMLAudioElement } };
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    const check = (condition: boolean, message: string) => { if (!condition) throw new Error(message); };
    const until = async (condition: () => boolean, message: string) => {
      const deadline = performance.now() + 15000;
      while (!condition()) { if (performance.now() > deadline) throw new Error(message); await delay(40); }
    };
    let analyser: AnalyserNode | undefined;
    try {
      audio.setMusic('menu'); audio.start();
      await until(() => audio.state === 'running' && Boolean(audio.diagnostics.background?.playing), 'First gesture failed to unlock music');
      const context = mixer().context, media = mixer().background.media;
      analyser = context.createAnalyser(); analyser.fftSize = 2048; mixer().master.connect(analyser);
      const samples = new Float32Array(analyser.fftSize);
      const peak = async () => {
        let maximum = 0;
        for (let i = 0; i < 30; i++) {
          analyser!.getFloatTimeDomainData(samples);
          for (const sample of samples) maximum = Math.max(maximum, Math.abs(sample));
          await delay(20);
        }
        return maximum;
      };
      const audiblePeak = async (label: string) => {
        // Keep the supplied opening intact, including any encoded silence. A
        // short initial analyser window alone cannot establish a silent track.
        for (let i = 0; i < 15; i++) { const value = await peak(); if (value > .000001) return value; }
        throw new Error(`${label} produced no mixer output after 9 seconds`);
      };
      const ready = async (track: MusicTrack) => {
        await until(() => audio.diagnostics.background?.track === track && audio.diagnostics.background.playing
          && audio.diagnostics.background.gain > .999 && media.currentTime > .2, `${track} music did not finish fading in`);
        check(decodeURIComponent(media.currentSrc).endsWith(MUSIC_AUDIO[track]), `Wrong ${track} recording`);
        check(media.loop && media === mixer().background.media, 'Music player was duplicated or stopped looping');
      };
      const loop = async () => {
        check(Number.isFinite(media.duration) && media.duration > 1, 'MP3 duration is unavailable');
        media.currentTime = media.duration - .3;
        await until(() => media.currentTime < 2 && !media.paused, 'Recording did not loop at its end');
      };
      await ready('menu');
      const menuPeak = await audiblePeak('MELANCHOLIA');
      await loop();
      audio.setMusic('game'); await delay(200);
      check(audio.diagnostics.background?.track === 'menu' && audio.diagnostics.background.gain > 0
        && audio.diagnostics.background.gain < 1, 'Menu music did not fade out before switching');
      await ready('game');
      const gamePeak = await audiblePeak('ILI ILI');
      await loop();
      status.textContent = 'Both MP3s play and loop; checking mixer and pause…';
      audio.apply({ ...settings, music: 0 }); await delay(900);
      check(mixer().buses.music.gain.value < .001 && await peak() < gamePeak * .01, 'Music volume failed to mute the recording');
      audio.apply({ ...settings, volume: 0 }); await delay(900);
      check(mixer().master.gain.value < .001 && await peak() < gamePeak * .01, 'Master volume failed to mute the recording');
      audio.apply(settings); await delay(900);
      await audiblePeak('Unmuted music');
      audio.pause(); await delay(80); const pausedAt = media.currentTime;
      await delay(250);
      check(media.paused && audio.state === 'suspended' && Math.abs(media.currentTime - pausedAt) < .02, 'Pause did not freeze the recording');
      audio.start(); await ready('game');
      check(media.currentTime >= pausedAt && media.currentTime < pausedAt + 3, 'Resume restarted or skipped the track');
      const before = media.currentTime;
      for (let i = 0; i < 8; i++) { audio.reset(); audio.start(); audio.setMusic('game'); }
      check(media.currentTime >= before && mixer().context === context, 'Retry duplicated or restarted music');
      audio.setMusic('menu'); await ready('menu');
      audio.setMusic('game'); audio.dispose(); await delay(1000);
      check(media.paused && !media.getAttribute('src') && context.state === 'closed', 'Dispose left media or a delayed switch alive');
      status.textContent = `PASS · Actual supplied MP3s\nMELANCHOLIA → ILI ILI → menu\nBoth recordings loop · one streaming player\n0.8 s fade out / fade in\nMusic + master mute independently\nPause freezes position · resume + 8 resets\nDispose during fade clears media\nOutput peaks: ${menuPeak.toFixed(6)} / ${gamePeak.toFixed(6)}`;
    } catch (error) { status.textContent = `FAIL · ${String(error)}\n${JSON.stringify(audio.diagnostics.background)}`; }
    finally { analyser?.disconnect(); audio.dispose(); button.disabled = false; }
  });
}
