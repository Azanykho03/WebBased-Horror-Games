# Warning, escape guide, and house map — 2026-10-21

## Changes

- Replaced the coffee-table paper texture, E/touch reading text, and existing
  warning reread with the supplied heading and two paragraphs. The reading surface
  remains available with dialogue subtitles disabled. Mobile text clears the action
  buttons in portrait and landscape.
- Renamed the existing journal heading to **Missions & Inventory** and added the
  six-step **Escape Guide — How to Escape the House**. The five-mission tracker,
  inventory, and existing warning reread remain. TAB opens/closes the menu; holding
  TAB does not repeatedly toggle it. The existing touch button now says Missions.
- The guide reads the existing progress flags and item IDs, including prerequisites,
  partial keepsake collection, the cabinet reveal versus final-key pickup, and
  opening/crossing the entrance after unlocking it. It does not write progress.
  The requested “rum locker” corresponds to the existing **family locket**;
  the other keepsakes are the folded letter and music box.
- There was no implemented map UI in the starting checkout. Added a separate M/map
  screen using the existing house manifest: actual room rectangles, wall slices,
  door openings, staircase, player position and heading. Both floors, a room
  directory, and Locate me are available on desktop and touch. No escape steps
  appear in the map. It pauses/resumes through the existing menu lifecycle.
- Ghost AI, grab/jumpscare animation, collision, mission gates, saved-progress
  format, and item collection logic are unchanged. The TypeSafe skill remains
  installed locally. Its guidance to keep known rules in code applies here; no AI
  service, SDK, account, or key was added.

## Verification

- `npm test`: **106 passed, 0 failed**. Includes the new guide/map regression cases
  and existing ghost, grab, hiding, movement, inventory, objective and audio tests.
  The headless canvas stub now includes text measurement for the printed warning.
- `npm run build`: passed strict TypeScript and generated `dist/`.
- `npm run build:validation`: passed. The final UI layout changes were then tested
  against the validation development server and rebuilt in production.
- `git diff --check`: passed with the repository's normal line-ending settings.
- `tests/escape-guide-browser.mjs`: passed in an isolated Edge context at
  1280×800, touch landscape 844×390, and touch portrait 390×844. Checked actual E
  and touch reading interactions, warning with subtitles off, TAB repeat/toggle,
  six guide steps, five mission entries, inventory, saved/restored progress, M and
  touch map controls, both floors, player position/heading, and menu scrolling.
  Verified that touch action buttons do not overlap the warning. No runtime or
  console errors and no failed asset requests.
- Production smoke check: loaded `dist/` through the normal UI; new game,
  difficulty, intro, movement, jumping, TAB, M, floor selection, Locate me, pause,
  save, reload and Continue passed. Player marker matched the rendered camera's
  horizontal position. Validation host was absent, with no runtime/console errors
  or failed asset requests.
- Reviewed desktop and mobile screenshots. Reports and screenshots are in
  `.cache/escape-guide/`; the final browser report is `browser-report.json` and
  the production report is `production-report.json`.

## Scope of testing and remaining limitations

No unresolved defect was found in the requested features. The focused browser
test uses the existing validation host to position the player and set up progress
via the real interaction rules; it is not a new full-house escape playthrough.
Mobile controls were exercised with browser touch emulation, not physical phones.
The build retains the existing Vite notices about the two classic Babylon vendor
scripts; both loaded successfully in the production browser check.

To rerun the focused browser test, start `npm run dev -- --mode validation`, then
run `node tests/escape-guide-browser.mjs`. Its optional environment variables are
`GAME_URL`, `PLAYWRIGHT_PATH`, and `BROWSER_PATH`. The default URL is
`http://127.0.0.1:5173`. Playwright may use the bundled Codex runtime packages.
