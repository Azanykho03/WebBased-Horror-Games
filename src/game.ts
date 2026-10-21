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
import { CHECKPOINTS, GHOST_DIALOGUE, GHOST_PROFILE, WARNING } from './config.ts';
import type { VoiceCue } from './config.ts';
import { HorrorDirector, calmAtmosphere, surfaceForRoom } from './horror.ts';
import type { HauntEvent, Soundscape } from './horror.ts';
import { TouchControls } from './touch.ts';
import { PerformanceProfile } from './performance.ts';
import { difficultySettings, isDifficulty } from './difficulty.ts';
import type { Difficulty } from './difficulty.ts';
import { MobileDisplay } from './mobile-display.ts';
import { CORAZON_SCARE, scareFrame } from './corazon-motion.ts';
import type { ScareKind } from './corazon-motion.ts';
import { HidingSystem } from './hiding.ts';
import { GrabSequence } from './grab.ts';
import { GrabPresentation } from './grab-presentation.ts';
import { StruggleUI } from './struggle-ui.ts';

export class Game {
  private engine!: Babylon.Engine;
  private world!: World;
  private interactions!: InteractionSystem;
  private hiding!: HidingSystem;
  private grab = new GrabSequence();
  private grabPresentation!: GrabPresentation;
  private struggleUI: StruggleUI;
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
  private sprintVoiceCooldown = 0;
  private lastGhostLines = new Map<keyof typeof GHOST_DIALOGUE, string>();
  private canvas: HTMLCanvasElement;
  private abort = new AbortController();
  private validationStep?: (dt: number) => void;
  constructor(canvas: HTMLCanvasElement, root: HTMLElement) {
    this.canvas = canvas; this.ui = new UI(root); this.settings = this.storage.settings();
    this.audio = new AudioSystem(this.settings); this.input = new InputSystem(canvas, () => this.pause());
    this.touch = new TouchControls(root, this.input, () => this.pause());
    this.struggleUI = new StruggleUI(root, () => this.strugglePress(), () => this.pause());
    this.input.onStruggle = () => this.strugglePress();
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
      this.presentationPaused = false; this.last = performance.now();
      this.syncAudio();
    }, { signal: this.abort.signal });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { this.presentationPaused = true; this.audio.pause(); }
      else { this.presentationPaused = false; this.last = performance.now(); this.syncAudio(); }
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
      this.hiding = new HidingSystem(this.player, this.input, this.world);
      this.grabPresentation = new GrabPresentation(this.world, this.player, this.ghost);
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
          world: this.world, player: this.player, ghost: this.ghost, input: this.input, interactions: this.interactions, hiding: this.hiding,
          grab: this.grab, grabPresentation: this.grabPresentation,
          progress: () => this.progress, screen: () => this.screen, revealing: () => this.revealTime >= 0,
          audioState: () => this.audio.state,
          audioDiagnostics: () => this.audio.diagnostics,
          atmosphere: () => this.world.atmosphere,
          touchSensitivity: () => this.settings.touchSensitivity,
          settings: () => this.settings,
          startScare: kind => this.startScare(kind),
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
    this.struggleUI.update(this.grab, screen === 'playing');
  }
  private syncAudio(): void {
    const menu = ['loading', 'menu', 'difficulty', 'ready'].includes(this.screen)
      || (this.screen === 'settings' || this.screen === 'credits') && this.returnScreen === 'menu';
    const game = ['playing', 'intro', 'caught', 'won'].includes(this.screen);
    if (menu || game) this.audio.setMusic(menu ? 'menu' : 'game');
    if (menu || game) this.audio.setGameplay(this.screen === 'playing' || this.screen === 'intro');
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
      this.world.corazon.finish(); this.ui.scareFade(0); this.ui.cinematic(false);
      this.resetGrab();
      this.hiding.reset();
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
    this.sprintVoiceCooldown = 0; this.world.kitchenBlackout = false;
    this.lastGhostLines.clear();
    this.world.corazon.reset(); this.ui.scareFade(0); this.ui.cinematic(false);
    this.resetGrab();
    this.grab.resetRun(); this.world.legs.reset();
    this.introPlayed = progress.collected.length > 0; this.introTime = 0; this.soundSightTick = this.weatherTick = 0;
    this.horror.reset(); this.world.environment.reset(); this.world.atmosphere = calmAtmosphere();
    this.progress.battery = Math.max(this.progress.battery, difficultySettings[progress.difficulty].restoredBattery);
    this.hiding.reset(); this.player.reset(CHECKPOINTS[this.progress.checkpoint]);
    this.world.fixtures3d.reset(this.progress);
    this.world.viewmodel.reset(has(this.progress, 'flashlight'));
    this.player.flashlight = has(this.progress, 'flashlight');
    this.ghost.reset(this.progress.kitchenSeen, this.player.position);
    this.world.corazon.updateLocomotion(0, this.ghost, this.settings);
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
  private speakGhost(cue: keyof typeof GHOST_DIALOGUE, force = false, voiced = true): void {
    if (!force && this.subtitleCooldown > 0) return;
    const lines = GHOST_DIALOGUE[cue].filter(line => line !== this.lastGhostLines.get(cue));
    const line = lines[Math.floor(Math.random() * lines.length)];
    this.lastGhostLines.set(cue, line);
    this.speak(`${GHOST_PROFILE.name}: “${line}”`, 3, force, voiced && cue !== 'capture' ? cue : undefined);
    // Leave silence between lines, including adjacent state changes.
    this.subtitleCooldown = 8;
  }
  private use(): void {
    if (this.player.hidingState === 'HIDDEN') { if (this.hiding.exit()) this.audio.effect('latch'); return; }
    if (this.player.movementLocked) return;
    const target = this.interactions.target;
    if (!target) return;
    if (target.kind === 'hide') {
      const cabinet = this.world.fixtures3d.cabinets.find(c => c.id === target.id)!;
      if (!this.hiding.enter(cabinet, this.ghost)) { this.ui.notice('Stand on the clear floor in front of the cabinet.'); return; }
      this.audio.effect('latch', target.position);
      this.ui.notice(this.player.hideExposed ? 'She saw you. Get fully inside before she reaches you.' : 'Keep quiet while you get inside.', 5); return;
    }
    if (target.kind === 'door') {
      const door = this.world.fixtures3d.doors.find(d => d.id === target.id)!;
      if (door.hinge.busy) return;
      if (door.locked) {
        const result = interact(this.progress, target.id); this.ui.notice(result.message);
        this.world.syncProgress(this.progress); this.audio.interaction(target.id, target.kind, result.changed, target.position);
        if (!result.changed) return;
        this.save(); if (target.id === 'front-door') this.speakGhost('exit', true);
      }
      if (door.hinge.request(door.hinge.state === 'CLOSED')) this.audio.effect('latch', target.position);
      return;
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
      if (target.id === 'exit') this.speakGhost('exit', true);
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
      if (stage === 0) this.speak('You: “Something is in here.”', 1.8, true, 'kitchen-player');
      if (stage === 1) this.startScare('jumpscare');
      if (stage === 2) this.speak('You: “I need to get out.”', 2, true, 'recognition');
      if (stage === 3) {
        this.audio.finishJumpscare();
        this.progress.kitchenSeen = true; this.revealTime = -1; this.ghost.reveal(this.player.position, this.world.nav); this.world.ghost.setEnabled(true);
        this.horror.recover();
        this.interactions.sync(this.progress); this.save(); this.ui.notice('Move. Find the fuse. The tsinelas on the floor can slow her down.', 6);
      }
    }
    this.world.kitchenBlackout = stage === 1;
    return stage < 3;
  }
  private startScare(kind: ScareKind): void {
    if (this.grab.active && (kind !== 'capture' || this.grab.phase !== 'killing')) return;
    if (kind === 'capture' && this.player.hidden) return;
    if (!this.world.corazon.start(kind, this.settings)) return;
    this.input.clear(); this.player.halt(this.world);
    this.ghostMoving = false; this.world.arms.setEnabled(false);
    this.horror.scare(CORAZON_SCARE[kind].duration); this.ui.cinematic(true); this.syncTouch();
  }
  private updateScare(dt: number): void {
    const presentation = this.world.corazon, kind = presentation.kind!;
    this.input.clear();
    const event = presentation.update(dt, this.settings);
    // Both the 3D pose and the preloaded recording change in this render tick.
    if (event.reveal) {
      this.ui.face(true, this.settings.gentleScares); this.audio.jumpscare();
      this.speakGhost(kind === 'capture' ? 'capture' : 'kitchen-ghost', true, false);
    }
    this.ui.scareFade(scareFrame(kind, presentation.timeline.time).fade);
    if (!event.finished) return;
    presentation.finish(); this.ui.face(false, this.settings.gentleScares); this.ui.cinematic(false);
    this.audio.finishJumpscare(); this.input.clear(); this.player.halt(this.world);
    if (kind === 'capture') { this.resetGrab(); this.ghost.state = 'Catch'; this.show('caught'); }
    else {
      this.player.camera(this.world, this.settings);
      this.world.arms.setEnabled(this.world.viewmodel.visible);
      this.horror.recover(); this.syncTouch();
    }
  }
  private startGrab(): void {
    if (this.player.hidden || this.world.corazon.active || !this.grab.start(this.progress.difficulty)) return;
    this.hiding.interruptGrab();
    this.player.grabbed = true; this.input.restrict(true); this.ghostMoving = false;
    this.grabPresentation.start(); this.ui.grab(true); this.syncTouch();
    this.grabPresentation.update(0, this.grab, this.settings);
    this.audio.grab();
  }
  private strugglePress(): void {
    if (this.screen !== 'playing' || this.presentationPaused || document.hidden || !this.input.active) return;
    // Do not accept an input delivered after the deadline between two renders.
    if (this.grab.remaining <= Math.max(0, (performance.now() - this.last) / 1000)) return;
    if (!this.grab.press()) return;
    this.grabPresentation.press(this.grab.phase === 'escape-kick'); this.audio.effect('struggle');
    if (this.grab.phase === 'escape-kick') { this.ghost.escapeKick(); this.audio.effect('escape'); }
    this.struggleUI.update(this.grab, true);
  }
  private updateGrab(realDt: number): void {
    const event = this.grab.update(realDt, this.player.grounded);
    this.grabPresentation.update(realDt, this.grab, this.settings);
    if (event === 'interactive') this.ghost.struggle();
    if (event === 'falling') this.ghost.falling();
    if (event === 'dragging') { this.ghost.dragging(); this.audio.effect('drag'); }
    if (event === 'release') { this.ghost.release(); this.audio.finishGrab(); }
    if (event === 'recovery') this.ghost.recover();
    if (event === 'failed') { this.ghost.kill(); this.audio.finishGrab(); }
    this.struggleUI.update(this.grab, true);
    if (event === 'kill') {
      this.grabPresentation.finish(false);
      this.startScare('capture');
      // The finishing presentation now owns the lock and its single reveal event.
      this.grab.reset(); this.ui.grab(false);
    } else if (event === 'released') {
      this.grabPresentation.finish(); this.player.grabbed = false;
      this.input.restrict(false); this.player.camera(this.world, this.settings);
      this.ghost.resumeAfterEscape(); this.ui.grab(false); this.horror.recover(); this.syncTouch();
      this.ui.notice('You broke free. Move!', 2);
    }
  }
  private resetGrab(): void {
    this.audio.finishGrab();
    this.grabPresentation?.finish(); this.grab.reset(); this.player.grabbed = false;
    this.player.grabView = null; this.world?.legs?.reset();
    this.input.restrict(false); this.struggleUI.update(this.grab, false); this.ui.grab(false);
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
    if (this.screen === 'playing' && !document.hidden && !this.presentationPaused) {
      if (this.performanceProfile.update(realDt, this.settings, this.input.touchMode)) this.applyResolution();
      if (this.grab.active) {
        this.progress.elapsed += realDt; this.ui.tick(realDt, this.settings.subtitles);
        this.subtitleCooldown = Math.max(0, this.subtitleCooldown - realDt);
        this.world.fixtures3d.update(dt, [this.player.position, this.ghost.position]);
        this.updateGrab(realDt); this.updateAtmosphere(Math.min(realDt, .1));
        this.world.scene.render(); return;
      }
      if (this.world.corazon.active) {
        // Presentation follows elapsed time even below 20 FPS, matching the
        // audio clock. Only movement physics uses the capped simulation step.
        this.progress.elapsed += realDt; this.ui.tick(realDt, this.settings.subtitles);
        this.subtitleCooldown = Math.max(0, this.subtitleCooldown - realDt);
        this.updateAtmosphere(realDt);
        const scareTime = this.world.corazon.timeline.time;
        const kind = this.world.corazon.kind;
        this.updateScare(realDt);
        // Keep kitchen dialogue behind the reveal when a frame stalls. The
        // scare clock may hold at the reveal to guarantee it is rendered once.
        if (kind === 'jumpscare' && this.revealTime >= 0) {
          const advance = this.world.corazon.active ? this.world.corazon.timeline.time - scareTime : CORAZON_SCARE.jumpscare.duration - scareTime;
          this.kitchen(Math.max(0, advance));
        }
        this.world.scene.render(); return;
      }
      this.progress.elapsed += dt; this.subtitleCooldown = Math.max(0, this.subtitleCooldown - dt);
      this.ui.tick(dt, this.settings.subtitles);
      if (this.input.consume('Tab')) { this.show('journal'); this.world.scene.render(); return; }
      const wasLit = this.player.flashlight;
      // Input belongs to the state in which it arrived, even when this frame
      // completes an animation. Do not replay a transition-time press afterward.
      const transitioningPlayer = this.player.movementLocked && !this.player.hidden;
      const transitioningDoors = new Set(this.world.fixtures3d.doors.filter(d => d.hinge.busy).map(d => d.id));
      this.world.fixtures3d.update(dt, [this.player.position, ...(this.ghost.state === 'Dormant' ? [] : [this.ghost.position])]);
      const exposed = this.player.hideExposed;
      const wasHidden = this.player.hidden;
      this.hiding.update(dt, this.ghost);
      if (!wasHidden && this.player.hidden) this.ui.notice(this.input.touchMode ? 'Hidden. Stay quiet. Tap Leave to step out.' : 'Hidden. Stay quiet. E to leave.', 4);
      else if (!exposed && this.player.hideExposed) this.ui.notice('She saw you entering. Get fully inside.', 4);
      this.player.update(dt, this.input, this.world, this.progress, this.settings, (p, radius) => this.ghost.hear(p, radius), () => {
        const p = this.player.position; this.audio.footstep(surfaceForRoom(this.world.room(p).id, p), this.player.sprinting, [p.x, p.y + .12, p.z]);
      });
      if (wasLit !== this.player.flashlight) this.audio.effect('flashlight');
      const revealing = this.kitchen(dt);
      if (!revealing) {
        this.interactions.focus(this.player, this.progress);
        const hide = this.input.consume('Hide');
        const use = this.input.consume('KeyE') || hide && (this.player.hidden || this.interactions.target?.kind === 'hide');
        if (use && !transitioningPlayer && (!this.interactions.target || !transitioningDoors.has(this.interactions.target.id))) this.use();
        if (this.input.consume('Throw') && this.interactions.throw(this.player)) { this.ghost.hear(this.player.position, 8); this.audio.effect('throw'); }
        const before = { ...this.ghost.position };
        const caught = this.ghost.update(dt, this.world, this.player, this.progress, event => this.speakGhost(event));
        if (this.ghost.openedDoor) this.audio.effect('latch', this.ghost.openedDoor);
        this.ghostMoving = Math.hypot(this.ghost.position.x - before.x, this.ghost.position.z - before.z) > .001;
        this.world.corazon.updateLocomotion(dt, this.ghost, this.settings);
        if (caught) { this.startGrab(); this.world.scene.render(); return; }
      } else { this.input.consume('KeyE'); this.input.consume('Throw'); this.input.consume('Hide'); }
      this.interactions.updateProjectile(dt, this.ghost, (p, r) => { this.ghost.hear(p, r); this.audio.effect('land', [p.x, p.y + .1, p.z]); }, () => {
        this.audio.effect('hit'); this.speakGhost('hit');
      });
      if (revealing && !this.world.corazon.active) this.world.corazon.updateLocomotion(dt, this.ghost, this.settings);
      this.sprintVoiceCooldown = Math.max(0, this.sprintVoiceCooldown - dt);
      if (this.ghost.state === 'Chase' && this.player.sprinting && this.sprintVoiceCooldown === 0 && this.subtitleCooldown === 0) {
        this.speakGhost('sprint'); this.sprintVoiceCooldown = 18;
      }
      if (this.screen === 'playing' && !this.world.corazon.active && !this.player.movementLocked && this.player.position.level === 0 && Math.abs(this.player.position.x) < .65 && this.player.position.z > .65 && canEscape(this.progress) && this.world.fixtures3d.doors.find(d => d.id === 'front-door')?.hinge.state === 'OPEN') {
        this.storage.clear(); this.show('won');
      }
      this.worldTick += dt; this.autosave += dt;
      if (this.worldTick >= .12) {
        this.worldTick = 0;
        this.world.update(this.player.position, this.player.direction, this.renderSettings, this.progress, has(this.progress, 'flashlight') && this.player.flashlight, this.progress.elapsed);
        const prompt = revealing ? '' : this.player.hidden ? 'Exit' : this.player.movementLocked ? '' : this.interactions.target?.label ?? '';
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
      suppressed: this.revealTime >= 0 || this.subtitleCooldown > 8 || this.world.corazon.active || this.grab.active,
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
  private syncTouch(): void {
    const locked = this.player.movementLocked;
    this.touch.sync(this.screen === 'playing' && !this.world?.corazon?.active && !this.grab.active, !locked && this.interactions?.target?.kind === 'hide' && this.player.grounded, this.player.hidden, !locked && (this.interactions?.slipperInHand ?? false), !locked && has(this.progress, 'flashlight') && this.world.viewmodel.ready, !locked && this.player.grounded, locked);
  }
  dispose(): void { this.abort.abort(); this.grabPresentation?.dispose(); this.struggleUI.dispose(); this.display.dispose(); this.ui.dispose(); this.input.dispose(); this.touch.dispose(); this.audio.dispose(); this.engine?.stopRenderLoop(); this.world?.dispose(); this.engine?.dispose(); }
}
