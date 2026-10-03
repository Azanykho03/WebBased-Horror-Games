import { WARNING, assetUrl, GHOST_PROFILE, GAME_TITLE } from './config.ts';
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
  private touchMode = false;
  private abort = new AbortController();
  onAction: (action: string) => void = () => {};
  onSettings: (key: keyof Settings, value: number | boolean | string) => void = () => {};
  constructor(root: HTMLElement) {
    this.root = root;
    root.innerHTML = '<div class="vignette"></div><div id="hud" hidden></div><div id="toast" role="status"></div><div id="subtitle" aria-live="polite"></div><div id="face-overlay" hidden><img alt="Corazon appears"/><span>HOY!</span></div><main id="panel"></main>';
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
    this.root.dataset.reducedMotion = String(settings.reducedMotion);
    this.panel.hidden = screen === 'playing'; this.hud.hidden = screen !== 'playing';
    this.subtitle.hidden = screen !== 'playing' || !settings.subtitles;
    this.toast.hidden = screen !== 'playing';
    if (screen !== 'playing') this.face(false, settings.gentleScares);
    const button = (action: string, label: string, primary = false, disabled = false) => `<button data-action="${action}" class="${primary ? 'primary' : ''}" ${disabled ? 'disabled' : ''}>${label}<span aria-hidden="true">↗</span></button>`;
    const heading = (eyebrow: string, title: string) => `<div class="eyebrow">${eyebrow}</div><h1>${title}</h1>`;
    const back = button('back', 'Back');
    let content = '';
    if (screen === 'loading') content = `${heading('THE HOUSE IS WAKING', GAME_TITLE)}<p id="load-label">${escaped(detail)}</p><div class="loading-track"><i id="load-bar"></i></div><p class="fine">Preparing the house, Corazon, and your flashlight.</p>`;
    if (screen === 'menu') content = `${heading('A BISAYA SURVIVAL HORROR', GAME_TITLE)}<p class="tagline">Ayaw Pagsulod.</p><p class="intro">You took the dare.<br>Corazon’s house took you seriously.</p><nav>${button('new', saved ? 'Start a new night' : 'Enter the house', true)}${saved ? button('continue', 'Continue from checkpoint') : ''}${button('settings', 'Settings')}${button('credits', 'Credits')}</nav><div class="menu-footer">ONE HOUSE · ONE GHOST · FIND YOUR WAY OUT</div>`;
    if (screen === 'intro') content = `${heading('THE RAIN HIDES YOUR FOOTSTEPS', GAME_TITLE)}<p class="intro-story">A dare brought you to Corazon’s door.<br>Her photographs still face the rooms.<br>Her keepsakes are still waiting.<br><em>Then the latch moves behind you.</em></p><nav>${button('skip-intro', 'Enter · skip intro')}</nav>`;
    if (screen === 'ready') {
      const returning = progress.collected.length > 0;
      content = `${heading(returning ? 'CHECKPOINT RESTORED' : 'THE FRONT DOOR HAS LOCKED', returning ? 'One more chance.' : 'Stay quiet.')}<p>${returning ? escaped(objective(progress).detail) : 'Find the flashlight and warning on the living-room coffee table. Return what belongs to this house.'}</p>${this.controls()}<nav>${button('resume', this.touchMode ? 'Tap to play' : 'Click to play', true)}${button('menu', 'Main menu')}</nav><p class="fine">${this.touchMode ? 'Tap to enable sound. Move with the left stick and drag the right side to look. Landscape is recommended.' : 'A click enables sound and mouse look. If mouse lock is unavailable, hold right mouse to look or use the arrow keys.'}</p>`;
    }
    if (screen === 'paused') content = `${heading('TAKE A BREATH', 'Paused.')}<p>The house will wait.</p><nav>${button('resume', 'Continue', true)}${button('journal', 'Missions & inventory')}${button('settings', 'Settings')}${button('menu', 'Save & main menu')}</nav>${this.controls()}`;
    if (screen === 'journal') {
      const m = mission(progress), stages = ['Find your bearings', 'Restore the lights', 'Recover the keepsakes', 'Return what belongs here', 'Escape through the service exit'];
      content = `${heading('YOUR WAY OUT', 'The warning')}<ol class="missions">${stages.map((s, i) => `<li class="${i + 1 < Number(m.slice(1)) ? 'done' : i + 1 === Number(m.slice(1)) ? 'current' : ''}"><span>0${i + 1}</span>${s}</li>`).join('')}</ol><p>${escaped(objective(progress).detail)}</p><p class="inventory">Carrying: ${progress.collected.filter(id => !['note', 'flashlight'].includes(id) && !id.startsWith('battery-')).map(id => escaped(id.replaceAll('-', ' '))).join(' · ') || 'nothing yet'}</p><details><summary>Read the living-room warning</summary><p>${WARNING}</p></details><nav>${button('resume', 'Back to the house', true)}${button('menu', 'Save & main menu')}</nav>`;
    }
    if (screen === 'settings') {
      const range = (key: keyof Settings, label: string, min: number, max: number, step: number) => `<label class="range">${label}<input data-setting="${key}" aria-label="${label}" type="range" min="${min}" max="${max}" step="${step}" value="${settings[key]}"></label>`;
      const check = (key: keyof Settings, label: string) => `<label class="check"><input data-setting="${key}" type="checkbox" ${settings[key] ? 'checked' : ''}>${label}</label>`;
      content = `${heading('MAKE THE NIGHT YOURS', 'Settings')}<div class="settings-grid">${range('volume', 'Master volume', 0, 1, .05)}${range('music', 'Music volume', 0, 1, .05)}${range('ambience', 'Ambience volume', 0, 1, .05)}${range('effects', 'Sound effects volume', 0, 1, .05)}${range('voice', 'Voice volume', 0, 1, .05)}${range('sensitivity', 'Mouse sensitivity', .3, 2.5, .1)}${range('touchSensitivity', 'Touch look sensitivity', .3, 2.5, .1)}${range('brightness', 'Brightness', .6, 1.7, .05)}${check('subtitles', 'Subtitles and sound captions')}${check('reducedFlicker', 'Reduced flicker and lightning')}${check('reducedMotion', 'Reduced camera and scare motion')}${check('gentleScares', 'Gentler visuals and scare audio')}${check('cleanDialogue', 'Clean dialogue')}<label class="range">Graphics<select data-setting="quality" aria-label="Graphics"><option value="auto" ${settings.quality === 'auto' ? 'selected' : ''}>Auto · adapt to device</option><option value="standard" ${settings.quality === 'standard' ? 'selected' : ''}>Standard</option><option value="low" ${settings.quality === 'low' ? 'selected' : ''}>Low · fewer lights, softer shadows</option></select></label></div><nav>${back}</nav>`;
    }
    if (screen === 'credits') content = `${heading('INSIDE THE HOUSE', 'Credits')}<p>House: the existing blueprint-led Balay ni Corazon environment, furniture, and original procedural textures.</p><p>${escaped(GHOST_PROFILE.name)}, flashlight, and red key: the project’s preserved TRELLIS / TripoSR assets and refined models. Original references and generation records remain with each asset.</p><p>Female arm: <a href="https://sketchfab.com/3d-models/free-gameready-fps-female-arms-007f5dd998ad4376943ed6fb3dfa2e15" target="_blank" rel="noopener noreferrer">FREE GameReady [FPS Female Arms]</a> by <a href="https://sketchfab.com/bamenwo05" target="_blank" rel="noopener noreferrer">BAMEN</a>, <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a>. Original model, textures, and rig preserved; right arm posed and animated for this game.</p><p>Background music: MELANCHOLIA Music Box Sad, creepy song (menu) and ILI ILI Tulog Anay Scary Version Music Box Cover (in game), supplied for this project.</p><p>Horror ambience: mixkit-horror-ambience-2482.wav from Mixkit, supplied for this project. Original procedural rain, wind, room tones, tension cues and physical effects. Corazon’s spoken lines are captioned; airy vocal textures stand in for optional voice recordings.</p><p>Babylon.js 9.28.0 · Apache 2.0. TypeScript and Vite.</p><nav>${back}</nav>`;
    if (screen === 'caught') content = `${heading('SHE HEARD YOU', 'Not this time.')}<p>Break her line of sight before hiding. Sprint to gain distance. A thrown tsinelas buys two seconds.</p><nav>${button('retry', 'Retry checkpoint', true)}${button('menu', 'Main menu')}</nav>`;
    if (screen === 'won') content = `${heading('YOU MADE IT OUT', 'Ayaw na og balik.')}<p class="result-time">${formatTime(progress.elapsed)}</p><p>“Nakuha nimo ang proof?”<br>“Oo. Dili na ko mobalik.”</p><p class="fine">The rain feels different outside.</p><nav>${button('new', 'Another night', true)}${button('menu', 'Main menu')}</nav>`;
    if (screen === 'error') content = `${heading('THE HOUSE COULD NOT OPEN', 'Something went wrong.')}<p>${escaped(detail)}</p><nav>${button('reload', 'Reload', true)}</nav>`;
    this.panel.innerHTML = `<section class="panel-inner ${screen === 'settings' || screen === 'journal' ? 'wide' : ''}">${content}</section><div class="edition">BALAY NI CORAZON / 01</div>`;
    if (screen !== 'playing' && screen !== 'loading') this.panel.querySelector<HTMLButtonElement>('button')?.focus();
  }
  inputMode(touch: boolean): void { this.touchMode = touch; this.root.dataset.input = touch ? 'touch' : 'desktop'; this.hudText = ''; }
  private controls(): string { if (this.touchMode) return '<div class="controls touch-guide"><span>Left thumb · move</span><span>Right side · look</span><span>Interact · items / doors</span><span>Light · flashlight</span><span>Run · toggle sprint</span><span>Throw · tsinelas</span><span>Hide · at a hiding place</span><span>Journal · missions</span></div>'; return '<div class="controls"><span><kbd>W A S D</kbd> Move</span><span><kbd>Mouse</kbd> Look</span><span><kbd>E</kbd> Interact / hide</span><span><kbd>F</kbd> Flashlight</span><span><kbd>Shift</kbd> Sprint</span><span><kbd>Click</kbd> Throw tsinelas</span><span><kbd>Tab</kbd> Journal</span><span><kbd>Esc</kbd> Pause</span></div>'; }
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
    const text = `<div class="objective"><span class="eyebrow">${mission(progress)} · ${keepsakeCount(progress)}/3 KEEPSAKES</span><h2>${o.title}</h2><p>${o.detail}</p></div><div class="crosshair" aria-hidden="true">·</div><div class="interact">${prompt ? `${this.touchMode ? 'Tap Interact ·' : '<kbd>E</kbd>'} ${escaped(prompt)}` : ''}</div><div class="location"><span class="eyebrow">${hidden ? 'HIDING · STAY QUIET' : 'INSIDE THE HOUSE'}</span><span>${escaped(room)}</span></div><div class="meters"><label>FLASHLIGHT <span>${Math.ceil(progress.battery)}%</span><meter min="0" max="100" value="${progress.battery}"></meter></label><label>STAMINA<meter min="0" max="6" value="${stamina}"></meter></label><small>${this.touchMode ? (slipper ? 'TSINELAS READY · TAP THROW' : 'JOURNAL · MISSIONS') : (slipper ? 'TSINELAS READY · CLICK TO THROW' : 'TAB · MISSIONS & INVENTORY')}</small></div><div class="danger ${ghost === 'Chase' ? 'visible' : ''}">${ghost === 'Chase' ? 'She sees you. Break line of sight.' : ''}</div>`;
    if (text !== this.hudText) { this.hud.innerHTML = text; this.hudText = text; }
  }
}
