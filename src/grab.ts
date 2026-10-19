import { difficultySettings } from './difficulty.ts';
import type { Difficulty } from './difficulty.ts';

// Metres / seconds. Grab distance and windup live beside each difficulty's AI tuning.
export const GRAB = {
  reachSeconds: .6, fallSeconds: .9, dragSeconds: .65,
  kickSeconds: .32, releaseSeconds: .36, recoverySeconds: 1.2,
  finishLeadSeconds: .24, protectionSeconds: 3,
  pullDistance: .24, minimumDistance: .94, groundDistance: 1.38, separationDistance: .35,
  eyeHeight: .47, eyeBack: .47, hipHeight: .11,
} as const;
export type GrabPhase = 'idle' | 'grab-start' | 'falling' | 'dragging' | 'struggling' | 'escape-kick' | 'release' | 'recovery' | 'killing';
export function escapeRequirement(difficulty: Difficulty, attempt: number) {
  const t = difficultySettings[difficulty], n = Math.max(0, Math.min(100, Math.floor(Number.isFinite(attempt) ? attempt : 1) - 1));
  return { presses: Math.min(t.struggleMaxPresses, t.strugglePresses + n * t.strugglePressStep),
    seconds: Math.max(t.struggleMinSeconds, t.struggleSeconds - n * t.struggleTimeStep) };
}

/** One simulation clock, advanced only by active gameplay. No wall-clock timers. */
export class GrabSequence {
  phase: GrabPhase = 'idle';
  time = 0;
  remaining = 0;
  presses = 0;
  required = 0;
  attempts = 0;
  private limit = 0;
  private killDelivered = false;
  get active(): boolean { return this.phase !== 'idle'; }
  get progress(): number { return this.required ? this.presses / this.required : 0; }
  start(difficulty: Difficulty): boolean {
    if (this.active) return false;
    const tuning = escapeRequirement(difficulty, ++this.attempts);
    this.phase = 'grab-start'; this.time = 0; this.presses = 0; this.killDelivered = false;
    this.required = tuning.presses; this.remaining = this.limit = tuning.seconds;
    return true;
  }
  press(): boolean {
    if (this.phase !== 'struggling' || this.remaining <= 0) return false;
    this.presses++;
    if (this.presses >= this.required) { this.phase = 'escape-kick'; this.time = 0; }
    return true;
  }
  update(dt: number, groundedReady = true): 'falling' | 'dragging' | 'interactive' | 'release' | 'recovery' | 'released' | 'failed' | 'kill' | null {
    if (!this.active || !Number.isFinite(dt)) return null;
    dt = Math.max(0, dt); this.time += dt;
    if (this.phase === 'grab-start' && this.time >= GRAB.reachSeconds) {
      this.phase = 'falling'; this.time = 0; return 'falling';
    }
    if (this.phase === 'falling' && this.time >= GRAB.fallSeconds && groundedReady) {
      this.phase = 'dragging'; this.time = 0; return 'dragging';
    }
    if (this.phase === 'dragging' && this.time >= GRAB.dragSeconds && groundedReady) {
      // Count down only after the player is grounded and the drag has settled.
      this.phase = 'struggling'; this.time = 0; this.remaining = this.limit; return 'interactive';
    }
    if (this.phase === 'struggling') {
      this.remaining = Math.max(0, this.limit - this.time);
      if (this.remaining <= 0) { this.phase = 'killing'; this.time = 0; return 'failed'; }
    }
    if (this.phase === 'killing' && this.time >= GRAB.finishLeadSeconds && !this.killDelivered) { this.killDelivered = true; return 'kill'; }
    if (this.phase === 'escape-kick' && this.time >= GRAB.kickSeconds) { this.phase = 'release'; this.time = 0; return 'release'; }
    if (this.phase === 'release' && this.time >= GRAB.releaseSeconds) { this.phase = 'recovery'; this.time = 0; return 'recovery'; }
    if (this.phase === 'recovery' && this.time >= GRAB.recoverySeconds) { this.phase = 'idle'; return 'released'; }
    return null;
  }
  reset(): void { this.phase = 'idle'; this.time = this.remaining = this.presses = this.required = this.limit = 0; this.killDelivered = false; }
  resetRun(): void { this.reset(); this.attempts = 0; }
}

/** Kept separate from frame queues: two presses between renders are still two presses. */
export class StruggleInput {
  private down = false;
  keyDown(repeat: boolean): boolean {
    if (repeat || this.down) return false;
    this.down = true; return true;
  }
  keyUp(): void { this.down = false; }
}
