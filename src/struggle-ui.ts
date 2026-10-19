import type { GrabSequence } from './grab.ts';

/** Persistent nodes keep taps, focus and the animated meter stable between frames. */
export class StruggleUI {
  readonly element: HTMLElement;
  private timer: HTMLElement;
  private count: HTMLElement;
  private fill: HTMLElement;
  private meter: HTMLElement;
  private button: HTMLButtonElement;
  private pointers = new Set<number>();
  private lastPresses = 0;
  private abort = new AbortController();
  constructor(root: HTMLElement, press: () => void, pause: () => void) {
    const element = this.element = document.createElement('section');
    element.id = 'struggle'; element.hidden = true; element.setAttribute('aria-label', 'Struggle to escape');
    element.innerHTML = `<button class="struggle-pause" aria-label="Pause struggle">Ⅱ</button>
      <div class="struggle-card"><span class="eyebrow">BREAK HER GRIP</span>
      <h2>KICK TO ESCAPE!</h2><p class="struggle-desktop">Press E repeatedly. Every press is a kick.</p>
      <div class="struggle-status"><span class="struggle-count"></span><span class="struggle-timer" role="timer" aria-label="Seconds remaining"></span></div>
      <div class="struggle-track" role="progressbar" aria-label="Escape progress" aria-valuemin="0"><i></i></div>
      <button class="struggle-tap" tabindex="-1">TAP TO ESCAPE!</button>
      <p>Keep fighting. Don't let her hold you.</p></div>`;
    root.append(element);
    this.timer = element.querySelector('.struggle-timer')!; this.count = element.querySelector('.struggle-count')!;
    this.meter = element.querySelector('.struggle-track')!; this.fill = this.meter.querySelector('i')!;
    this.button = element.querySelector('.struggle-tap')!;
    const signal = this.abort.signal;
    element.addEventListener('pointerdown', event => { event.preventDefault(); event.stopPropagation(); }, { signal });
    element.addEventListener('pointermove', event => { event.preventDefault(); event.stopPropagation(); }, { signal });
    element.addEventListener('contextmenu', event => event.preventDefault(), { signal });
    this.button.addEventListener('pointerdown', event => {
      if (element.hidden || this.button.disabled || this.pointers.has(event.pointerId) || event.pointerType === 'mouse' && event.button !== 0) return;
      this.pointers.add(event.pointerId);
      try { this.button.setPointerCapture(event.pointerId); } catch { /* Synthetic audit / cancelled native pointer. */ }
      press();
    }, { signal });
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) this.button.addEventListener(name, event => this.pointers.delete(event.pointerId), { signal });
    element.querySelector('.struggle-pause')!.addEventListener('click', pause, { signal });
  }
  update(sequence: GrabSequence, playing: boolean): void {
    const visible = playing && sequence.phase === 'struggling';
    if (this.element.hidden === visible) { this.element.hidden = !visible; this.pointers.clear(); this.lastPresses = 0; }
    this.button.disabled = !visible;
    if (!visible) return;
    this.timer.textContent = `${sequence.remaining.toFixed(1)}s`;
    this.count.textContent = `Grab ${sequence.attempts} · ${sequence.presses} / ${sequence.required}`;
    if (sequence.presses > this.lastPresses) {
      this.lastPresses = sequence.presses;
      this.meter.animate([{ filter: 'brightness(1.8)' }, { filter: 'brightness(1)' }], { duration: 140 });
    }
    this.meter.setAttribute('aria-valuemax', String(sequence.required));
    this.meter.setAttribute('aria-valuenow', String(sequence.presses));
    this.fill.style.transform = `scaleX(${sequence.progress})`;
    this.element.dataset.urgent = String(sequence.remaining <= 2);
  }
  dispose(): void { this.abort.abort(); this.pointers.clear(); this.element.remove(); }
}
