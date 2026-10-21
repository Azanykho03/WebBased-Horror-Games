import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { freshProgress } from '../src/types.ts';
import type { HouseManifest, Position } from '../src/types.ts';
import { escapeGuide, interact, missionChecklist } from '../src/objectives.ts';
import { parseSave } from '../src/storage.ts';
import { floorPlan, houseMap, mapRoom } from '../src/house-map.ts';

const data = JSON.parse(readFileSync('public/assets/models/environments/haunted-house/house-manifest.json', 'utf8')) as HouseManifest;
const entrance: Position = { x: 0, y: 0, z: -2.5, level: 0 };

test('guide follows real interaction guards, collection, cabinet reveal and exit crossing', () => {
  const p = freshProgress();
  const status = (id: string) => escapeGuide(p).find(step => step.id === id)?.status;
  assert(escapeGuide(p).every(step => step.status === 'upcoming'));
  assert.equal(interact(p, 'fuse').changed, false);
  assert.equal(status('fuse'), 'upcoming');
  interact(p, 'flashlight'); interact(p, 'note');
  assert.equal(status('fuse'), 'current');
  assert.equal(interact(p, 'breaker').changed, false);
  interact(p, 'fuse'); assert.equal(status('fuse'), 'done'); assert.equal(status('power'), 'current');
  interact(p, 'breaker'); assert.equal(status('power'), 'done');
  interact(p, 'master-key'); assert.equal(status('master-key'), 'done');
  interact(p, 'locket'); interact(p, 'letter');
  assert.equal(interact(p, 'music-box').changed, false);
  assert.equal(status('keepsakes'), 'current');
  assert.match(escapeGuide(p)[3].detail, /2\/3/);
  interact(p, 'bedroom-door'); interact(p, 'music-box');
  assert.equal(status('keepsakes'), 'done');
  interact(p, 'cabinet'); assert.equal(status('final-key'), 'current');
  assert.match(escapeGuide(p)[4].detail, /Take the revealed final key/);
  interact(p, 'exit-key'); assert.equal(status('final-key'), 'done');
  interact(p, 'front-door');
  assert.equal(status('escape'), 'current', 'Unlocking the door alone is not an escape');
  assert.match(escapeGuide(p)[5].detail, /step outside/);
  assert.equal(missionChecklist(p)[4].status, 'current');
  assert.equal(escapeGuide(p, true)[5].status, 'done');
  assert(missionChecklist(p, true).every(step => step.status === 'done'));
});

test('menus report out-of-order finds honestly and preserve checkpoint progress without mutation', () => {
  const p = freshProgress();
  interact(p, 'master-key');
  assert.equal(escapeGuide(p)[2].status, 'done');
  assert.equal(escapeGuide(p)[0].status, 'upcoming');
  for (const id of ['flashlight', 'note', 'fuse', 'breaker', 'letter'] as const) interact(p, id);
  const before = JSON.stringify(p);
  const restored = parseSave(JSON.stringify({ version: 1, progress: p }))!;
  assert.deepEqual(escapeGuide(restored), escapeGuide(p));
  assert.deepEqual(missionChecklist(restored), missionChecklist(p));
  assert.equal(JSON.stringify(p), before);
  assert.match(escapeGuide(restored)[3].detail, /1\/3/);
  assert.equal(escapeGuide(freshProgress(), true)[5].status, 'upcoming');
});

test('map uses both real floor plans and keeps door openings clear of wall headers', () => {
  for (const level of [0, 1] as const) {
    const plan = floorPlan(data, level);
    assert.deepEqual(plan.rooms, data.rooms.filter(room => room.floor === level));
    assert(plan.walls.length > 20);
    assert.deepEqual(plan.stair, data.stair);
    assert(plan.doors.every(door => door.floor === level));
    for (const door of plan.doors) {
      assert(!plan.walls.some(([x0, x1, z0, z1]) => door.position[0] > x0 && door.position[0] < x1 && door.position[2] > z0 && door.position[2] < z1), door.id);
    }
  }
});

test('map shows current room and marker only on the player floor, including the stairs', () => {
  assert.equal(mapRoom(data, entrance), 'F01');
  const ground = houseMap(data, entrance, Math.PI / 2, 0);
  assert.match(ground, /id="map-player" transform="translate\(0 -2.5\)"/);
  assert.match(ground, /rotate\(90\)/);
  assert.match(ground, /map-room here" data-room="F01"/);
  assert(!ground.includes('Escape Guide'));
  const upstairs = houseMap(data, entrance, 0, 1);
  assert(!upstairs.includes('id="map-player"'));
  assert.match(upstairs, /Your position is on the other floor/);
  assert.match(upstairs, /Hardwood staircase/);
  const study: Position = { x: -4, y: data.floorRise, z: -4, level: 1 };
  assert.equal(mapRoom(data, study), 'U02');
  assert.match(houseMap(data, study, 0, 1), /map-room here" data-room="U02"/);
  assert.equal(mapRoom(data, { x: 2.4, y: 2, z: -3, level: 1 }), 'F03');
});
