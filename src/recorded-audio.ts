// A decoded recording owns at most one source. Reversing a fade reuses that
// source; zero gain actually stops it. One-shots never wait for a network load.
export class RecordedAudio {
  private readonly context: AudioContext;
  private readonly gain: GainNode;
  private readonly loop: boolean;
  private buffer: AudioBuffer | null = null;
  private source: AudioBufferSourceNode | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private envelope = { from: 0, to: 0, start: 0, end: 0 };
  private startedAt = 0;
  private starts = 0;
  private disposed = false;
  private status: 'loading' | 'ready' | 'unavailable' = 'loading';

  constructor(context: AudioContext, destination: AudioNode, loop: boolean) {
    this.context = context; this.loop = loop;
    this.gain = context.createGain(); this.gain.gain.value = 0; this.gain.connect(destination);
  }
  setBuffer(buffer: AudioBuffer | null): void {
    if (this.disposed) return;
    this.buffer = buffer; this.status = buffer ? 'ready' : 'unavailable';
  }
  private level(): number {
    const e = this.envelope, progress = e.end <= e.start ? 1 : Math.max(0, Math.min(1, (this.context.currentTime - e.start) / (e.end - e.start)));
    return e.from + (e.to - e.from) * progress;
  }
  get diagnostics() {
    const elapsed = this.source ? this.context.currentTime - this.startedAt : 0;
    return { status: this.status, loop: this.loop, sources: this.source ? 1 : 0, starts: this.starts,
      playing: Boolean(this.source) && this.context.state === 'running', gain: this.level(), target: this.envelope.to,
      duration: this.buffer?.duration ?? 0, time: this.loop && this.buffer ? elapsed % this.buffer.duration : elapsed };
  }
  setLevel(level: number, fade: number): void {
    if (this.disposed) return;
    const target = Math.max(0, Math.min(1, level));
    if (target > 0 && !this.source) {
      if (!this.buffer) return;
      const source = this.context.createBufferSource();
      source.buffer = this.buffer; source.loop = this.loop; source.connect(this.gain);
      source.onended = () => {
        source.disconnect();
        if (this.source === source) { this.source = null; this.fade(0, 0); }
      };
      this.source = source; this.startedAt = this.context.currentTime; this.starts++;
      source.start(this.startedAt);
    } else if (target === this.envelope.to) return;
    clearTimeout(this.timer); this.timer = undefined;
    this.fade(target, fade);
    if (target === 0 && this.source) {
      const finish = () => {
        if (this.disposed || this.envelope.to !== 0) return;
        const remaining = this.envelope.end - this.context.currentTime;
        if (remaining > .005) this.timer = setTimeout(finish, Math.max(25, remaining * 1000));
        else this.stop();
      };
      if (fade <= 0) this.stop();
      else this.timer = setTimeout(finish, fade * 1000);
    }
  }
  private fade(to: number, seconds: number): void {
    const now = this.context.currentTime, from = this.level(), param = this.gain.gain;
    param.cancelScheduledValues(now); param.setValueAtTime(from, now);
    if (seconds <= 0) param.setValueAtTime(to, now);
    else param.linearRampToValueAtTime(to, now + seconds);
    this.envelope = { from, to, start: now, end: now + Math.max(0, seconds) };
  }
  stop(): void {
    clearTimeout(this.timer); this.timer = undefined;
    const source = this.source; this.source = null;
    if (source) { source.onended = null; source.stop(); source.disconnect(); }
    this.fade(0, 0);
  }
  dispose(): void { this.stop(); this.disposed = true; this.buffer = null; this.gain.disconnect(); }
}

export function proximityLevel(distance: number, nearby: boolean, settings: {
  enterDistance: number; exitDistance: number; fullVolumeDistance: number; minimumVolume: number; volume: number;
}): { nearby: boolean; volume: number } {
  const active = Number.isFinite(distance) && distance <= (nearby ? settings.exitDistance : settings.enterDistance);
  const intensity = Math.max(0, Math.min(1, (settings.exitDistance - distance) / (settings.exitDistance - settings.fullVolumeDistance)));
  return { nearby: active, volume: active ? settings.minimumVolume + (settings.volume - settings.minimumVolume) * intensity : 0 };
}
