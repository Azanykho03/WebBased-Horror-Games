import type { Settings } from './types.ts';

// Hardware scaling is CSS-pixel based because Engine.adaptToDeviceRatio is false.
// A high-DPI phone never renders a full 3x/4x framebuffer.
export class PerformanceProfile {
  private extraScale = 1;
  private sample = 0;
  private frames = 0;
  private slowWindows = 0;
  private fastWindows = 0;
  low(settings: Settings, touch: boolean): boolean { return settings.quality === 'low' || settings.quality === 'auto' && touch; }
  scale(settings: Settings, touch: boolean, dpr: number): number {
    const base = this.low(settings, touch) ? 1.25 : 1 / Math.min(1.5, Math.max(1, dpr));
    return Math.max(base, Math.min(2, base * this.extraScale));
  }
  update(realDt: number, settings: Settings, touch: boolean): boolean {
    if (settings.quality !== 'auto' || !touch) return false;
    this.sample += Math.min(.25, realDt); this.frames++;
    if (this.sample < 4) return false;
    const fps = this.frames / this.sample; this.sample = this.frames = 0;
    this.slowWindows = fps < 29 ? this.slowWindows + 1 : 0; this.fastWindows = fps > 53 ? this.fastWindows + 1 : 0;
    const previous = this.extraScale;
    if (this.slowWindows >= 2) { this.extraScale = Math.min(1.6, this.extraScale + .15); this.slowWindows = 0; }
    if (this.fastWindows >= 4) { this.extraScale = Math.max(1, this.extraScale - .1); this.fastWindows = 0; }
    return previous !== this.extraScale;
  }
  resetSamples(): void { this.sample = this.frames = this.slowWindows = this.fastWindows = 0; }
}
