import { DEFAULT_SETTINGS } from './types.ts';
import type { Progress, Settings, ItemId } from './types.ts';
import { bearingsFound, keepsakeCount, has } from './objectives.ts';

const SAVE_KEY = 'balay.checkpoint.v1', SETTINGS_KEY = 'balay.settings.v1';
const itemIds: ItemId[] = ['flashlight', 'note', 'fuse', 'locket', 'letter', 'music-box', 'exit-key', 'battery-kitchen', 'battery-study', 'battery-guest', 'tsinelas'];
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const bounded = (value: unknown, min: number, max: number): value is number => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
export function parseSave(raw: string | null): Progress | null {
  try {
    if (!raw) return null;
    const envelope: unknown = JSON.parse(raw);
    if (!record(envelope) || envelope.version !== 1 || !record(envelope.progress)) return null;
    const p = envelope.progress;
    if (!Array.isArray(p.collected) || !p.collected.every(id => typeof id === 'string' && itemIds.includes(id as ItemId)) || new Set(p.collected).size !== p.collected.length) return null;
    if (!['power', 'cabinet', 'exitUnlocked', 'kitchenSeen'].every(key => typeof p[key] === 'boolean')) return null;
    if (!bounded(p.battery, 0, 100) || !bounded(p.elapsed, 0, 604800) || !['entrance', 'breaker', 'cabinet'].includes(String(p.checkpoint))) return null;
    const value = p as unknown as Progress;
    // Validate prerequisites as well as shape: a forged or stale save cannot bypass the exit.
    if ((value.power || has(value, 'fuse')) && !bearingsFound(value)) return null;
    if (value.power && !has(value, 'fuse')) return null;
    if (keepsakeCount(value) && !value.power) return null;
    if (value.cabinet && (!value.power || keepsakeCount(value) !== 3)) return null;
    if (has(value, 'exit-key') && !value.cabinet) return null;
    if (value.exitUnlocked && !has(value, 'exit-key')) return null;
    if (value.checkpoint === 'breaker' && !value.power || value.checkpoint === 'cabinet' && !value.cabinet) return null;
    if (value.kitchenSeen && !bearingsFound(value)) return null;
    return structuredClone(value);
  } catch { return null; }
}
export function parseSettings(raw: string | null): Settings {
  const result = { ...DEFAULT_SETTINGS };
  try {
    const value: unknown = JSON.parse(raw ?? 'null');
    if (!record(value)) return result;
    for (const key of ['volume', 'music', 'ambience', 'effects', 'voice', 'sensitivity', 'touchSensitivity', 'brightness'] as const) {
      const bounds = key === 'sensitivity' || key === 'touchSensitivity' ? [.3, 2.5] : key === 'brightness' ? [.6, 1.7] : [0, 1];
      if (bounded(value[key], bounds[0], bounds[1])) result[key] = value[key];
    }
    for (const key of ['subtitles', 'reducedFlicker', 'reducedMotion', 'gentleScares', 'cleanDialogue'] as const) if (typeof value[key] === 'boolean') result[key] = value[key];
    if (value.quality === 'low' || value.quality === 'standard' || value.quality === 'auto') result.quality = value.quality;
  } catch { /* Unavailable/corrupt settings use conservative defaults. */ }
  return result;
}
export class SaveSystem {
  private memory: Progress | null = null;
  available = true;
  load(): Progress | null {
    try { return parseSave(localStorage.getItem(SAVE_KEY)) ?? this.memory; }
    catch { this.available = false; return this.memory ? structuredClone(this.memory) : null; }
  }
  save(progress: Progress): void {
    this.memory = structuredClone(progress);
    try { localStorage.setItem(SAVE_KEY, JSON.stringify({ version: 1, progress })); }
    catch { this.available = false; }
  }
  clear(): void {
    this.memory = null;
    try { localStorage.removeItem(SAVE_KEY); } catch { this.available = false; }
  }
  settings(): Settings {
    try { return parseSettings(localStorage.getItem(SETTINGS_KEY)); } catch { this.available = false; return { ...DEFAULT_SETTINGS }; }
  }
  saveSettings(value: Settings): void {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(value)); } catch { this.available = false; }
  }
}
