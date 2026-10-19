// Runs the project's existing complete journeys and capture audit after the QTE
// change. No fixture grants are used in the ordinary desktop/touch journeys.
import { createRequire } from 'node:module';
import { writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const browser = await chromium.launch({ headless: true,
  ...(process.env.BROWSER_PATH ? { executablePath: process.env.BROWSER_PATH } : {}),
  args: ['--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, hasTouch: true });
const errors = [], reports = [];
page.on('pageerror', error => { errors.push(String(error)); console.log(`PAGE ERROR: ${error}`); });
const report = text => { reports.push(text); console.log(text); };
const progress = setInterval(() => {
  void page.evaluate(() => {
    const host = window.grabValidation;
    return {
      status: document.querySelector('aside pre[role="status"]')?.textContent.split('\n').slice(0, 2).join(' · '),
      screen: host?.screen(), phase: host?.grab.phase, ghost: host?.ghost.state,
      capture: document.querySelector('[aria-label="Celestina motion validation"]')?.textContent.split('\n')[0],
    };
  }).then(value => console.log(`Progress: ${JSON.stringify(value)}`)).catch(() => {});
}, 30000);
try {
  await page.goto(process.env.GAME_URL || 'http://127.0.0.1:5175');
  await page.waitForFunction(() => window.grabValidation, null, { timeout: 60000 });
  for (const touch of (process.argv.includes('--touch-only') ? [true] : [false, true])) {
    await page.setViewportSize(touch ? { width: 844, height: 390 } : { width: 1280, height: 720 });
    await page.getByRole('button', { name: touch ? 'Run touch journey' : 'Run full journey', exact: true }).click();
    let attempts = 0;
    while (true) {
      await page.waitForFunction(() => /^(PASS · Full|Capture verified|FAIL)/.test(document.querySelector('aside pre[role="status"]').textContent), null, { timeout: 480000 });
      const status = await page.locator('aside pre[role="status"]').innerText();
      if (status.startsWith('Capture verified')) {
        report(status); assert(++attempts <= 8, 'Journey repeatedly fails after checkpoint recovery');
        await page.getByRole('button', { name: 'Continue journey from checkpoint' }).click();
      } else { report(status); assert(status.startsWith('PASS')); break; }
    }
  }
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.getByRole('button', { name: 'Check capture angles' }).click();
  await page.waitForFunction(() => /^(PASS|FAIL)/.test(document.querySelector('[aria-label="Celestina motion validation"]').textContent), null, { timeout: 180000 });
  const capture = await page.locator('[aria-label="Celestina motion validation"]').innerText(); report(capture); assert(capture.startsWith('PASS'));
  assert.deepEqual(errors, []); report('PASS no browser runtime errors');
} catch (error) { report(`FAIL ${error.stack}`); process.exitCode = 1; }
finally { clearInterval(progress); await writeFile(`tests/grab-${process.argv.includes('--touch-only') ? 'touch-' : ''}regression-browser-report.txt`, reports.join('\n\n') + '\n'); await browser.close(); }
