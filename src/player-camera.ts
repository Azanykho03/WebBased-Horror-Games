import type * as Babylon from 'babylonjs';

// Both gameplay and scares use the player's yaw/pitch convention. Keeping the
// camera in Euler mode avoids quaternion interpolation introducing camera roll.
export function orientPlayerCamera(camera: Babylon.FreeCamera, yaw: number, pitch: number): void {
  camera.rotationQuaternion = null;
  camera.rotation.set(pitch, -yaw, 0);
  // Babylon otherwise caches a quaternion-derived up vector across the return
  // to Euler controls. It then banks the view on the next mouse-look turn even
  // though rotation.z is zero. Recompute the basis from the current pose.
  camera.upVector.set(0, 1, 0);
  camera.updateUpVectorFromRotation = true;
}

export function haltPlayerCamera(camera: Babylon.FreeCamera): void {
  // PlayerPhysics and InputSystem own locomotion; no native camera motion may
  // survive a presentation boundary and run later during Scene.render().
  camera.cameraDirection.setAll(0); camera.cameraRotation.set(0, 0);
  camera.movement.resetPanVelocity(); camera.movement.resetRotationVelocity(); camera.movement.resetZoomVelocity();
  camera.lockedTarget = null;
}

/** One-dimensional gradient Perlin noise: smooth, deterministic, frame-rate independent. */
export function cameraNoise(time: number, seed = 0): number {
  if (!Number.isFinite(time)) return 0;
  const cell = Math.floor(time), x = time - cell;
  const gradient = (index: number) => {
    let hash = Math.imul(index ^ seed, 0x45d9f3b);
    hash = Math.imul(hash ^ (hash >>> 16), 0x45d9f3b);
    return (hash ^ (hash >>> 16)) & 1 ? 1 : -1;
  };
  const fade = x * x * x * (x * (x * 6 - 15) + 10);
  return 2 * ((1 - fade) * gradient(cell) * x + fade * gradient(cell + 1) * (x - 1));
}

/** Apply offsets after the ordinary absolute camera pose; never accumulate rotations. */
export function shakeGrabCamera(camera: Babylon.FreeCamera, time: number, impact: number, drag: number, kick: number, fade: number): void {
  const strength = Math.max(0, Math.min(1, fade));
  const pitch = cameraNoise(time * 16.7, 17) * (.075 * impact + .012 * drag) + .024 * kick;
  const roll = cameraNoise(time * 19.3 + .21, 31) * (.10 * impact + .014 * drag) + .022 * impact;
  camera.rotation.x = Math.max(-1.3, Math.min(1.3, camera.rotation.x + pitch * strength));
  camera.rotation.z = Math.max(-.12, Math.min(.12, roll * strength));
  camera.position.x += cameraNoise(time * 13.1 + .13, 43) * (.016 * impact + .004 * drag) * strength;
  camera.position.y += cameraNoise(time * 17.9 + .37, 59) * (.014 * impact + .006 * drag + .004 * kick) * strength;
  camera.position.z += cameraNoise(time * 11.7, 71) * (.01 * impact + .004 * drag) * strength;
}
