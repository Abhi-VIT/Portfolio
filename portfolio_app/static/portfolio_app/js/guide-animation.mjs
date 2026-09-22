import * as THREE from '../vendor/three/three.module.js';

const smooth = THREE.MathUtils.smoothstep;

// The archive is unrigged. Build a small, non-destructive runtime rig in a
// height-normalized space; the source GLB and its face/hand textures stay intact.
export function createWalkingPresenter(source) {
  source.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(source);
  const size = bounds.getSize(new THREE.Vector3());
  if (!Number.isFinite(size.length()) || size.y <= 0) throw new Error('Invalid presenter geometry');
  const center = bounds.getCenter(new THREE.Vector3());
  const normalize = new THREE.Matrix4().makeScale(1 / size.y, 1 / size.y, 1 / size.y)
    .multiply(new THREE.Matrix4().makeTranslation(-center.x, -bounds.min.y, -center.z));
  const presenter = new THREE.Group();
  presenter.name = 'formal-walking-presenter';
  const meshes = [];
  source.traverse(object => {
    if (!object.isMesh) return;
    const geometry = object.geometry.clone();
    geometry.applyMatrix4(new THREE.Matrix4().multiplyMatrices(normalize, object.matrixWorld));
    meshes.push({ geometry, material: object.material });
  });

  // Estimate joints from the scan's own cross-sections, including its asymmetric
  // resting stance, rather than forcing both knees into a straight mannequin pose.
  function jointAt(y, side) {
    let count = 0, x = 0, z = 0;
    for (const { geometry } of meshes) {
      const p = geometry.attributes.position;
      for (let i = 0; i < p.count; i++) {
        if (Math.abs(p.getY(i) - y) > .012 || Math.sign(p.getX(i) - .015) !== side) continue;
        x += p.getX(i); z += p.getZ(i); count++;
      }
    }
    return new THREE.Vector3(count ? x / count : side * .055, y, count ? z / count : -.025);
  }
  const root = new THREE.Bone();
  root.name = 'body';
  const bones = [root];
  const legs = [-1, 1].map((side, index) => {
    const hipPoint = jointAt(.46, side), kneePoint = jointAt(.25, side), anklePoint = jointAt(.065, side);
    const hip = new THREE.Bone(), knee = new THREE.Bone(), ankle = new THREE.Bone();
    hip.name = `${index ? 'right' : 'left'}Hip`;
    knee.name = `${index ? 'right' : 'left'}Knee`;
    ankle.name = `${index ? 'right' : 'left'}Ankle`;
    hip.position.copy(hipPoint);
    knee.position.copy(kneePoint).sub(hipPoint);
    ankle.position.copy(anklePoint).sub(kneePoint);
    root.add(hip); hip.add(knee); knee.add(ankle);
    bones.push(hip, knee, ankle);
    return { hip, knee, ankle, hipPoint, kneePoint, anklePoint, side };
  });
  presenter.add(root);
  presenter.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(bones);
  const footSamples = [];
  for (const { geometry, material } of meshes) {
    const p = geometry.attributes.position;
    const indices = new Uint16Array(p.count * 4), weights = new Float32Array(p.count * 4);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const side = x < .015 ? 0 : 1;
      const base = 1 + side * 3;
      // Hands hang beside the thighs: never bind their vertices to a leg.
      const outsideLeg = y > .36 && (Math.abs(x - .015) > .09 || z > .035);
      const bodyWeight = outsideLeg ? 1 : smooth(y, .425, .51);
      const upperWeight = smooth(y, .215, .29);
      const ankleWeight = 1 - smooth(y, .045, .10);
      indices.set([0, base, base + 1, base + 2], i * 4);
      weights.set([bodyWeight, (1 - bodyWeight) * upperWeight,
        (1 - bodyWeight) * (1 - upperWeight) * (1 - ankleWeight),
        (1 - bodyWeight) * (1 - upperWeight) * ankleWeight], i * 4);
    }
    geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(indices, 4));
    geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weights, 4));
    const materials = Array.isArray(material) ? material.map(tailorMaterial) : tailorMaterial(material);
    const mesh = new THREE.SkinnedMesh(geometry, materials);
    mesh.name = 'rigged-shadowed-ensemble';
    mesh.castShadow = mesh.receiveShadow = true;
    // Feet can move outside the static bounding sphere during the stride.
    mesh.frustumCulled = false;
    presenter.add(mesh);
    mesh.bind(skeleton, new THREE.Matrix4());
    // Sample the real shoe soles for floor correction each frame.
    for (let side = 0; side < 2; side++) {
      const candidates = [];
      for (let i = 0; i < p.count; i++) {
        if ((p.getX(i) < .015 ? 0 : 1) === side && p.getY(i) < .06) candidates.push(i);
      }
      candidates.sort((a, b) => p.getY(a) - p.getY(b));
      for (const i of candidates.filter((_, j) => j % Math.max(1, Math.floor(candidates.length / 40)) === 0)) {
        footSamples.push({ mesh, index: i });
      }
    }
  }
  // Reserve the walking envelope before fitGuideModel chooses the final scale.
  // This keeps animated shoes inside the same navigation radius as the body.
  presenter.userData.walkingRadius = .235;
  let phase = 0, blend = 0;
  const vertex = new THREE.Vector3();
  presenter.userData.updateWalk = ({ distance = 0, dt = 0, reducedMotion = false } = {}) => {
    const walking = distance > .0001;
    blend = THREE.MathUtils.damp(blend, walking && !reducedMotion ? 1 : 0, 14, dt);
    if (blend < .0001) blend = 0;
    // One complete left/right cycle per 1.65 world units traveled.
    if (!reducedMotion) phase += distance * Math.PI * 2 / 1.65;
    root.position.y = 0;
    legs.forEach(({ hip, knee, ankle }, side) => {
      const cycle = phase + side * Math.PI;
      const swing = Math.sin(cycle);
      hip.rotation.x = swing * .29 * blend;
      knee.rotation.x = Math.max(0, -swing) * .46 * blend;
      ankle.rotation.x = -Math.max(0, -swing) * .18 * blend;
    });
    // No leg cycling at a closed gate or during a pause; smoothly return to rest.
    presenter.updateMatrixWorld(true);
    skeleton.update();
    let lowest = Infinity;
    for (const sample of footSamples) {
      vertex.fromBufferAttribute(sample.mesh.geometry.attributes.position, sample.index);
      sample.mesh.applyBoneTransform(sample.index, vertex);
      lowest = Math.min(lowest, vertex.y);
    }
    if (Number.isFinite(lowest)) root.position.y = -lowest;
    presenter.updateMatrixWorld(true);
    skeleton.update();
  };
  presenter.userData.legs = legs;
  return presenter;
}

function tailorMaterial(original) {
  const material = original.clone();
  material.name = 'navy-suit-white-shirt-burgundy-tie';
  material.roughness = .88;
  material.metalness = 0;
  material.metalnessMap = null;
  material.roughnessMap = null;
  material.emissiveMap = null;
  material.emissive.set(0x000000);
  material.normalScale?.setScalar(.3);
  material.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vSuitPosition;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSuitPosition = position;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vSuitPosition;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        float y = vSuitPosition.y;
        float x = vSuitPosition.x + .017;
        // Retain the photographed face, hair and hands; replace only clothing.
        bool hand = y > .36 && y < .55 &&
          diffuseColor.r > diffuseColor.g * 1.15 && diffuseColor.r > diffuseColor.b * 1.25;
        if (y < .865 && !hand) {
          vec3 cloth = vec3(.024, .038, .072);
          if (y < .085) cloth = vec3(.014, .018, .025);
          float shirtWidth = .052 * clamp((y - .65) / .185, 0.0, 1.0);
          bool front = vSuitPosition.z > .025;
          bool shirt = front && y > .65 && y < .846 && abs(x) < shirtWidth;
          bool lapel = front && y > .64 && y < .85 && abs(x) >= shirtWidth && abs(x) < shirtWidth + .018;
          if (lapel) cloth = vec3(.045, .066, .105);
          if (shirt) {
            cloth = vec3(.87, .89, .91);
            float tieWidth = y > .82 ? .010 : .008;
            if (abs(x) < tieWidth && y > .699 && y < .837) cloth = vec3(.18, .018, .038);
          }
          // Crisp white collar tips around the knot.
          if (front && y > .815 && y < .848 && abs(x) > .011 &&
              abs(x) < .039 && y > .815 + abs(x) * .35) cloth = vec3(.93);
          if (front && y >= .846 && y < .865 && abs(x) < .036) cloth = vec3(.87, .89, .91);
          diffuseColor.rgb = cloth;
        }
      `);
  };
  material.customProgramCacheKey = () => 'formal-suit-v1';
  return material;
}
