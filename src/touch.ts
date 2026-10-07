// Touch and keyboard share the existing input path; no second player controller.
export interface TouchInput {
  active: boolean; touchMode: boolean; touchSprint: boolean;
  setTouchMode(touch: boolean): void;
  setMove(x: number, forward: number): void;
  addLook(x: number, y: number): void;
  queue(action: string): void;
}
export function detectTouch(): boolean {
  return typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0 &&
    (matchMedia('(pointer: coarse)').matches || matchMedia('(hover: none)').matches);
}
export function joystickVector(dx: number, dy: number, radius: number): [number, number] {
  const distance = Math.hypot(dx, dy), deadzone = radius * .1;
  if (distance <= deadzone || radius <= 0) return [0, 0];
  const strength = Math.min(1, (distance - deadzone) / (radius - deadzone));
  return [dx / distance * strength, -dy / distance * strength];
}
export class TouchControls {
  readonly element: HTMLElement;
  private input: TouchInput;
  private abort = new AbortController();
  private stick: HTMLElement;
  private nub: HTMLElement;
  private lookArea: HTMLElement;
  private movePointer: number | null = null;
  private lookPointer: number | null = null;
  private origin = { x: 0, y: 0, radius: 1 };
  private lastLook = { x: 0, y: 0 };
  private actions = new Map<number, HTMLButtonElement>();
  private portraitDismissed = false;
  constructor(root: HTMLElement, input: TouchInput, pause: () => void) {
    this.input = input;
    const element = this.element = document.createElement('div'); element.id = 'touch-controls'; element.hidden = true;
    element.innerHTML = `<div class="touch-look" aria-label="Touch camera area"></div>
      <div class="touch-top"><button data-touch="Tab" aria-label="Journal and inventory">▤ <span>Journal</span></button><button data-touch="Pause" aria-label="Pause game">Ⅱ <span>Pause</span></button></div>
      <div class="touch-stick" role="group" aria-label="Movement joystick"><span class="stick-label">MOVE</span><i></i></div>
      <div class="touch-actions">
        <button data-touch="KeyE" aria-label="Interact" class="touch-interact">✋<span>Interact</span></button>
        <button data-touch="Space" aria-label="Jump" class="touch-jump">↑<span>Jump</span></button>
        <button data-touch="KeyF" aria-label="Toggle flashlight">☼<span>Light</span></button>
        <button data-touch="Sprint" aria-label="Toggle sprint" aria-pressed="false">»<span>Run</span></button>
        <button data-touch="Hide" aria-label="Hide or leave hiding place">◐<span>Hide</span></button>
        <button data-touch="Throw" aria-label="Throw tsinelas">↗<span>Throw</span></button>
      </div><div class="rotate-hint"><span>Rotate your phone for the best experience.</span><button data-touch="Dismiss" aria-label="Keep playing in portrait">Keep playing</button></div>`;
    root.append(element);
    this.stick = element.querySelector('.touch-stick')!; this.nub = this.stick.querySelector('i')!; this.lookArea = element.querySelector('.touch-look')!;
    const signal = this.abort.signal;
    const capture = (target: HTMLElement, id: number) => { try { target.setPointerCapture(id); } catch { /* A cancelled pointer or a synthetic validation event has no native capture. */ } };
    element.addEventListener('contextmenu', e => e.preventDefault(), { signal });
    element.addEventListener('pointerdown', e => {
      if (!input.active || e.pointerType === 'mouse' && e.button !== 0) return;
      const target = e.target as HTMLElement, button = target.closest<HTMLButtonElement>('button[data-touch]');
      e.preventDefault();
      if (button) {
        if (button.disabled) return;
        capture(button, e.pointerId); this.actions.set(e.pointerId, button); button.classList.add('pressed');
        const action = button.dataset.touch!;
        if (action === 'Pause') pause();
        else if (action === 'Sprint') { input.touchSprint = !input.touchSprint; button.setAttribute('aria-pressed', String(input.touchSprint)); }
        else if (action === 'Dismiss') { this.portraitDismissed = true; element.classList.add('portrait-dismissed'); }
        else input.queue(action);
      } else if (this.stick.contains(target) && this.movePointer === null) {
        this.movePointer = e.pointerId; capture(this.stick, e.pointerId);
        const rect = this.stick.getBoundingClientRect(); this.origin = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, radius: rect.width * .38 };
        this.move(e.clientX, e.clientY);
      } else if (target === this.lookArea && this.lookPointer === null) {
        this.lookPointer = e.pointerId; this.lastLook = { x: e.clientX, y: e.clientY }; capture(this.lookArea, e.pointerId);
      }
    }, { signal });
    element.addEventListener('pointermove', e => {
      if (!input.active) return;
      if (e.pointerId === this.movePointer) { e.preventDefault(); this.move(e.clientX, e.clientY); }
      if (e.pointerId === this.lookPointer) {
        e.preventDefault(); const scale = 680 / Math.max(320, Math.min(innerWidth, innerHeight));
        input.addLook((e.clientX - this.lastLook.x) * scale, (e.clientY - this.lastLook.y) * scale);
        this.lastLook = { x: e.clientX, y: e.clientY };
      }
    }, { signal });
    const release = (e: PointerEvent) => {
      if (e.pointerId === this.movePointer) { this.movePointer = null; input.setMove(0, 0); this.nub.style.transform = ''; }
      if (e.pointerId === this.lookPointer) this.lookPointer = null;
      this.actions.get(e.pointerId)?.classList.remove('pressed'); this.actions.delete(e.pointerId);
    };
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) element.addEventListener(name, release, { signal });
    window.addEventListener('resize', () => { this.reset(); if (innerWidth > innerHeight) { this.portraitDismissed = false; element.classList.remove('portrait-dismissed'); } }, { signal });
    // Keyboard activation for focus users; pointer actions have already fired on down.
    element.addEventListener('click', e => {
      if (e.detail !== 0 || !input.active) return;
      const button = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-touch]');
      if (!button || button.disabled) return;
      const action = button.dataset.touch!;
      if (action === 'Pause') pause();
      else if (action === 'Sprint') { input.touchSprint = !input.touchSprint; button.setAttribute('aria-pressed', String(input.touchSprint)); }
      else if (action === 'Dismiss') { this.portraitDismissed = true; element.classList.add('portrait-dismissed'); }
      else input.queue(action);
    }, { signal });
  }
  private move(x: number, y: number): void {
    const [side, forward] = joystickVector(x - this.origin.x, y - this.origin.y, this.origin.radius);
    this.input.setMove(side, forward); this.nub.style.transform = `translate(${side * this.origin.radius}px,${-forward * this.origin.radius}px)`;
  }
  sync(playing: boolean, canHide: boolean, hidden: boolean, canThrow: boolean, hasLight: boolean, grounded = true, movementLocked = false): void {
    this.element.hidden = !playing || !this.input.touchMode;
    this.element.classList.toggle('portrait-dismissed', this.portraitDismissed);
    const hide = this.element.querySelector<HTMLButtonElement>('[data-touch="Hide"]')!;
    hide.disabled = !canHide && !hidden; hide.querySelector('span')!.textContent = hidden ? 'Leave' : 'Hide';
    this.element.querySelector<HTMLButtonElement>('[data-touch="Throw"]')!.disabled = !canThrow;
    this.element.querySelector<HTMLButtonElement>('[data-touch="KeyF"]')!.disabled = !hasLight || hidden;
    const jump = this.element.querySelector<HTMLButtonElement>('[data-touch="Space"]')!;
    jump.disabled = movementLocked || hidden;
    this.element.querySelector<HTMLButtonElement>('[data-touch="KeyE"]')!.disabled = movementLocked && !hidden;
    this.element.querySelector<HTMLButtonElement>('[data-touch="Sprint"]')!.disabled = movementLocked;
    jump.dataset.grounded = String(grounded);
    this.element.querySelector('[data-touch="Sprint"]')!.setAttribute('aria-pressed', String(this.input.touchSprint));
  }
  reset(): void {
    this.movePointer = this.lookPointer = null; this.input.setMove(0, 0); this.input.touchSprint = false;
    this.nub.style.transform = ''; for (const button of this.actions.values()) button.classList.remove('pressed'); this.actions.clear();
    this.element.querySelector('[data-touch="Sprint"]')!.setAttribute('aria-pressed', 'false');
  }
  dispose(): void { this.reset(); this.abort.abort(); this.element.remove(); }
}
