import type * as Babylon from 'babylonjs';
import { B } from './world.ts';
import { seededRandom } from './decay-layout.ts';
import { assetUrl } from './config.ts';
import { INTERIOR_TEXTURES } from './interior-assets.ts';

type Context = CanvasRenderingContext2D;
export const ATLAS_CELLS = { damp: 0, peel: 1, dust: 2, web: 3, tear: 4, paper: 5, crack: 6, moon: 7, rot: 8, cloth: 9, grime: 10, contact: 11, peelTall: 12, peelSmall: 13 } as const;
export type DecalKind = keyof typeof ATLAS_CELLS;

export function referenceTexture(scene: Babylon.Scene, path: string): Babylon.Texture {
  const map = new B.Texture(assetUrl(path), scene, false, true, B.Texture.TRILINEAR_SAMPLINGMODE);
  map.wrapU = map.wrapV = B.Texture.WRAP_ADDRESSMODE;
  map.anisotropicFilteringLevel = 4;
  return map;
}

export function referenceFinish(scene: Babylon.Scene, kind: 'paper' | 'rug'): Babylon.StandardMaterial {
  const material = new B.StandardMaterial(`reference-${kind}`, scene);
  material.diffuseTexture = referenceTexture(scene, INTERIOR_TEXTURES[kind]);
  material.specularColor.setAll(.012); material.specularPower = 8; material.maxSimultaneousLights = 8;
  material.backFaceCulling = false; material.twoSidedLighting = true;
  if (kind === 'paper') {
    material.bumpTexture = referenceTexture(scene, INTERIOR_TEXTURES.paperNormal);
    material.bumpTexture.level = .32;
    material.diffuseColor.set(.93, .94, .92);
  } else {
    material.diffuseColor.set(.83, .81, .76);
    material.diffuseTexture.wrapU = material.diffuseTexture.wrapV = B.Texture.CLAMP_ADDRESSMODE;
  }
  return material;
}

function texture(scene: Babylon.Scene, name: string, size: number, paint: (ctx: Context) => void): Babylon.DynamicTexture {
  const t = new B.DynamicTexture(name, { width: size, height: size }, scene, true, B.Texture.TRILINEAR_SAMPLINGMODE);
  paint(t.getContext() as Context); t.update(false); t.anisotropicFilteringLevel = 4;
  return t;
}

function polygon(ctx: Context, random: () => number, x: number, y: number, rx: number, ry: number, color: string): void {
  ctx.fillStyle = color; ctx.beginPath();
  for (let j = 0; j < 14; j++) {
    const angle = j / 14 * Math.PI * 2, r = .65 + random() * .35;
    const px = x + Math.cos(angle) * rx * r, py = y + Math.sin(angle) * ry * r;
    if (j === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath(); ctx.fill();
}

/** Small, shared maps are generated once at load. Nothing is redrawn per frame. */
export function weatherHouse(scene: Babylon.Scene, meshes: Babylon.AbstractMesh[]): void {
  const palettes: Record<string, [number, number, number]> = {
    plaster: [147, 143, 126], wood: [75, 64, 50], woodlight: [117, 105, 85],
    tile: [117, 116, 103], rust: [86, 63, 43], linen: [143, 137, 116], lace: [154, 149, 131],
  };
  for (const [kind, base] of Object.entries(palettes)) {
    const material = scene.materials.find(m => m.name === `${kind}-game`);
    if (!(material instanceof B.StandardMaterial)) continue;
    const reference = ({ plaster: INTERIOR_TEXTURES.plaster, wood: INTERIOR_TEXTURES.panels,
      woodlight: INTERIOR_TEXTURES.timber, tile: INTERIOR_TEXTURES.tile } as Record<string, string>)[kind];
    const map = reference ? referenceTexture(scene, reference) : texture(scene, `aged-${kind}`, 512, ctx => {
      const random = seededRandom(311 + kind.length * 43), pixels = ctx.createImageData(512, 512);
      const field = Array.from({ length: 256 }, () => random());
      const noise = (x: number, y: number, step: number) => {
        const a = x / step, b = y / step, ix = Math.floor(a), iy = Math.floor(b), fx = a - ix, fy = b - iy;
        const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
        const sample = (dx: number, dy: number) => field[((iy + dy) % 16) * 16 + (ix + dx) % 16];
        return (sample(0, 0) * (1 - u) + sample(1, 0) * u) * (1 - v) + (sample(0, 1) * (1 - u) + sample(1, 1) * u) * v;
      };
      for (let y = 0; y < 512; y++) for (let x = 0; x < 512; x++) {
        const broad = noise(x, y, 64), detail = noise(x, y, 16), fine = (random() - .5) * 12;
        let value = (broad - .5) * 64 + (detail - .5) * 23 + fine;
        if (kind.startsWith('wood')) {
          value += Math.sin(x * .65 + Math.sin(y * .019) * 2 + broad * 5) * 7;
          value += Math.sin(x * 2.1 + Math.sin(y * .006) * 13) * 3;
          if (x % 128 < 3 || (y + Math.floor(x / 128) * 167) % 512 < 3) value -= 43;
          if (x % 128 > 123) value += 13; // dust caught on worn plank edges
        } else if (kind === 'plaster') {
          value -= Math.max(0, .42 - broad) * 130;
          value += Math.sin(x * .14 + broad * 2) * Math.max(0, detail - .45) * 28;
        } else if (kind === 'tile' && (x % 256 < 5 || y % 256 < 5)) value -= 49;
        else if (kind === 'linen' || kind === 'lace') value += ((x % 3) - 1 + (y % 4) - 1.5) * 2.3;
        const at = (y * 512 + x) * 4;
        pixels.data[at] = base[0] + value; pixels.data[at + 1] = base[1] + value; pixels.data[at + 2] = base[2] + value * .89; pixels.data[at + 3] = 255;
      }
      ctx.putImageData(pixels, 0, 0);
      if (kind === 'plaster') {
        for (let i = 0; i < 44; i++) {
          const x = random() * 512, y = random() * 512;
          polygon(ctx, random, x, y, 5 + random() * 20, 6 + random() * 26, 'rgba(71,68,54,.26)');
          polygon(ctx, random, x + 1, y - 2, 4 + random() * 14, 5 + random() * 19, 'rgba(189,184,162,.48)');
        }
      }
      if (kind.startsWith('wood') || kind === 'tile' || kind === 'plaster') {
        for (let i = 0; i < (kind.startsWith('wood') ? 140 : 16); i++) {
          let x = random() * 512, y = random() * 512;
          ctx.strokeStyle = i % 3 ? 'rgba(34,33,27,.48)' : 'rgba(207,198,170,.3)'; ctx.lineWidth = .4 + random() * 1.2; ctx.beginPath(); ctx.moveTo(x, y);
          for (let j = 0; j < 5; j++) { x += (random() - .5) * (kind.startsWith('wood') ? 4 : 12); y += 4 + random() * 9; ctx.lineTo(x, y); }
          ctx.stroke();
        }
      }
    });
    // DynamicTexture defaults to CLAMP; the house uses metre-scaled UVs outside
    // 0..1. Explicit wrapping is essential or the surface stretches edge pixels.
    map.wrapU = map.wrapV = B.Texture.WRAP_ADDRESSMODE;
    if (kind === 'plaster') map.uScale = map.vScale = .36;
    const previous = material.diffuseTexture;
    material.diffuseTexture = map; material.diffuseColor.set(1, 1, 1);
    const normal = kind === 'plaster' ? INTERIOR_TEXTURES.plasterNormal : kind === 'woodlight' ? INTERIOR_TEXTURES.timberNormal : null;
    if (normal) {
      const bump = referenceTexture(scene, normal); bump.uScale = map.uScale; bump.vScale = map.vScale;
      bump.level = kind === 'woodlight' ? .4 : .22; material.bumpTexture = bump;
    }
    if (previous && !scene.materials.some(m => m instanceof B.StandardMaterial && m.diffuseTexture === previous)) previous.dispose();
    material.specularColor.setAll(kind === 'tile' ? .035 : .012); material.specularPower = 8;
  }
  for (const material of scene.materials) {
    if (!(material instanceof B.StandardMaterial) || !material.name.endsWith('-game')) continue;
    if (/fabric|velvet|book|paper/.test(material.name)) { material.diffuseColor.set(.78, .77, .70); material.specularColor.setAll(.008); }
    if (/metal|brass|porcelain|mirror/.test(material.name)) { material.diffuseColor.set(.7, .72, .67); material.specularColor.setAll(.055); material.specularPower = 14; }
  }
  // Upward faces gather pale dust; lower furniture/wall edges retain damp grime.
  for (const mesh of meshes) {
    if (/window|glow|glass|screen|stain/.test(mesh.name)) continue;
    const p = mesh.getVerticesData(B.VertexBuffer.PositionKind), n = mesh.getVerticesData(B.VertexBuffer.NormalKind);
    if (!p || !n) continue;
    const colors = new Float32Array(p.length / 3 * 4);
    for (let i = 0; i < p.length / 3; i++) {
      const y = ((p[i * 3 + 1] % 3.24) + 3.24) % 3.24;
      const dust = Math.max(0, n[i * 3 + 1]) * .14, damp = y < .55 ? (.55 - y) * .24 : 0;
      colors.set([.91 + dust - damp, .90 + dust - damp, .86 + dust - damp, 1], i * 4);
    }
    mesh.setVerticesData(B.VertexBuffer.ColorKind, colors, false);
  }
}

export function createDecayAtlas(scene: Babylon.Scene): Babylon.DynamicTexture {
  const atlas = texture(scene, 'abandonment-atlas', 1024, ctx => {
    const random = seededRandom(870571);
    for (const [kind, index] of Object.entries(ATLAS_CELLS)) {
      ctx.save(); ctx.translate(index % 4 * 256, Math.floor(index / 4) * 256);
      ctx.beginPath(); ctx.rect(3, 3, 250, 250); ctx.clip();
      if (kind === 'damp' || kind === 'dust' || kind === 'grime' || kind === 'contact') {
        const dust = kind === 'dust', contact = kind === 'contact';
        for (let i = 0; i < (contact ? 20 : 190); i++) {
          const x = 24 + random() * 208, y = 15 + random() * 225, r = 8 + random() * 37;
          const g = ctx.createRadialGradient(x, y, 1, x, y, r);
          g.addColorStop(0, dust ? 'rgba(181,173,144,.27)' : contact ? 'rgba(12,15,12,.22)' : 'rgba(34,39,26,.35)'); g.addColorStop(1, 'rgba(40,42,29,0)');
          ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
        }
        if (kind === 'damp') for (let i = 0; i < 95; i++) {
          const x = 15 + random() * 226, y = random() * 100, length = 30 + random() * 135;
          const g = ctx.createLinearGradient(0, y, 0, y + length); g.addColorStop(0, 'rgba(39,41,25,.30)'); g.addColorStop(1, 'rgba(39,41,25,0)');
          ctx.fillStyle = g; ctx.fillRect(x, y, 1 + random() * 5, length);
        }
      } else if (kind.startsWith('peel')) {
        const rx = kind === 'peelTall' ? 56 : kind === 'peelSmall' ? 73 : 103, ry = kind === 'peelSmall' ? 73 : 115;
        polygon(ctx, random, 127, 132, rx, ry, '#504b3d');
        polygon(ctx, random, 123, 129, rx * .91, ry * .94, '#67624e');
        polygon(ctx, random, 100, 183, rx * .55, ry * .49, '#716a55');
        ctx.save(); ctx.globalCompositeOperation = 'source-atop';
        for (let y = 35; y < 240; y += 29) { ctx.fillStyle = 'rgba(48,44,32,.43)'; ctx.fillRect(15, y, 228, 3); }
        ctx.restore();
        for (let i = 0; i < 105; i++) {
          const a = random() * Math.PI * 2, r = .7 + random() * .3;
          const x = 124 + Math.cos(a) * rx * r, y = 130 + Math.sin(a) * ry * r, chipX = 2 + random() * 11, chipY = 3 + random() * 13;
          polygon(ctx, random, x, y, chipX, chipY, 'rgba(83,78,65,.8)');
          polygon(ctx, random, x - .5, y - 1, chipX * .76, chipY * .82, i % 4 ? '#96917e' : '#817c69');
        }
      } else if (kind === 'web') {
        ctx.lineWidth = 1.05;
        const origin = [13, 12], spokes = 13;
        for (let i = 0; i <= spokes; i++) {
          const angle = i / spokes * Math.PI / 2;
          ctx.strokeStyle = `rgba(198,195,170,${.48 + random() * .3})`;
          ctx.beginPath(); ctx.moveTo(...origin as [number, number]); ctx.lineTo(13 + Math.cos(angle) * 232, 12 + Math.sin(angle) * 232); ctx.stroke();
        }
        for (let r = 25; r < 234; r += 12 + random() * 13) {
          ctx.strokeStyle = 'rgba(193,190,164,.58)'; ctx.beginPath();
          for (let i = 0; i <= spokes; i++) {
            const a = i / spokes * Math.PI / 2, x = 13 + Math.cos(a) * r, y = 12 + Math.sin(a) * r;
            if (!i || random() < .13) ctx.moveTo(x, y); else ctx.quadraticCurveTo(x - 7, y - 5, x, y);
          }
          ctx.stroke();
        }
        for (let i = 0; i < 28; i++) {
          const x = 16 + random() * 150, y = 12 + random() * 130;
          ctx.strokeStyle = 'rgba(195,190,169,.17)'; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 4, y + 27, x - 8, y + 45); ctx.stroke();
        }
      } else if (kind === 'tear' || kind === 'rot') {
        polygon(ctx, random, 128, 128, kind === 'tear' ? 26 : 84, 112, '#151914');
        for (let i = 0; i < 24; i++) {
          const x = (kind === 'tear' ? 102 : 54) + random() * (kind === 'tear' ? 53 : 140), y = 25 + random() * 205;
          ctx.strokeStyle = i % 2 ? '#69624b' : '#a19a81'; ctx.lineWidth = .7;
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + random() * 8 - 4, y + 14 + random() * 20); ctx.stroke();
        }
      } else if (kind === 'paper') {
        polygon(ctx, random, 128, 128, 123, 122, '#b2a98a');
        ctx.fillStyle = 'rgba(65,64,52,.5)';
        for (let i = 0; i < 22; i++) for (let col = 0; col < 2; col++) ctx.fillRect(35 + col * 92, 32 + i * 8, 45 + random() * 30, 1 + random());
        ctx.fillStyle = '#78715c'; ctx.fillRect(35, 30, 168, 5);
      } else if (kind === 'crack') {
        for (let i = 0; i < 6; i++) {
          let x = 95 + random() * 50, y = 90 + random() * 40;
          ctx.strokeStyle = 'rgba(30,31,24,.8)'; ctx.lineWidth = .7 + random(); ctx.beginPath(); ctx.moveTo(x, y);
          for (let j = 0; j < 8; j++) { x += (random() - .5) * 40; y += (i % 2 ? 1 : -1) * 15; ctx.lineTo(x, y); }
          ctx.stroke();
        }
      } else if (kind === 'moon') {
        for (let x = 22; x < 230; x += 42) {
          const g = ctx.createLinearGradient(0, 10, 0, 245); g.addColorStop(0, 'rgba(123,155,162,.26)'); g.addColorStop(.4, 'rgba(123,155,162,.14)'); g.addColorStop(1, 'rgba(123,155,162,0)');
          ctx.fillStyle = g; ctx.fillRect(x, 10, 30, 98); ctx.fillRect(x, 116, 30, 126);
        }
      } else if (kind === 'cloth') {
        ctx.fillStyle = '#8b8774'; ctx.beginPath(); ctx.moveTo(8, 5); ctx.lineTo(246, 5);
        for (let x = 246; x >= 8; x -= 8) ctx.lineTo(x, 180 + random() * 64);
        ctx.closePath(); ctx.fill();
        for (let x = 10; x < 248; x += 13) { ctx.fillStyle = x % 2 ? 'rgba(31,33,24,.28)' : 'rgba(200,191,163,.22)'; ctx.fillRect(x, 5, 5, 244); }
        ctx.globalCompositeOperation = 'destination-out';
        for (let i = 0; i < 18; i++) polygon(ctx, random, 20 + random() * 215, 40 + random() * 190, 2 + random() * 8, 8 + random() * 18, '#000');
      }
      ctx.restore();
      if (['damp', 'dust', 'grime', 'contact'].includes(kind)) {
        const x0 = index % 4 * 256, y0 = Math.floor(index / 4) * 256, pixels = ctx.getImageData(x0, y0, 256, 256);
        for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) pixels.data[(y * 256 + x) * 4 + 3] *= Math.max(0, Math.min(1, Math.min(x - 6, 249 - x, y - 6, 249 - y) / 28));
        ctx.putImageData(pixels, x0, y0);
      }
      // Fine pitting prevents large decal chips from reading as flat paper shapes.
      if (kind.startsWith('peel') || ['paper', 'cloth', 'rot', 'tear'].includes(kind)) {
        const x0 = index % 4 * 256, y0 = Math.floor(index / 4) * 256, pixels = ctx.getImageData(x0, y0, 256, 256);
        for (let i = 0; i < pixels.data.length; i += 4) {
          const grain = (random() - .5) * 33;
          for (let channel = 0; channel < 3; channel++) pixels.data[i + channel] += grain;
        }
        ctx.putImageData(pixels, x0, y0);
      }
    }
  });
  atlas.hasAlpha = true; atlas.wrapU = atlas.wrapV = B.Texture.CLAMP_ADDRESSMODE;
  return atlas;
}
