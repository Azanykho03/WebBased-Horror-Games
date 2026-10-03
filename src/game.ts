import { B, World } from './world.ts';
import type * as Babylon from 'babylonjs';
import { Player, InputSystem } from './player.ts';
import { GhostStateMachine } from './ghost.ts';
import { InteractionSystem } from './interactions.ts';
import { AudioSystem } from './audio.ts';
import { SaveSystem } from './storage.ts';
import { UI } from './ui.ts';
import { bearingsFound, canEscape, interact, has, mission } from './objectives.ts';
import { freshProgress } from './types.ts';
import type { Progress, Screen, Settings, Vec3 } from './types.ts';
import { CHECKPOINTS, GHOST_PROFILE, WARNING } from './config.ts';
import type { VoiceCue } from './config.ts';
import { HorrorDirector, calmAtmosphere, surfaceForRoom } from './horror.ts';
import type { HauntEvent, Soundscape } from './horror.ts';
import { TouchControls } from './touch.ts';
import { PerformanceProfile } from './performance.ts';
import { difficultySettings, isDifficulty } from './difficulty.ts';
import type { Difficulty } from './difficulty.ts';
import { MobileDisplay } from './mobile-display.ts';

export class Game {
  private engine!: Babylon.Engine;
  private world!: World;
  private interactions!: InteractionSystem;
  private player = new Player();
  private ghost = new GhostStateMachine();
  private storage = new SaveSystem();
  private ui: UI;
  private input: InputSystem;
  private touch: TouchControls;
  private display: MobileDisplay;
  private selectedDifficulty: Difficulty = 'medium';
  private performanceProfile = new PerformanceProfile();
  private audio: AudioSystem;
  private audioUnlocked = false;
  private horror!: HorrorDirector;
  private introPlayed = false;
  private introTime = 0;
  private presentationPaused = false;
  private ghostOccluded = true;
  private soundSightTick = 0;
  private ghostMoving = false;
  private weatherTick = 0;
  private weather: { rainExposure: number; window: Vec3 | null } = { rainExposure: .05, window: null };
  private settings: Settings;
  private progress = freshProgress();
  private screen: Screen = 'loading';
  private returnScreen: Screen = 'menu';
  private loaded = false;
  private runStarted = false;
  private last = 0;
  private worldTick = 0;
  private autosave = 0;
  private revealTime = -1;
  private revealStage = -1;
  private subtitleCooldown = 0;
  private captureTime = 0;
  private sprintVoiceCooldown = 0;
  private canvas: HTMLCanvasElement;
  private abort = new AbortController();
  private validationStep?: (dt: number) => void;
  constructor(canvas: HTMLCanvasElement, root: HTMLElement) {
    this.canvas = canvas; this.ui = new UI(root); this.settings = this.storage.settings();
    this.audio = new AudioSystem(this.settings); this.input = new InputSystem(canvas, () => this.pause());
    this.touch = new TouchControls(root, this.input, () => this.pause());
    this.display = new MobileDisplay(() => {
      this.input.clear(); this.performanceProfile.resetSamples(); this.applyResolution();
      this.engine?.resize(); this.world?.camera.getProjectionMatrix(true);
    });
    this.input.onClear = () => this.touch.reset();
    this.input.onModeChange = touch => {
      this.updateInputMode(touch); this.applyResolution();
      this.syncTouch();
    };
    this.updateInputMode(this.input.touchMode);
    this.ui.onAction = (action, userGesture) => this.action(action, userGesture);
    this.ui.onSettings = (key, value) => {
      this.settings = { ...this.settings, [key]: value }; this.storage.saveSettings(this.settings); this.audio.apply(this.settings);
      this.applyResolution();
      if (this.loaded) this.world.update(this.player.position, this.player.direction, this.renderSettings, this.progress, this.player.flashlight && has(this.progress, 'flashlight'), this.progress.elapsed);
    };
    const unlockAudio = () => { this.audioUnlocked = true; this.syncAudio(); };
    // Touch browsers may grant activation only at the end of the tap. Keep these
    // listeners for recovery after OS interruptions or a rejected play promise.
    for (const event of ['pointerdown', 'pointerup', 'touchend', 'keydown', 'click']) {
      document.addEventListener(event, unlockAudio, { capture: true, passive: true, signal: this.abort.signal });
    }
    window.addEventListener('beforeunload', () => { if (this.runStarted && this.screen !== 'difficulty') this.save(); }, { signal: this.abort.signal });
    window.addEventListener('keydown', event => {
      if (this.screen === 'intro' && event.code === 'Escape') { event.preventDefault(); this.action('skip-intro', event.isTrusted); }
      if (this.screen === 'journal' && (event.code === 'Tab' || event.code === 'Escape')) {
        event.preventDefault(); this.action('resume', event.isTrusted);
      }
    }, { signal: this.abort.signal });
    window.addEventListener('blur', () => { this.presentationPaused = true; this.audio.pause(); }, { signal: this.abort.signal });
    window.addEventListener('focus', () => {
      this.presentationPaused = false;
      this.syncAudio();
    }, { signal: this.abort.signal });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { this.presentationPaused = true; this.audio.pause(); }
      else { this.presentationPaused = false; this.syncAudio(); }
    }, { signal: this.abort.signal });
  }
  async init(): Promise<void> {
    this.show('loading');
    try {
      if (!B || !B.Engine.IsSupported) throw new Error('This browser could not initialize WebGL. Try a current browser with hardware acceleration.');
      this.engine = new B.Engine(this.canvas, true, { preserveDrawingBuffer: true, stencil: true, powerPreference: 'high-performance' });
      this.applyResolution();
      this.world = new World(this.engine);
      await this.world.load((label, percent) => this.ui.loading(label, percent));
      this.interactions = new InteractionSystem(this.world);
      this.horror = new HorrorDirector(this.world.data);
      this.loaded = true;
      this.world.syncProgress(this.progress);
      this.player.reset(CHECKPOINTS.entrance);
      this.player.camera(this.world, this.settings);
      this.interactions.reset(this.progress);
      this.world.update(this.player.position, this.player.direction, this.renderSettings, this.progress, false, 0);
      this.engine.onContextLostObservable.add(() => { this.pause(); this.ui.notice('Graphics context lost. Reload if the scene does not recover.', 15); });
      this.show('menu'); this.last = performance.now();
      if (import.meta.env.MODE === 'validation') {
        const { attachJourney } = await import('../tests/browser-journey.ts');
        this.validationStep = attachJourney({
          world: this.world, player: this.player, ghost: this.ghost, input: this.input, interactions: this.interactions,
          progress: () => this.progress, screen: () => this.screen, revealing: () => this.revealTime >= 0,
          audioState: () => this.audio.state,
          audioDiagnostics: () => this.audio.diagnostics,
          atmosphere: () => this.world.atmosphere,
          touchSensitivity: () => this.settings.touchSensitivity,
          haunt: event => this.haunt(event),
          action: action => this.action(action),
        });
      }
      this.engine.runRenderLoop(() => this.tick());
    } catch (error) { this.show('error', error instanceof Error ? error.message : String(error)); console.error(error); }
  }
  private show(screen: Screen, detail = ''): void {
    this.screen = screen;
    if (screen === 'menu' || screen === 'won') this.runStarted = false;
    this.display.sync(screen === 'playing' || screen === 'intro');
    if (screen !== 'playing') this.input.stop();
    if (screen === 'menu' || screen === 'caught' || screen === 'won') this.audio.reset();
    this.syncAudio();
    this.ui.screen(screen, this.progress, this.settings, this.storage.load() !== null, detail, this.selectedDifficulty);
    this.syncTouch();
  }
  private syncAudio(): void {
    const menu = ['loading', 'menu', 'difficulty', 'ready'].includes(this.screen)
      || (this.screen === 'settings' || this.screen === 'credits') && this.returnScreen === 'menu';
    const game = ['playing', 'intro', 'caught', 'won'].includes(this.screen);
    if (menu || game) this.audio.setMusic(menu ? 'menu' : 'game');
    if (this.audioUnlocked && !this.presentationPaused && !document.hidden && (menu || game)) this.audio.start();
    else this.audio.pause();
  }
  private action(action: string, userGesture = false): void {
    if (action === 'reload') { location.reload(); return; }
    if (!this.loaded) return;
    if (action === 'new') { this.selectedDifficulty = 'medium'; this.show('difficulty'); }
    if (action.startsWith('difficulty:') && this.screen === 'difficulty') {
      const value = action.slice('difficulty:'.length);
      if (isDifficulty(value)) { this.selectedDifficulty = value; this.ui.selectDifficulty(value); }
    }
    if (action === 'start-game' && this.screen === 'difficulty') { this.storage.clear(); this.begin(freshProgress(this.selectedDifficulty)); }
    if (action === 'continue' || action === 'retry') this.begin(this.storage.load() ?? freshProgress());
    if (action === 'resume' || action === 'skip-intro') {
      if (!['ready', 'intro', 'paused', 'journal'].includes(this.screen)) return;
      this.display.sync(true, userGesture);
      this.presentationPaused = false; this.last = performance.now();
      this.performanceProfile.resetSamples();
      if (!this.introPlayed && action !== 'skip-intro') {
        this.introPlayed = true; this.introTime = 0; this.show('intro');
      } else { this.introPlayed = true; this.show('playing'); this.input.start(this.canvas); }
      this.audio.effect('ui');
    }
    if (action === 'menu') {
      if (!['menu', 'difficulty', 'won', 'caught'].includes(this.screen)) this.save();
      this.show('menu');
    }
    if (action === 'journal') this.show('journal');
    if (action === 'settings' || action === 'credits') { this.returnScreen = this.screen === 'menu' ? 'menu' : 'paused'; this.show(action); }
    if (action === 'back') this.show(this.returnScreen);
  }
  private begin(progress: Progress): void {
    this.runStarted = true;
    this.selectedDifficulty = progress.difficulty;
    this.ghost.difficulty = this.horror.difficulty = progress.difficulty;
    this.progress = structuredClone(progress); this.revealTime = -1; this.revealStage = -1; this.autosave = 0; this.subtitleCooldown = 0;
    this.captureTime = this.sprintVoiceCooldown = 0; this.world.kitchenBlackout = false;
    this.introPlayed = progress.collected.length > 0; this.introTime = 0; this.soundSightTick = this.weatherTick = 0;
    this.horror.reset(); this.world.environment.reset(); this.world.atmosphere = calmAtmosphere();
    this.progress.battery = Math.max(this.progress.battery, difficultySettings[progress.difficulty].restoredBattery);
    this.player.reset(CHECKPOINTS[this.progress.checkpoint]);
    this.world.viewmodel.reset(has(this.progress, 'flashlight'));
    this.player.flashlight = has(this.progress, 'flashlight');
    this.ghost.reset(this.progress.kitchenSeen, this.player.position);
    this.world.syncProgress(this.progress); this.interactions.reset(this.progress);
    this.player.camera(this.world, this.settings); this.ui.reset(); this.audio.reset();
    this.world.ghost.setEnabled(this.progress.kitchenSeen);
    this.worldTick = 1; this.save(); this.show('ready');
  }
  private save(): void {
    // A thrown slipper always returns to inventory on checkpoint reload.
    this.storage.save(this.progress);
    if (!this.storage.available) this.ui.notice('Browser storage is unavailable. Checkpoints last only while this page is open.', 8);
  }
  private pause(): void {
    if (this.screen !== 'playing') return;
    this.save(); this.show('paused');
  }
  private speak(text: string, seconds = 3, force = false, voice?: VoiceCue): void {
    if (!force && this.subtitleCooldown > 0) return;
    this.ui.say(text, seconds); this.subtitleCooldown = seconds;
    if (voice) this.audio.voice(voice, this.revealTime >= 0 ? [-5.7, 1.4, -19] : undefined);
  }
  private use(): void {
    if (this.player.hidden) { this.player.hidden = this.player.hideExposed = false; this.ui.notice('You step out.'); return; }
    const target = this.interactions.target;
    if (!target) return;
    if (target.kind === 'hide') {
      if (!this.player.grounded) return;
      this.player.hideExposed = this.ghost.sees(this.player, this.world);
      this.player.hidden = true; this.player.flashlight = false;
      this.audio.effect('latch', target.position);
      this.ui.notice(this.player.hideExposed ? 'She saw you enter. This hiding place will not protect you.' : this.input.touchMode ? 'Stay quiet. Tap Leave to step out.' : 'Stay quiet. E to leave.', 5); return;
    }
    if (target.id === 'tsinelas') { this.interactions.takeSlipper(this.progress); this.ui.notice(this.input.touchMode ? 'Tsinelas ready. Tap Throw.' : 'Tsinelas ready. Left click to throw.'); this.audio.interaction(target.id, target.kind, true, target.position); this.save(); return; }
    const before = mission(this.progress);
    const result = interact(this.progress, target.id);
    this.audio.interaction(target.id, target.kind, result.changed, target.position);
    if (target.id === 'note') this.speak(WARNING, 18, true);
    this.ui.notice(this.input.touchMode && target.id === 'flashlight' ? 'Taking the flashlight. Tap Light after it settles. Read the warning beside it.' : result.message, target.id === 'note' ? 8 : 4);
    if (result.changed) {
      if (target.id === 'flashlight') { this.player.flashlight = false; this.world.viewmodel.pickup(); }
      if (before !== mission(this.progress)) this.audio.effect('objective');
      this.world.syncProgress(this.progress); this.interactions.sync(this.progress); this.save();
      if (result.checkpoint) this.ghost.grace = Math.max(difficultySettings[this.progress.difficulty].objectiveGrace, this.ghost.grace);
      if (target.id === 'exit') this.speak(`${GHOST_PROFILE.name}: “ASA MAN KA PADULONG?! BALIK DIRI!”`, 3, true, 'exit');
    }
  }
  private kitchen(dt: number): boolean {
    const room = this.world.room(this.player.position).id;
    if (this.revealTime < 0 && !this.progress.kitchenSeen && bearingsFound(this.progress) && room === 'F05') {
      this.revealTime = 0; this.revealStage = -1; this.audio.effect('latch'); this.horror.silence(1.8);
    }
    if (this.revealTime < 0) return false;
    this.revealTime += dt;
    const stage = this.revealTime < 1.8 ? 0 : this.revealTime < 3.8 ? 1 : this.revealTime < 5.8 ? 2 : 3;
    if (stage !== this.revealStage) {
      this.revealStage = stage;
      if (stage === 0) this.speak(this.settings.cleanDialogue ? 'You: “Aguy, unsa man tong tingoga?”' : 'You: “Yawa, unsa man tong tingoga?”', 1.8, true, 'kitchen-player');
      if (stage === 1) { this.horror.scare(2); this.audio.effect('sting'); this.speak(`${GHOST_PROFILE.name}: “HOY! NGANONG NISULOD MAN KA DIRI?!”`, 2, true, 'kitchen-ghost'); }
      if (stage === 2) this.speak(`You: “${this.settings.cleanDialogue ? 'AGUY' : 'YAWA'}, SI ${GHOST_PROFILE.name.toUpperCase()} RA DIAY!”`, 2, true, 'recognition');
      if (stage === 3) {
        this.progress.kitchenSeen = true; this.revealTime = -1; this.ghost.reveal(this.player.position, this.world.nav); this.world.ghost.setEnabled(true);
        this.horror.recover();
        this.interactions.sync(this.progress); this.save(); this.ui.notice('Move. Find the fuse. The tsinelas on the floor can slow her down.', 6);
      }
    }
    this.ui.face(stage === 1, this.settings.gentleScares);
    this.world.kitchenBlackout = stage === 1;
    return stage < 3;
  }
  private tick(): void {
    const now = performance.now(), realDt = Math.max(0, (now - this.last) / 1000), dt = Math.min(.05, realDt); this.last = now;
    this.validationStep?.(dt);
    if (this.screen === 'intro' && !document.hidden && !this.presentationPaused) {
      const before = this.introTime; this.introTime += dt;
      if (before < 1.5 && this.introTime >= 1.5) this.haunt({ kind: 'thunder', room: 'F01', position: [2, 7, 6], duration: 4, delay: 1, strength: .4, caption: '' });
      this.updateAtmosphere(dt, 'CALM_EXPLORATION');
      if (this.introTime > 6.5) this.action('skip-intro');
      this.world.scene.render(); return;
    }
    if (['won', 'caught'].includes(this.screen) && !document.hidden && !this.presentationPaused) this.updateAtmosphere(dt, this.screen === 'won' ? 'ENDING' : 'GAME_OVER');
    if (this.screen === 'playing' && !document.hidden) {
      if (this.performanceProfile.update(realDt, this.settings, this.input.touchMode)) this.applyResolution();
      if (this.captureTime > 0) {
        this.captureTime -= dt; this.ui.face(true, this.settings.gentleScares);
        this.updateAtmosphere(dt);
        if (this.captureTime <= 0) this.show('caught');
        this.world.scene.render(); return;
      }
      this.progress.elapsed += dt; this.subtitleCooldown = Math.max(0, this.subtitleCooldown - dt);
      this.ui.tick(dt, this.settings.subtitles);
      if (this.input.consume('Tab')) { this.show('journal'); this.world.scene.render(); return; }
      const wasLit = this.player.flashlight;
      this.player.update(dt, this.input, this.world, this.progress, this.settings, (p, radius) => this.ghost.hear(p, radius), () => {
        const p = this.player.position; this.audio.footstep(surfaceForRoom(this.world.room(p).id, p), this.player.sprinting, [p.x, p.y + .12, p.z]);
      });
      if (wasLit !== this.player.flashlight) this.audio.effect('flashlight');
      const revealing = this.kitchen(dt);
      if (!revealing) {
        this.interactions.focus(this.player, this.progress);
        const hide = this.input.consume('Hide');
        if (this.input.consume('KeyE') || hide && (this.player.hidden || this.interactions.target?.kind === 'hide')) this.use();
        if (this.input.consume('Throw') && this.interactions.throw(this.player)) { this.ghost.hear(this.player.position, 8); this.audio.effect('throw'); }
        const before = { ...this.ghost.position };
        const caught = this.ghost.update(dt, this.world, this.player, this.progress, event => this.speak(`${GHOST_PROFILE.name}: ${event === 'spotted' ? '“HOYYYY! ARI DIRI!”' : '“PAGHULAT BA!”'}`, 3, false, event));
        this.ghostMoving = Math.hypot(this.ghost.position.x - before.x, this.ghost.position.z - before.z) > .001;
        if (caught) { this.horror.scare(.7); this.audio.effect('sting'); this.audio.voice('scream'); this.captureTime = .7; this.input.clear(); this.ui.face(true, this.settings.gentleScares); }
      } else { this.input.consume('KeyE'); this.input.consume('Throw'); this.input.consume('Hide'); }
      this.interactions.updateProjectile(dt, this.ghost, (p, r) => { this.ghost.hear(p, r); this.audio.effect('land', [p.x, p.y + .1, p.z]); }, () => {
        this.audio.effect('hit'); this.speak(`${GHOST_PROFILE.name}: ${this.settings.cleanDialogue ? '“Aguy, sakita oy!”' : '“YAWA, SAKITA OY!”'}`, 2, true, 'hit');
      });
      this.world.ghost.position.set(this.ghost.position.x, this.ghost.position.y + .015, this.ghost.position.z);
      this.world.ghost.rotation.y = this.ghost.yaw + Math.PI;
      this.world.ghost.rotation.z = this.ghost.state === 'Stunned' ? .14 : 0;
      this.sprintVoiceCooldown = Math.max(0, this.sprintVoiceCooldown - dt);
      if (this.ghost.state === 'Chase' && this.player.sprinting && this.sprintVoiceCooldown === 0 && this.subtitleCooldown === 0) {
        this.speak(`${GHOST_PROFILE.name}: “Ayaw dagan!”`, 2, false, 'sprint'); this.sprintVoiceCooldown = 18;
      }
      if (this.screen === 'playing' && this.captureTime === 0 && this.player.position.level === 0 && this.player.position.x < -1.9 && this.player.position.z > -14.3 && this.player.position.z < -12.7 && canEscape(this.progress)) {
        this.storage.clear(); this.show('won');
      }
      this.worldTick += dt; this.autosave += dt;
      if (this.worldTick >= .12) {
        this.worldTick = 0;
        this.world.update(this.player.position, this.player.direction, this.renderSettings, this.progress, has(this.progress, 'flashlight') && this.player.flashlight, this.progress.elapsed);
        const prompt = revealing ? '' : this.player.hidden ? 'Leave hiding place' : this.interactions.target?.label ?? '';
        this.ui.update(this.progress, this.player.stamina, this.world.room(this.player.position).name, prompt, this.ghost.state, this.player.hidden, this.interactions.slipperInHand);
        this.syncTouch();
      }
      if (this.screen === 'playing') this.updateAtmosphere(dt);
      if (this.autosave > 20 && this.screen === 'playing') { this.autosave = 0; this.save(); }
    }
    this.world.scene.render();
  }
  private haunt(event: HauntEvent): void {
    this.world.environment.trigger(event);
    // Essential dialogue takes priority over incidental whispers.
    if (event.kind === 'whisper' && this.subtitleCooldown > 0) return;
    this.audio.event(event, !this.world.clearSight(this.player.eye, event.position));
    if (event.caption && this.subtitleCooldown === 0) this.speak(event.caption, event.kind === 'silence' ? 2 : Math.min(5, event.duration));
  }
  private updateAtmosphere(dt: number, presentation?: Soundscape): void {
    const p = this.player.position, room = this.world.room(p).id;
    const ghost = !presentation && this.ghost.state !== 'Dormant' ? this.ghost.position : null;
    this.soundSightTick -= dt; this.weatherTick -= dt;
    if (this.soundSightTick <= 0) {
      this.soundSightTick = .2;
      this.ghostOccluded = ghost ? !this.world.clearSight(this.player.eye, [ghost.x, ghost.y + 1.4, ghost.z]) : true;
    }
    if (this.weatherTick <= 0) { this.weatherTick = .3; this.weather = this.world.weather(p); }
    const result = presentation ? { atmosphere: { ...calmAtmosphere(), state: presentation }, events: [] } : this.horror.update(dt, {
      room, player: p, eye: this.player.eye, direction: this.player.direction.asArray() as Vec3,
      ghost, ghostState: this.ghost.state, ghostGrace: this.ghost.grace, ghostOccluded: this.ghostOccluded,
      hidden: this.player.hidden, sprinting: this.player.sprinting && this.player.moving, stamina: this.player.stamina,
      suppressed: this.revealTime >= 0 || this.subtitleCooldown > 8 || this.captureTime > 0,
    });
    this.world.atmosphere = result.atmosphere;
    this.audio.update(dt, { atmosphere: result.atmosphere, eye: this.player.eye, direction: this.player.direction.asArray() as Vec3,
      room, ghost, ghostOccluded: this.ghostOccluded, ghostMoving: this.ghostMoving, ...this.weather });
    for (const event of result.events) this.haunt(event);
    const lit = has(this.progress, 'flashlight') && this.world.viewmodel.ready && this.player.flashlight && this.progress.battery > 0;
    this.world.environment.update(dt, p, this.player.direction, lit, this.renderSettings, presentation ? this.introTime : this.progress.elapsed);
    this.world.lighting(this.player.direction, this.renderSettings, this.progress, lit, this.progress.elapsed);
  }
  private get renderSettings(): Settings { return { ...this.settings, quality: this.performanceProfile.low(this.settings, this.input.touchMode) ? 'low' : 'standard' }; }
  private updateInputMode(touch: boolean): void {
    this.ui.inputMode(touch);
    this.canvas.setAttribute('aria-label', touch ? 'Haunted house game. Left joystick to move, right drag to look, on-screen buttons to interact.' : 'Haunted house game. WASD to move, mouse to look, Space to jump, E to interact.');
  }
  private applyResolution(): void { this.engine?.setHardwareScalingLevel(this.performanceProfile.scale(this.settings, this.input.touchMode, devicePixelRatio)); }
  private syncTouch(): void { this.touch.sync(this.screen === 'playing', this.interactions?.target?.kind === 'hide' && this.player.grounded, this.player.hidden, this.interactions?.slipperInHand ?? false, has(this.progress, 'flashlight') && this.world.viewmodel.ready, this.player.grounded); }
  dispose(): void { this.abort.abort(); this.display.dispose(); this.ui.dispose(); this.input.dispose(); this.touch.dispose(); this.audio.dispose(); this.engine?.stopRenderLoop(); this.world?.dispose(); this.engine?.dispose(); }
}
