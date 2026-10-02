// Validation-only pointer input. Real TouchControls handles every event; the
// driver never changes player transforms, progress, collision or enemy state.
import type { InputSystem, Player } from '../src/player.ts';
import type { Vec3 } from '../src/types.ts';

export class TouchDriver {
  private stick = document.querySelector<HTMLElement>('.touch-stick')!;
  private camera = document.querySelector<HTMLElement>('.touch-look')!;
  private moving = false;
  private looking = false;
  private lookX = 0;
  private lookY = 0;
  constructor(private input: InputSystem, private player: Player, private sensitivity: () => number) {}
  private pointer(target: Element, type: string, id: number, x = 0, y = 0): void {
    target.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: id, pointerType: 'touch', isPrimary: id === 501, button: 0, buttons: type === 'pointerup' || type === 'pointercancel' ? 0 : 1, clientX: x, clientY: y }));
  }
  move(side: number, forward: number): void {
    const r = this.stick.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
    if (!side && !forward) { if (this.moving) this.pointer(this.stick, 'pointerup', 501, x, y); this.moving = false; return; }
    if (!this.moving) { this.pointer(this.stick, 'pointerdown', 501, x, y); this.moving = true; }
    this.pointer(this.stick, 'pointermove', 501, x + side * r.width * .38, y - forward * r.width * .38);
  }
  drag(x: number, y: number): void {
    if (!this.looking) { const r = this.camera.getBoundingClientRect(); this.lookX = r.left + 25; this.lookY = r.top + r.height / 2; this.pointer(this.camera, 'pointerdown', 502, this.lookX, this.lookY); this.looking = true; }
    this.lookX += x; this.lookY += y;
    this.pointer(this.camera, 'pointermove', 502, this.lookX, this.lookY);
  }
  aim(at: Vec3): void {
    const eye = this.player.eye, dx = at[0] - eye[0], dz = at[2] - eye[2];
    const yaw = Math.atan2(dx, -dz), pitch = Math.max(-1.35, Math.min(1.35, Math.atan2(at[1] - eye[1], Math.hypot(dx, dz))));
    const difference = Math.atan2(Math.sin(yaw - this.player.yaw), Math.cos(yaw - this.player.yaw));
    const scale = .0022 * this.sensitivity() * 680 / Math.max(320, Math.min(innerWidth, innerHeight));
    this.drag(difference / scale, (this.player.pitch - pitch) / scale);
  }
  button(action: string): boolean {
    const button = document.querySelector<HTMLButtonElement>(`#touch-controls [data-touch="${action}"]`)!;
    if (button.disabled || button.getBoundingClientRect().width === 0) return false;
    const r = button.getBoundingClientRect(); this.pointer(button, 'pointerdown', 503, r.left + r.width / 2, r.top + r.height / 2); this.pointer(button, 'pointerup', 503); return true;
  }
  sprint(): void { if (!this.input.touchSprint) this.button('Sprint'); }
  release(cancel = false): void {
    if (this.moving) this.pointer(this.stick, cancel ? 'pointercancel' : 'pointerup', 501);
    if (this.looking) this.pointer(this.camera, cancel ? 'pointercancel' : 'pointerup', 502);
    this.moving = this.looking = false;
  }
}
