/** Transient presentation state; inventory remains in Progress.collected. */
export class FlashlightEquipState {
  readonly duration = .78;
  elapsed = 0;
  phase: 'unowned' | 'equipping' | 'held' = 'unowned';
  hidden = false;

  reset(owned: boolean): void {
    this.phase = owned ? 'held' : 'unowned';
    this.elapsed = owned ? this.duration : 0;
    this.hidden = false;
  }
  pickup(): boolean {
    if (this.phase !== 'unowned') return false;
    this.phase = 'equipping'; this.elapsed = 0;
    return true;
  }
  update(dt: number, owned: boolean, hidden: boolean): boolean {
    this.hidden = hidden;
    if (!owned) { this.phase = 'unowned'; this.elapsed = 0; return false; }
    // Restored inventory is immediately usable; a live pickup calls pickup().
    if (this.phase === 'unowned') { this.reset(true); this.hidden = hidden; }
    if (this.phase !== 'equipping') return false;
    this.elapsed = Math.min(this.duration, this.elapsed + Math.max(0, dt));
    if (this.elapsed < this.duration) return false;
    this.phase = 'held';
    return !hidden;
  }
  get progress(): number { return Math.min(1, this.elapsed / this.duration); }
  get ready(): boolean { return this.phase === 'held' && !this.hidden; }
  get visible(): boolean { return this.phase !== 'unowned' && !this.hidden; }
}
