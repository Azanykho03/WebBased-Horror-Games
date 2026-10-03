import { detectTouch } from './touch.ts';

export interface FullscreenHost {
  supported(): boolean;
  fullscreen(): boolean;
  request(): Promise<void>;
}

/** One automatic attempt and one activation retry per landscape/session transition. */
export class LandscapeFullscreen {
  private eligible = false;
  private automaticAttempted = false;
  private gestureAttempted = false;
  private pending = false;
  private dismissed = false;
  private wasFullscreen = false;
  private host: FullscreenHost;
  constructor(host: FullscreenHost) { this.host = host; }
  sync(playing: boolean, mobile: boolean, landscape: boolean, gesture = false): void {
    const eligible = playing && mobile && landscape;
    if (eligible !== this.eligible) {
      this.automaticAttempted = this.gestureAttempted = this.dismissed = false;
      this.eligible = eligible;
    }
    if (eligible) this.attempt(gesture);
  }
  interact(): void { this.attempt(true); }
  changed(): void {
    const fullscreen = this.host.fullscreen();
    if (this.wasFullscreen && !fullscreen) this.dismissed = true;
    this.wasFullscreen = fullscreen;
  }
  private attempt(gesture: boolean): void {
    if (!this.eligible || this.pending || this.dismissed || !this.host.supported() || this.host.fullscreen()) return;
    if (gesture ? this.gestureAttempted : this.automaticAttempted) return;
    this.automaticAttempted = true;
    if (gesture) this.gestureAttempted = true;
    this.pending = true;
    // Call synchronously so Start/Continue's transient activation is preserved.
    try {
      void this.host.request().then(() => { this.wasFullscreen = this.host.fullscreen(); }, () => {
        // Rejection is expected on browsers requiring a fresh tap or denying fullscreen.
      }).finally(() => { this.pending = false; });
    } catch { this.pending = false; }
  }
}

export class MobileDisplay {
  private abort = new AbortController();
  private frame = 0;
  private playing = false;
  private resize: () => void;
  private mobile: () => boolean;
  private fullscreen = new LandscapeFullscreen({
    supported: () => !!document.documentElement.requestFullscreen && document.fullscreenEnabled !== false,
    fullscreen: () => !!document.fullscreenElement,
    request: () => document.documentElement.requestFullscreen({ navigationUI: 'hide' }),
  });
  constructor(resize: () => void, mobile = detectTouch) {
    this.resize = resize; this.mobile = mobile;
    const signal = this.abort.signal;
    const resized = () => {
      this.sync(this.playing);
      cancelAnimationFrame(this.frame);
      this.frame = requestAnimationFrame(() => this.resize());
    };
    window.addEventListener('resize', resized, { signal });
    window.addEventListener('orientationchange', resized, { signal });
    window.screen.orientation?.addEventListener('change', resized, { signal });
    window.visualViewport?.addEventListener('resize', resized, { signal });
    document.addEventListener('fullscreenchange', () => { this.fullscreen.changed(); resized(); }, { signal });
    // Touch activation is reliably available on release; this also covers gameplay taps.
    const interact = (event: Event) => { if (event.isTrusted) this.fullscreen.interact(); };
    document.addEventListener('pointerup', interact, { signal, capture: true, passive: true });
    document.addEventListener('click', interact, { signal, capture: true, passive: true });
  }
  sync(playing: boolean, gesture = false): void {
    this.playing = playing;
    this.fullscreen.sync(playing, this.mobile(), innerWidth > innerHeight, gesture);
  }
  dispose(): void { this.abort.abort(); cancelAnimationFrame(this.frame); }
}
