import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { planDebris } from '../src/decay-layout.ts';
import { HOTSPOTS } from '../src/config.ts';
import type { HouseManifest } from '../src/types.ts';

const data = JSON.parse(readFileSync('public/assets/models/environments/haunted-house/house-manifest.json', 'utf8')) as HouseManifest;

test('abandonment preserves the manifest and reserves stairs, doors, hiding and objective approaches', () => {
  const before = JSON.stringify(data), pieces = planDebris(data, HOTSPOTS);
  assert.equal(JSON.stringify(data), before, 'Decoration cannot mutate navigation/collision inputs');
  assert(pieces.length > 120 && pieces.length < 360, `Unexpected mobile debris budget: ${pieces.length}`);
  assert.deepEqual(pieces, planDebris(data, HOTSPOTS), 'Retry and reload must not reshuffle the house');
  for (const piece of pieces) {
    const [x, y, z] = piece.position, radius = Math.hypot(piece.size[0], piece.size[2]) / 2;
    const floor = y >= data.floorRise ? 1 : 0;
    assert(piece.size[1] < .04, 'Floor scatter must remain below foot level');
    for (const hotspot of HOTSPOTS.filter(h => (h.position[1] >= data.floorRise ? 1 : 0) === floor)) {
      assert(Math.hypot(x - hotspot.position[0], z - hotspot.position[2]) >= radius + (hotspot.kind === 'hide' ? 1.25 : .95), `${hotspot.id} needs clear space`);
    }
    for (const door of data.doors.filter(d => d.floor === floor)) {
      const along = Math.abs((door.axis === 'x' ? x : z) - door.position[door.axis === 'x' ? 0 : 2]);
      const across = Math.abs((door.axis === 'x' ? z : x) - door.position[door.axis === 'x' ? 2 : 0]);
      assert(along >= door.width / 2 + radius + .25 || across >= 1 + radius, `${door.id} threshold must stay clear`);
    }
    const [sx0, sx1, sz0, sz1] = data.stair.rect;
    assert(x <= sx0 - radius - .5 || x >= sx1 + radius + .5 || z <= sz0 - radius - .5 || z >= sz1 + radius + .5, 'Stair and landing clearances stay untouched');
    if (['F01', 'F08', 'U00'].includes(piece.room)) assert(Math.abs(x) - radius >= .78, 'Clear central chase lane');
  }
});
