import type { World } from './world.ts';
import { B } from './world.ts';
import type { Position, Progress, Settings, Vec3 } from './types.ts';

export class InputSystem {
  readonly keys = new Set<string>();
  private pressed = new Set<string>();
  private lookX = 0;
  private lookY = 0;
  private controller = new AbortController();
  active = false;
  dragging = false;
  pointerLocked = false;
  lockFailed = false;

  constructor(canvas: HTMLCanvasElement, onPause: () => void) {
    const signal = this.controller.signal;
    window.addEventListener('keydown', e => {
      if (!this.active) return;
      if (['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      if (!e.repeat) this.pressed.add(e.code);
      this.keys.add(e.code);
      if (e.code === 'Escape') onPause();
    }, { signal });
    window.addEventListener('keyup', e => this.keys.delete(e.code), { signal });
    window.addEventListener('blur', onPause, { signal });
    document.addEventListener('visibilitychange', () => { if (document.hidden) onPause(); }, { signal });
    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === canvas;
      if (!this.pointerLocked && this.active && !this.lockFailed) onPause();
    }, { signal });
    document.addEventListener('pointerlockerror', () => { this.lockFailed = true; }, { signal });
    canvas.addEventListener('pointerdown', e => {
      if (!this.active) return;
      if (e.button === 0) this.pressed.add('Throw');
      if (e.button === 2) { this.dragging = true; canvas.setPointerCapture(e.pointerId); }
    }, { signal });
    canvas.addEventListener('pointerup', () => { this.dragging = false; }, { signal });
    canvas.addEventListener('contextmenu', e => e.preventDefault(), { signal });
    document.addEventListener('mousemove', e => {
      if (this.active && (this.pointerLocked || this.dragging)) { this.lookX += e.movementX; this.lookY += e.movementY; }
    }, { signal });
  }
  start(canvas: HTMLCanvasElement): void {
    this.clear(); this.active = true; this.lockFailed = false; canvas.focus();
    try {
      const request = canvas.requestPointerLock();
      if (request) void request.catch(() => { this.lockFailed = true; });
    } catch { this.lockFailed = true; }
  }
  stop(): void { this.active = false; this.clear(); if (document.pointerLockElement) document.exitPointerLock(); }
  clear(): void { this.keys.clear(); this.pressed.clear(); this.lookX = this.lookY = 0; this.dragging = false; }
  consume(key: string): boolean { const value = this.pressed.has(key); this.pressed.delete(key); return value; }
  queue(key: string): void { this.pressed.add(key); }
  look(): [number, number] { const value: [number, number] = [this.lookX, this.lookY]; this.lookX = this.lookY = 0; return value; }
  dispose(): void { this.stop(); this.controller.abort(); }
}

export class Player {
  position: Position = { x: 0, y: 0, z: -2.5, level: 0 };
  yaw = 0;
  pitch = 0;
  stamina = 6;
  flashlight = true;
  hidden = false;
  hideExposed = false;
  moving = false;
  sprinting = false;
  private recovery = 0;
  private exhausted = false;
  private step = 0;
  private bob = 0;
  direction = new B.Vector3(0, 0, -1);
  reset(position: Position): void {
    this.position = { ...position }; this.yaw = 0; this.pitch = 0;
    this.stamina = 6; this.recovery = 0; this.exhausted = false;
    this.hidden = this.hideExposed = this.moving = this.sprinting = false;
    this.flashlight = true; this.step = 0; this.bob = 0;
  }
  update(dt: number, input: InputSystem, world: World, progress: Progress, settings: Settings, noise: (p: Position, radius: number) => void, footstep: () => void): void {
    const [dx, dy] = input.look();
    this.yaw += dx * .0022 * settings.sensitivity;
    this.pitch = Math.max(-1.35, Math.min(1.35, this.pitch - dy * .0022 * settings.sensitivity));
    if (input.keys.has('ArrowLeft')) this.yaw -= dt * 1.5;
    if (input.keys.has('ArrowRight')) this.yaw += dt * 1.5;
    if (input.keys.has('ArrowUp')) this.pitch = Math.min(1.35, this.pitch + dt);
    if (input.keys.has('ArrowDown')) this.pitch = Math.max(-1.35, this.pitch - dt);
    if (input.consume('KeyF') && progress.collected.includes('flashlight')) this.flashlight = !this.flashlight;
    if (this.hidden) this.flashlight = false;
    const forward = Number(input.keys.has('KeyW')) - Number(input.keys.has('KeyS'));
    const side = Number(input.keys.has('KeyD')) - Number(input.keys.has('KeyA'));
    const norm = Math.hypot(forward, side);
    this.sprinting = !this.hidden && norm > 0 && !this.exhausted && this.stamina > 0 && (input.keys.has('ShiftLeft') || input.keys.has('ShiftRight'));
    const speed = this.sprinting ? 3.9 : 2.1;
    const before = this.position;
    if (norm > 0 && !this.hidden) this.position = world.nav.move(before, (Math.sin(this.yaw) * forward + Math.cos(this.yaw) * side) / norm * speed * dt, (-Math.cos(this.yaw) * forward + Math.sin(this.yaw) * side) / norm * speed * dt);
    const distance = Math.hypot(this.position.x - before.x, this.position.z - before.z);
    this.moving = distance > .0001;
    if (this.sprinting && this.moving) {
      this.stamina = Math.max(0, this.stamina - dt); this.recovery = 1.4;
      if (this.stamina === 0) this.exhausted = true;
    } else {
      this.recovery = Math.max(0, this.recovery - dt);
      if (this.recovery === 0) this.stamina = Math.min(6, this.stamina + dt * 1.25);
      if (this.stamina >= 1.8) this.exhausted = false;
    }
    this.step += distance;
    if (this.step > (this.sprinting ? 1.1 : .95)) { this.step = 0; footstep(); noise(this.position, this.sprinting ? 11 : 3); }
    if (this.flashlight && progress.collected.includes('flashlight')) progress.battery = Math.max(0, progress.battery - dt * .17);
    this.bob += distance * 7;
    this.camera(world, settings);
    world.arms.setEnabled(progress.collected.includes('flashlight') && !this.hidden);
    world.arms.position.y = -.34 + (settings.reducedMotion ? 0 : Math.sin(this.bob) * .008);
  }
  camera(world: World, settings: Settings): void {
    this.direction.set(Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch));
    world.camera.position.set(this.position.x, this.position.y + world.data.eyeHeight + (settings.reducedMotion || !this.moving ? 0 : Math.sin(this.bob) * .012), this.position.z);
    world.camera.setTarget(world.camera.position.add(this.direction));
  }
  get eye(): Vec3 { return [this.position.x, this.position.y + 1.65, this.position.z]; }
}
