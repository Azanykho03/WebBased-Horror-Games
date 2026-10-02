import type { InteractionId, ItemId, Mission, Progress } from './types.ts';
export const KEEPSAKES: ItemId[] = ['locket', 'letter', 'music-box'];
export const has = (p: Progress, id: ItemId) => p.collected.includes(id);
export const keepsakeCount = (p: Progress) => KEEPSAKES.filter(id => has(p, id)).length;
export const bearingsFound = (p: Progress) => has(p, 'flashlight') && has(p, 'note');
const exitRequirementsMet = (p: Progress) => bearingsFound(p) && has(p, 'fuse') && p.power && keepsakeCount(p) === 3 && p.cabinet && has(p, 'exit-key');
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
    case 'M01': return { title: 'Find your bearings', detail: !has(p, 'flashlight') ? 'Take the flashlight by the entrance.' : 'Read the warning on the foyer wall.' };
    case 'M02': return { title: 'Restore the lights', detail: has(p, 'fuse') ? 'Install the fuse in the upstairs breaker, near Master 1.' : 'Pangitaa ang fuse sa kusina. Search the kitchen counter.' };
    case 'M03': return { title: `Recover the keepsakes · ${keepsakeCount(p)}/3`, detail: 'Locket: guest bedroom. Letter: garage workbench. Music box: far master bedroom.' };
    case 'M04': return { title: 'Return what belongs here', detail: 'Place all three keepsakes in the glass cabinet downstairs.' };
    case 'M05': return { title: 'Leave the house', detail: !has(p, 'exit-key') ? 'Take the red key from the glass cabinet.' : !p.exitUnlocked ? 'Unlock the service exit opposite the cabinet.' : 'Cross the service doorway. Ayaw paglingi.' };
  }
}
export interface InteractionResult { changed: boolean; message: string; checkpoint?: boolean }
export function interact(p: Progress, id: InteractionId): InteractionResult {
  const no = (message: string): InteractionResult => ({ changed: false, message });
  const collect = (item: ItemId, message: string): InteractionResult => {
    if (has(p, item)) return no('Already collected.');
    p.collected.push(item); return { changed: true, message };
  };
  if (id === 'front-door') return no('The front latch is jammed. The warning mentions a service exit opposite the glass cabinet.');
  if (id === 'bedroom-door') return no(p.power ? 'The latch has released.' : 'The electric latch has no power. Find the kitchen fuse and the upstairs breaker.');
  if (id === 'breaker') {
    if (!bearingsFound(p)) return no('Find the flashlight and read the foyer warning first.');
    if (!has(p, 'fuse')) return no('A fuse is missing. Search the kitchen counter downstairs.');
    if (p.power) return no('The house has partial power. The far bedroom latch is open.');
    p.power = true; p.checkpoint = 'breaker';
    return { changed: true, checkpoint: true, message: 'Partial power restored. Find the three keepsakes. Checkpoint reached.' };
  }
  if (id === 'cabinet') {
    if (!p.power || keepsakeCount(p) !== 3) return no(`Three empty spaces. Return the locket, letter, and music box (${keepsakeCount(p)}/3).`);
    if (p.cabinet) return no('The keepsakes are home. Take the red key.');
    p.cabinet = true; p.checkpoint = 'cabinet';
    return { changed: true, checkpoint: true, message: 'A hidden latch clicks. A worn red key is revealed. Checkpoint reached.' };
  }
  if (id === 'exit') {
    if (!exitRequirementsMet(p)) return no('Locked. Restore the lights, return the three keepsakes, then take the cabinet key.');
    if (p.exitUnlocked) return no('The exit is open. Step outside.');
    p.exitUnlocked = true; return { changed: true, message: 'The service exit is unlocked. Go!' };
  }
  if (id.startsWith('hide-')) return no('A place to hide.');
  if (id === 'exit-key' && !p.cabinet) return no('The cabinet is sealed.');
  if (id === 'fuse' && !bearingsFound(p)) return no('Read the foyer warning and take the flashlight first.');
  if (KEEPSAKES.includes(id as ItemId) && !p.power) return no('Restore the lights before disturbing the keepsakes.');
  if (id === 'tsinelas' && !p.kitchenSeen) return no('Something is moving in the kitchen.');
  if (id.startsWith('battery-')) {
    if (has(p, id as ItemId)) return no('Already collected.');
    if (p.battery >= 99) return no('The flashlight is charged. Leave this battery for later.');
    p.battery = Math.min(100, p.battery + 55);
    return collect(id as ItemId, 'Fresh battery fitted.');
  }
  const messages: Partial<Record<ItemId, string>> = {
    flashlight: 'Flashlight taken. F switches it on or off. Read the warning on the wall.',
    note: 'Warning read. Find the kitchen fuse, then the breaker upstairs.',
    fuse: 'Kitchen fuse collected. The breaker is upstairs near Master 1.',
    locket: 'Corazon’s locket. The little portrait has been carefully kept.', letter: 'A folded letter: “Corazon, we left the light on for you.”', 'music-box': 'Corazon’s music box. One unfinished melody, then silence.',
    'exit-key': 'The red key is yours. The service exit is directly opposite.',
    tsinelas: 'Tsinelas ready. Left click to throw. It can be picked up again.',
  };
  return collect(id as ItemId, messages[id as ItemId] ?? 'Collected.');
}
