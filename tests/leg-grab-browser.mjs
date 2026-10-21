// Real imported models, source-derived clips and audio in an isolated validation build.
import { createRequire } from 'node:module';
import { writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH || 'playwright');
const browser = await chromium.launch({ headless: true,
  ...(process.env.BROWSER_PATH ? { executablePath: process.env.BROWSER_PATH } : {}),
  args: ['--autoplay-policy=no-user-gesture-required', '--no-proxy-server'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, hasTouch: true });
const errors = [], missing = [], report = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('response', r => { if (r.status() >= 400) missing.push(`${r.status()} ${r.url()}`); });
const log = message => { console.log(message); report.push({ message }); };
const read = () => page.evaluate(() => {
  const h = window.grabValidation, w = h.world, legs = w.legs, grip = h.grabPresentation.gripTargets[0], B = window.BABYLON;
  return { phase: h.grab.phase, time: h.grab.time, screen: h.screen(), remaining: h.grab.remaining,
    attempts: h.grab.attempts, presses: h.grab.presses, required: h.grab.required,
    position: { ...h.player.position }, ghost: { ...h.ghost.position }, ghostState: h.ghost.state,
    yaw: h.player.yaw, pitch: h.player.pitch, view: w.camera.position.asArray(), roll: w.camera.rotation.z, touch: h.input.touchMode,
    legs: legs.root.isEnabled(), side: h.grabPresentation.grabbedSide, grips: h.grabPresentation.gripTargets.length,
    gripError: grip ? B.Vector3.Distance(legs.contacts[1], grip) : 0,
    contacts: legs.contacts.map(v => v.asArray()), joints: legs.joints.map(n => n.rotationQuaternion.asArray()),
    head: w.corazon.facePosition().asArray(), locked: h.player.grabbed || h.input.restricted,
    audio: h.audioDiagnostics().recordings?.grab, capture: h.audioDiagnostics().recordings?.jumpscare,
    monitor: { ...window.singleLegMonitor },
  };
});
async function sample(name, screenshot = true) {
  const data = await read();
  const skin = await page.evaluate(() => {
    const legs = window.grabValidation.world.legs, B = window.BABYLON;
    legs.skeleton.prepare(); let minY = Infinity, finite = true;
    for (const mesh of legs.meshes) {
      const vertices = mesh.getPositionData(true, true), matrix = mesh.computeWorldMatrix(true);
      for (let i = 0; i < vertices.length; i += 3) {
        const v = B.Vector3.TransformCoordinates(B.Vector3.FromArray(vertices, i), matrix);
        minY = Math.min(minY, v.y); finite &&= Number.isFinite(v.x + v.y + v.z);
      }
    }
    return { minY, finite, bones: legs.skeleton.bones.length };
  });
  assert(skin.finite); assert.equal(skin.bones, 7);
  if (data.legs) assert(skin.minY > data.position.y - .025, `${name}: floor clearance ${skin.minY}`);
  report.push({ name, ...data, skin });
  if (screenshot) await page.screenshot({ path: `tests/single-leg-${name}.png` });
  return data;
}
async function phase(phase, time = 0) {
  await page.waitForFunction(({ phase, time }) => window.grabValidation.grab.phase === phase && window.grabValidation.grab.time >= time,
    { phase, time }, { timeout: 16000 });
}
async function prepare(difficulty = 'easy', touch = false, reduced = false, near = false) {
  await page.evaluate(({ difficulty, touch, reduced, near }) => {
    const h = window.grabValidation;
    h.action('menu'); h.action('new'); h.action(`difficulty:${difficulty}`); h.action('start-game'); h.action('skip-intro');
    h.settings().reducedMotion = reduced; h.input.setTouchMode(touch);
    h.progress().collected = ['flashlight', 'note']; h.progress().kitchenSeen = true;
    h.world.syncProgress(h.progress()); h.world.viewmodel.reset(true); h.player.flashlight = true;
    h.player.position = { x: 0, y: 0, z: -8, level: 0 }; h.player.yaw = .8; h.player.pitch = -.2;
    h.player.halt(h.world); h.player.camera(h.world, h.settings());
    h.ghost.state = 'Chase'; h.ghost.grace = near ? 0 : 100; h.ghost.yaw = Math.PI;
    h.ghost.position = { x: 0, y: 0, z: near ? -9.02 : -12, level: 0 }; h.world.ghost.setEnabled(true);
    window.singleLegMonitor = { maxGripError: 0, maxRoll: 0, minHeadY: 100, minFacing: 1, heldFrames: 0, idleLegFrames: 0 };
    document.querySelector('aside[aria-label="Development validation"]').hidden = true;
  }, { difficulty, touch, reduced, near });
}
async function escape(touch = false) {
  const state = await read();
  // Native taps do not wait for the button's :active CSS transition after each
  // press. Locator stability waits can consume a Hard timer on a busy test host.
  const button = touch ? await page.locator('.struggle-tap').boundingBox() : null;
  if (touch) assert(button && state.touch, 'Touch struggle button must be available');
  for (let i = state.presses; i < state.required; i++) {
    if (touch) { await page.touchscreen.tap(button.x + button.width / 2, button.y + button.height / 2); await page.waitForTimeout(50); }
    else await page.keyboard.press('e');
  }
  await phase('idle');
  const restored = await read();
  assert(!restored.legs && !restored.locked && restored.grips === 0); assert.equal(restored.audio.sources, 0);
  assert(Math.abs(restored.roll) < 1e-8); assert(Math.abs(restored.view[1] - restored.position.y - 1.65) < 1e-6);
  return restored;
}
try {
  await page.goto(process.env.GAME_URL || 'http://127.0.0.1:5176', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => window.grabValidation, null, { timeout: 60000 });
  await page.getByRole('button', { name: /Enter the house|Start a new night/ }).click();
  await page.waitForFunction(() => window.grabValidation.audioDiagnostics().recordings?.grab.status === 'ready');
  await page.evaluate(() => {
    const h = window.grabValidation, B = window.BABYLON;
    h.world.scene.onAfterRenderObservable.add(() => {
      const m = window.singleLegMonitor; if (!m || h.screen() !== 'playing') return;
      const grip = h.grabPresentation.gripTargets[0];
      if (grip) {
        m.heldFrames++; m.maxGripError = Math.max(m.maxGripError, B.Vector3.Distance(grip, h.world.legs.contacts[1]));
        m.maxRoll = Math.max(m.maxRoll, Math.abs(h.world.camera.rotation.z));
      }
      if (grip || h.ghost.state === 'Chase' && h.world.corazon.crawlAmount > .9) {
        const face = h.world.corazon.facePosition(); m.minHeadY = Math.min(m.minHeadY, face.y - h.ghost.position.y);
        const normal = B.Vector3.TransformNormal(new B.Vector3(0, 0, 1), h.world.corazon.head.getWorldMatrix()).normalize();
        m.minFacing = Math.min(m.minFacing, B.Vector3.Dot(normal, h.world.camera.position.subtract(face).normalize()));
      }
      if (h.grab.phase === 'idle' && h.world.legs.root.isEnabled()) m.idleLegFrames++;
    });
  });
  await prepare();
  await page.evaluate(() => { const h = window.grabValidation; h.player.pitch = -1.35; });
  await page.waitForTimeout(100); assert(!(await sample('normal')).legs);
  await page.keyboard.down('w'); await page.waitForTimeout(200); assert(!(await read()).legs);
  await page.keyboard.down('Shift'); await page.keyboard.press('Space'); await page.waitForTimeout(140);
  const jump = await read(); assert(jump.position.y > .1); assert(!jump.legs);
  await page.keyboard.up('w'); await page.keyboard.up('Shift');
  await page.waitForFunction(() => window.grabValidation.player.grounded);
  log('PASS arms-only downward look, walking, sprinting and jump; normal movement preserved');
  await page.evaluate(() => { const h = window.grabValidation; h.player.position = { x: 0, y: 0, z: -8, level: 0 }; h.player.yaw = 0; h.player.pitch = -.35; h.player.halt(h.world); h.ghost.grace = 0; });
  const starts = (await read()).audio.starts;
  await page.waitForTimeout(500); await sample('chase');
  await phase('grab-start', .1); const contact = await sample('contact'); assert(contact.legs); assert.equal(contact.side, 1); assert.equal(contact.grips, 1); assert.equal(contact.audio.starts, starts + 1);
  await phase('falling', .2); await sample('falling');
  await phase('dragging', .2); await sample('dragging');
  await phase('struggling'); const before = await read();
  await page.keyboard.down('e'); await page.keyboard.down('e'); await page.waitForTimeout(80);
  const kick = await sample('kick'); assert.equal(kick.presses, 1); assert.equal(kick.audio.starts, starts + 1);
  assert.deepEqual(kick.joints.slice(3), before.joints.slice(3)); assert.notDeepEqual(kick.joints.slice(0, 3), before.joints.slice(0, 3));
  await page.keyboard.up('e');
  await page.keyboard.press('Escape'); const paused = await read(); assert.equal(paused.screen, 'paused');
  await page.waitForTimeout(180); assert.equal((await read()).remaining, paused.remaining);
  await page.locator('#panel [data-action="resume"]').click();
  const recovered = await escape(); await sample('recovered');
  assert(recovered.monitor.maxGripError < .08, `maximum contact error ${recovered.monitor.maxGripError}`);
  assert(recovered.monitor.maxRoll > .01 && recovered.monitor.maxRoll <= .12);
  assert(recovered.monitor.minHeadY > .35 && recovered.monitor.minFacing > .2, `head tracking ${JSON.stringify(recovered.monitor)}`);
  assert.equal(recovered.monitor.idleLegFrames, 0);
  log('PASS source FBX chase/fall/drag, one fixed ankle, free-leg kick, held-E rejection, one-shot sound, Perlin shake, pause and recovery');

  await page.setViewportSize({ width: 844, height: 390 }); await prepare('hard', true, true, true);
  for (let attempt = 1; attempt <= 3; attempt++) {
    await phase('struggling'); const state = await sample(`touch-${attempt}`, attempt === 1);
    assert.equal(state.attempts, attempt); assert.equal(state.required, 16 + (attempt - 1) * 4); assert.equal(state.roll, 0);
    const restored = await escape(true); assert.equal(restored.monitor.idleLegFrames, 0);
    assert(Math.abs(restored.yaw - .8) < 1e-6 && Math.abs(restored.pitch + .2) < 1e-6);
  }
  log('PASS three consecutive Hard touch escapes, original 16/20/24 progression, protection, reduced-motion view and no accumulated offsets');
  await page.setViewportSize({ width: 390, height: 844 });
  await phase('struggling'); await sample('portrait');
  const captureStarts = (await read()).capture.starts;
  await page.waitForFunction(() => window.grabValidation.screen() === 'caught', null, { timeout: 14000 });
  const dead = await sample('failure'); assert(!dead.legs && !dead.locked && dead.grips === 0); assert.equal(dead.audio.sources, 0); assert.equal(dead.capture.starts, captureStarts + 1);
  await page.keyboard.press('e'); assert.equal((await read()).screen, 'caught');
  await page.evaluate(() => window.grabValidation.action('retry')); const retry = await read(); assert.equal(retry.attempts, 0); assert.equal(retry.phase, 'idle'); assert(!retry.legs && !retry.locked);
  log('PASS failed escape → one existing capture → Game Over; rejects later E; retry cleans state');
  await prepare('easy', true, false, true); await phase('struggling');
  await page.evaluate(() => window.grabValidation.action('menu')); const menu = await read(); assert.equal(menu.phase, 'idle'); assert(!menu.legs && !menu.locked); assert.equal(menu.audio.sources, 0);
  assert.deepEqual(errors, []); assert.deepEqual(missing, []);
  log('PASS menu interruption, no missing assets and no browser runtime errors');
} catch (error) {
  log(`FAIL ${error.stack}`); console.log(JSON.stringify(await read().catch(() => null)));
  await sample('diagnostic').catch(() => {}); process.exitCode = 1;
} finally {
  await writeFile('tests/single-leg-browser-report.json', JSON.stringify({ errors, missing, report }, null, 2) + '\n'); await browser.close();
}
