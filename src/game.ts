import { B, World } from './world.ts';
import type * as Babylon from 'babylonjs';
import { Player, InputSystem } from './player.ts';
import { GhostStateMachine } from './ghost.ts';
import { InteractionSystem } from './interactions.ts';
import { AudioSystem } from './audio.ts';
import { SaveSystem } from './storage.ts';
import { UI } from './ui.ts';
import { bearingsFound, canEscape, interact, has } from './objectives.ts';
import { freshProgress } from './types.ts';
import type { Progress, Screen, Settings } from './types.ts';
import { CHECKPOINTS, GHOST_PROFILE, WARNING } from './config.ts';
import type { VoiceCue } from './config.ts';

export class Game {
  private engine!: Babylon.Engine;
  private world!: World;
  private interactions!: InteractionSystem;
  private player = new Player();
  private ghost = new GhostStateMachine();
  private storage = new SaveSystem();
  private ui: UI;
  private input: InputSystem;
  private audio: AudioSystem;
  private settings: Settings;
  private progress = freshProgress();
  private screen: Screen = 'loading';
  private returnScreen: Screen = 'menu';
  private loaded = false;
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
    this.ui.onAction = action => this.action(action);
    this.ui.onSettings = (key, value) => {
      this.settings = { ...this.settings, [key]: value }; this.storage.saveSettings(this.settings); this.audio.apply(this.settings);
      this.engine?.setHardwareScalingLevel(this.settings.quality === 'low' ? Math.max(1.5, devicePixelRatio) : Math.max(1, devicePixelRatio / 1.5));
      if (this.loaded) this.world.update(this.player.position, this.player.direction, this.settings, this.progress, this.player.flashlight && has(this.progress, 'flashlight'), this.progress.elapsed);
    };
    window.addEventListener('beforeunload', () => { if (this.loaded && this.screen !== 'won' && this.screen !== 'menu') this.save(); }, { signal: this.abort.signal });
    window.addEventListener('keydown', event => {
      if (this.screen === 'journal' && (event.code === 'Tab' || event.code === 'Escape')) {
        event.preventDefault(); this.action('resume');
      }
    }, { signal: this.abort.signal });
  }
  async init(): Promise<void> {
    this.show('loading');
    try {
      if (!B || !B.Engine.IsSupported) throw new Error('This browser could not initialize WebGL. Try a desktop browser with hardware acceleration.');
      this.engine = new B.Engine(this.canvas, true, { preserveDrawingBuffer: true, stencil: true, powerPreference: 'high-performance' });
      this.engine.setHardwareScalingLevel(this.settings.quality === 'low' ? Math.max(1.5, devicePixelRatio) : Math.max(1, devicePixelRatio / 1.5));
      this.world = new World(this.engine);
      await this.world.load((label, percent) => this.ui.loading(label, percent));
      this.interactions = new InteractionSystem(this.world);
      this.loaded = true;
      this.world.syncProgress(this.progress);
      this.player.reset(CHECKPOINTS.entrance);
      this.player.camera(this.world, this.settings);
      this.interactions.reset(this.progress);
      this.world.update(this.player.position, this.player.direction, this.settings, this.progress, true, 0);
      window.addEventListener('resize', () => this.engine.resize(), { signal: this.abort.signal });
      this.engine.onContextLostObservable.add(() => { this.pause(); this.ui.notice('Graphics context lost. Reload if the scene does not recover.', 15); });
      this.show('menu'); this.last = performance.now();
      if (import.meta.env.MODE === 'validation') {
        const { attachJourney } = await import('../tests/browser-journey.ts');
        this.validationStep = attachJourney({
          world: this.world, player: this.player, ghost: this.ghost, input: this.input, interactions: this.interactions,
          progress: () => this.progress, screen: () => this.screen, revealing: () => this.revealTime >= 0,
          audioState: () => this.audio.state,
          action: action => this.action(action),
        });
      }
      this.engine.runRenderLoop(() => this.tick());
    } catch (error) { this.show('error', error instanceof Error ? error.message : String(error)); console.error(error); }
  }
  private show(screen: Screen, detail = ''): void {
    this.screen = screen;
    if (screen !== 'playing') { this.input.stop(); this.audio.pause(); }
    this.ui.screen(screen, this.progress, this.settings, this.storage.load() !== null, detail);
  }
  private action(action: string): void {
    if (action === 'reload') { location.reload(); return; }
    if (!this.loaded) return;
    if (action === 'new') { this.storage.clear(); this.begin(freshProgress()); }
    if (action === 'continue' || action === 'retry') this.begin(this.storage.load() ?? freshProgress());
    if (action === 'resume') { this.show('playing'); this.last = performance.now(); this.input.start(this.canvas); this.audio.start(); }
    if (action === 'menu') {
      if (!['menu', 'won', 'caught'].includes(this.screen)) this.save();
      this.show('menu');
    }
    if (action === 'journal') this.show('journal');
    if (action === 'settings' || action === 'credits') { this.returnScreen = this.screen === 'menu' ? 'menu' : 'paused'; this.show(action); }
    if (action === 'back') this.show(this.returnScreen);
  }
  private begin(progress: Progress): void {
    this.progress = structuredClone(progress); this.revealTime = -1; this.revealStage = -1; this.autosave = 0; this.subtitleCooldown = 0;
    this.captureTime = this.sprintVoiceCooldown = 0; this.world.kitchenBlackout = false;
    this.progress.battery = Math.max(this.progress.battery, 25);
    this.player.reset(CHECKPOINTS[this.progress.checkpoint]);
    this.ghost.reset(this.progress.kitchenSeen, this.player.position);
    this.world.syncProgress(this.progress); this.interactions.reset(this.progress);
    this.player.camera(this.world, this.settings); this.ui.reset(); this.audio.reset();
    this.world.ghost.setEnabled(this.progress.kitchenSeen); this.world.arms.setEnabled(has(this.progress, 'flashlight'));
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
    this.ui.say(text, seconds); this.subtitleCooldown = seconds; this.audio.voice(voice);
  }
  private use(): void {
    if (this.player.hidden) { this.player.hidden = this.player.hideExposed = false; this.ui.notice('You step out.'); return; }
    const target = this.interactions.target;
    if (!target) return;
    if (target.kind === 'hide') {
      this.player.hideExposed = this.ghost.sees(this.player, this.world);
      this.player.hidden = true; this.player.flashlight = false;
      this.ui.notice(this.player.hideExposed ? 'She saw you enter. This hiding place will not protect you.' : 'Stay quiet. E to leave.', 5); return;
    }
    if (target.id === 'tsinelas') { this.interactions.takeSlipper(this.progress); this.ui.notice('Tsinelas ready. Left click to throw.'); this.audio.effect('pickup'); this.save(); return; }
    const result = interact(this.progress, target.id);
    if (target.id === 'note') this.speak(WARNING, 18, true);
    this.ui.notice(result.message, target.id === 'note' ? 8 : 4);
    if (result.changed) {
      this.audio.effect(target.kind === 'pickup' ? 'pickup' : 'latch');
      this.world.syncProgress(this.progress); this.interactions.sync(this.progress); this.save();
      if (result.checkpoint) this.ghost.grace = Math.max(5, this.ghost.grace);
      if (target.id === 'exit') this.speak(`${GHOST_PROFILE.name}: “ASA MAN KA PADULONG?! BALIK DIRI!”`, 3, true, 'exit');
    }
  }
  private kitchen(dt: number): boolean {
    const room = this.world.room(this.player.position).id;
    if (this.revealTime < 0 && !this.progress.kitchenSeen && bearingsFound(this.progress) && room === 'F05') {
      this.revealTime = 0; this.revealStage = -1; this.audio.effect('latch');
    }
    if (this.revealTime < 0) return false;
    this.revealTime += dt;
    const stage = this.revealTime < 1.8 ? 0 : this.revealTime < 3.8 ? 1 : this.revealTime < 5.8 ? 2 : 3;
    if (stage !== this.revealStage) {
      this.revealStage = stage;
      if (stage === 0) this.speak(this.settings.cleanDialogue ? 'You: “Aguy, unsa man tong tingoga?”' : 'You: “Yawa, unsa man tong tingoga?”', 1.8, true, 'kitchen-player');
      if (stage === 1) { this.audio.effect('sting'); this.speak(`${GHOST_PROFILE.name}: “HOY! NGANONG NISULOD MAN KA DIRI?!”`, 2, true, 'kitchen-ghost'); }
      if (stage === 2) this.speak(`You: “${this.settings.cleanDialogue ? 'AGUY' : 'YAWA'}, SI ${GHOST_PROFILE.name.toUpperCase()} RA DIAY!”`, 2, true, 'recognition');
      if (stage === 3) {
        this.progress.kitchenSeen = true; this.revealTime = -1; this.ghost.reveal(this.player.position, this.world.nav); this.world.ghost.setEnabled(true);
        this.interactions.sync(this.progress); this.save(); this.ui.notice('Move. Find the fuse. The tsinelas on the floor can slow her down.', 6);
      }
    }
    this.ui.face(stage === 1, this.settings.gentleScares);
    this.world.kitchenBlackout = stage === 1;
    return stage < 3;
  }
  private tick(): void {
    const now = performance.now(), dt = Math.min(.05, Math.max(0, (now - this.last) / 1000)); this.last = now;
    this.validationStep?.(dt);
    if (this.screen === 'playing' && !document.hidden) {
      if (this.captureTime > 0) {
        this.captureTime -= dt; this.ui.face(true, this.settings.gentleScares);
        if (this.captureTime <= 0) this.show('caught');
        this.world.scene.render(); return;
      }
      this.progress.elapsed += dt; this.subtitleCooldown = Math.max(0, this.subtitleCooldown - dt);
      this.ui.tick(dt, this.settings.subtitles);
      if (this.input.consume('Tab')) { this.show('journal'); this.world.scene.render(); return; }
      this.player.update(dt, this.input, this.world, this.progress, this.settings, (p, radius) => this.ghost.hear(p, radius), () => this.audio.effect('step'));
      const revealing = this.kitchen(dt);
      if (!revealing) {
        this.interactions.focus(this.player, this.progress);
        if (this.input.consume('KeyE')) this.use();
        if (this.input.consume('Throw') && this.interactions.throw(this.player)) this.ghost.hear(this.player.position, 8);
        const caught = this.ghost.update(dt, this.world, this.player, this.progress, event => this.speak(`${GHOST_PROFILE.name}: ${event === 'spotted' ? '“HOYYYY! ARI DIRI!”' : '“PAGHULAT BA!”'}`, 3, false, event));
        if (caught) { this.audio.effect('sting'); this.captureTime = .7; this.input.clear(); }
      } else { this.input.consume('KeyE'); this.input.consume('Throw'); }
      this.interactions.updateProjectile(dt, this.ghost, (p, r) => this.ghost.hear(p, r), () => {
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
        this.world.update(this.player.position, this.player.direction, this.settings, this.progress, has(this.progress, 'flashlight') && this.player.flashlight, this.progress.elapsed);
        const prompt = revealing ? '' : this.player.hidden ? 'Leave hiding place' : this.interactions.target?.label ?? '';
        this.ui.update(this.progress, this.player.stamina, this.world.room(this.player.position).name, prompt, this.ghost.state, this.player.hidden, this.interactions.slipperInHand);
      }
      this.audio.update(dt, this.world.room(this.player.position).id, this.ghost.state === 'Chase', this.player.eye, this.player.direction.asArray() as [number, number, number], this.ghost.state === 'Dormant' ? null : this.ghost.position, text => { if (this.subtitleCooldown === 0) this.speak(text); });
      if (this.autosave > 20 && this.screen === 'playing') { this.autosave = 0; this.save(); }
    }
    this.world.scene.render();
  }
  dispose(): void { this.abort.abort(); this.ui.dispose(); this.input.dispose(); this.audio.dispose(); this.engine?.stopRenderLoop(); this.world?.dispose(); this.engine?.dispose(); }
}
