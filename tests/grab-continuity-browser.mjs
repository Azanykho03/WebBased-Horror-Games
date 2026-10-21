// Inspect real rendered phase boundaries; fixture placement only, no animation-clock changes.
import { createRequire } from 'node:module';
import { writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH || 'playwright');
const browser = await chromium.launch({ headless: true,
  ...(process.env.BROWSER_PATH ? { executablePath: process.env.BROWSER_PATH } : {}),
  args: ['--autoplay-policy=no-user-gesture-required', '--no-proxy-server'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } }), errors = [];
page.on('pageerror', error => errors.push(String(error)));
try {
  await page.goto(process.env.GAME_URL || 'http://127.0.0.1:4174', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => window.grabValidation, null, { timeout: 60000 });
  await page.getByRole('button', { name: /Enter the house|Start a new night/ }).click();
  await page.evaluate(() => {
    const h = window.grabValidation;
    h.action('new'); h.action('difficulty:easy'); h.action('start-game'); h.action('skip-intro');
    h.settings().reducedMotion = true;
    h.progress().collected = ['flashlight', 'note']; h.progress().kitchenSeen = true;
    h.world.syncProgress(h.progress()); h.world.viewmodel.reset(true); h.player.flashlight = true;
    h.player.position = { x: 0, y: 0, z: -8, level: 0 }; h.player.yaw = 0; h.player.pitch = -.2; h.player.halt(h.world);
    h.ghost.state = 'Chase'; h.ghost.grace = 0; h.ghost.yaw = Math.PI;
    h.ghost.position = { x: 0, y: 0, z: -9.02, level: 0 }; h.world.ghost.setEnabled(true);
    document.querySelector('aside[aria-label="Development validation"]').hidden = true;
    let previous;
    window.continuity = { boundaries: [], worst: {}, maxGroundedHipHeight: 0 };
    h.world.scene.onAfterRenderObservable.add(() => {
      const l = h.world.legs, B = window.BABYLON;
      const sample = { phase: h.grab.phase, time: performance.now(), enabled: l.root.isEnabled(),
        q: [...l.joints.map(n => n.rotationQuaternion.clone()), l.root.rotationQuaternion.clone()],
        foot: l.contacts[1].clone(), camera: h.world.camera.position.clone() };
      if (sample.phase === 'struggling') window.continuity.maxGroundedHipHeight = Math.max(window.continuity.maxGroundedHipHeight, l.root.position.y - h.player.position.y);
      if (previous?.enabled && sample.enabled) {
        const dt = (sample.time - previous.time) / 1000;
        const change = { from: previous.phase, to: sample.phase, dt,
          angle: Math.max(...sample.q.map((q, i) => 2 * Math.acos(Math.min(1, Math.abs(B.Quaternion.Dot(q, previous.q[i])))))),
          ankle: B.Vector3.Distance(sample.foot, previous.foot), camera: B.Vector3.Distance(sample.camera, previous.camera) };
        if (previous.phase !== sample.phase) window.continuity.boundaries.push(change);
        else if (change.angle > (window.continuity.worst[sample.phase]?.angle ?? 0)) window.continuity.worst[sample.phase] = change;
      }
      previous = sample;
    });
  });
  await page.waitForFunction(() => window.grabValidation.grab.phase === 'struggling' && window.grabValidation.grab.time > 4);
  await page.screenshot({ path: 'tests/grab-runtime-grounded.png' });
  await page.keyboard.press('e'); await page.waitForTimeout(100);
  await page.screenshot({ path: 'tests/grab-runtime-kick.png' });
  const count = await page.evaluate(() => window.grabValidation.grab.required - window.grabValidation.grab.presses);
  for (let i = 0; i < count; i++) await page.keyboard.press('e');
  await page.waitForFunction(() => window.grabValidation.grab.phase === 'idle');
  const result = await page.evaluate(() => window.continuity);
  await writeFile('tests/grab-continuity-browser-report.json', JSON.stringify({ errors, ...result }, null, 2) + '\n');
  console.log(JSON.stringify({ errors, ...result })); assert.deepEqual(errors, []);
  const entry = result.boundaries.find(change => change.from === 'dragging' && change.to === 'struggling');
  assert(entry && entry.ankle < .03, 'Entering the QTE must retain the pulled ankle position');
  assert(result.maxGroundedHipHeight < .35, 'Crawl poses must not lift the waist into the camera');
} finally { await browser.close(); }
