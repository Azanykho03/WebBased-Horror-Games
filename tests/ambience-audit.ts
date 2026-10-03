import { AudioSystem } from '../src/audio.ts';
import { HORROR_AMBIENCE_LEVEL } from '../src/ambience.ts';
import { MUSIC_AUDIO } from '../src/config.ts';
import { calmAtmosphere } from '../src/horror.ts';
import { DEFAULT_SETTINGS } from '../src/types.ts';
import type { AudioFrame } from '../src/audio.ts';

// Validation-only UI: real assets, real Web Audio, normal user activation.
export function attachAmbienceAudit(panel: Element, pauseGame: () => void): void {
  const button = document.createElement('button'); button.textContent = 'Check layered ambience';
  const status = document.createElement('pre'); status.setAttribute('aria-label', 'Ambience audit result'); status.style.whiteSpace = 'pre-wrap';
  panel.append(button, status);
  button.addEventListener('click', async () => {
    pauseGame(); button.disabled = true; status.textContent = 'Checking ILI ILI + Mixkit in the shared mixer…';
    const settings = { ...DEFAULT_SETTINGS, volume: .12 };
    const audio = new AudioSystem(settings);
    const mixer = () => audio as unknown as { context: AudioContext; master: GainNode; buses: Record<string, GainNode>;
      background: { media: HTMLAudioElement; gain: GainNode }; horrorAmbience: GainNode; ambienceSource: AudioBufferSourceNode };
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    const check = (ok: boolean, message: string) => { if (!ok) throw new Error(message); };
    const until = async (condition: () => boolean, message: string) => {
      const end = performance.now() + 20000;
      while (!condition()) { if (performance.now() > end) throw new Error(message); await delay(50); }
    };
    const frame: AudioFrame = { atmosphere: calmAtmosphere(), eye: [0, 1.65, 0], direction: [0, 0, -1], room: 'F01',
      ghost: null, ghostOccluded: false, ghostMoving: false, rainExposure: 0, window: null };
    let tick: ReturnType<typeof setInterval> | undefined;
    const analysers: AnalyserNode[] = [];
    try {
      audio.setMusic('game');
      check(audio.state === 'uninitialized' && !audio.diagnostics.ambience.playing, 'Selecting a track started audio without activation');
      audio.start();
      let last = performance.now();
      tick = setInterval(() => { const now = performance.now(); audio.update((now - last) / 1000, frame); last = now; }, 40);
      await until(() => audio.diagnostics.ambience.playing && audio.diagnostics.ambience.gain > HORROR_AMBIENCE_LEVEL * .99, 'Both layers did not start after the gesture');
      const { context, background, ambienceSource } = mixer(), media = background.media;
      check(decodeURIComponent(media.currentSrc).endsWith(MUSIC_AUDIO.game), 'Existing ILI ILI recording was changed');
      check(audio.diagnostics.permanentSources === 12 && ambienceSource.loop, 'Expected exactly one additional looping source');
      const analyse = (node: AudioNode) => { const a = context.createAnalyser(); a.fftSize = 2048; node.connect(a); analysers.push(a); return a; };
      const music = analyse(background.gain), ambience = analyse(mixer().horrorAmbience), master = analyse(mixer().master);
      const effects = analyse(mixer().buses.effects), voice = analyse(mixer().buses.voice);
      const measure = async (a: AnalyserNode, milliseconds = 600) => {
        const data = new Float32Array(a.fftSize); let peak = 0, energy = 0, count = 0;
        for (let end = performance.now() + milliseconds; performance.now() < end; ) {
          a.getFloatTimeDomainData(data);
          for (const s of data) { peak = Math.max(peak, Math.abs(s)); energy += s * s; count++; }
          await delay(25);
        }
        return { peak, rms: Math.sqrt(energy / Math.max(1, count)) };
      };
      // Sample beyond the preserved MP3 opening, without seeking or restarting it.
      await until(() => media.currentTime > 7, 'ILI ILI playback clock did not advance');
      const [musicLevel, ambienceLevel, mixLevel] = await Promise.all([measure(music, 3000), measure(ambience, 3000), measure(master, 3000)]);
      check(musicLevel.rms > .0001 && ambienceLevel.rms > .0001, 'A background layer produced no actual samples');
      check(ambienceLevel.rms * settings.ambience < musicLevel.rms * settings.music, 'Ambience is louder than the music box');
      check(mixLevel.peak > .0001 && mixLevel.peak < .95, 'Mixed output is silent or clipping');
      status.textContent = 'Both layers produce audio; checking loop seam, ducking and effects…';

      // Render a real native loop boundary at normal speed with the prepared WAV.
      const loop = ambienceSource.buffer!, offline = new OfflineAudioContext(2, loop.sampleRate * 2, loop.sampleRate);
      const source = offline.createBufferSource(); source.buffer = loop; source.loop = true; source.connect(offline.destination);
      source.start(0, loop.duration - .75);
      const rendered = await offline.startRendering(), seam = Math.round(.75 * loop.sampleRate);
      let seamJump = 0;
      for (let channel = 0; channel < 2; channel++) {
        const data = rendered.getChannelData(channel);
        seamJump = Math.max(seamJump, Math.abs(data[seam] - data[seam - 1]));
        for (let start = 0; start < data.length; start += Math.round(loop.sampleRate * .05)) {
          const window = data.subarray(start, start + Math.round(loop.sampleRate * .05));
          check(Math.sqrt(window.reduce((sum, s) => sum + s * s, 0) / window.length) > .01, 'Native loop boundary has a gap');
        }
      }
      check(seamJump < .05, 'Native loop boundary has a click');

      audio.voice('hum'); await delay(350);
      check(audio.diagnostics.ducking.music < .5 && audio.diagnostics.ducking.ambience < .48, 'Dialogue did not duck both layers promptly');
      check((await measure(voice, 350)).peak > .0001, 'Ghost vocal disappeared from the mix');
      audio.effect('sting'); await delay(140);
      check(audio.diagnostics.ducking.music < .13 && audio.diagnostics.ducking.ambience < .13, 'Jumpscare did not duck both layers');
      check((await measure(effects, 200)).peak > .0001, 'Jumpscare effect disappeared');
      await delay(1000);
      check(audio.diagnostics.ducking.music < .55 && audio.diagnostics.ducking.ambience < .5, 'Scare release overrode ongoing dialogue');
      audio.voice(); frame.atmosphere.state = 'CHASE'; await delay(2400);
      check(Math.abs(audio.diagnostics.ducking.music - .7) < .04 && Math.abs(audio.diagnostics.ducking.ambience - .35) < .04, 'Chase did not duck both layers');
      frame.atmosphere.state = 'CALM_EXPLORATION'; await delay(240);
      check(audio.diagnostics.ducking.music > .7 && audio.diagnostics.ducking.music < .95, 'Ducking release was not gradual');
      await delay(2800);
      check(audio.diagnostics.ducking.music > .98 && audio.diagnostics.ducking.ambience > .98, 'Ducking did not recover');
      audio.footstep('wood', true); audio.effect('latch');
      check((await measure(effects, 160)).peak > .0001 && mixer().buses.voice.gain.value > .79, 'Foreground effects or voice gain changed');

      audio.apply({ ...settings, ambience: 0 }); await delay(900);
      check(mixer().buses.ambience.gain.value < .001 && mixer().buses.music.gain.value > .49, 'Ambience slider affected music');
      audio.apply({ ...settings, music: 0 }); await delay(900);
      check(mixer().buses.music.gain.value < .001 && mixer().buses.ambience.gain.value > .54, 'Music slider affected ambience');
      audio.apply({ ...settings, volume: 0 }); await delay(900);
      check((await measure(master, 150)).peak < .00001, 'Master mute failed');
      audio.apply(settings);

      audio.pause(); await delay(100);
      const pausedMusic = media.currentTime, pausedAmbience = audio.diagnostics.ambience.time;
      await delay(300);
      check(audio.state === 'suspended' && Math.abs(media.currentTime - pausedMusic) < .02
        && audio.diagnostics.ambience.time === pausedAmbience, 'Pause did not freeze both layers');
      audio.start(); await delay(1200);
      check(audio.diagnostics.ambience.playing && media.currentTime > pausedMusic && media.currentTime < pausedMusic + 2, 'Resume restarted or failed to restore a layer');
      const beforeReset = media.currentTime;
      for (let i = 0; i < 8; i++) { audio.reset(); audio.start(); audio.setMusic('game'); }
      check(audio.diagnostics.permanentSources === 12 && mixer().ambienceSource === ambienceSource
        && mixer().context === context && media.currentTime >= beforeReset, 'Reset duplicated a source or restarted music');
      audio.voice('hum'); await delay(350); audio.reset();
      check(audio.diagnostics.ducking.music < .5 && audio.diagnostics.ducking.ambience < .48, 'Reset abruptly restored background volume');
      await delay(2600);
      check(audio.diagnostics.ducking.music > .97 && audio.diagnostics.ducking.ambience > .97, 'Reset did not smoothly release ducking');
      audio.setMusic('menu'); await delay(200);
      check(audio.diagnostics.ambience.gain > 0 && audio.diagnostics.ambience.gain < HORROR_AMBIENCE_LEVEL * .5, 'Menu transition did not fade out ambience');
      await until(() => audio.diagnostics.background?.track === 'menu' && audio.diagnostics.background.playing, 'Menu recording failed after layered mix');
      await delay(900); check(audio.diagnostics.ambience.gain < .0001, 'Ambience leaked into menu music');
      audio.setMusic('game'); await until(() => audio.diagnostics.ambience.playing && audio.diagnostics.ambience.gain > .05, 'Returning to game did not restore both layers');
      check(mixer().ambienceSource === ambienceSource && audio.diagnostics.permanentSources === 12, 'Menu return created another loop');
      audio.dispose(); await delay(100);
      check(context.state === 'closed' && audio.diagnostics.permanentSources === 0 && !audio.diagnostics.ambience.playing, 'Dispose retained audio');
      status.textContent = `PASS · ILI ILI + Mixkit in one mixer\nActual RMS: music ${musicLevel.rms.toFixed(6)} / ambience ${ambienceLevel.rms.toFixed(6)}\nAmbience quieter · mixed peak ${mixLevel.peak.toFixed(6)}\n${loop.duration.toFixed(1)} s native loop · seam jump ${seamJump.toFixed(6)}\nDialogue / chase / jumpscare duck both layers\nSmooth release (including reset) · overlapping cues retain ducking\nGhost voice, footsteps, door, sting remain audible\nIndependent sliders + master mute\nPause freezes both · resume + 8 resets\nMenu fade + return · one ambience source · disposal`;
    } catch (error) { status.textContent = `FAIL · ${String(error)}\n${JSON.stringify(audio.diagnostics)}`; }
    finally { clearInterval(tick); for (const analyser of analysers) analyser.disconnect(); audio.dispose(); button.disabled = false; }
  });
}
