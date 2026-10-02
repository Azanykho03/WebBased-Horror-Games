import { WARNING, assetUrl, GHOST_PROFILE } from './config.ts';
import { keepsakeCount, mission, objective } from './objectives.ts';
import type { GhostState, Progress, Screen, Settings } from './types.ts';

const escaped = (text: string) => text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
export const formatTime = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
export class UI {
  private root: HTMLElement;
  private panel: HTMLElement;
  private hud: HTMLElement;
  private overlay: HTMLElement;
  private subtitle: HTMLElement;
  private toast: HTMLElement;
  private noticeTime = 0;
  private subtitleTime = 0;
  private hudText = '';
  private abort = new AbortController();
  onAction: (action: string) => void = () => {};
  onSettings: (key: keyof Settings, value: number | boolean | string) => void = () => {};
  constructor(root: HTMLElement) {
    this.root = root;
    root.innerHTML = '<div class="vignette"></div><div id="hud" hidden></div><div id="toast" role="status"></div><div id="subtitle" aria-live="polite"></div><div id="face-overlay" hidden><img alt="Mayang appears"/><span>HOY!</span></div><main id="panel"></main>';
    this.panel = root.querySelector('#panel')!; this.hud = root.querySelector('#hud')!; this.overlay = root.querySelector('#face-overlay')!;
    this.subtitle = root.querySelector('#subtitle')!; this.toast = root.querySelector('#toast')!;
    this.overlay.querySelector('img')!.src = assetUrl(GHOST_PROFILE.face);
    this.overlay.querySelector('img')!.alt = `${GHOST_PROFILE.name} appears`;
    root.addEventListener('click', e => {
      const button = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-action]');
      if (button && !button.disabled) this.onAction(button.dataset.action!);
    }, { signal: this.abort.signal });
    root.addEventListener('input', e => {
      const input = e.target as HTMLInputElement;
      if (!input.dataset.setting) return;
      this.onSettings(input.dataset.setting as keyof Settings, input.type === 'checkbox' ? input.checked : input.type === 'range' ? Number(input.value) : input.value);
    }, { signal: this.abort.signal });
  }
  screen(screen: Screen, progress: Progress, settings: Settings, saved: boolean, detail = ''): void {
    this.root.dataset.screen = screen;
    this.panel.hidden = screen === 'playing'; this.hud.hidden = screen !== 'playing';
    this.subtitle.hidden = screen !== 'playing' || !settings.subtitles;
    this.toast.hidden = screen !== 'playing';
    if (screen !== 'playing') this.face(false, settings.gentleScares);
    const button = (action: string, label: string, primary = false, disabled = false) => `<button data-action="${action}" class="${primary ? 'primary' : ''}" ${disabled ? 'disabled' : ''}>${label}<span aria-hidden="true">↗</span></button>`;
    const heading = (eyebrow: string, title: string) => `<div class="eyebrow">${eyebrow}</div><h1>${title}</h1>`;
    const back = button('back', 'Back');
    let content = '';
    if (screen === 'loading') content = `${heading('THE HOUSE IS WAKING', 'BALAY')}<p id="load-label">${escaped(detail)}</p><div class="loading-track"><i id="load-bar"></i></div><p class="fine">Preparing the house, Mayang, and your flashlight.</p>`;
    if (screen === 'menu') content = `${heading('A BISAYA SURVIVAL HORROR', 'BALAY')}<p class="tagline">Ayaw Pagsulod.</p><p class="intro">You took the dare.<br>The house took you seriously.</p><nav>${button('new', saved ? 'Start a new night' : 'Enter the house', true)}${saved ? button('continue', 'Continue from checkpoint') : ''}${button('settings', 'Settings')}${button('credits', 'Credits')}</nav><div class="menu-footer">ONE HOUSE · ONE GHOST · FIND YOUR WAY OUT</div>`;
    if (screen === 'ready') {
      const returning = progress.collected.length > 0;
      content = `${heading(returning ? 'CHECKPOINT RESTORED' : 'THE FRONT DOOR HAS LOCKED', returning ? 'One more chance.' : 'Stay quiet.')}<p>${returning ? escaped(objective(progress).detail) : 'Find the flashlight. Read the warning. Return what belongs to this house.'}</p>${this.controls()}<nav>${button('resume', 'Click to play', true)}${button('menu', 'Main menu')}</nav><p class="fine">A click enables sound and mouse look. If mouse lock is unavailable, hold right mouse to look or use the arrow keys.</p>`;
    }
    if (screen === 'paused') content = `${heading('TAKE A BREATH', 'Paused.')}<p>The house will wait.</p><nav>${button('resume', 'Continue', true)}${button('journal', 'Missions & inventory')}${button('settings', 'Settings')}${button('menu', 'Save & main menu')}</nav>${this.controls()}`;
    if (screen === 'journal') {
      const m = mission(progress), stages = ['Find your bearings', 'Restore the lights', 'Recover the keepsakes', 'Return what belongs here', 'Escape through the service exit'];
      content = `${heading('YOUR WAY OUT', 'The warning')}<ol class="missions">${stages.map((s, i) => `<li class="${i + 1 < Number(m.slice(1)) ? 'done' : i + 1 === Number(m.slice(1)) ? 'current' : ''}"><span>0${i + 1}</span>${s}</li>`).join('')}</ol><p>${escaped(objective(progress).detail)}</p><p class="inventory">Carrying: ${progress.collected.filter(id => !['note', 'flashlight'].includes(id) && !id.startsWith('battery-')).map(id => escaped(id.replaceAll('-', ' '))).join(' · ') || 'nothing yet'}</p><details><summary>Read the entrance warning</summary><p>${WARNING}</p></details><nav>${button('resume', 'Back to the house', true)}${button('menu', 'Save & main menu')}</nav>`;
    }
    if (screen === 'settings') {
      const range = (key: keyof Settings, label: string, min: number, max: number, step: number) => `<label class="range">${label}<input data-setting="${key}" aria-label="${label}" type="range" min="${min}" max="${max}" step="${step}" value="${settings[key]}"></label>`;
      const check = (key: keyof Settings, label: string) => `<label class="check"><input data-setting="${key}" type="checkbox" ${settings[key] ? 'checked' : ''}>${label}</label>`;
      content = `${heading('MAKE THE NIGHT YOURS', 'Settings')}<div class="settings-grid">${range('volume', 'Master volume', 0, 1, .05)}${range('ambience', 'Ambience', 0, 1, .05)}${range('sensitivity', 'Mouse sensitivity', .3, 2.5, .1)}${range('brightness', 'Brightness', .6, 1.7, .05)}${check('subtitles', 'Subtitles and sound captions')}${check('reducedFlicker', 'Reduced flicker')}${check('reducedMotion', 'Reduced camera motion')}${check('gentleScares', 'Gentle scare presentation')}${check('cleanDialogue', 'Clean dialogue')}<label class="range">Graphics<select data-setting="quality" aria-label="Graphics"><option value="standard" ${settings.quality === 'standard' ? 'selected' : ''}>Standard</option><option value="low" ${settings.quality === 'low' ? 'selected' : ''}>Low · fewer lights, no shadows</option></select></label></div><nav>${back}</nav>`;
    }
    if (screen === 'credits') content = `${heading('INSIDE THE HOUSE', 'Credits')}<p>House: the existing blueprint-led Balay environment, furniture, and original procedural textures.</p><p>${escaped(GHOST_PROFILE.name)}, flashlight arm, and red key: the project’s preserved TRELLIS / TripoSR model assets. Original references and generation records remain with each asset.</p><p>Audio: original synthesis adapted from the house inspection palette. Bisaya dialogue is currently captioned with temporary sound cues; personal voice recordings are not included.</p><p>Babylon.js 9.28.0 · Apache 2.0. TypeScript and Vite.</p><nav>${back}</nav>`;
    if (screen === 'caught') content = `${heading('SHE HEARD YOU', 'Not this time.')}<p>Break her line of sight before hiding. Sprint to gain distance. A thrown tsinelas buys two seconds.</p><nav>${button('retry', 'Retry checkpoint', true)}${button('menu', 'Main menu')}</nav>`;
    if (screen === 'won') content = `${heading('YOU MADE IT OUT', 'Ayaw na og balik.')}<p class="result-time">${formatTime(progress.elapsed)}</p><p>“Nakuha nimo ang proof?”<br>“Oo. Dili na ko mobalik.”</p><p class="fine">The rain feels different outside.</p><nav>${button('new', 'Another night', true)}${button('menu', 'Main menu')}</nav>`;
    if (screen === 'error') content = `${heading('THE HOUSE COULD NOT OPEN', 'Something went wrong.')}<p>${escaped(detail)}</p><nav>${button('reload', 'Reload', true)}</nav>`;
    this.panel.innerHTML = `<section class="panel-inner ${screen === 'settings' || screen === 'journal' ? 'wide' : ''}">${content}</section><div class="edition">BALAY / 01</div>`;
    if (screen !== 'playing' && screen !== 'loading') this.panel.querySelector<HTMLButtonElement>('button')?.focus();
  }
  private controls(): string { return '<div class="controls"><span><kbd>W A S D</kbd> Move</span><span><kbd>Mouse</kbd> Look</span><span><kbd>E</kbd> Interact / hide</span><span><kbd>F</kbd> Flashlight</span><span><kbd>Shift</kbd> Sprint</span><span><kbd>Click</kbd> Throw tsinelas</span><span><kbd>Tab</kbd> Journal</span><span><kbd>Esc</kbd> Pause</span></div>'; }
  loading(text: string, percent: number): void {
    const label = this.panel.querySelector('#load-label'), bar = this.panel.querySelector<HTMLElement>('#load-bar');
    if (label) label.textContent = text; if (bar) bar.style.width = `${percent}%`;
  }
  notice(text: string, seconds = 4): void { this.toast.textContent = text; this.noticeTime = seconds; }
  say(text: string, seconds = 3): void { this.subtitle.textContent = text; this.subtitleTime = seconds; }
  face(visible: boolean, gentle: boolean): void { this.overlay.hidden = !visible; this.overlay.classList.toggle('gentle', gentle); }
  tick(dt: number, subtitles: boolean): void {
    this.noticeTime -= dt; this.subtitleTime -= dt;
    if (this.noticeTime <= 0) this.toast.textContent = '';
    if (this.subtitleTime <= 0) this.subtitle.textContent = '';
    this.subtitle.hidden = !subtitles;
  }
  reset(): void { this.noticeTime = this.subtitleTime = 0; this.toast.textContent = this.subtitle.textContent = ''; this.hudText = ''; }
  dispose(): void { this.abort.abort(); }
  update(progress: Progress, stamina: number, room: string, prompt: string, ghost: GhostState, hidden: boolean, slipper: boolean): void {
    const o = objective(progress);
    const text = `<div class="objective"><span class="eyebrow">${mission(progress)} · ${keepsakeCount(progress)}/3 KEEPSAKES</span><h2>${o.title}</h2><p>${o.detail}</p></div><div class="crosshair" aria-hidden="true">·</div><div class="interact">${prompt ? `<kbd>E</kbd> ${escaped(prompt)}` : ''}</div><div class="location"><span class="eyebrow">${hidden ? 'HIDING · STAY QUIET' : 'INSIDE THE HOUSE'}</span><span>${escaped(room)}</span></div><div class="meters"><label>FLASHLIGHT <span>${Math.ceil(progress.battery)}%</span><meter min="0" max="100" value="${progress.battery}"></meter></label><label>STAMINA<meter min="0" max="6" value="${stamina}"></meter></label><small>${slipper ? 'TSINELAS READY · CLICK TO THROW' : 'TAB · MISSIONS & INVENTORY'}</small></div><div class="danger ${ghost === 'Chase' ? 'visible' : ''}">${ghost === 'Chase' ? 'She sees you. Break line of sight.' : ''}</div>`;
    if (text !== this.hudText) { this.hud.innerHTML = text; this.hudText = text; }
  }
}
