import type { Floor, HouseManifest, Position } from './types.ts';

type Rect = [number, number, number, number];
export const floorName = (floor: Floor) => floor === 0 ? 'Ground floor' : 'Upper floor';
const inside = (r: Rect, p: Position) => p.x >= r[0] && p.x <= r[1] && p.z >= r[2] && p.z <= r[3];
export function mapRoom(data: HouseManifest, player: Position): string {
  if (inside(data.stair.rect, player)) return 'F03';
  return data.rooms.find(room => room.floor === player.level && room.id !== 'F03' && room.rects.some(rect => inside(rect, player)))?.id ?? 'OUT';
}

/** The same room footprints, solid wall pieces and openings used by the world.
 * Cut below window sills and door headers so openings remain legible. */
export function floorPlan(data: HouseManifest, floor: Floor) {
  const cut = floor * data.floorRise + .5;
  const walls: Rect[] = [];
  for (const collider of data.colliders) {
    if (!collider.min || collider.min[1] > cut || collider.max[1] < cut) continue;
    const width = collider.max[0] - collider.min[0], depth = collider.max[2] - collider.min[2];
    if (collider.max[1] - collider.min[1] < .35 || Math.min(width, depth) > .24 || Math.max(width, depth) < .24) continue;
    walls.push([collider.min[0], collider.max[0], collider.min[2], collider.max[2]]);
  }
  return { rooms: data.rooms.filter(room => room.floor === floor), walls, doors: data.doors.filter(door => door.floor === floor), stair: data.stair };
}

const escaped = (text: string) => text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const n = (value: number) => Number(value.toFixed(3));
const rect = ([x0, x1, z0, z1]: Rect) => `x="${n(x0)}" y="${n(z0)}" width="${n(x1 - x0)}" height="${n(z1 - z0)}"`;

export function houseMap(data: HouseManifest, player: Position, yaw: number, floor: Floor): string {
  const plan = floorPlan(data, floor), current = mapRoom(data, player);
  const onFloor = player.level === floor;
  const currentName = data.rooms.find(room => room.id === current)?.name ?? 'Outside';
  const allRects = data.rooms.flatMap(room => room.rects);
  const x0 = Math.min(...allRects.map(r => r[0])) - .8, x1 = Math.max(...allRects.map(r => r[1])) + .8;
  const z0 = Math.min(...allRects.map(r => r[2])) - .8, z1 = Math.max(...allRects.map(r => r[3])) + .8;
  const rooms = plan.rooms.filter(room => room.id !== 'F03').map(room => `<g class="map-room ${onFloor && room.id === current ? 'here' : ''}" data-room="${room.id}"><title>${escaped(room.name)}</title>${room.rects.map(r => `<rect ${rect(r)}/>`).join('')}</g>`).join('');
  const labels = plan.rooms.filter(room => room.id !== 'F03').map(room => {
    const [x0, x1, z0, z1] = room.rects.reduce((a, b) => (b[1] - b[0]) * (b[3] - b[2]) > (a[1] - a[0]) * (a[3] - a[2]) ? b : a);
    // Narrow passages use their room ID; the adjacent directory gives full names.
    const words = (x1 - x0 < 3 ? room.id : room.name).split(' '), lines: string[] = [];
    const limit = Math.floor((x1 - x0) / .32);
    for (const word of words) {
      const last = lines.length - 1;
      if (last < 0 || lines[last].length + word.length + 1 > limit) lines.push(word);
      else lines[last] += ` ${word}`;
    }
    const x = (x0 + x1) / 2, y = (z0 + z1) / 2 - (lines.length - 1) * .35;
    return `<text class="map-room-label" x="${n(x)}" y="${n(y)}">${lines.map((line, index) => `<tspan x="${n(x)}" dy="${index ? .7 : 0}">${escaped(line)}</tspan>`).join('')}</text>`;
  }).join('');
  const walls = plan.walls.map(r => `<rect class="map-wall" ${rect(r)}/>`).join('');
  const doors = plan.doors.map(door => {
    const [x, , z] = door.position, half = door.width / 2;
    return `<line class="map-door" data-door="${escaped(door.id)}" x1="${n(x - (door.axis === 'x' ? half : 0))}" y1="${n(z - (door.axis === 'z' ? half : 0))}" x2="${n(x + (door.axis === 'x' ? half : 0))}" y2="${n(z + (door.axis === 'z' ? half : 0))}"><title>Doorway</title></line>`;
  }).join('');
  const [sx0, sx1, sz0, sz1] = plan.stair.rect;
  const stairs = `<g class="map-stairs ${current === 'F03' && onFloor ? 'here' : ''}"><title>Hardwood staircase · ${floor === 0 ? 'up to upper floor' : 'down to ground floor'}</title><rect ${rect(plan.stair.rect)}/>${Array.from({ length: 11 }, (_, i) => `<line x1="${sx0}" x2="${sx1}" y1="${n(sz0 + (sz1 - sz0) * i / 10)}" y2="${n(sz0 + (sz1 - sz0) * i / 10)}"/>`).join('')}<text x="${(sx0 + sx1) / 2}" y="${(sz0 + sz1) / 2}" transform="rotate(-90 ${(sx0 + sx1) / 2} ${(sz0 + sz1) / 2})">${floor === 0 ? '← UP' : 'DOWN →'}</text></g>`;
  const marker = onFloor ? `<g id="map-player" transform="translate(${n(player.x)} ${n(player.z)})" aria-label="You are here"><circle r=".3"/><path d="M 0 -.75 L -.22 -.37 L .22 -.37 Z" transform="rotate(${n(yaw * 180 / Math.PI)})"/></g>` : '';
  const directory = [...plan.rooms];
  if (floor === 1) directory.push({ id: 'F03', name: 'Hardwood staircase', floor, rects: [plan.stair.rect] });
  return `<div class="map-toolbar" role="group" aria-label="Choose a floor">${([0, 1] as const).map(level => `<button data-action="map-floor:${level}" aria-pressed="${level === floor}">${floorName(level)}${player.level === level ? '<small>Your floor</small>' : ''}</button>`).join('')}<button data-action="map-player">Locate me</button></div>
    <p class="map-location" role="status">You are in: <strong>${escaped(currentName)}</strong> · ${floorName(player.level)}${onFloor ? '' : ' · Switch floors or choose Locate me to see your position.'}</p>
    <div class="map-layout"><figure class="map-plan"><svg id="house-map" viewBox="${n(x0)} ${n(z0)} ${n(x1 - x0)} ${n(z1 - z0)}" role="img" aria-labelledby="map-title map-description"><title id="map-title">${floorName(floor)} house layout</title><desc id="map-description">Rooms, walls, doorways and the connecting staircase.${onFloor ? ` Your position is marked in ${escaped(currentName)}.` : ' Your position is on the other floor.'}</desc>${rooms}${walls}${doors}${stairs}${labels}${marker}</svg><figcaption><span class="map-key-player">●</span> You & facing direction <span class="map-key-door">┄</span> Doorway <span class="map-key-stairs">▤</span> Stairs</figcaption></figure>
    <section class="map-directory" aria-label="Rooms on this floor"><h2>${floorName(floor)}</h2><ul>${directory.map(room => `<li class="${onFloor && room.id === current ? 'here' : ''}"><span>${room.id}</span>${escaped(room.name)}${onFloor && room.id === current ? '<strong>YOU ARE HERE</strong>' : ''}</li>`).join('')}</ul></section></div>`;
}
