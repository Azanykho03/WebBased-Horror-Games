// Uses the production display controller with a simulated mobile capability.
// Fullscreen requests and renderer/camera resize are real browser operations.
import { MobileDisplay } from '../src/mobile-display.ts';
import type { World } from '../src/world.ts';

export function attachDisplayAudit(root: Element, world: World): void {
  const button = document.createElement('button'), result = document.createElement('pre');
  button.textContent = 'Check landscape fullscreen'; result.setAttribute('aria-label', 'Fullscreen validation');
  result.style.whiteSpace = 'pre-wrap'; root.append(button, result);
  button.addEventListener('click', () => {
    if (innerWidth <= innerHeight) { result.textContent = 'Use a landscape viewport for this check.'; return; }
    button.disabled = true;
    let resized = 0;
    const display = new MobileDisplay(() => { world.scene.getEngine().resize(); world.camera.getProjectionMatrix(true); resized++; }, () => true);
    display.sync(true, true);
    window.setTimeout(async () => {
      const canvas = world.scene.getEngine().getRenderingCanvas()!, rect = canvas.getBoundingClientRect();
      const aspect = world.scene.getEngine().getAspectRatio(world.camera);
      const fits = Math.abs(rect.width - innerWidth) < 1 && Math.abs(rect.height - innerHeight) < 1;
      const cameraFits = Math.abs(aspect - rect.width / rect.height) < .02;
      const active = !!document.fullscreenElement;
      result.textContent = `${fits && cameraFits ? 'PASS' : 'FAIL'}: ${active ? 'browser granted fullscreen' : 'browser restricted fullscreen; viewport fallback remains usable'}; canvas ${Math.round(rect.width)}×${Math.round(rect.height)}; camera aspect ${aspect.toFixed(3)}; ${resized} resize events. Mobile capability simulated.`;
      display.sync(false); display.dispose();
      if (active) await document.exitFullscreen().catch(() => {});
      button.disabled = false;
    }, 1200);
  });
}
