import type { InteractionId, ItemId, Mission, Progress } from './types.ts';
import { difficultySettings } from './difficulty.ts';
export const KEEPSAKES: ItemId[] = ['locket', 'letter', 'music-box'];
export const has = (p: Progress, id: ItemId) => p.collected.includes(id);
export const keepsakeCount = (p: Progress) => KEEPSAKES.filter(id => has(p, id)).length;
export const bearingsFound = (p: Progress) => has(p, 'flashlight') && has(p, 'note');
const exitRequirementsMet = (p: Progress) => bearingsFound(p) && has(p, 'fuse') && p.power && p.bedroomUnlocked && has(p, 'master-key') && keepsakeCount(p) === 3 && p.cabinet && has(p, 'exit-key');
export const canEscape = (p: Progress) => exitRequirementsMet(p) && p.exitUnlocked;
export function mission(p: Progress): Mission {
  if (!bearingsFound(p)) return 'M01';
  if (!p.power) return 'M02';
  if (keepsakeCount(p) < 3) return 'M03';
  if (!p.cabinet) return 'M04';
  return 'M05';
}
export function objective(p: Progress): { title: string; detail: string } {
  switch (mission(p)) {
    case 'M01': return { title: 'Find your bearings', detail: !has(p, 'flashlight') ? 'Take the flashlight from the living-room coffee table.' : 'Read the warning beside the flashlight on the living-room table.' };
    case 'M02': return { title: 'Restore the lights', detail: has(p, 'fuse') ? 'Install the fuse in the upstairs breaker, near Master 1.' : 'Pangitaa ang fuse sa kusina. Search the kitchen counter.' };
    case 'M03': return { title: `Recover the keepsakes · ${keepsakeCount(p)}/3`, detail: 'Find the master bedroom key on the study desk. Locket: guest bedroom. Letter: garage. Music box: locked far master bedroom.' };
    case 'M04': return { title: 'Return what belongs here', detail: 'Place all three keepsakes in the glass cabinet downstairs.' };
    case 'M05': return { title: 'Leave the house', detail: !has(p, 'exit-key') ? 'Take the final key from the glass cabinet.' : !p.exitUnlocked ? 'Unlock the main entrance at the front of the house.' : 'Open the main entrance and step outside.' };
  }
}
export interface InteractionResult { changed: boolean; message: string; checkpoint?: boolean }
export function interact(p: Progress, id: InteractionId): InteractionResult {
  const no = (message: string): InteractionResult => ({ changed: false, message });
  const collect = (item: ItemId, message: string): InteractionResult => {
    if (has(p, item)) return no('Already collected.');
    p.collected.push(item); return { changed: true, message };
  };
  if (id === 'bedroom-door') {
    if (!p.power || !has(p, 'master-key')) return no('Locked. Restore power and find the master bedroom key on the study desk.');
    if (p.bedroomUnlocked) return no('The master bedroom is unlocked.');
    p.bedroomUnlocked = true; return { changed: true, message: 'The master bedroom key turns. The door is unlocked.' };
  }
  if (id.startsWith('door:')) return no('The service door is jammed. The final key opens the main entrance.');
  if (id === 'breaker') {
    if (!bearingsFound(p)) return no('Find the flashlight and read the living-room warning first.');
    if (!has(p, 'fuse')) return no('A fuse is missing. Search the kitchen counter downstairs.');
    if (p.power) return no('The house has partial power. Find the bedroom key in the study.');
    p.power = true; p.checkpoint = 'breaker';
    return { changed: true, checkpoint: true, message: 'Partial power restored. Find the three keepsakes. Checkpoint reached.' };
  }
  if (id === 'cabinet') {
    if (!p.power || keepsakeCount(p) !== 3) return no(`Three empty spaces. Return the locket, letter, and music box (${keepsakeCount(p)}/3).`);
    if (p.cabinet) return no('The keepsakes are home. Take the final key.');
    p.cabinet = true; p.checkpoint = 'cabinet';
    return { changed: true, checkpoint: true, message: 'A hidden latch clicks. The final key is revealed. Checkpoint reached.' };
  }
  if (id === 'exit' || id === 'front-door') {
    if (!exitRequirementsMet(p)) return no('Locked. Restore the lights, return the three keepsakes, then take the cabinet key.');
    if (p.exitUnlocked) return no('The exit is open. Step outside.');
    p.exitUnlocked = true; return { changed: true, message: 'The main entrance is unlocked. Get outside!' };
  }
  if (id.startsWith('hide-')) return no('A place to hide.');
  if (id === 'exit-key' && !p.cabinet) return no('The cabinet is sealed.');
  if (id === 'fuse' && !bearingsFound(p)) return no('Read the living-room warning and take the flashlight first.');
  if (KEEPSAKES.includes(id as ItemId) && !p.power) return no('Restore the lights before disturbing the keepsakes.');
  if (id === 'music-box' && !p.bedroomUnlocked) return no('Unlock the master bedroom with the study key first.');
  if (id === 'tsinelas' && !p.kitchenSeen) return no('Something is moving in the kitchen.');
  if (id.startsWith('battery-')) {
    if (has(p, id as ItemId)) return no('Already collected.');
    if (p.battery >= 99) return no('The flashlight is charged. Leave this battery for later.');
    p.battery = Math.min(100, p.battery + difficultySettings[p.difficulty].batteryPickup);
    return collect(id as ItemId, 'Fresh battery fitted.');
  }
  const messages: Partial<Record<ItemId, string>> = {
    flashlight: 'Taking the flashlight. F switches it on or off once it settles. Read the warning beside it.',
    note: 'Warning read. Find the kitchen fuse, then the breaker upstairs.',
    fuse: 'Kitchen fuse collected. The breaker is upstairs near Master 1.',
    locket: 'Corazon’s locket. The little portrait has been carefully kept.', letter: 'A folded letter: “Corazon, we left the light on for you.”', 'music-box': 'Corazon’s music box. One unfinished melody, then silence.',
    'exit-key': 'The final key is yours. Return to the main entrance.',
    'master-key': 'Master bedroom key collected. The locked bedroom is at the far end upstairs.',
    tsinelas: 'Tsinelas ready. Left click to throw. It can be picked up again.',
  };
  return collect(id as ItemId, messages[id as ItemId] ?? 'Collected.');
}
