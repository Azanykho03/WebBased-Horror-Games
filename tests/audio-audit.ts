import { AudioSystem } from '../src/audio.ts';
import { calmAtmosphere } from '../src/horror.ts';
import { DEFAULT_SETTINGS } from '../src/types.ts';
import type { Soundscape } from '../src/horror.ts';

// Real Web Audio graph validation, included only in the validation build.
export function attachAudioAudit(panel: Element, pauseGame: () => void): void {
  const button = document.createElement('button'); button.textContent = 'Check audio lifecycle';
  const status = document.createElement('pre'); status.setAttribute('aria-label', 'Audio audit result'); status.style.whiteSpace = 'pre-wrap';
  panel.append(button, status);
  button.addEventListener('click', async () => {
    pauseGame();
    button.disabled = true; status.textContent = 'Checking actual Web Audio graph…';
    const audio = new AudioSystem({ ...DEFAULT_SETTINGS, volume: .015 });
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    const check = (condition: boolean, message: string) => { if (!condition) throw new Error(message); };
    const mixer = () => audio as unknown as { context: AudioContext; master: GainNode; buses: Record<string, GainNode> };
    let analyser: AnalyserNode | undefined;
    try {
      audio.start(); await delay(150);
      check(audio.state === 'running', 'Gesture did not unlock Web Audio');
      const context = mixer().context; audio.start();
      check(mixer().context === context, 'Repeated start created another context');
      analyser = context.createAnalyser(); analyser.fftSize = 2048; mixer().master.connect(analyser);
      const frame = { atmosphere: calmAtmosphere(), eye: [0, 1.65, 0] as [number, number, number], direction: [0, 0, -1] as [number, number, number], room: 'F01', ghost: { x: 2, y: 0, z: -4, level: 0 as const }, ghostOccluded: false, ghostMoving: true, rainExposure: .8, window: [3, 2, 0] as [number, number, number] };
      const states: Soundscape[] = ['CALM_EXPLORATION', 'UNEASY', 'CORAZON_NEARBY', 'CORAZON_DETECTED_PLAYER', 'CHASE', 'HIDING', 'JUMPSCARE', 'POST_JUMPSCARE', 'GAME_OVER', 'ENDING'];
      for (const state of states) { frame.atmosphere = { ...calmAtmosphere(), state, fear: .8, proximity: .8, exertion: .7 }; audio.update(.1, frame); }
      audio.effect('sting'); await delay(200);
      const samples = new Float32Array(analyser.fftSize); analyser.getFloatTimeDomainData(samples);
      const peak = Math.max(...samples.map(Math.abs)); check(peak > .000001, 'Graph produced no audio samples');
      for (const cue of ['whisper-1', 'laugh', 'cry', 'hum', 'scream'] as const) { audio.voice(cue); await delay(20); }
      check(audio.diagnostics.transientVoices <= 20, 'Vocal variants exceeded the sound budget');
      for (let i = 0; i < 80; i++) audio.event({ kind: 'thunder', room: 'F01', position: [0, 3, -3], duration: 4, strength: .7, delay: 1, caption: '' });
      check(audio.diagnostics.transientVoices <= 20 && audio.diagnostics.transientVoices > 0, 'Voice budget failed');
      audio.apply({ ...DEFAULT_SETTINGS, volume: 0, music: 0, ambience: 0, effects: 0, voice: 0 }); await delay(650);
      check(mixer().master.gain.value < .001 && Object.values(mixer().buses).every(bus => bus.gain.value < .001), 'Independent mixer mute failed');
      audio.pause(); await delay(80); check(audio.state === 'suspended', 'Pause left audio running');
      audio.reset(); check(audio.diagnostics.transientVoices === 0, 'Reset left delayed sounds alive');
      audio.start(); await delay(80); check(audio.state === 'running', 'Resume failed');
      for (let i = 0; i < 8; i++) { audio.effect('pickup'); audio.reset(); audio.start(); }
      check(audio.diagnostics.permanentSources === 11 && audio.diagnostics.transientVoices === 0 && mixer().context === context, 'Retry duplicated loops or retained sounds');
      audio.dispose(); await delay(80); check(context.state === 'closed', 'Dispose did not close context');
      check(audio.diagnostics.permanentSources === 0, 'Dispose retained permanent sources');
      status.textContent = `PASS · Actual Web Audio\n10 soundscapes · nonzero output (peak ${peak.toFixed(6)})\n5 mixer controls mute · 20-voice cap\nvocal variants · pause / resume\n8 resets without duplication\ndelayed sounds cleared · context closed`;
    } catch (error) { status.textContent = `FAIL · ${String(error)}`; }
    finally { analyser?.disconnect(); audio.dispose(); button.disabled = false; }
  });
}
