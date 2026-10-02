export type MusicTrack = 'menu' | 'game';
export const MUSIC_FADE_SECONDS = .8;

// Stream long recordings through the existing mixer instead of decoding entire
// songs into memory on phones. Reusing one element also prevents overlapping BGM.
export class BackgroundMusic {
  private readonly media = new Audio();
  private readonly source: MediaElementAudioSourceNode;
  private readonly gain: GainNode;
  private readonly context: AudioContext;
  private readonly urls: Record<MusicTrack, string>;
  private current: MusicTrack | null = null;
  private requested: MusicTrack | null = null;
  private active = false;
  private disposed = false;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private playToken = 0;
  private pendingPlay: Promise<void> | null = null;
  private error: string | null = null;
  private envelope = { from: 0, to: 0, start: 0, end: 0 };

  constructor(context: AudioContext, destination: AudioNode, urls: Record<MusicTrack, string>) {
    this.context = context; this.urls = urls;
    this.media.loop = true; this.media.preload = 'auto';
    this.media.setAttribute('playsinline', '');
    this.gain = context.createGain(); this.gain.gain.value = 0; this.gain.connect(destination);
    this.source = context.createMediaElementSource(this.media); this.source.connect(this.gain);
  }
  get diagnostics() {
    return { track: this.current, requested: this.requested, playing: this.active && !this.media.paused && this.context.state === 'running',
      time: this.media.currentTime, gain: this.level(), error: this.error };
  }
  select(track: MusicTrack | null): void {
    if (this.disposed || track === this.requested) return;
    this.requested = track;
    if (this.active) this.transition();
  }
  resume(): void {
    if (this.disposed) return;
    if (this.active) {
      // Keep retrying blocked playback on subsequent gestures, without restarting
      // a running song or rescheduling a fade on every key press / touch.
      if (!this.timer && this.media.paused) this.play();
      return;
    }
    this.active = true; this.transition();
  }
  pause(): void {
    this.active = false; this.clearTimer(); this.cancelPlay();
    this.media.pause(); this.fade(0, 0);
  }
  private level(): number {
    const e = this.envelope;
    const progress = e.end <= e.start ? 1 : Math.max(0, Math.min(1, (this.context.currentTime - e.start) / (e.end - e.start)));
    return e.from + (e.to - e.from) * progress;
  }
  private fade(to: number, seconds = MUSIC_FADE_SECONDS): void {
    const now = this.context.currentTime, from = this.level(), param = this.gain.gain;
    param.cancelScheduledValues(now); param.setValueAtTime(from, now);
    if (seconds === 0) param.setValueAtTime(to, now);
    else param.linearRampToValueAtTime(to, now + seconds);
    this.envelope = { from, to, start: now, end: now + seconds };
  }
  private clearTimer(): void { clearTimeout(this.timer); this.timer = undefined; }
  private cancelPlay(): void { this.playToken++; this.pendingPlay = null; }
  private transition(): void {
    this.clearTimer();
    if (this.current === this.requested) {
      if (this.media.paused) this.play();
      else this.fade(1);
      return;
    }
    if (this.current && !this.media.paused && this.level() > 0) {
      this.fade(0);
      const end = this.context.currentTime + MUSIC_FADE_SECONDS;
      const finish = () => {
        if (!this.active || this.disposed) return;
        const remaining = end - this.context.currentTime;
        // Audio time freezes during browser interruptions; a wall-clock timeout
        // must never cut off a fade that has not actually finished.
        if (remaining > .005) this.timer = setTimeout(finish, Math.max(25, remaining * 1000));
        else { this.timer = undefined; this.switchTrack(); }
      };
      this.timer = setTimeout(finish, MUSIC_FADE_SECONDS * 1000);
    } else this.switchTrack();
  }
  private switchTrack(): void {
    this.cancelPlay(); this.media.pause(); this.fade(0, 0);
    this.current = this.requested; this.error = null;
    if (!this.current) { this.media.removeAttribute('src'); this.media.load(); return; }
    this.media.src = this.urls[this.current];
    this.play();
  }
  private play(): void {
    if (!this.active || this.disposed || !this.current || this.pendingPlay) return;
    const token = ++this.playToken;
    // Called synchronously from the gesture handler alongside AudioContext.resume.
    // Waiting for resume or a fetch first can lose mobile user activation.
    if (this.media.error) this.media.load();
    this.pendingPlay = this.media.play();
    void this.pendingPlay.then(() => {
      if (token !== this.playToken) return;
      this.error = null; this.fade(1);
    }).catch((error: unknown) => {
      if (token === this.playToken) this.error = error instanceof Error ? error.name : String(error);
    }).finally(() => {
      if (token === this.playToken) this.pendingPlay = null;
    });
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true; this.pause(); this.current = this.requested = null;
    this.media.removeAttribute('src'); this.media.load();
    this.source.disconnect(); this.gain.disconnect();
  }
}
