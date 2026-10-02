import type { Position, Settings, Vec3 } from './types.ts';
import { assetUrl, VOICE_AUDIO } from './config.ts';
import type { VoiceCue } from './config.ts';

// The room palette and synthesis are adapted from the existing house inspection audio.
const zones: Record<string, [string, string]> = {
  F01: ['wood', 'Wood settles near the entrance.'], F02: ['piano', 'A faint piano note resonates.'],
  F03: ['wood', 'A stair tread creaks.'], F04: ['flies', 'A fly circles the abandoned meal.'],
  F05: ['water', 'Water drips into the sink.'], F06: ['static', 'The CRT murmurs with static.'],
  F07: ['water', 'A slow drip echoes beyond the books.'], F08: ['glass', 'Glass rattles inside the cabinet.'],
  F09: ['metal', 'The car body ticks in the dark.'], U00: ['wood', 'Timber creaks along the hallway.'],
  U01: ['paper', 'Paper rustles by the old computer.'], U02: ['paper', 'A page brushes the desk.'],
  U03: ['wood', 'A quiet knock inside the wardrobe.'], U04: ['fabric', 'Old fabric brushes against wood.'],
  U05: ['water', 'A tap drips into the cracked basin.'], U06: ['fabric', 'Hanging clothes rustle.'],
  U07: ['metal', 'A railing fitting taps in the wind.'],
};
export class AudioSystem {
  private context: AudioContext | null = null;
  private master!: GainNode;
  private ambience!: GainNode;
  private wind!: GainNode;
  private chase!: GainNode;
  private breath!: GainNode;
  private ghostPanner!: PannerNode;
  private recording: HTMLAudioElement | null = null;
  private settings: Settings;
  private active = false;
  private nextAmbient = 14;
  constructor(settings: Settings) { this.settings = settings; }
  get state(): string { return this.context?.state ?? 'uninitialized'; }
  start(): void {
    this.active = true;
    try {
      if (!this.context) this.setup();
      void this.context?.resume().then(() => { if (!this.active) void this.context?.suspend(); }).catch(() => {});
      if (this.recording && !this.recording.ended) void this.recording.play().catch(() => {});
    } catch { /* Captions and play remain available if audio is unavailable. */ }
  }
  pause(): void { this.active = false; this.recording?.pause(); void this.context?.suspend().catch(() => {}); }
  reset(): void { this.nextAmbient = 14; this.voice(); if (this.context) { this.chase.gain.setValueAtTime(0, this.context.currentTime); this.breath.gain.setValueAtTime(0, this.context.currentTime); } }
  private setup(): void {
    const context = this.context = new AudioContext();
    this.master = context.createGain(); this.master.connect(context.destination);
    this.ambience = context.createGain(); this.ambience.connect(this.master);
    const buffer = context.createBuffer(1, context.sampleRate * 4, context.sampleRate), samples = buffer.getChannelData(0);
    let previous = 0;
    for (let i = 0; i < samples.length; i++) { previous = (previous + (Math.random() * 2 - 1) * .015) / 1.015; samples[i] = previous; }
    const source = context.createBufferSource(); source.buffer = buffer; source.loop = true;
    const filter = context.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 380;
    this.wind = context.createGain(); this.wind.gain.value = .38;
    source.connect(filter); filter.connect(this.wind); this.wind.connect(this.ambience); source.start();
    this.breath = context.createGain(); this.breath.gain.value = 0;
    this.ghostPanner = context.createPanner(); this.ghostPanner.panningModel = 'HRTF';
    this.ghostPanner.distanceModel = 'inverse'; this.ghostPanner.refDistance = 1.5; this.ghostPanner.maxDistance = 15; this.ghostPanner.rolloffFactor = 2;
    source.connect(this.breath); this.breath.connect(this.ghostPanner); this.ghostPanner.connect(this.ambience);
    const oscillator = context.createOscillator(); oscillator.type = 'sine'; oscillator.frequency.value = 49;
    this.chase = context.createGain(); this.chase.gain.value = 0;
    oscillator.connect(this.chase); this.chase.connect(this.master); oscillator.start();
    this.apply(this.settings);
  }
  apply(settings: Settings): void {
    this.settings = settings;
    if (!this.context) return;
    this.master.gain.setTargetAtTime(settings.volume * .5, this.context.currentTime, .1);
    this.ambience.gain.setTargetAtTime(settings.ambience, this.context.currentTime, .1);
    if (this.recording) this.recording.volume = settings.volume;
  }
  voice(cue?: VoiceCue): void {
    this.recording?.pause(); this.recording = null;
    if (!cue || !this.active) return;
    const entry = VOICE_AUDIO[cue], path = this.settings.cleanDialogue ? entry?.clean : entry?.normal;
    if (!path) return;
    this.recording = new Audio(assetUrl(path)); this.recording.volume = this.settings.volume;
    void this.recording.play().catch(() => { /* The subtitle remains usable. */ });
  }
  effect(type: 'step' | 'pickup' | 'latch' | 'sting' | 'hit'): void {
    const frequency = { step: 85, pickup: 523, latch: 180, sting: 65, hit: 130 }[type];
    this.tone(frequency, type === 'sting' ? .9 : .22, type === 'sting' ? .16 : .09);
  }
  private tone(frequency: number, duration: number, volume: number): void {
    const c = this.context;
    if (!c || !this.active || c.state !== 'running') return;
    const osc = c.createOscillator(), gain = c.createGain(), t = c.currentTime;
    osc.type = 'triangle'; osc.frequency.setValueAtTime(frequency, t); osc.frequency.exponentialRampToValueAtTime(frequency * .55, t + duration);
    gain.gain.setValueAtTime(.0001, t); gain.gain.exponentialRampToValueAtTime(volume, t + .02); gain.gain.exponentialRampToValueAtTime(.0001, t + duration);
    osc.connect(gain); gain.connect(this.master); osc.start(); osc.stop(t + duration + .05);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); };
  }
  update(dt: number, room: string, chasing: boolean, eye: Vec3, direction: Vec3, ghost: Position | null, caption: (text: string) => void): void {
    const c = this.context;
    if (!c || !this.active) return;
    this.wind.gain.setTargetAtTime(room === 'U07' ? .75 : .32, c.currentTime, .5);
    this.chase.gain.setTargetAtTime(chasing ? .11 : 0, c.currentTime, .35);
    const listener = c.listener;
    listener.positionX.value = eye[0]; listener.positionY.value = eye[1]; listener.positionZ.value = eye[2];
    listener.forwardX.value = direction[0]; listener.forwardY.value = direction[1]; listener.forwardZ.value = direction[2];
    listener.upX.value = 0; listener.upY.value = 1; listener.upZ.value = 0;
    this.breath.gain.setTargetAtTime(ghost ? .8 : 0, c.currentTime, .3);
    if (ghost) { this.ghostPanner.positionX.value = ghost.x; this.ghostPanner.positionY.value = ghost.y + 1.4; this.ghostPanner.positionZ.value = ghost.z; }
    this.nextAmbient -= dt;
    if (this.nextAmbient > 0) return;
    this.nextAmbient = 18 + Math.random() * 20;
    const [type, cue] = zones[room] ?? zones.F01;
    caption(cue);
    const frequency = ({ piano: 130.81, water: 880, glass: 1661, metal: 277, wood: 110, flies: 220, static: 1400, paper: 2400, fabric: 680 } as Record<string, number>)[type];
    this.tone(frequency, 1.7, .045 * this.settings.ambience);
  }
  dispose(): void { this.active = false; this.voice(); void this.context?.close(); }
}
