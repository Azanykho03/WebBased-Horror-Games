import type { Position, Settings, Vec3, InteractionId, Hotspot } from './types.ts';
import { AMBIENCE_AUDIO, assetUrl, CORAZON_AUDIO, MUSIC_AUDIO, VOICE_AUDIO } from './config.ts';
import type { VoiceCue } from './config.ts';
import { BackgroundMusic } from './music.ts';
import type { MusicTrack } from './music.ts';
import { createAmbienceLoop, HORROR_AMBIENCE_LEVEL } from './ambience.ts';
import { clamp } from './horror.ts';
import type { Atmosphere, HauntEvent, Soundscape, Surface } from './horror.ts';
import { RecordedAudio, proximityLevel } from './recorded-audio.ts';

type Bus = 'music' | 'ambience' | 'effects' | 'voice';
type Effect = 'pickup' | 'latch' | 'sting' | 'hit' | 'flashlight' | 'detect' | 'objective' | 'throw' | 'land' | 'ui' | 'grab' | 'struggle' | 'escape' | 'drag';
type Playing = { stop: () => void };
export interface AudioFrame {
  atmosphere: Atmosphere; eye: Vec3; direction: Vec3; room: string;
  ghost: Position | null; ghostOccluded: boolean; ghostMoving: boolean;
  rainExposure: number; window: Vec3 | null;
}
type Note = { frequency?: number; endFrequency?: number; duration: number; volume: number; bus: Bus; scare?: boolean;
  noise?: boolean; filter?: number; q?: number; wave?: OscillatorType; at?: Vec3; delay?: number; attack?: number; occluded?: boolean; ghost?: boolean; buffer?: AudioBuffer };

// One mixer and AudioContext for the supplied music, original procedural horror
// palette and optional local dialogue.
export class AudioSystem {
  private context: AudioContext | null = null;
  private background: BackgroundMusic | null = null;
  private musicTrack: MusicTrack | null = null;
  private recordings: Record<keyof typeof CORAZON_AUDIO, RecordedAudio> | null = null;
  private gameplay = false;
  private nearby = false;
  private jumpscareLatched = false;
  private master!: GainNode;
  private buses!: Record<Bus, GainNode>;
  private musicDuck!: GainNode;
  private ambientDuck!: GainNode;
  private horrorAmbience!: GainNode;
  private ambienceSource: AudioBufferSourceNode | null = null;
  private ambienceStatus: 'idle' | 'loading' | 'ready' | 'unavailable' = 'idle';
  private ambienceStarted: number | null = null;
  private ambienceTarget = 0;
  private silence = 0;
  private scareUntil = 0;
  private duckTargets = { music: 1, ambience: 1 };
  private wind!: GainNode;
  private rain!: GainNode;
  private rainFilter!: BiquadFilterNode;
  private weatherPanner!: PannerNode;
  private roomtone!: GainNode;
  private ghostBreath!: GainNode;
  private ghostFilter!: BiquadFilterNode;
  private ghostPanner!: PannerNode;
  private reverb!: ConvolverNode;
  private layers!: Record<'drone' | 'tension' | 'nearby' | 'chase' | 'ending', GainNode>;
  private noise!: AudioBuffer;
  private reverse!: AudioBuffer;
  private active = false;
  private disposed = false;
  private settings: Settings;
  private playing = new Set<Playing>();
  private permanent: AudioScheduledSourceNode[] = [];
  private buffers = new Map<string, Promise<AudioBuffer | null>>();
  private pending = new AbortController();
  private voiceToken = 0;
  private voicePlaying: Playing | null = null;
  private lastEffect = new Map<string, number>();
  private variants = new Map<string, number>();
  private beat = .5;
  private breath = 1;
  private pulse = 0;
  private ghostStep = 1;
  private vocal = 18;
  private phrase = 0;
  private dialogue = 0;
  private stateName: Soundscape = 'CALM_EXPLORATION';
  private mixTick = 0;
  constructor(settings: Settings) { this.settings = settings; }
  get state(): string { return this.context?.state ?? 'uninitialized'; }
  get diagnostics() { return { state: this.state, soundtrack: this.stateName, transientVoices: this.playing.size, permanentSources: this.permanent.length, active: this.active, background: this.background?.diagnostics ?? null,
    ambience: { status: this.ambienceStatus, playing: this.active && this.state === 'running' && this.ambienceTarget > 0 && Boolean(this.ambienceSource),
      gain: this.horrorAmbience?.gain.value ?? 0, duration: this.ambienceSource?.buffer?.duration ?? 0,
      time: this.ambienceSource && this.ambienceStarted !== null ? (this.context!.currentTime - this.ambienceStarted) % this.ambienceSource.buffer!.duration : 0 },
    recordings: this.recordings ? { menu: this.recordings.menu.diagnostics, gameplay: this.recordings.gameplay.diagnostics,
      proximity: this.recordings.proximity.diagnostics, jumpscare: this.recordings.jumpscare.diagnostics, nearby: this.nearby, jumpscareLatched: this.jumpscareLatched } : null,
    ducking: { music: this.musicDuck?.gain.value ?? 1, ambience: this.ambientDuck?.gain.value ?? 1 } }; }
  setMusic(track: MusicTrack | null): void {
    if (track !== this.musicTrack) this.gameplay = track === 'game';
    this.musicTrack = track; this.background?.select(track); this.syncAmbience(); this.syncRecordings();
  }
  setGameplay(active: boolean): void {
    this.gameplay = active;
    if (!active) { this.nearby = false; this.recordings?.proximity.setLevel(0, CORAZON_AUDIO.proximity.fade); }
    this.syncRecordings();
  }
  start(): void {
    if (this.disposed) return;
    this.active = true;
    try {
      if (!this.context) this.setup();
      if (this.context?.state !== 'running') void this.context?.resume().then(() => { if (!this.active) void this.context?.suspend().catch(() => {}); }).catch(() => {});
      this.background?.resume();
      this.syncRecordings();
    } catch { /* Captions and gameplay remain available without Web Audio. */ }
  }
  pause(): void {
    this.active = false; this.background?.pause(); this.silenceAmbience();
    void this.context?.suspend().catch(() => {});
  }
  reset(): void {
    this.nearby = false; this.recordings?.proximity.stop();
    this.finishJumpscare();
    this.voiceToken++; this.voicePlaying = null;
    for (const sound of [...this.playing]) sound.stop();
    this.lastEffect.clear(); this.variants.clear();
    this.beat = .5; this.breath = 1; this.pulse = this.phrase = this.dialogue = this.mixTick = 0; this.ghostStep = 1; this.vocal = 18;
    this.stateName = 'CALM_EXPLORATION';
    this.silence = this.scareUntil = 0; this.duckTargets = { music: 1, ambience: 1 };
    if (this.context) {
      for (const gain of [this.wind, this.rain, this.roomtone, this.ghostBreath, ...Object.values(this.layers)]) {
        gain.gain.cancelScheduledValues(this.context.currentTime); gain.gain.setValueAtTime(0, this.context.currentTime);
      }
      for (const gain of [this.musicDuck, this.ambientDuck]) {
        gain.gain.cancelScheduledValues(this.context.currentTime); gain.gain.setTargetAtTime(1, this.context.currentTime, .8);
      }
    }
  }
  private gain(destination: AudioNode, volume = 0): GainNode {
    const gain = this.context!.createGain(); gain.gain.value = volume; gain.connect(destination); return gain;
  }
  private panner(destination: AudioNode): PannerNode {
    const p = this.context!.createPanner(); p.panningModel = 'HRTF'; p.distanceModel = 'inverse';
    p.refDistance = 2.2; p.maxDistance = 28; p.rolloffFactor = 1.4; p.connect(destination); return p;
  }
  private place(p: PannerNode, at: Vec3): void { p.positionX.value = at[0]; p.positionY.value = at[1]; p.positionZ.value = at[2]; }
  private setup(): void {
    const c = this.context = new AudioContext();
    this.master = this.gain(c.destination, 0);
    const limiter = c.createDynamicsCompressor();
    limiter.threshold.value = -12; limiter.knee.value = 12; limiter.ratio.value = 8; limiter.attack.value = .003; limiter.release.value = .25;
    limiter.connect(this.master);
    this.buses = { music: this.gain(limiter), ambience: this.gain(limiter), effects: this.gain(limiter), voice: this.gain(limiter) };
    this.musicDuck = this.gain(this.buses.music, 1); this.ambientDuck = this.gain(this.buses.ambience, 1);
    const ambienceFilter = c.createBiquadFilter(); ambienceFilter.type = 'lowpass'; ambienceFilter.frequency.value = 1800; ambienceFilter.Q.value = .7;
    ambienceFilter.connect(this.ambientDuck); this.horrorAmbience = this.gain(ambienceFilter);
    this.background = new BackgroundMusic(c, this.musicDuck, { menu: assetUrl(MUSIC_AUDIO.menu), game: assetUrl(MUSIC_AUDIO.game) });
    this.background.select(this.musicTrack);
    this.recordings = {
      menu: new RecordedAudio(c, this.musicDuck, CORAZON_AUDIO.menu.loop),
      gameplay: new RecordedAudio(c, this.ambientDuck, CORAZON_AUDIO.gameplay.loop),
      // A nearby warning remains audible while chase music/ambience are ducked.
      proximity: new RecordedAudio(c, this.buses.effects, CORAZON_AUDIO.proximity.loop),
      jumpscare: new RecordedAudio(c, this.buses.effects, CORAZON_AUDIO.jumpscare.loop),
    };
    for (const name of Object.keys(CORAZON_AUDIO) as (keyof typeof CORAZON_AUDIO)[]) {
      const clip = this.recordings[name], path = CORAZON_AUDIO[name].path;
      void this.load(path).then(buffer => {
        if (this.disposed) return;
        clip.setBuffer(buffer);
        if (!buffer) console.warn(`Audio unavailable: ${path}. Other game audio remains enabled.`);
        this.syncRecordings();
      });
    }
    c.addEventListener('statechange', () => {
      if (c.state !== 'running') { this.background?.pause(); this.silenceAmbience(); }
      else if (this.active) { this.background?.resume(); this.syncRecordings(); }
    }, { signal: this.pending.signal });
    this.noise = c.createBuffer(1, c.sampleRate * 8, c.sampleRate);
    const samples = this.noise.getChannelData(0), edge = c.sampleRate * .035;
    for (let i = 0; i < samples.length; i++) samples[i] = (Math.random() * 2 - 1) * Math.min(1, i / edge, (samples.length - 1 - i) / edge);
    this.reverse = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const texture = this.reverse.getChannelData(0);
    for (let i = 0; i < texture.length; i++) { const t = i / texture.length; texture[i] = Math.sin(i / c.sampleRate * 2 * Math.PI * (90 + 12 * t)) * Math.sin(Math.PI * t) ** 3 * t; }
    const noise = c.createBufferSource(); noise.buffer = this.noise; noise.loop = true; noise.start(); this.permanent.push(noise);
    const bed = (frequency: number, q: number, destination: AudioNode) => {
      const filter = c.createBiquadFilter(); filter.type = 'bandpass'; filter.frequency.value = frequency; filter.Q.value = q;
      const gain = this.gain(destination); noise.connect(filter); filter.connect(gain); return { gain, filter };
    };
    this.wind = bed(190, .6, this.ambientDuck).gain;
    this.roomtone = bed(72, 1.6, this.ambientDuck).gain;
    this.weatherPanner = this.panner(this.ambientDuck); this.weatherPanner.refDistance = 7; this.weatherPanner.rolloffFactor = .4;
    const rain = bed(1800, .45, this.weatherPanner); this.rain = rain.gain; this.rainFilter = rain.filter;
    this.ghostPanner = this.panner(this.buses.voice);
    this.ghostFilter = c.createBiquadFilter(); this.ghostFilter.type = 'lowpass'; this.ghostFilter.frequency.value = 2200; this.ghostFilter.connect(this.ghostPanner);
    this.ghostBreath = bed(620, 1.8, this.ghostFilter).gain;
    const reverb = this.reverb = c.createConvolver(), impulse = c.createBuffer(2, c.sampleRate * .85, c.sampleRate);
    for (let channel = 0; channel < 2; channel++) {
      const data = impulse.getChannelData(channel);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 3) * .13;
    }
    reverb.buffer = impulse; this.ghostPanner.connect(reverb); reverb.connect(this.gain(this.buses.voice, .16));
    this.layers = { drone: this.gain(this.musicDuck), tension: this.gain(this.musicDuck), nearby: this.gain(this.musicDuck), chase: this.gain(this.musicDuck), ending: this.gain(this.musicDuck) };
    const layer = (name: keyof typeof this.layers, frequencies: number[], wave: OscillatorType) => {
      const filter = c.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = name === 'chase' ? 460 : 900; filter.connect(this.layers[name]);
      for (const f of frequencies) { const oscillator = c.createOscillator(); oscillator.frequency.value = f; oscillator.type = wave; oscillator.connect(filter); oscillator.start(); this.permanent.push(oscillator); }
    };
    layer('drone', [49, 73.55], 'sine'); layer('tension', [98, 103.7], 'triangle'); layer('nearby', [196, 207.6], 'sine');
    layer('chase', [49, 50.3], 'sawtooth'); layer('ending', [130.81, 196], 'sine');
    this.apply(this.settings);
    this.ambienceStatus = 'loading';
    void this.load(AMBIENCE_AUDIO).then(recording => {
      // Keep only the prepared loop in memory, not a second decoded WAV copy.
      this.buffers.delete(AMBIENCE_AUDIO);
      if (this.disposed) return;
      if (!recording) { this.ambienceStatus = 'unavailable'; return; }
      try {
        const source = c.createBufferSource(); source.buffer = createAmbienceLoop(c, recording);
        source.loop = true; source.connect(this.horrorAmbience);
        this.ambienceSource = source; this.ambienceStatus = 'ready'; this.syncAmbience();
      } catch { this.ambienceStatus = 'unavailable'; }
    });
    // Only configured critical clips are prefetched. Empty placeholders make no requests.
    for (const cue of ['kitchen-ghost', 'spotted', 'scream'] as const) { const path = this.path(cue); if (path) void this.load(path); }
  }
  private silenceAmbience(): void {
    this.ambienceTarget = 0;
    if (!this.context || !this.horrorAmbience) return;
    this.horrorAmbience.gain.cancelScheduledValues(this.context.currentTime);
    this.horrorAmbience.gain.setValueAtTime(0, this.context.currentTime);
  }
  private syncRecordings(): void {
    if (!this.recordings || !this.active) return;
    const music = this.background?.diagnostics;
    if (!this.gameplay) { this.nearby = false; this.recordings.proximity.setLevel(0, CORAZON_AUDIO.proximity.fade); }
    this.recordings.menu.setLevel(this.musicTrack === 'menu' ? CORAZON_AUDIO.menu.volume : 0, CORAZON_AUDIO.menu.fade);
    this.recordings.gameplay.setLevel(this.gameplay && music?.playing && music.track === 'game' && music.requested === 'game'
      ? CORAZON_AUDIO.gameplay.volume : 0, CORAZON_AUDIO.gameplay.fade);
  }
  // Called in the same render tick that makes Corazon's face visible. Preloading
  // keeps this synchronous; a failed/late download must never create a late scare.
  jumpscare(): void {
    if (this.jumpscareLatched || !this.gameplay || !this.active || this.context?.state !== 'running') return;
    this.jumpscareLatched = true; this.nearby = false;
    this.recordings?.proximity.setLevel(0, .04);
    // Cancel a voice already playing (or loading) so only the impact owns this beat.
    this.voice();
    this.recordings?.jumpscare.stop();
    this.recordings?.jumpscare.setLevel(CORAZON_AUDIO.jumpscare.volume * (this.settings.gentleScares ? .4 : 1), CORAZON_AUDIO.jumpscare.fade, CORAZON_AUDIO.jumpscare.offset);
    this.duckBackground();
  }
  finishJumpscare(): void { this.recordings?.jumpscare.stop(); this.jumpscareLatched = false; }
  private updateProximity(frame: AudioFrame): void {
    const eligible = this.gameplay && !this.jumpscareLatched && !['ENDING', 'GAME_OVER'].includes(frame.atmosphere.state);
    const distance = eligible && frame.ghost ? Math.hypot(frame.ghost.x - frame.eye[0], frame.ghost.y + 1.4 - frame.eye[1], frame.ghost.z - frame.eye[2]) : Infinity;
    const result = proximityLevel(distance, this.nearby, CORAZON_AUDIO.proximity);
    this.nearby = result.nearby;
    this.recordings?.proximity.setLevel(result.volume * (this.settings.gentleScares ? .6 : 1), CORAZON_AUDIO.proximity.fade);
  }
  private syncAmbience(): void {
    const c = this.context, music = this.background?.diagnostics;
    if (!c || !this.horrorAmbience) return;
    const level = this.ambienceSource && this.active && music?.playing && music.track === 'game' && music.requested === 'game' ? music.gain * HORROR_AMBIENCE_LEVEL : 0;
    if (level > 0 && this.ambienceSource && this.ambienceStarted === null) {
      // Start only once ILI ILI really plays; the same audio clock freezes both
      // layers during pause/interruption, and repeated gestures never add loops.
      this.ambienceStarted = c.currentTime;
      this.ambienceSource.start(); this.permanent.push(this.ambienceSource);
    }
    if (level === this.ambienceTarget) return;
    this.ambienceTarget = level;
    this.horrorAmbience.gain.setTargetAtTime(level, c.currentTime, level > 0 ? .25 : .16);
  }
  private duckBackground(): void {
    const c = this.context;
    if (!c) return;
    const scare = this.stateName === 'JUMPSCARE' || c.currentTime < this.scareUntil || Boolean(this.recordings?.jumpscare.diagnostics.playing);
    const chase = this.stateName === 'CHASE', voice = this.dialogue > 0;
    const targets = {
      music: (scare ? .08 : Math.min(voice ? .42 : 1, chase ? .7 : 1)) * (1 - this.silence * .92),
      ambience: (scare ? .08 : Math.min(voice ? .4 : 1, chase ? .35 : 1)) * (1 - this.silence * .97),
    };
    for (const key of ['music', 'ambience'] as const) {
      if (targets[key] === this.duckTargets[key]) continue;
      const attack = targets[key] < this.duckTargets[key]; this.duckTargets[key] = targets[key];
      const gain = key === 'music' ? this.musicDuck : this.ambientDuck;
      gain.gain.setTargetAtTime(targets[key], c.currentTime, attack ? scare ? .025 : .08 : .8);
    }
  }
  apply(settings: Settings): void {
    const cleanChanged = this.settings.cleanDialogue !== settings.cleanDialogue;
    this.settings = settings;
    if (cleanChanged) { this.voiceToken++; this.voicePlaying?.stop(); this.voicePlaying = null; this.dialogue = 0; this.duckBackground(); }
    if (!this.context) return;
    const t = this.context.currentTime;
    this.master.gain.setTargetAtTime(clamp(settings.volume) * .7, t, .08);
    for (const key of ['music', 'ambience', 'effects', 'voice'] as const) this.buses[key].gain.setTargetAtTime(clamp(settings[key]), t, .08);
  }
  private path(cue: VoiceCue): string | undefined { const entry = VOICE_AUDIO[cue]; return this.settings.cleanDialogue ? entry?.clean : entry?.normal; }
  private load(path: string): Promise<AudioBuffer | null> {
    if (!this.buffers.has(path)) this.buffers.set(path, fetch(assetUrl(path), { signal: this.pending.signal })
      .then(response => { if (!response.ok) throw new Error(`Audio ${response.status}`); return response.arrayBuffer(); })
      .then(bytes => this.context!.decodeAudioData(bytes)).catch(() => null));
    return this.buffers.get(path)!;
  }
  voice(cue?: VoiceCue, at?: Vec3, level = 1, occluded = false): void {
    const token = ++this.voiceToken; this.voicePlaying?.stop(); this.voicePlaying = null;
    this.dialogue = 0;
    if (!cue || !this.active || !this.context) { this.duckBackground(); return; }
    this.dialogue = 3; this.duckBackground();
    const path = this.path(cue), ghost = cue !== 'kitchen-player' && cue !== 'recognition';
    const fallback = () => {
      // Formant/hum placeholder, not spoken dialogue. Supplied clips replace it.
      if (!ghost) return;
      const parts: (Playing | null)[] = [], length = cue.startsWith('whisper') ? 2 : cue === 'cry' ? 2.6 : cue === 'hum' ? 3 : .9;
      for (let i = 0; i < (cue === 'laugh' ? 3 : 1); i++) parts.push(this.note({ noise: true, filter: cue === 'scream' ? 1550 : cue === 'cry' ? 550 : 740 + i * 60, q: 2.5, duration: cue === 'laugh' ? .24 : length, delay: i * .3, volume: (cue === 'scream' ? .19 : cue === 'hum' ? .04 : .11) * level, attack: .16, bus: 'voice', at, ghost: !at, occluded, scare: cue === 'scream' }));
      parts.push(this.note({ frequency: cue === 'hum' ? 196 : 174.6, endFrequency: cue === 'cry' ? 116.5 : 147, duration: length, volume: .023 * level, attack: .22, bus: 'voice', at, ghost: !at, occluded, scare: cue === 'scream' }));
      this.voicePlaying = { stop: () => { for (const part of parts) part?.stop(); } };
    };
    if (!path) { fallback(); return; }
    void this.load(path).then(buffer => {
      if (token !== this.voiceToken || !this.active || this.disposed) return;
      if (!buffer) { fallback(); return; }
      this.dialogue = buffer.duration; this.duckBackground();
      this.voicePlaying = this.note({ buffer, duration: buffer.duration, volume: .75 * level, bus: 'voice', at, ghost: ghost && !at, attack: .01, occluded });
    });
  }
  private note(options: Note): Playing | null {
    const c = this.context;
    if (!c || !this.active || c.state !== 'running' || this.playing.size >= 20) return null;
    const t = c.currentTime + (options.delay ?? 0), duration = Math.max(.04, options.duration), end = t + duration;
    const nodes: AudioNode[] = [], gain = c.createGain(); nodes.push(gain);
    const volume = options.volume * (this.settings.gentleScares && (options.scare || this.stateName === 'JUMPSCARE' || options.volume > .2) ? .4 : 1);
    gain.gain.setValueAtTime(0, c.currentTime); gain.gain.setValueAtTime(.0001, t);
    gain.gain.linearRampToValueAtTime(Math.max(.0001, volume), t + Math.min(options.attack ?? .008, duration * .45));
    // Recorded lines retain their level until a short release; synthesized hits decay.
    if (options.buffer && options.bus === 'voice') gain.gain.setValueAtTime(Math.max(.0001, volume), Math.max(t + .02, end - .045));
    gain.gain.exponentialRampToValueAtTime(.0001, end);
    let destination: AudioNode = options.bus === 'music' ? this.musicDuck : options.bus === 'ambience' ? this.ambientDuck : this.buses[options.bus];
    if (options.ghost) destination = this.ghostFilter;
    else if (options.at) {
      const p = this.panner(destination); this.place(p, options.at); nodes.push(p); destination = p;
      if (options.bus === 'voice') { const send = this.gain(this.reverb, .08 + Math.random() * .1); p.connect(send); nodes.push(send); }
    }
    if (options.occluded) { const low = c.createBiquadFilter(); low.type = 'lowpass'; low.frequency.value = 700; low.connect(destination); nodes.push(low); destination = low; }
    gain.connect(destination);
    let source: AudioBufferSourceNode | OscillatorNode;
    if (options.noise || options.buffer) { const buffer = c.createBufferSource(); buffer.buffer = options.buffer ?? this.noise; buffer.loop = !options.buffer; source = buffer; }
    else {
      const oscillator = c.createOscillator(); oscillator.type = options.wave ?? 'sine'; oscillator.frequency.setValueAtTime(options.frequency ?? 110, t);
      if (options.endFrequency) oscillator.frequency.exponentialRampToValueAtTime(options.endFrequency, end); source = oscillator;
    }
    if (options.filter) {
      const filter = c.createBiquadFilter(); filter.type = 'bandpass'; filter.frequency.value = options.filter; filter.Q.value = options.q ?? .8;
      source.connect(filter); filter.connect(gain); nodes.push(filter);
    } else source.connect(gain);
    let ended = false;
    const cleanup = () => { if (ended) return; ended = true; source.disconnect(); for (const node of nodes) node.disconnect(); this.playing.delete(handle); };
    const handle: Playing = { stop: () => { try { source.stop(); } catch { /* Already stopped. */ } cleanup(); } };
    this.playing.add(handle); source.onended = cleanup;
    if (options.noise && !options.buffer) (source as AudioBufferSourceNode).start(t, Math.random() * 5); else source.start(t);
    source.stop(end + .025); return handle;
  }
  private ready(key: string, cooldown: number): boolean {
    if (!this.active || !this.context || this.context.state !== 'running') return false;
    const now = this.context.currentTime;
    if (now - (this.lastEffect.get(key) ?? -Infinity) < cooldown) return false;
    this.lastEffect.set(key, now); return true;
  }
  footstep(surface: Surface, sprint: boolean, at?: Vec3): void {
    if (!this.ready('step', .12)) return;
    const previous = this.variants.get(surface) ?? -1, variant = (previous + 1 + Math.floor(Math.random() * 3)) % 4; this.variants.set(surface, variant);
    const frequencies = { wood: 145, tile: 820, concrete: 430, metal: 1150, dirt: 280 }, scale = sprint ? 1 : .65, variation = .88 + variant * .08;
    this.note({ noise: true, filter: frequencies[surface] * variation, q: surface === 'wood' ? 2 : .6, duration: .16 + variant * .016, volume: .22 * scale, bus: 'effects', at });
    this.note({ frequency: (surface === 'wood' ? 85 : 120) * variation, endFrequency: 48, duration: .11, volume: .085 * scale, bus: 'effects', at });
    if (surface === 'wood' && variant === 2) this.note({ noise: true, filter: 240, q: 12, duration: .37, volume: .045, bus: 'effects', at });
  }
  effect(type: Effect, at?: Vec3): void {
    if (!this.ready(type, type === 'sting' ? 2.5 : type === 'detect' ? 5 : .12)) return;
    const tone = (frequency: number, duration: number, volume: number, delay = 0) => this.note({ frequency, endFrequency: frequency * .7, duration, volume, bus: 'effects', at, delay, scare: type === 'sting' });
    if (type === 'sting') { this.scareUntil = this.context!.currentTime + 1; this.duckBackground(); this.note({ noise: true, filter: 900, q: .65, duration: .65, volume: .24, bus: 'effects', scare: true }); tone(55, .9, .17); tone(277, .42, .035); return; }
    if (type === 'detect') { tone(146.8, .6, .095); tone(155.6, .5, .06); return; }
    if (type === 'objective') { tone(196, 1.5, .045); tone(207.6, 1.2, .025, .22); return; }
    if (type === 'pickup') { tone(740, .22, .05); tone(1113, .16, .02, .06); return; }
    if (type === 'ui') { tone(220, .09, .026); return; }
    if (type === 'grab' || type === 'struggle' || type === 'escape' || type === 'drag') {
      const release = type === 'escape', gain = this.settings.gentleScares ? .55 : 1;
      this.note({ noise: true, filter: release ? 1200 : type === 'grab' ? 380 : 650, q: .7,
        duration: type === 'drag' ? .65 : release ? .32 : .16, volume: (type === 'struggle' ? .065 : .13) * gain, attack: .025, bus: 'effects', at });
      if (type !== 'struggle') tone(release ? 110 : 62, .24, .07 * gain);
      return;
    }
    const filter = { latch: 350, hit: 160, flashlight: 2100, throw: 900, land: 180 }[type];
    this.note({ noise: true, filter, duration: type === 'throw' ? .23 : type === 'flashlight' ? .045 : .22, volume: type === 'flashlight' ? .12 : .2, bus: 'effects', at });
    if (type !== 'flashlight' && type !== 'throw') tone(85, .15, .08);
  }
  interaction(id: InteractionId, kind: Hotspot['kind'], changed: boolean, at: Vec3): void {
    if (!changed && kind !== 'door' && id !== 'cabinet') return;
    if (!this.ready(`interaction-${id}`, .35)) return;
    if (kind === 'door') { this.effect('latch', at); if (changed) this.note({ noise: true, filter: 240, q: 14, duration: 1.2, volume: .16, attack: .13, bus: 'effects', at }); }
    else if (id === 'cabinet') { this.note({ noise: true, filter: changed ? 500 : 1900, q: 4, duration: changed ? .8 : .24, volume: .13, bus: 'effects', at }); if (changed) this.effect('latch', at); }
    else if (id === 'breaker') { this.effect('latch', at); this.note({ frequency: 60, duration: .75, volume: .055, bus: 'effects', at }); }
    else if (id === 'note' || id === 'letter') this.note({ noise: true, filter: 2700, duration: .35, volume: .11, bus: 'effects', at });
    else if (id === 'exit-key' || id === 'locket' || id === 'fuse') this.effect('pickup', at);
    else if (id === 'music-box') for (const [i, frequency] of [523.25, 493.88, 369.99].entries()) this.note({ frequency, duration: .9, volume: .06, bus: 'effects', at, delay: i * .28 });
    else this.note({ noise: true, filter: 700, duration: .18, volume: .16, bus: 'effects', at });
  }
  event(event: HauntEvent, occluded = false): void {
    const at = event.position, volume = event.strength;
    const noise = (filter: number, duration: number, scale: number, delay = 0, q = 1) => this.note({ noise: true, filter, duration, volume: scale * volume, bus: 'ambience', at, delay, q, occluded });
    if (event.kind === 'whisper') { this.voice(event.voice, at, event.strength, occluded); return; }
    if (event.kind === 'silence' || event.kind === 'light' || event.kind === 'shadow') return;
    if (event.kind === 'thunder') { noise(85, 3.5, .7, event.delay); noise(220, 1.8, .25, event.delay); return; }
    if (['piano', 'drip', 'glass', 'metal'].includes(event.kind)) {
      const base = ({ piano: 130.81, drip: 920, glass: 1661, metal: 277 } as Record<string, number>)[event.kind];
      for (const harmonic of [1, 2.01, 3.97]) this.note({ frequency: base * harmonic, endFrequency: event.kind === 'drip' ? base * harmonic * .5 : undefined, duration: event.kind === 'drip' ? .25 : 1.7, volume: .055 * volume / harmonic, bus: 'ambience', at, occluded });
      return;
    }
    if (event.kind === 'paper') { noise(2400, .8, .13); return; }
    if (event.kind === 'footsteps' || event.kind === 'knock') for (let i = 0; i < 3; i++) noise(event.kind === 'knock' ? 380 : 140, .17, .3, i * (event.kind === 'knock' ? .32 : .62), 3);
    else if (event.kind === 'window') { noise(1700, .65, .2); noise(830, .4, .16, .23, 12); }
    else if (event.kind === 'radio') { noise(1900, 3, .2); this.note({ frequency: 830, endFrequency: 510, duration: 1.4, volume: .018, bus: 'ambience', at }); }
    else if (event.kind === 'object' || event.kind === 'door') { noise(160, .3, .45); noise(320, .8, .14, .2, 9); }
    else if (event.kind === 'apparition') this.note({ buffer: this.reverse, duration: 2, volume: .08, bus: 'voice', at });
    else noise(event.kind === 'curtain' ? 1400 : event.kind === 'scratch' ? 2500 : 190, 1.6, .14, 0, event.kind === 'creak' ? 16 : 2);
  }
  update(dt: number, frame: AudioFrame): void {
    const c = this.context;
    if (!c || !this.active || c.state !== 'running') return;
    const a = frame.atmosphere, old = this.stateName; this.stateName = a.state;
    if (old !== a.state && a.state === 'CHASE') this.pulse = 0;
    if (old !== a.state && a.state === 'CELESTINA_DETECTED_PLAYER') this.effect('detect');
    this.dialogue = Math.max(0, this.dialogue - dt);
    this.silence = a.silence; this.duckBackground(); this.syncAmbience(); this.syncRecordings(); this.updateProximity(frame);
    const listener = c.listener;
    if (listener.positionX) {
      listener.positionX.value = frame.eye[0]; listener.positionY.value = frame.eye[1]; listener.positionZ.value = frame.eye[2];
      listener.forwardX.value = frame.direction[0]; listener.forwardY.value = frame.direction[1]; listener.forwardZ.value = frame.direction[2];
      const horizontal = Math.hypot(frame.direction[0], frame.direction[2]) || 1;
      listener.upX.value = -frame.direction[0] * frame.direction[1] / horizontal; listener.upY.value = horizontal; listener.upZ.value = -frame.direction[2] * frame.direction[1] / horizontal;
    } else { listener.setPosition(...frame.eye); listener.setOrientation(...frame.direction, 0, 1, 0); }
    if (frame.ghost) this.place(this.ghostPanner, [frame.ghost.x, frame.ghost.y + 1.4, frame.ghost.z]);
    this.place(this.weatherPanner, frame.window ?? [frame.eye[0], frame.eye[1] + 5, frame.eye[2]]);
    this.mixTick -= dt;
    const chase = a.state === 'CHASE', scare = a.state === 'JUMPSCARE', ending = a.state === 'ENDING', over = a.state === 'GAME_OVER';
    if (this.mixTick <= 0 || old !== a.state) {
      this.mixTick = .1;
      const set = (gain: GainNode, value: number, fade = .7) => gain.gain.setTargetAtTime(value, c.currentTime, fade);
      set(this.wind, (.085 + frame.rainExposure * .07) * (.8 + Math.sin(c.currentTime * .16) * .2));
      set(this.rain, .07 + frame.rainExposure * .19); this.rainFilter.frequency.setTargetAtTime(650 + frame.rainExposure * 2100, c.currentTime, 1);
      set(this.roomtone, .1); set(this.layers.drone, ending ? .005 : over ? .025 : .012);
      set(this.layers.tension, a.state === 'UNEASY' ? .025 : a.state === 'CELESTINA_DETECTED_PLAYER' ? .065 : a.state === 'CELESTINA_NEARBY' ? .035 : 0, 1.6);
      set(this.layers.nearby, a.state === 'CELESTINA_NEARBY' ? .015 : a.state === 'HIDING' ? .004 : 0, 2);
      set(this.layers.chase, chase ? .027 : 0, chase ? .3 : 2.2); set(this.layers.ending, ending ? .027 : 0, 2);
      set(this.ghostBreath, frame.ghost && !ending && !over ? (.04 + .08 * a.proximity) * (.55 + .45 * Math.sin(c.currentTime * 1.1) ** 2) : 0);
      this.ghostFilter.frequency.setTargetAtTime(frame.ghostOccluded ? 550 : 2600, c.currentTime, .25);
    }
    if (ending || over) {
      if (old !== a.state) { this.voiceToken++; this.voicePlaying?.stop(); this.phrase = 0; this.pulse = 0; }
      this.pulse -= dt;
      if (ending && this.pulse <= 0 && this.phrase < 8) { this.pulse = 1.8; this.note({ frequency: [261.63, 293.66, 196, 220][this.phrase++ % 4], duration: 3, volume: .065, attack: .1, bus: 'music' }); }
      return;
    }
    this.beat -= dt; this.breath -= dt; this.pulse -= dt; this.ghostStep -= dt; this.vocal -= dt;
    const fear = a.fear, exertion = a.exertion, hiding = a.state === 'HIDING';
    if (!scare && this.beat <= 0) {
      this.beat = 60 / (58 + fear * 83 + exertion * 12);
      if (fear > .12) for (let i = 0; i < 2; i++) this.note({ frequency: i ? 48 : 63, endFrequency: 36, duration: .14, volume: (.02 + fear * .095) * (i ? .7 : 1) * (hiding ? 1.12 : 1), bus: 'effects', delay: i * .14 });
    }
    if (!scare && this.breath <= 0) {
      this.breath = 3.8 - Math.max(fear, exertion) * 2.25;
      const effort = Math.max(exertion, fear * .85);
      if (effort > .14) this.note({ noise: true, filter: 630 + effort * 310, q: 1.4, duration: .9, attack: .22, volume: .12 * effort * (hiding ? .75 : 1), bus: 'effects' });
    }
    if (this.pulse <= 0) {
      this.pulse = chase ? .43 : 8 + Math.random() * 10;
      if (chase) { this.note({ frequency: this.phrase++ % 4 === 0 ? 73.4 : 49, endFrequency: 38, duration: .28, volume: .15, bus: 'music' }); this.note({ noise: true, filter: 1500, duration: .08, volume: .07, bus: 'music' }); }
      else if (a.state === 'UNEASY' || a.state === 'CELESTINA_NEARBY') this.note({ buffer: this.reverse, duration: 2, volume: .055, bus: 'music' });
    }
    if (this.ghostStep <= 0) {
      this.ghostStep = chase ? .55 : 1.3 + Math.random() * 1.4;
      if (frame.ghost && frame.ghostMoving && Math.random() > .32) this.note({ noise: true, filter: 390, duration: .7, volume: .13, bus: 'voice', ghost: true, attack: .09 });
    }
    if (this.vocal <= 0) {
      this.vocal = 22 + Math.random() * 26;
      if (frame.ghost && a.proximity > .12 && this.dialogue === 0 && !scare) this.voice(chase ? 'laugh' : Math.random() < .5 ? 'hum' : 'cry');
    }
  }
  dispose(): void {
    this.disposed = true; this.active = false; this.pending.abort(); this.reset();
    this.background?.dispose(); this.background = null;
    if (this.recordings) for (const clip of Object.values(this.recordings)) clip.dispose();
    this.recordings = null;
    for (const source of this.permanent) { try { source.stop(); } catch { /* Already stopped. */ } source.disconnect(); }
    this.ambienceSource?.disconnect(); this.ambienceSource = null; this.ambienceStarted = null; this.ambienceStatus = 'idle'; this.ambienceTarget = 0;
    this.permanent = []; this.buffers.clear(); void this.context?.close().catch(() => {}); this.context = null;
  }
}
