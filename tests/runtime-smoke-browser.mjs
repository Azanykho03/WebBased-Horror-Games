// Exercise the production bundle through its ordinary UI; no validation fixture host.
import { createRequire } from 'node:module';
import { writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH || 'playwright');
const browser = await chromium.launch({ headless: true,
  ...(process.env.BROWSER_PATH ? { executablePath: process.env.BROWSER_PATH } : {}),
  args: ['--autoplay-policy=no-user-gesture-required', '--no-proxy-server'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [], missing = [], report = [];
page.on('pageerror', error => errors.push(String(error)));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
page.on('response', response => { if (response.status() >= 400) missing.push(`${response.status()} ${response.url()}`); });
const screen = name => page.waitForSelector(`#ui[data-screen="${name}"]`);
const action = name => page.locator(`#panel button[data-action="${name}"]`).click();
const view = () => page.evaluate(() => {
  const scene = window.BABYLON.Engine.Instances[0].scenes[0];
  return { position: scene.activeCamera.position.asArray(), legs: scene.getTransformNodeByName('player-uniform-body').isEnabled(),
    validationHost: 'grabValidation' in window, camera: scene.activeCamera.rotation.asArray() };
});
try {
  await page.goto(process.env.PRODUCTION_URL || 'http://127.0.0.1:4173', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('#ui[data-screen="menu"]', { timeout: 60000 });
  await action('new'); await screen('difficulty'); await action('difficulty:easy'); await action('start-game');
  await screen('ready'); await action('resume'); await screen('intro'); await action('skip-intro'); await screen('playing');
  const initial = await view(); assert(!initial.validationHost && !initial.legs);
  await page.keyboard.down('w'); await page.waitForTimeout(400); await page.keyboard.up('w');
  const moved = await view(); assert(Math.hypot(...moved.position.map((v, i) => v - initial.position[i])) > .15);
  await page.keyboard.press('Space'); await page.waitForTimeout(140); assert((await view()).position[1] > moved.position[1] + .1);
  await page.waitForTimeout(850); assert(!(await view()).legs);
  await page.screenshot({ path: 'tests/production-runtime-playing.png' });
  report.push('PASS production assets, new game, difficulty, intro, movement, jump and hidden legs; validation tools absent');
  await page.keyboard.press('Escape'); await screen('paused'); await action('journal'); await screen('journal');
  await page.keyboard.press('Tab'); await screen('playing');
  await page.keyboard.press('Escape'); await screen('paused'); await action('menu'); await screen('menu');
  await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForSelector('#panel button[data-action="continue"]', { timeout: 60000 });
  await action('continue'); await screen('ready');
  report.push('PASS pause, journal, resume, save-to-menu, reload and continue from checkpoint');
  assert.deepEqual(errors, []); assert.deepEqual(missing, []);
  report.push('PASS no JavaScript/console errors or missing HTTP assets');
} catch (error) { report.push(`FAIL ${error.stack}`); process.exitCode = 1; }
finally { console.log(report.join('\n')); await writeFile('tests/production-runtime-report.json', JSON.stringify({ errors, missing, report }, null, 2) + '\n'); await browser.close(); }
