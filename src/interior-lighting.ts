import type { HouseManifest } from './types.ts';

// Presentation only. The existing breaker remains the sole source of power.
// The blackened private-bathroom bulb is permanently dead; both hallway lights
// remain usable and no new light source is added to the blueprint inventory.
export const BROKEN_BULBS = new Set(['L-master-cr']);
const failing = new Set(['H1', 'H2', 'L-kitchen', 'L-garage', 'L-shared-cr', 'L-master2-ceiling']);

export function fixtureOutput(light: Pick<HouseManifest['lights'][number], 'id' | 'period' | 'phase' | 'electric'>,
  powered: boolean, reducedFlicker: boolean, time: number): number {
  if (!light.electric) return 1;
  if (!powered || BROKEN_BULBS.has(light.id)) return 0;
  if (reducedFlicker) return 1;
  // Keep the original fixture-specific cycle, layered with slow, unsynchronized
  // failing-ballast dips. Continuous curves avoid rapid flashes or abrupt edges.
  const original = .94 + .06 * Math.sin(time * Math.PI * 2 / light.period + light.phase);
  if (!failing.has(light.id)) return original;
  const drift = .58 * Math.sin(time * .37 + light.phase) + .42 * Math.sin(time * .173 + light.phase * 1.67);
  const dip = Math.max(0, (drift - .24) / .76);
  return original * (1 - dip * dip * .76);
}
