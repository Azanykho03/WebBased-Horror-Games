import { defineConfig } from 'vite';
import { cp, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { ASSETS, GHOST_PROFILE, MUSIC_AUDIO, VOICE_AUDIO } from './src/config.ts';

// Ship only runtime assets; generation sources, references and model weights stay local.
const runtimeAssets = new Set([
  ASSETS.house, ASSETS.manifest,
  'models/environments/haunted-house/vendor/babylon.js',
  'models/environments/haunted-house/vendor/babylonjs.loaders.min.js',
  'models/environments/haunted-house/vendor/BABYLON-LICENSE.md',
  GHOST_PROFILE.model, GHOST_PROFILE.face, ASSETS.key, ASSETS.arms,
  ...Object.values(MUSIC_AUDIO),
  ...Object.values(VOICE_AUDIO).flatMap(clip => [clip.normal, clip.clean]).filter((path): path is string => Boolean(path)),
]);

export default defineConfig(({ command, mode }) => ({
  base: './',
  publicDir: command === 'serve' ? 'public' : false,
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
  build: { outDir: mode === 'validation' ? 'dist-validation' : 'dist' },
  plugins: [{
    name: 'existing-game-assets',
    apply: 'build',
    async closeBundle() {
      for (const asset of runtimeAssets) {
        const destination = resolve(mode === 'validation' ? 'dist-validation/assets' : 'dist/assets', asset);
        await mkdir(dirname(destination), { recursive: true });
        await cp(resolve('public/assets', asset), destination);
      }
    },
  }],
}));
