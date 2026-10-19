import type { Player, InputSystem } from './player.ts';
import type { World } from './world.ts';
import type { GhostStateMachine } from './ghost.ts';
import type { Position } from './types.ts';
import type { HidingCabinet } from './fixtures.ts';
import { anchorPosition } from './fixtures.ts';
import { smooth } from './hinge.ts';
import { angleDifference } from './corazon-motion.ts';

export type HidingState = 'NORMAL' | 'OPENING_CABINET' | 'ENTERING' | 'HIDDEN' | 'EXITING' | 'CLOSING_CABINET';
/** Owns body/camera placement until a complete, safe exit. Game pause freezes this clock. */
export class HidingSystem {
  cabinet: HidingCabinet | null = null;
  private time = 0;
  private origin!: Position;
  private fromYaw = 0;
  private fromPitch = 0;
  private leaving = false;
  private restoreLight = false;
  private player: Player;
  private input: InputSystem;
  private world: World;
  constructor(player: Player, input: InputSystem, world: World) { this.player = player; this.input = input; this.world = world; }
  get state(): HidingState { return this.player.hidingState; }
  private stateTo(state: HidingState): void { this.player.hidingState = state; this.time = 0; }
  enter(cabinet: HidingCabinet, ghost: GhostStateMachine): boolean {
    if (this.player.movementLocked || !this.player.grounded || cabinet.hinge.busy) return false;
    const exit = anchorPosition(cabinet.exit, cabinet.floor);
    if (this.world.collision.blocked(exit)) return false;
    const entrance = anchorPosition(cabinet.entrance, cabinet.floor);
    // Refuse a shortcut through furniture or around a wall to the cabinet mouth.
    if (!this.world.nav.segment(this.player.position, entrance)) return false;
    this.cabinet = cabinet; this.origin = { ...this.player.position };
    this.fromYaw = this.player.yaw; this.fromPitch = this.player.pitch; this.leaving = false;
    this.restoreLight = this.player.flashlight; this.player.flashlight = false;
    this.player.hideExposed = ghost.state !== 'Dormant' && ghost.state !== 'Stunned' && ghost.grace <= 0 && ghost.sees(this.player, this.world);
    this.player.hidingAt = exit; this.player.hideYaw = cabinet.yaw;
    this.input.clear(); this.player.halt(this.world); cabinet.hinge.request(true); this.stateTo('OPENING_CABINET'); return true;
  }
  exit(): boolean {
    if (this.state !== 'HIDDEN' || !this.cabinet) return false;
    if (this.world.collision.blocked(anchorPosition(this.cabinet.exit, this.cabinet.floor))) return false;
    this.fromYaw = this.player.yaw; this.fromPitch = this.player.pitch;
    this.origin = { ...this.player.position }; this.leaving = true;
    this.player.hidden = false; this.player.hidingEye = null; this.input.clear(); this.cabinet.hinge.request(true); this.stateTo('EXITING'); return true;
  }
  update(dt: number, ghost: GhostStateMachine): void {
    const c = this.cabinet;
    if (!c || this.state === 'NORMAL') return;
    if (!this.leaving && this.state !== 'HIDDEN' && ghost.state !== 'Dormant' && ghost.state !== 'Stunned' && ghost.grace <= 0 && ghost.sees(this.player, this.world)) this.player.hideExposed = true;
    this.player.halt(this.world);
    if (this.state === 'OPENING_CABINET' && c.hinge.state === 'OPEN') this.stateTo('ENTERING');
    if (this.state === 'ENTERING') {
      this.time += dt;
      const entrance = anchorPosition(c.entrance, c.floor), hide = anchorPosition(c.hide, c.floor);
      if (this.time < .38) this.move(this.origin, entrance, smooth(this.time / .38));
      else this.move(entrance, hide, smooth(Math.min(1, (this.time - .38) / .6)));
      const t = smooth(Math.min(1, this.time / .98));
      this.player.yaw = this.fromYaw + angleDifference(c.yaw, this.fromYaw) * t; this.player.pitch = this.fromPitch * (1 - t);
      if (this.time >= .98) { c.hinge.request(false); this.stateTo('CLOSING_CABINET'); }
    } else if (this.state === 'HIDDEN') {
      this.player.position = anchorPosition(c.hide, c.floor);
      const eye = anchorPosition(c.view, c.floor); this.player.hidingEye = [eye.x, eye.y, eye.z];
    } else if (this.state === 'EXITING' && c.hinge.state === 'OPEN') {
      this.time += dt;
      const t = smooth(Math.min(1, this.time / .85)); this.move(this.origin, anchorPosition(c.exit, c.floor), t);
      this.player.yaw = this.fromYaw + angleDifference(c.yaw, this.fromYaw) * t; this.player.pitch = this.fromPitch * (1 - t);
      if (this.time >= .85) { c.hinge.request(false); this.stateTo('CLOSING_CABINET'); }
    } else if (this.state === 'CLOSING_CABINET' && c.hinge.state === 'CLOSED') {
      if (this.leaving) this.finish();
      else { this.player.hidden = true; this.stateTo('HIDDEN'); this.input.clear(); }
    }
  }
  private move(a: Position, b: Position, t: number): void {
    this.player.position = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t, level: b.level };
  }
  private finish(): void {
    this.player.hidden = this.player.hideExposed = false; this.player.hidingAt = null; this.player.hidingEye = null;
    this.player.pitch = 0; this.player.flashlight = this.restoreLight;
    this.stateTo('NORMAL'); this.cabinet = null; this.input.clear(); this.player.halt(this.world);
  }
  reset(): void {
    if (this.cabinet) {
      this.player.position = anchorPosition(this.cabinet.exit, this.cabinet.floor);
      this.cabinet.hinge.reset(); this.cabinet.pivots.forEach(p => p.rotation.y = 0);
    }
    this.finish();
  }
  interruptGrab(): void {
    // A witnessed entry can be intercepted before concealment. Keep the current
    // body position and open the leaf; never teleport to a cabinet exit mid-grab.
    if (!this.cabinet || this.player.hidden) return;
    const pitch = this.player.pitch;
    this.cabinet.hinge.reopen(); this.finish(); this.player.pitch = pitch;
  }
}
