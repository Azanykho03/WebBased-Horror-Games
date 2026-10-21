// Focused UI regression against the existing validation host. Fixture positioning
// isolates the coffee-table interaction and floor markers; it is not a full run.
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH || 'playwright');
const browser = await chromium.launch({ headless: true,
  ...(process.env.BROWSER_PATH ? { executablePath: process.env.BROWSER_PATH } : {}),
  args: ['--autoplay-policy=no-user-gesture-required', '--no-proxy-server'],
});
const directory = '.cache/escape-guide';
await mkdir(directory, { recursive: true });
const errors = [], missing = [], report = [];
const log = message => { report.push(message); console.log(message); };
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, hasTouch: true });
page.on('pageerror', error => errors.push(String(error)));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
page.on('response', response => { if (response.status() >= 400) missing.push(`${response.status()} ${response.url()}`); });
const screen = name => page.waitForSelector(`#ui[data-screen="${name}"]`, { timeout: 10000 });
const action = name => page.locator(`#panel [data-action="${name}"]`).click();
const guideStatus = () => page.locator('[data-guide-step]').evaluateAll(rows => rows.map(row => [row.dataset.guideStep, row.className]));
const openGuide = async () => { await page.keyboard.press('Tab'); await screen('journal'); };
const resume = async () => { await action('resume'); await screen('playing'); };
async function positionAtItem(id) {
  await page.evaluate(async id => {
    const h = window.grabValidation;
    const { worldHit } = await import('/src/geometry.ts');
    const hotspot = h.interactions.hotspots.find(item => item.id === id);
    const level = hotspot.position[1] >= h.world.data.floorRise ? 1 : 0;
    let target;
    for (const radius of [1.1, 1.4, .8]) {
      for (let i = 0; i < 16; i++) {
        const angle = i * Math.PI / 8;
        const candidate = h.world.nav.point(hotspot.position[0] + Math.sin(angle) * radius, hotspot.position[2] + Math.cos(angle) * radius, level);
        if (!candidate) continue;
        const eye = [candidate.x, candidate.y + h.world.data.eyeHeight, candidate.z];
        const hit = worldHit(eye, hotspot.position, h.world.colliders);
        if (Math.hypot(...hotspot.position.map((v, j) => v - eye[j])) < 2.05 && (hit === null || hit > .985)) { target = candidate; break; }
      }
      if (target) break;
    }
    if (!target) throw new Error(`No clear approach for ${id}`);
    h.player.reset(target);
    const eye = h.player.eye, dx = hotspot.position[0] - eye[0], dz = hotspot.position[2] - eye[2];
    h.player.yaw = Math.atan2(dx, -dz); h.player.pitch = Math.atan2(hotspot.position[1] - eye[1], Math.hypot(dx, dz));
    h.player.camera(h.world, h.settings());
    h.interactions.focus(h.player, h.progress());
  }, id);
  await page.waitForFunction(id => window.grabValidation.interactions.target?.id === id, id);
}
async function progressFixture(ids) {
  await page.evaluate(async ids => {
    const h = window.grabValidation, { interact } = await import('/src/objectives.ts');
    for (const id of ids) {
      const result = interact(h.progress(), id);
      if (!result.changed) throw new Error(`${id}: ${result.message}`);
    }
    h.world.syncProgress(h.progress()); h.interactions.sync(h.progress());
  }, ids);
}
async function noHorizontalOverflow() {
  assert(await page.locator('#panel').evaluate(panel => panel.scrollWidth <= panel.clientWidth + 1), 'Panel must fit the viewport');
}
try {
  await page.goto(process.env.GAME_URL || 'http://127.0.0.1:5173', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => window.grabValidation, null, { timeout: 60000 });
  await page.evaluate(() => { document.querySelector('aside[aria-label="Development validation"]').hidden = true; });
  await action('new'); await action('difficulty:easy'); await action('start-game'); await screen('ready');
  await action('resume'); await screen('intro'); await action('skip-intro'); await screen('playing');
  await page.evaluate(() => window.grabValidation.input.setTouchMode(false));
  const initial = await page.evaluate(() => JSON.stringify(window.grabValidation.progress()));
  await openGuide();
  assert.equal(await page.locator('[data-guide-step]').count(), 6);
  assert.equal(await page.locator('.missions li').count(), 5);
  assert(await page.getByRole('heading', { name: 'Inventory', exact: true }).isVisible());
  assert((await guideStatus()).every(([, status]) => status === 'upcoming'));
  assert.equal(await page.locator('#panel').evaluate(panel => panel.scrollTop), 0);
  await page.keyboard.down('Tab'); await screen('playing'); await page.keyboard.down('Tab');
  await page.keyboard.up('Tab'); await screen('playing');
  // A fresh press opens, but auto-repeat cannot immediately close a menu.
  await page.keyboard.down('Tab'); await screen('journal'); await page.keyboard.down('Tab');
  await screen('journal'); await page.keyboard.up('Tab');
  const after = JSON.parse(await page.evaluate(() => JSON.stringify(window.grabValidation.progress())));
  const before = JSON.parse(initial); after.elapsed = before.elapsed;
  assert.deepEqual(after, before);
  await page.screenshot({ path: `${directory}/desktop-guide.png` });
  log('PASS desktop TAB toggle, held-key handling, six guide steps, five missions, inventory, initial progress and no mutation');
  await page.keyboard.press('Tab'); await screen('playing');
  await positionAtItem('note');
  await page.waitForFunction(() => document.querySelector('.interact')?.textContent.includes('Read the warning'));
  assert.match(await page.locator('.interact').innerText(), /E.*Read the warning/);
  await page.evaluate(() => { window.grabValidation.settings().subtitles = false; });
  await page.keyboard.press('e');
  await page.waitForSelector('#subtitle.warning-letter');
  assert(await page.locator('#subtitle').isVisible());
  assert.equal(await page.locator('#subtitle strong').innerText(), 'YOU HAVE ENTERED. THERE IS NO GETTING OUT.');
  assert.equal(await page.locator('#subtitle p').count(), 2);
  assert(!/kitchen|breaker|study|glass cabinet|music box/i.test(await page.locator('#subtitle').innerText()));
  assert(await page.evaluate(() => window.grabValidation.progress().collected.includes('note')));
  await page.screenshot({ path: `${directory}/desktop-warning.png` });
  log('PASS real E interaction reads the short warning, still works with subtitles off, and contains no walkthrough');

  await openGuide();
  await progressFixture(['flashlight', 'fuse', 'breaker', 'master-key', 'bedroom-door', 'locket', 'letter', 'music-box']);
  await resume(); await openGuide();
  assert.deepEqual((await guideStatus()).map(([, status]) => status), ['done', 'done', 'done', 'done', 'current', 'upcoming']);
  assert.match(await page.locator('.inventory').innerText(), /locket.*letter.*music box/i);
  await progressFixture(['cabinet']); await resume(); await openGuide();
  assert.equal((await guideStatus())[4][1], 'current');
  assert.match(await page.locator('[data-guide-step="final-key"]').innerText(), /Take the revealed final key/);
  await progressFixture(['exit-key', 'front-door']); await resume(); await openGuide();
  assert.deepEqual((await guideStatus()).map(([, status]) => status), ['done', 'done', 'done', 'done', 'done', 'current']);
  await action('menu'); await screen('menu'); await action('continue'); await screen('ready'); await action('resume'); await screen('playing');
  await openGuide();
  assert.deepEqual((await guideStatus()).map(([, status]) => status), ['done', 'done', 'done', 'done', 'done', 'current']);
  log('PASS live progress, returned-keepsakes versus collected-final-key status, unlocked exit remains incomplete, checkpoint reload');

  await page.keyboard.press('m'); await screen('map');
  assert.equal(await page.locator('#map-player').count(), 1);
  assert.equal(await page.locator('[data-guide-step]').count(), 0);
  assert.equal(await page.locator('.map-directory li').count(), 9);
  const atCabinet = await page.locator('#map-player').getAttribute('transform');
  assert.equal(atCabinet, 'translate(0 -13.5)');
  await action('map-floor:1'); assert.equal(await page.locator('#map-player').count(), 0);
  assert.match(await page.locator('.map-location').innerText(), /Switch floors/);
  await page.screenshot({ path: `${directory}/desktop-map-upper.png` });
  await action('map-player'); assert.equal(await page.locator('#map-player').count(), 1);
  await page.screenshot({ path: `${directory}/desktop-map-ground.png` });
  await page.keyboard.press('m'); await screen('playing');
  await page.evaluate(() => {
    const h = window.grabValidation;
    h.player.reset({ x: -4, y: h.world.data.floorRise, z: -4, level: 1 });
    h.player.yaw = Math.PI / 2; h.player.camera(h.world, h.settings());
  });
  await page.keyboard.press('m'); await screen('map');
  assert.equal(await page.locator('[data-action="map-floor:1"]').getAttribute('aria-pressed'), 'true');
  assert.equal(await page.locator('#map-player').getAttribute('transform'), 'translate(-4 -4)');
  assert.equal(await page.locator('#map-player path').getAttribute('transform'), 'rotate(90)');
  assert.match(await page.locator('.map-location').innerText(), /Study/);
  await page.keyboard.press('Escape'); await screen('playing');
  log('PASS separate M map, actual walls/rooms/doorways/stairs, both floor tabs, Locate me, room/position/facing, Escape close');

  for (const [orientation, viewport] of [['landscape', { width: 844, height: 390 }], ['portrait', { width: 390, height: 844 }]]) {
    await page.setViewportSize(viewport);
    await page.evaluate(() => window.grabValidation.input.setTouchMode(true));
    await page.waitForSelector('#touch-controls:not([hidden])');
    await page.locator('[data-touch="Tab"]').tap(); await screen('journal');
    assert.equal(await page.locator('[data-guide-step]').count(), 6);
    await noHorizontalOverflow();
    assert.equal(await page.locator('#panel').evaluate(panel => panel.scrollTop), 0);
    await page.screenshot({ path: `${directory}/mobile-${orientation}-guide.png` });
    await page.locator('.inventory').scrollIntoViewIfNeeded(); assert(await page.locator('.inventory').isVisible());
    await page.locator('#panel [data-action="resume"]').tap(); await screen('playing');
    await page.locator('[data-touch="KeyM"]').tap(); await screen('map');
    await page.locator('[data-action="map-floor:0"]').tap();
    assert.equal(await page.locator('#map-player').count(), 0);
    await page.locator('[data-action="map-player"]').tap();
    assert.equal(await page.locator('#map-player').count(), 1);
    await noHorizontalOverflow();
    await page.screenshot({ path: `${directory}/mobile-${orientation}-map.png` });
    await page.locator('#panel [data-action="resume"]').tap(); await screen('playing');
    await page.screenshot({ path: `${directory}/mobile-${orientation}-controls.png` });
    log(`PASS ${orientation} touch Missions & Inventory, scrolling, dedicated Map, floor controls, close and no horizontal overflow`);
  }
  for (const [orientation, viewport] of [['landscape', { width: 844, height: 390 }], ['portrait', { width: 390, height: 844 }]]) {
    await page.setViewportSize(viewport);
    await positionAtItem('note');
    if (await page.locator('[data-touch="Dismiss"]').isVisible()) await page.locator('[data-touch="Dismiss"]').tap();
    await page.locator('[data-touch="KeyE"]').tap();
    await page.waitForSelector('#subtitle.warning-letter');
    assert(await page.locator('#subtitle').isVisible());
    const letter = await page.locator('#subtitle').boundingBox(), controls = await page.locator('.touch-actions').boundingBox();
    assert(letter.y + letter.height <= controls.y || letter.x + letter.width <= controls.x, 'Touch controls must not cover the warning');
    await page.screenshot({ path: `${directory}/mobile-${orientation}-warning.png` });
    log(`PASS ${orientation} touch Interact reads the warning without overlapping action buttons`);
  }
  assert.deepEqual(errors, []); assert.deepEqual(missing, []);
  log('PASS no runtime/console errors or failed asset requests');
} catch (error) { log(`FAIL ${error.stack}`); process.exitCode = 1; await page.screenshot({ path: `${directory}/failure.png` }).catch(() => {}); }
finally {
  await writeFile(`${directory}/browser-report.json`, JSON.stringify({ report, errors, missing }, null, 2) + '\n');
  await browser.close();
}
