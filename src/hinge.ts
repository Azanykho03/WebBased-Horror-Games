export type DoorState = 'CLOSED' | 'OPENING' | 'OPEN' | 'CLOSING';
export const smooth = (t: number) => t * t * (3 - 2 * t);

/** A pause-safe hinge clock. A blocked sweep holds time, so it cannot jump past a body. */
export class Hinge {
  state: DoorState = 'CLOSED';
  angle = 0;
  private elapsed = 0;
  readonly openAngle: number;
  readonly duration: number;
  constructor(openAngle: number, duration = .8) { this.openAngle = openAngle; this.duration = duration; }
  get busy(): boolean { return this.state === 'OPENING' || this.state === 'CLOSING'; }
  reset(open = false): void { this.state = open ? 'OPEN' : 'CLOSED'; this.angle = open ? this.openAngle : 0; this.elapsed = 0; }
  request(open: boolean): boolean {
    if (this.busy || open === (this.state === 'OPEN')) return false;
    this.state = open ? 'OPENING' : 'CLOSING'; this.elapsed = 0; return true;
  }
  update(dt: number, clear: (angle: number) => boolean = () => true): boolean {
    if (!this.busy) return false;
    const elapsed = Math.min(this.duration, this.elapsed + Math.max(0, dt));
    const t = smooth(elapsed / this.duration);
    const next = this.openAngle * (this.state === 'OPENING' ? t : 1 - t);
    const steps = Math.max(1, Math.ceil(Math.abs(next - this.angle) / .025));
    for (let i = 1; i <= steps; i++) if (!clear(this.angle + (next - this.angle) * i / steps)) return false;
    this.elapsed = elapsed; this.angle = next;
    if (elapsed === this.duration) this.state = this.state === 'OPENING' ? 'OPEN' : 'CLOSED';
    return true;
  }
}
