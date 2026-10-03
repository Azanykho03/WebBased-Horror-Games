import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FlashlightEquipState } from '../src/flashlight-state.ts';
import { interact } from '../src/objectives.ts';
import { freshProgress } from '../src/types.ts';

test('flashlight is unavailable before pickup and only usable after the equip finishes', () => {
  const state = new FlashlightEquipState(), progress = freshProgress();
  state.reset(false);
  assert.equal(state.ready, false); assert.equal(state.visible, false);
  assert.equal(interact(progress, 'flashlight').changed, true);
  assert.equal(state.pickup(), true);
  assert.equal(state.ready, false); assert.equal(state.visible, true);
  assert.equal(state.update(.3, true, false), false); assert.equal(state.ready, false);
  assert.equal(state.update(.48, true, false), true); assert.equal(state.ready, true);
  assert.equal(state.update(1, true, false), false, 'completion only fires once');
  assert.equal(state.pickup(), false, 'a collected flashlight cannot replay its pickup');
  assert.equal(interact(progress, 'flashlight').changed, false);
});

test('hide, checkpoint restore and new game cannot leave an extra held flashlight', () => {
  const state = new FlashlightEquipState();
  state.reset(true); assert.equal(state.ready, true); assert.equal(state.progress, 1);
  state.update(.1, true, true); assert.equal(state.visible, false); assert.equal(state.ready, false);
  state.update(.1, true, false); assert.equal(state.visible, true); assert.equal(state.ready, true);
  state.reset(false); assert.equal(state.visible, false); assert.equal(state.ready, false);
  state.pickup(); state.update(.1, false, false);
  assert.equal(state.phase, 'unowned'); assert.equal(state.visible, false);
});

test('equip interrupted by hiding never switches the beam on inside a hiding place', () => {
  const state = new FlashlightEquipState();
  state.pickup();
  assert.equal(state.update(1, true, true), false);
  assert.equal(state.ready, false); assert.equal(state.visible, false);
  assert.equal(state.update(.1, true, false), false);
  assert.equal(state.ready, true);
});
