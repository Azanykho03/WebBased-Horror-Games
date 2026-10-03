import { AudioSystem } from '../src/audio.ts';
import { CORAZON_AUDIO } from '../src/config.ts';
import { calmAtmosphere } from '../src/horror.ts';
import { DEFAULT_SETTINGS } from '../src/types.ts';
import type { AudioFrame } from '../src/audio.ts';
import type { RecordedAudio } from '../src/recorded-audio.ts';

// Validation build only. Real MP3 decoding, Web Audio output and normal gesture
// activation; the production game keeps its original UI and one AudioSystem.
export function attachCorazonAudioAudit(panel: Element, pauseGame: () => void): void {
  const button = document.createElement('button'); button.textContent = 'Check four Corazon audio integrations';
  const status = document.createElement('pre'); status.setAttribute('aria-label', 'Corazon audio audit result'); status.style.whiteSpace = 'pre-wrap';
  panel.append(button, status);
  button.addEventListener('click', async () => {
    pauseGame(); button.disabled = true; status.textContent = 'Checking menu layers and all four supplied MP3s…';
    const settings = { ...DEFAULT_SETTINGS, volume: .12 };
    const audio = new AudioSystem(settings);
    const mixer = () => audio as unknown as { context: AudioContext; master: GainNode; horrorAmbience: GainNode;
      recordings: Record<keyof typeof CORAZON_AUDIO, { diagnostics: RecordedAudio['diagnostics']; gain: GainNode; source: AudioBufferSourceNode | null; buffer: AudioBuffer }>;
      background: { gain: GainNode; media: HTMLAudioElement }; buses: Record<string, GainNode> };
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    const check = (ok: unknown, message: string) => { if (!ok) throw new Error(message); };
    const until = async (ok: () => unknown, message: string) => {
      const deadline = performance.now() + 18000;
      while (!ok()) { if (performance.now() > deadline) throw new Error(message); await delay(40); }
    };
    const frame: AudioFrame = { atmosphere: calmAtmosphere(), eye: [0, 1.4, 0], direction: [0, 0, -1], room: 'F01',
      ghost: null, ghostOccluded: true, ghostMoving: false, rainExposure: 0, window: null };
    const tick = setInterval(() => { if (audio.diagnostics.background?.requested === 'game') audio.update(.05, frame); }, 50);
    const analysers: AnalyserNode[] = [];
    const report: string[] = [];
    try {
      check(audio.state === 'uninitialized', 'Audio initialized before interaction');
      audio.setMusic('menu'); audio.start();
      await until(() => audio.state === 'running' && audio.diagnostics.background?.playing && audio.diagnostics.recordings?.menu.playing
        && Object.values(mixer().recordings).every(clip => clip.diagnostics.status === 'ready'), 'A supplied recording did not load/unlock');
      const context = mixer().context, clips = mixer().recordings, media = mixer().background.media;
      const analyse = (node: AudioNode) => { const a = context.createAnalyser(); a.fftSize = 2048; node.connect(a); analysers.push(a); return a; };
      const outputs = { menu: analyse(clips.menu.gain), girl: analyse(clips.gameplay.gain), curse: analyse(clips.proximity.gain),
        scare: analyse(clips.jumpscare.gain), music: analyse(mixer().background.gain), ambience: analyse(mixer().horrorAmbience), master: analyse(mixer().master) };
      const measure = async (a: AnalyserNode, ms = 650) => {
        const data = new Float32Array(a.fftSize); let peak = 0, sum = 0, count = 0;
        for (const end = performance.now() + ms; performance.now() < end;) {
          a.getFloatTimeDomainData(data);
          for (const sample of data) { peak = Math.max(peak, Math.abs(sample)); sum += sample * sample; count++; }
          await delay(25);
        }
        return { peak, rms: Math.sqrt(sum / Math.max(1, count)) };
      };
      await delay(1500);
      // MELANCHOLIA has quiet gaps in its opening. Inspect several concurrent
      // windows without seeking, rather than mistaking a gap for failed playback.
      let breeze = { peak: 0, rms: 0 }, melancholia = { peak: 0, rms: 0 };
      for (let attempt = 0; attempt < 6; attempt++) {
        [breeze, melancholia] = await Promise.all([measure(outputs.menu, 1200), measure(outputs.music, 1200)]);
        if (breeze.rms > .00001 && melancholia.rms > .00001) break;
      }
      check(breeze.rms > .00001 && melancholia.rms > .00001, `Menu pair is not producing simultaneous samples: breeze ${breeze.rms}, music ${melancholia.rms}`);
      check(clips.menu.diagnostics.loop && clips.gameplay.diagnostics.sources === 0 && clips.proximity.diagnostics.sources === 0, 'Wrong menu loops');
      const menuSource = clips.menu.source;
      for (let i = 0; i < 15; i++) { audio.start(); audio.setMusic('menu'); }
      check(clips.menu.source === menuSource && clips.menu.diagnostics.starts === 1, 'Repeated gestures stacked menu audio');
      report.push(`Menu RMS: breeze ${breeze.rms.toFixed(5)} + MELANCHOLIA ${melancholia.rms.toFixed(5)}`);
      report.push(`Decoded durations: ${Object.entries(clips).map(([name, clip]) => `${name} ${clip.diagnostics.duration.toFixed(2)}s`).join(', ')}`);
      report.push(`Recording RMS before gain: ${Object.entries(clips).map(([name, clip]) => {
        const data = clip.buffer.getChannelData(0);
        return `${name} ${Math.sqrt(data.reduce((sum, sample) => sum + sample * sample, 0) / data.length).toFixed(5)}`;
      }).join(', ')}`);

      // Exercise each native loop boundary with its real decoded MP3 buffer.
      for (const name of ['menu', 'gameplay', 'proximity'] as const) {
        const buffer = clips[name].buffer;
        const offline = new OfflineAudioContext(buffer.numberOfChannels, buffer.sampleRate, buffer.sampleRate);
        const loop = offline.createBufferSource(); loop.buffer = buffer; loop.loop = CORAZON_AUDIO[name].loop; loop.connect(offline.destination);
        loop.start(0, buffer.duration - .5);
        const rendered = await offline.startRendering(), data = rendered.getChannelData(0);
        check(data.subarray(data.length / 2).some(sample => Math.abs(sample) > .00001), `${name} did not produce samples after the loop boundary`);
      }
      report.push('All three native recording loops produce samples across their boundaries');
      status.textContent = 'Menu pair passed; checking ILI ILI + Mixkit + CreepyLittleGirl…';
      audio.setMusic('game'); await delay(300);
      check(clips.menu.diagnostics.gain > 0 && clips.menu.diagnostics.gain < CORAZON_AUDIO.menu.volume, 'Menu breeze did not fade');
      await until(() => media.currentTime > 7 && audio.diagnostics.background?.track === 'game'
        && audio.diagnostics.ambience.playing && clips.gameplay.diagnostics.playing, 'Gameplay layers failed to synchronize');
      check(clips.menu.diagnostics.sources === 0, 'Menu breeze leaked into gameplay');
      const [girl, existingMusic, ambience, mix] = await Promise.all([measure(outputs.girl), measure(outputs.music), measure(outputs.ambience), measure(outputs.master)]);
      check(girl.rms > .00001 && existingMusic.rms > .00001 && ambience.rms > .00001, 'A gameplay layer is silent');
      check(mix.peak > .00001 && mix.peak < .95, 'Output is silent or clipping');
      report.push(`Gameplay RMS: girl ${girl.rms.toFixed(5)} / ILI ILI ${existingMusic.rms.toFixed(5)} / Mixkit ${ambience.rms.toFixed(5)}; mixed peak ${mix.peak.toFixed(5)}`);

      const at = (distance: number) => { frame.ghost = { x: 0, y: 0, z: -distance, level: 0 }; audio.update(.05, frame); };
      at(8.2); check(!audio.diagnostics.recordings?.nearby, 'Warning entered outside 8m');
      at(8); await delay(600); const curseSource = clips.proximity.source, starts = clips.proximity.diagnostics.starts, distant = clips.proximity.diagnostics.gain;
      check((await measure(outputs.curse)).rms > .00001, 'Curse is inaudible around a corner');
      for (const distance of [7.9, 8.1, 8, 8.2, 9, 10.9]) { at(distance); await delay(70); }
      check(clips.proximity.source === curseSource && clips.proximity.diagnostics.starts === starts, 'Boundary movement restarted or stacked curse');
      at(2); await delay(600); check(clips.proximity.diagnostics.gain > distant, 'Curse did not intensify');
      at(12); await delay(100); at(7); await delay(600);
      check(clips.proximity.source === curseSource, 'Reversing a fade stacked the warning');
      at(12); await delay(600); check(clips.proximity.diagnostics.sources === 0, 'Distant curse did not stop');
      report.push('Curse: 8m entry / 11m exit; occluded, louder near, stable boundary, reversed fade, far stop');

      status.textContent = 'Distance warning passed; checking one-shot, pause and cleanup…';
      const scareStarts = clips.jumpscare.diagnostics.starts;
      audio.jumpscare();
      for (let i = 0; i < 20; i++) audio.jumpscare();
      check(clips.jumpscare.diagnostics.starts === scareStarts + 1 && !clips.jumpscare.diagnostics.loop, 'Jumpscare duplicated or loops');
      check((await measure(outputs.scare, 350)).peak > .00001, 'Jumpscare produced no immediate samples');
      audio.reset(true); audio.setGameplay(false);
      check(clips.jumpscare.diagnostics.playing, 'Caught-screen cleanup truncated the one-shot');
      await delay(400); check(audio.diagnostics.ducking.music < .15, 'Caught-screen music obscures the one-shot tail');
      await until(() => clips.jumpscare.diagnostics.sources === 0, 'One-shot never ended');
      audio.setGameplay(true);
      audio.jumpscare(); check(clips.jumpscare.diagnostics.starts === scareStarts + 1, 'Finished recording rearmed during the same sequence');
      audio.finishJumpscare(); audio.apply({ ...settings, gentleScares: true }); audio.jumpscare();
      check(clips.jumpscare.diagnostics.starts === scareStarts + 2 && clips.jumpscare.diagnostics.target === CORAZON_AUDIO.jumpscare.volume * .4, 'New scare did not rearm or honor gentle mode');
      const oldScare = clips.jumpscare.source;
      audio.finishJumpscare(); audio.jumpscare();
      check(clips.jumpscare.diagnostics.sources === 1 && clips.jumpscare.source !== oldScare && clips.jumpscare.diagnostics.starts === scareStarts + 3, 'A new sequence stacked the previous tail');
      audio.reset(); audio.apply(settings);
      report.push('Jumpscare: immediate samples, non-looping, 20 duplicate calls ignored, full tail on caught screen, no replay before sequence completion, next event + gentle mode, tail replacement without overlap');

      const girlSource = clips.gameplay.source, girlStarts = clips.gameplay.diagnostics.starts;
      audio.pause(); await delay(100); const paused = clips.gameplay.diagnostics.time, oldMusic = media.currentTime;
      await delay(250);
      check(audio.state === 'suspended' && clips.gameplay.diagnostics.time === paused && Math.abs(media.currentTime - oldMusic) < .02, 'Pause lost synchronized clocks');
      audio.start(); await delay(1200);
      check(clips.gameplay.source === girlSource && clips.gameplay.diagnostics.time !== paused && clips.gameplay.diagnostics.starts === girlStarts, 'Resume restarted or stacked girl');
      audio.apply({ ...settings, ambience: 0, music: 0, effects: 0, voice: 0 }); await delay(900);
      check((await measure(outputs.master, 150)).peak < .00001, 'Mixer mute leaked a new clip');
      audio.apply(settings); audio.setGameplay(false); await delay(1000);
      check(clips.gameplay.diagnostics.sources === 0 && clips.proximity.diagnostics.sources === 0, 'Gameplay-end retained new loops');
      audio.setMusic('menu'); await until(() => audio.diagnostics.background?.track === 'menu' && clips.menu.diagnostics.playing, 'Returning to menu failed');
      await delay(1000); check(!clips.gameplay.diagnostics.playing && !clips.proximity.diagnostics.playing, 'Gameplay audio leaked into menu');
      report.push('Pause/resume keeps clocks and sources; mixer mute; end stops new loops; return restores menu pair');
      audio.dispose(); await delay(100);
      check(context.state === 'closed' && Object.values(clips).every(clip => clip.diagnostics.sources === 0), 'Dispose retained a recording');
      status.textContent = `PASS · Four Corazon audio integrations\n${report.join('\n')}\nAll sources disposed`;
    } catch (error) { status.textContent = `FAIL · ${String(error)}\n${report.join('\n')}\n${JSON.stringify(audio.diagnostics)}`; }
    finally { clearInterval(tick); for (const analyser of analysers) analyser.disconnect(); audio.dispose(); button.disabled = false; }
  });
}
