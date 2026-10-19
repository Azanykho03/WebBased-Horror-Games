// Local validation-only regression. Uses an isolated browser context and the
// fixture host compiled exclusively by Vite's validation mode.
import { createRequire } from 'node:module';
import { writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const mode = process.argv.includes('--preview') ? 'preview' : process.argv.includes('--edges') ? 'edges' : 'main';
const browser = await chromium.launch({ headless: true,
  ...(process.env.BROWSER_PATH ? { executablePath: process.env.BROWSER_PATH } : {}),
  args: ['--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, hasTouch: true });
const errors = [], report = [];
const append = report.push.bind(report); report.push = (...entries) => { entries.forEach(entry => console.log(entry)); return append(...entries); };
page.on('pageerror', error => errors.push(String(error)));
const url = process.env.GAME_URL || 'http://127.0.0.1:5175';
const read = () => page.evaluate(() => {
  const h = window.grabValidation, c = h.world.camera;
  return { phase: h.grab.phase, time: h.grab.time, remaining: h.grab.remaining, presses: h.grab.presses, required: h.grab.required, attempts: h.grab.attempts,
    screen: h.screen(), ghost: h.ghost.state, protection: h.ghost.grabProtection, position: { ...h.player.position }, yaw: h.player.yaw, pitch: h.player.pitch,
    grabbed: h.player.grabbed, restricted: h.input.restricted, active: h.input.active, hidden: h.player.hidden,
    pointerLocked: !!document.pointerLockElement,
    items: [...h.progress().collected], roll: c.rotation.z, rightY: c.getViewMatrix(true).clone().invert().m[1],
    velocity: h.player.verticalVelocity, collision: h.world.collision.blocked(h.player.position),
    qteVisible: !document.querySelector('#struggle').hidden, audio: h.audioDiagnostics().recordings?.jumpscare,
    rig: { root: h.world.viewmodel.root.isEnabled(), left: h.world.viewmodel.leftArm.isEnabled(), right: h.world.viewmodel.rightArm.isEnabled(), lampParent: h.world.viewmodel.lamp.parent?.name,
      equip: h.world.viewmodel.state.phase, equipTime: h.world.viewmodel.state.elapsed, lampPosition: h.world.viewmodel.lamp.position.asArray(),
      light: h.player.flashlight, fill: h.world.scene.getLightByName('viewmodel-fill').isEnabled() },
  };
});
async function prepare(difficulty, mobile = false, options = {}) {
  await page.evaluate(({ difficulty, mobile, options }) => {
    const h = window.grabValidation;
    h.action('menu'); h.action('new'); h.action(`difficulty:${difficulty}`); h.action('start-game'); h.action('skip-intro');
    h.input.setTouchMode(mobile);
    h.progress().collected = options.lamp === 'unowned' ? [] : ['flashlight', 'note']; h.progress().kitchenSeen = true;
    h.world.syncProgress(h.progress()); h.world.viewmodel.reset(!options.lamp); h.player.flashlight = !options.lamp;
    h.player.position = { x: 0, y: 0, z: -8, level: 0 }; h.player.yaw = .8; h.player.pitch = .2; h.player.halt(h.world); h.player.camera(h.world, h.settings());
    if (options.lamp === 'equipping') h.world.viewmodel.pickup();
    h.ghost.state = 'Chase'; h.ghost.grace = 0; h.ghost.yaw = Math.PI;
    h.ghost.position = { x: 0, y: 0, z: -8 - (difficulty === 'easy' ? .98 : 1.02), level: 0 };
    h.world.ghost.setEnabled(true); h.world.corazon.updateLocomotion(0, h.ghost, h.settings());
    document.querySelector('aside[aria-label="Development validation"]').hidden = true;
  }, { difficulty, mobile, options });
  await page.waitForFunction(phase => window.grabValidation.grab.phase === phase, options.phase ?? 'struggling', { timeout: 12000 });
}
async function press(mobile) {
  if (mobile) await page.locator('.struggle-tap').tap();
  else await page.keyboard.press('e');
}
async function escape(mobile = false) {
  const state = await read(); for (let n = state.presses; n < state.required; n++) await press(mobile);
  await page.waitForFunction(() => window.grabValidation.grab.phase === 'idle');
}
try {
  await page.goto(url); await page.waitForFunction(() => window.grabValidation, null, { timeout: 60000 });
  await page.getByRole('button', { name: /Enter the house|Start a new night/ }).click();
  if (mode === 'preview') {
    await prepare('medium');
    await page.screenshot({ path: 'tests/grab-desktop.png' });
    console.log(JSON.stringify(await read(), null, 2));
  } else if (mode === 'edges') {
    for (const lamp of ['unowned', 'equipping']) {
      await prepare('easy', false, { lamp, phase: 'grab-start' });
      const reached = await read();
      await page.waitForFunction(() => window.grabValidation.grab.phase === 'struggling');
      const held = await read(); assert(held.rig.left && held.rig.root && held.rig.fill);
      assert.equal(held.rig.lampParent, reached.rig.lampParent);
      if (lamp === 'unowned') assert.deepEqual(held.rig.lampPosition, reached.rig.lampPosition, 'Uncollected lamp stays on its table');
      else assert.equal(held.rig.equipTime, reached.rig.equipTime, 'Grab suspends the equip clock');
      await escape(); const released = await read();
      assert.deepEqual(released.items, held.items); assert(!released.rig.left);
      if (lamp === 'unowned') assert(!released.rig.root && released.rig.equip === 'unowned');
      else { await page.waitForFunction(() => window.grabValidation.world.viewmodel.ready); assert.equal((await read()).rig.lampParent, 'FlashlightSocket'); }
      report.push(`PASS ${lamp} flashlight: visible arms, original lamp attachment, inventory and equip recovery`);
    }
    await prepare('easy', false, { phase: 'grab-start' });
    await page.keyboard.down('e');
    await page.waitForFunction(() => window.grabValidation.grab.phase === 'struggling');
    await page.keyboard.down('e'); assert.equal((await read()).presses, 0, 'Pre-held E cannot become a struggle press');
    await page.keyboard.up('e'); await press(false); assert.equal((await read()).presses, 1);
    await page.keyboard.press('Escape'); assert.equal((await read()).screen, 'paused');
    const paused = await read(); await page.waitForTimeout(250); assert.equal((await read()).remaining, paused.remaining);
    await page.locator('#panel [data-action="resume"]').click();
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    const blurred = await read(); assert.equal(blurred.screen, 'paused');
    await page.waitForTimeout(250); assert.equal((await read()).remaining, blurred.remaining);
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await page.locator('#panel [data-action="resume"]').click();
    const beforeStall = await read();
    await page.evaluate(() => { const end = performance.now() + 700; while (performance.now() < end) { /* Simulate one dropped render frame. */ } });
    await page.waitForTimeout(70);
    assert(beforeStall.remaining - (await read()).remaining >= .7, 'Deadline follows elapsed time, not capped movement dt');
    await escape();
    report.push('PASS pre-held E, Escape pause, window blur/focus and dropped-frame deadline');

    // Repeated catches in the same live run, with the real immunity and chase.
    for (let i = 0; i < 2; i++) {
      const recovered = await read(); assert(recovered.protection > 2);
      await page.waitForTimeout(1200); assert.equal((await read()).phase, 'idle');
      await page.waitForFunction(() => window.grabValidation.grab.phase === 'struggling', null, { timeout: 12000 });
      const repeat = await read(); assert.equal(repeat.attempts, i + 2); assert.equal(repeat.required, 10 + i * 2);
      await escape(); const next = await read(); assert(!next.grabbed && !next.restricted && !next.rig.left && !next.collision);
      assert(Math.abs(next.yaw - .8) < .00001 && Math.abs(next.pitch - .2) < .00001);
    }
    report.push('PASS repeated live catches: protection window, renewed chase, stable rig, upright view and recovery');

    await page.setViewportSize({ width: 844, height: 390 }); await prepare('easy', true);
    assert(!(await read()).pointerLocked, 'A late desktop pointer-lock request must not capture touch input');
    await page.getByRole('button', { name: 'Pause struggle' }).tap(); assert.equal((await read()).screen, 'paused');
    await page.locator('#panel [data-action="resume"]').tap();
    const beforeGesture = await read();
    await page.locator('.touch-look').dispatchEvent('pointerdown', { pointerId: 802, pointerType: 'touch', clientX: 650, clientY: 80 });
    await page.locator('.touch-look').dispatchEvent('pointermove', { pointerId: 802, pointerType: 'touch', clientX: 710, clientY: 140 });
    await page.locator('.touch-look').dispatchEvent('pointercancel', { pointerId: 802, pointerType: 'touch' });
    await page.waitForTimeout(100); const afterGesture = await read();
    assert.equal(afterGesture.yaw, beforeGesture.yaw); assert.equal(afterGesture.pitch, beforeGesture.pitch);
    assert.deepEqual(afterGesture.position, beforeGesture.position);
    await page.evaluate(() => { document.querySelector('aside[aria-label="Development validation"]').hidden = false; });
    await page.getByRole('button', { name: 'Check landscape fullscreen' }).click();
    await page.waitForFunction(() => document.querySelector('[aria-label="Fullscreen validation"]').textContent.startsWith('PASS'));
    report.push((await page.locator('[aria-label="Fullscreen validation"]').innerText()).replace(/^PASS:/, 'PASS QTE fullscreen:'));
    await page.evaluate(() => { document.querySelector('aside[aria-label="Development validation"]').hidden = true; });
    if ((await read()).screen === 'paused') await page.locator('#panel [data-action="resume"]').tap();
    await escape(true);
    report.push('PASS touch pause/resume and blocked camera gestures during the struggle');
  } else {
    for (const difficulty of ['easy', 'medium', 'hard']) for (const mobile of [false, true]) {
      await page.setViewportSize(mobile ? { width: 844, height: 390 } : { width: 1280, height: 720 });
      await prepare(difficulty, mobile);
      const before = await read(); assert(before.qteVisible && before.grabbed && before.restricted);
      assert.equal(before.audio?.starts ?? 0, 0, 'No finishing scream during a recoverable grab');
      if (!mobile) {
        await page.keyboard.down('e'); await page.keyboard.down('e');
        await page.waitForTimeout(180); assert.equal((await read()).presses, 1, 'Holding E is one press'); await page.keyboard.up('e');
      } else {
        await page.locator('.struggle-tap').dispatchEvent('pointerdown', { pointerId: 901, pointerType: 'touch', button: 0 });
        await page.locator('.struggle-tap').dispatchEvent('pointerdown', { pointerId: 901, pointerType: 'touch', button: 0 });
        assert.equal((await read()).presses, 1, 'Held pointer is one tap');
        await page.locator('.struggle-tap').dispatchEvent('pointercancel', { pointerId: 901, pointerType: 'touch' });
      }
      await page.keyboard.press('w'); await page.keyboard.press('Space'); await page.keyboard.press('f'); await page.keyboard.press('Tab');
      assert.equal((await read()).screen, 'playing', 'Other actions cannot open a journal during QTE');
      await page.evaluate(() => window.grabValidation.action('journal'));
      const paused = await read(); await page.waitForTimeout(250);
      assert.equal((await read()).remaining, paused.remaining); assert(!(await read()).qteVisible);
      await page.evaluate(() => window.grabValidation.action('resume'));
      if (difficulty === 'medium') await page.screenshot({ path: `tests/grab-${mobile ? 'mobile' : 'desktop'}.png` });
      const state = await read(); for (let n = state.presses; n < state.required; n++) await press(mobile);
      await page.waitForFunction(() => window.grabValidation.grab.phase === 'idle', null, { timeout: 5000 });
      const after = await read();
      assert.equal(after.screen, 'playing'); assert(!after.restricted && !after.grabbed && !after.qteVisible);
      assert.equal(after.ghost, 'Chase'); assert(after.protection > 2); assert.deepEqual(after.items, before.items);
      assert(!after.collision); assert.equal(after.roll, 0); assert(Math.abs(after.rightY) < 1e-6);
      assert(Math.abs(after.yaw - .8) < .00001 && Math.abs(after.pitch - .2) < .00001);
      assert(!after.rig.left); assert.equal(after.velocity, 0);
      await page.keyboard.down('w'); await page.keyboard.down('Shift'); await page.keyboard.press('Space'); await page.waitForTimeout(150);
      await page.keyboard.up('w'); await page.keyboard.up('Shift');
      const moved = await read(); assert(moved.position.y > after.position.y, 'Jump restored');
      assert(Math.hypot(moved.position.x - after.position.x, moved.position.z - after.position.z) > .1, 'Locomotion restored');
      report.push(`PASS ${difficulty} ${mobile ? 'touch' : 'desktop'}: guarded catch, individual presses, pause, escape, inventory, upright camera, jump and movement recovery`);
    }
    for (const difficulty of ['easy', 'medium', 'hard']) {
      await prepare(difficulty);
      const starts = (await read()).audio?.starts ?? 0;
      await page.waitForFunction(() => window.grabValidation.screen() === 'caught', null, { timeout: 15000 });
      const dead = await read(); assert(!dead.grabbed && !dead.restricted && !dead.active && !dead.qteVisible);
      assert.equal(dead.audio?.starts, starts + 1); assert.equal(dead.audio?.sources, 0);
      await page.getByRole('button', { name: 'Retry checkpoint' }).click();
      const retry = await read(); assert.equal(retry.phase, 'idle'); assert.equal(retry.presses, 0); assert.equal(retry.attempts, 0); assert.equal(retry.screen, 'ready');
      assert.equal(retry.roll, 0); assert(!retry.rig.left);
      report.push(`PASS ${difficulty}: timeout → one finishing sound / animation → Game Over → clean retry`);
    }
    await prepare('medium', true);
    await page.setViewportSize({ width: 390, height: 844 });
    const box = await page.locator('.struggle-tap').boundingBox(); assert(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= 390 && box.y + box.height <= 844);
    await page.screenshot({ path: 'tests/grab-portrait.png' });
    await page.evaluate(() => window.grabValidation.action('menu'));
    const menu = await read(); assert.equal(menu.phase, 'idle'); assert(!menu.grabbed && !menu.restricted && !menu.qteVisible);
    report.push('PASS portrait layout and exiting an active struggle to the main menu');
  }
  assert.deepEqual(errors, []); report.push('PASS no browser runtime errors');
} catch (error) { report.push(`FAIL ${error.stack}\nState: ${JSON.stringify(await read().catch(() => null))}`); await page.screenshot({ path: 'tests/grab-failure.png' }).catch(() => {}); process.exitCode = 1; }
finally {
  if (mode !== 'preview') await writeFile(`tests/grab-${mode === 'edges' ? 'edges-' : ''}browser-report.txt`, report.join('\n') + '\n');
  console.log(report.join('\n')); await browser.close();
}
