import { Box3, Group, Vector3 } from '../vendor/three/three.module.js';

// A circular footprint stays inside the navigator's clearance even while turning.
export function fitGuideModel(model, collisionRadius, desiredHeight = 3.15) {
  const bounds = new Box3().setFromObject(model);
  const size = bounds.getSize(new Vector3());
  if (!Number.isFinite(size.length()) || size.y <= 0 || collisionRadius <= .02) {
    throw new Error('The presenter model has invalid dimensions.');
  }
  const scale = Math.min(desiredHeight / size.y,
    (collisionRadius - .02) / Math.max(Math.hypot(size.x, size.z) / 2, model.userData.walkingRadius || 0));
  const center = bounds.getCenter(new Vector3());
  // Use wrappers to retain all authored node transforms and embedded textures.
  const centered = new Group();
  centered.add(model);
  centered.position.set(-center.x, -bounds.min.y, -center.z);
  const fitted = new Group();
  fitted.name = 'shadowed-ensemble';
  fitted.add(centered);
  fitted.scale.setScalar(scale);
  model.traverse((object) => {
    if (!object.isMesh) return;
    object.castShadow = true;
    object.receiveShadow = true;
  });
  return fitted;
}
