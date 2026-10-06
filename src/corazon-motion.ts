// Corazon's authored face points along +Z. Gameplay yaw uses (sin(yaw), -cos(yaw)).
export const corazonModelYaw = (yaw: number) => Math.PI - yaw;
export const angleDifference = (target: number, current: number) => Math.atan2(Math.sin(target - current), Math.cos(target - current));
export const smoothStep = (value: number) => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };
export const mix = (a: number, b: number, t: number) => a + (b - a) * t;

export type ScareKind = 'jumpscare' | 'capture';
export const CORAZON_SCARE = {
  jumpscare: { duration: 1.75, reveal: .16, settle: .16 },
  capture: { duration: 2.2, reveal: .38, settle: .38 },
} as const;

// Motion observations only, in seconds/radians. The supplied reference GLBs are
// never loaded by the game. Head rotations are relative to their opening pose,
// converted to Corazon's upright +Z basis. The static body has no arm/leg rig.
// See tests/corazon-motion-validation.md for reference limitations and provenance.
type PoseKey = readonly [time: number, pitch: number, yaw: number, roll: number, bodyPitch: number];
const faceAttack: readonly PoseKey[] = [
  [0, 0, 0, 0, 0], [.1, .0323, -.2933, .0777, 0], [.2, .0016, .0126, .0939, 0],
  [.3, -.0135, .017, .0782, 0], [.5, -.0439, .0256, .0924, 0], [.75, -.1143, .0382, .1633, 0],
  [1, -.1638, .0374, .1977, 0], [1.25, -.2401, .0267, .2746, 0], [1.4, -.3685, .0238, .2844, 0],
  [1.5, -.5043, .0196, .2922, 0], [1.6, -.4874, .0202, .2908, 0], [1.75, -.4656, .021, .2891, 0],
];
const finalAttack: readonly PoseKey[] = [
  [0, 0, 0, 0, 0], [.1, .0766, -.0041, -.0195, .0275], [.2, .2224, -.022, -.068, .0559],
  [.3, .3973, -.0609, -.1341, .0905], [.5, .6199, -.1496, -.2456, .1361],
  [.75, .25, .1176, .5416, .0865], [1, .3691, -.0017, .3513, .0434],
  [1.25, .3261, .0719, .1429, .0229], [1.4, .3111, .0874, .0734, .0089],
  [1.5, .2747, .0795, .0483, -.0109], [1.6, .222, .0741, .0309, -.0381],
  [1.75, .1435, .0705, .0172, -.0859], [2, .2296, .0706, .0227, -.1588],
  [2.2, .3669, .0746, .0336, -.1832],
];
function pose(keys: readonly PoseKey[], time: number): number[] {
  const next = keys.findIndex(k => k[0] >= time);
  if (next <= 0) return (next === 0 ? keys[0] : keys[keys.length - 1]).slice(1);
  const a = keys[next - 1], b = keys[next], t = smoothStep((time - a[0]) / (b[0] - a[0]));
  return a.slice(1).map((n, i) => mix(n, b[i + 1], t));
}
export function scareFrame(kind: ScareKind, time: number, reducedMotion = false, gentle = false) {
  const tuning = CORAZON_SCARE[kind], t = Math.max(0, Math.min(tuning.duration, time));
  const [pitch, yaw, roll, bodyPitch] = pose(kind === 'capture' ? finalAttack : faceAttack, t);
  const approach = smoothStep(t / tuning.settle), amount = reducedMotion ? .2 : gentle ? .55 : 1;
  // Reference faceattack holds a rolling head, then lunges in its last .4 s.
  const lunge = smoothStep((t - (kind === 'capture' ? 1.7 : 1.35)) / (kind === 'capture' ? .34 : .35));
  return {
    approach, pitch: pitch * amount, yaw: yaw * amount, roll: roll * amount, bodyPitch: bodyPitch * amount,
    distance: (kind === 'capture' ? mix(.65, .46, lunge) : mix(mix(1.85, .65, approach), .48, lunge)) + (gentle ? .3 : 0),
    visibility: kind === 'capture' ? 1 : (t >= tuning.reveal ? 1 : 0) * (1 - smoothStep((t - 1.68) / .07)),
    fade: kind === 'capture' ? smoothStep((t - 2.02) / .18) : 0,
    revealed: t >= tuning.reveal, finished: time >= tuning.duration,
  };
}

// One presentation clock; pause/backgrounding freezes both presentation and audio.
export class ScareTimeline {
  kind: ScareKind | null = null;
  time = 0;
  private revealed = false;
  start(kind: ScareKind): boolean {
    if (this.kind) return false;
    this.kind = kind; this.time = 0; this.revealed = false; return true;
  }
  update(dt: number): { reveal: boolean; finished: boolean } {
    if (!this.kind) return { reveal: false, finished: false };
    const tuning = CORAZON_SCARE[this.kind], next = this.time + Math.max(0, dt);
    const reveal = !this.revealed && next >= tuning.reveal;
    // Start the audible/visible beat together even after a long frame. Once it
    // starts, elapsed time drives the remaining motion at the audio's pace.
    this.time = reveal ? tuning.reveal : next;
    if (reveal) this.revealed = true;
    return { reveal, finished: this.time >= tuning.duration };
  }
  reset(): void { this.kind = null; this.time = 0; this.revealed = false; }
}
