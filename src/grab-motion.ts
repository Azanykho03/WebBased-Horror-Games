import type * as Babylon from 'babylonjs';
import { B } from './world.ts';

export type GrabClip = 'run' | 'stumble' | 'crawl' | 'kick';
type Frame = { legs: number[]; pelvis: number[]; height: number; hands: number[]; bend: number };
type Clip = { duration: number; fps: number; frames: Frame[] };
export type MotionPose = { legs: Babylon.Quaternion[]; pelvis: Babylon.Quaternion; height: number; hands: [Babylon.Vector3, Babylon.Vector3]; bend: number };
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
const finiteArray = (value: unknown, length: number): value is number[] => Array.isArray(value) && value.length === length && value.every(Number.isFinite);
function validFrame(frame: unknown): frame is Frame {
  return record(frame) && finiteArray(frame.legs, 24) && finiteArray(frame.pelvis, 4) && finiteArray(frame.hands, 6)
    && typeof frame.height === 'number' && Number.isFinite(frame.height) && typeof frame.bend === 'number' && Number.isFinite(frame.bend);
}
function validClip(clip: unknown): clip is Clip {
  return record(clip) && typeof clip.duration === 'number' && clip.duration > 0 && clip.duration < 30 && clip.fps === 30
    && Array.isArray(clip.frames) && clip.frames.length === Math.round(clip.duration * clip.fps) + 1 && clip.frames.every(validFrame);
}

/** The inspected FBXs, baked once offline. One shared preload, no per-grab loads or animation instances. */
export class GrabMotion {
  private clips: Record<GrabClip, Clip>;
  constructor(data: unknown) {
    if (!record(data) || data.version !== 1 || !record(data.clips)) throw new Error('Invalid grab motion asset');
    const { run, stumble, crawl, kick } = data.clips;
    if (!validClip(run) || !validClip(stumble) || !validClip(crawl) || !validClip(kick)) throw new Error('Missing or invalid grab animation tracks');
    this.clips = { run, stumble, crawl, kick };
  }
  duration(clip: GrabClip): number { return this.clips[clip].duration; }
  sample(name: GrabClip, time: number, loop = false): MotionPose {
    const clip = this.clips[name], seconds = Math.max(0, Number.isFinite(time) ? time : 0);
    const frame = Math.min(clip.frames.length - 1, (loop ? seconds % clip.duration : Math.min(seconds, clip.duration)) * clip.fps);
    const index = Math.floor(frame), a = clip.frames[index], b = clip.frames[Math.min(index + 1, clip.frames.length - 1)], t = frame - index;
    const q = (a: number[], b: number[], offset = 0) => B.Quaternion.Slerp(B.Quaternion.FromArray(a, offset), B.Quaternion.FromArray(b, offset), t).normalize();
    return { legs: Array.from({ length: 6 }, (_, i) => q(a.legs, b.legs, i * 4)), pelvis: q(a.pelvis, b.pelvis),
      height: a.height + (b.height - a.height) * t, bend: a.bend + (b.bend - a.bend) * t,
      hands: [B.Vector3.Lerp(B.Vector3.FromArray(a.hands), B.Vector3.FromArray(b.hands), t),
        B.Vector3.Lerp(B.Vector3.FromArray(a.hands, 3), B.Vector3.FromArray(b.hands, 3), t)] };
  }
}
