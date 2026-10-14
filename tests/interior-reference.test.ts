import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { planWallFinishes } from '../src/interior-layout.ts';
import { fixtureOutput, BROKEN_BULBS } from '../src/interior-lighting.ts';
import { INTERIOR_TEXTURES } from '../src/interior-assets.ts';
import type { HouseManifest } from '../src/types.ts';

const data = JSON.parse(readFileSync('public/assets/models/environments/haunted-house/house-manifest.json', 'utf8')) as HouseManifest;

test('reference wall skins stay on solid walls without bridging doors or windows', () => {
  const before = JSON.stringify(data), surfaces = planWallFinishes(data);
  assert(surfaces.length > 100);
  assert.equal(JSON.stringify(data), before, 'Decoration cannot alter the layout');
  for (const skin of surfaces) {
    const wall = data.colliders.find(c => c.id === skin.collider)!;
    assert(wall.min);
    assert(skin.bottom >= wall.min[1] && skin.top <= wall.max[1]);
    assert(skin.length <= wall.max[skin.along] - wall.min[skin.along] + .00001);
    const face = skin.side > 0 ? wall.max[skin.across] : wall.min[skin.across];
    assert(Math.abs(skin.center[skin.across] - face) <= .00401, 'Wall skin remains flush');
    for (const opening of [...data.doors, ...data.windows]) {
      const along = opening.axis === 'x' ? 0 : 2, across = along === 0 ? 2 : 0;
      if (Math.abs(skin.center[across] - opening.position[across]) > .2 || along !== skin.along) continue;
      const overlap = Math.min(skin.center[along] + skin.length / 2, opening.position[along] + opening.width / 2)
        - Math.max(skin.center[along] - skin.length / 2, opening.position[along] - opening.width / 2);
      if (overlap <= .001) continue;
      assert(skin.bottom >= opening.position[1] + opening.height - .001 || skin.top <= opening.position[1] + .001,
        `${skin.collider} must not cover ${'id' in opening ? opening.id : opening.room + ' window'}`);
    }
  }
});

test('electricity and burned-out bulbs govern both illumination and visible glow', () => {
  assert.equal(data.lights.filter(l => l.room === 'U00').length, 2);
  for (const light of data.lights) for (const reduced of [false, true]) {
    assert.equal(fixtureOutput(light, false, reduced, 42), 0);
    const powered = fixtureOutput(light, true, reduced, 42);
    if (BROKEN_BULBS.has(light.id)) assert.equal(powered, 0);
    else assert(powered > 0 && powered <= 1);
    if (reduced && !BROKEN_BULBS.has(light.id)) assert.equal(powered, 1);
  }
  const h1 = data.lights.find(l => l.id === 'H1')!, h2 = data.lights.find(l => l.id === 'H2')!;
  let previous = fixtureOutput(h2, true, false, 0), low = 1, high = 0;
  for (let t = .05; t < 120; t += .05) {
    const level = fixtureOutput(h2, true, false, t);
    assert(Math.abs(level - previous) < .03, 'No rapid on/off strobing');
    low = Math.min(low, level); high = Math.max(high, level); previous = level;
  }
  assert(high - low > .25, 'Faulty hallway light still dims visibly');
  assert.notEqual(fixtureOutput(h1, true, false, 20), fixtureOutput(h2, true, false, 20));
});

test('reference surfaces are local and remain within a small download budget', () => {
  const bytes = Object.values(INTERIOR_TEXTURES).reduce((sum, path) => sum + statSync(`public/assets/${path}`).size, 0);
  assert(bytes < 512 * 1024);
  for (const file of ['haunted_house.glb', 'scary_interiorHallway.glb']) {
    const raw = readFileSync(`public/assets/models/environments/haunted-house/source/interior-references/${file}`);
    assert.equal(raw.subarray(0, 4).toString(), 'glTF');
    assert.equal(raw.readUInt32LE(4), 2);
    assert.equal(raw.readUInt32LE(8), raw.length);
  }
});
