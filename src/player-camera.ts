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
