import type { Collider, HouseManifest, Position, Floor } from '../../src/types.ts';
export interface Navigation {
  point(x: number, z: number, level: Floor): Position | null;
  move(position: Position, dx: number, dz: number, slide?: boolean): Position;
  path(start: { x: number; z: number; floor?: Floor; level?: Floor; name?: string }, end: { x: number; z: number; floor?: Floor; level?: Floor; name?: string }): Position[];
  blocked(x: number, y: number, z: number): string | null;
  height(x: number, z: number, level: Floor): number | null;
  segment(a: Position, b: Position): boolean;
  setDynamicColliders(extra: Collider[]): void;
  radius: number;
}
export function createNavigation(data: HouseManifest): Navigation;
