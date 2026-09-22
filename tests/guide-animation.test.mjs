import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from '../portfolio_app/static/portfolio_app/vendor/three/three.module.js';
import { createWalkingPresenter } from '../portfolio_app/static/portfolio_app/js/guide-animation.mjs';
import { fitGuideModel } from '../portfolio_app/static/portfolio_app/js/guide-model.mjs';
import { GUIDE_RADIUS } from '../portfolio_app/static/portfolio_app/js/guide-navigation.mjs';

// Decode the supplied mesh's real vertex buffers; texture decoding is browser QA.
const bytes = readFileSync(new URL('../portfolio_app/static/portfolio_app/models/shadowed-ensemble.glb', import.meta.url));
const jsonLength = bytes.readUInt32LE(12);
const gltf = JSON.parse(bytes.subarray(20, 20 + jsonLength));
function attribute(index) {
  const accessor = gltf.accessors[index], view = gltf.bufferViews[accessor.bufferView];
  const width = { SCALAR: 1, VEC2: 2, VEC3: 3 }[accessor.type];
  const Type = accessor.componentType === 5126 ? Float32Array : Uint32Array;
  const offset = bytes.byteOffset + 28 + jsonLength + (view.byteOffset || 0) + (accessor.byteOffset || 0);
  return new THREE.BufferAttribute(new Type(bytes.buffer, offset, accessor.count * width).slice(), width);
}
const source = new THREE.Group();
const primitive = gltf.meshes[0].primitives[0];
const geometry = new THREE.BufferGeometry();
geometry.setAttribute('position', attribute(primitive.attributes.POSITION));
geometry.setAttribute('normal', attribute(primitive.attributes.NORMAL));
geometry.setAttribute('uv', attribute(primitive.attributes.TEXCOORD_0));
geometry.setIndex(attribute(primitive.indices));
const scan = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial());
scan.position.fromArray(gltf.nodes[0].translation);
scan.scale.fromArray(gltf.nodes[0].scale);
source.add(scan);
const presenter = createWalkingPresenter(source);
const fitted = fitGuideModel(presenter, GUIDE_RADIUS);
fitted.updateMatrixWorld(true);
const mesh = presenter.getObjectByName('rigged-shadowed-ensemble');
const update = presenter.userData.updateWalk;

test('all real scan vertices have finite normalized bone weights, while head stays on body', () => {
  const { position, skinIndex, skinWeight } = mesh.geometry.attributes;
  for (let i = 0; i < position.count; i++) {
    const total = skinWeight.getX(i) + skinWeight.getY(i) + skinWeight.getZ(i) + skinWeight.getW(i);
    assert.ok(Math.abs(total - 1) < 1e-6);
    if (position.getY(i) > .6) {
      assert.equal(skinIndex.getX(i), 0);
      assert.equal(skinWeight.getX(i), 1);
    }
  }
  assert.notEqual(mesh.geometry, scan.geometry, 'Never mutate the source scan');
  assert.notEqual(mesh.material, scan.material);
});

test('legs alternate, bend knees, and stay inside the collision envelope for a full gait', () => {
  const v = new THREE.Vector3();
  let maxRadius = 0, minFloor = Infinity;
  const { position } = mesh.geometry.attributes;
  for (let frame = 0; frame < 72; frame++) {
    update({ distance: 1.65 / 72, dt: 1 / 60 });
    const [left, right] = presenter.userData.legs;
    assert.ok(Math.abs(left.hip.rotation.x + right.hip.rotation.x) < 1e-6);
    assert.ok(left.knee.rotation.x >= 0 && right.knee.rotation.x >= 0);
    for (let i = 0; i < position.count; i++) {
      v.fromBufferAttribute(position, i);
      mesh.applyBoneTransform(i, v);
      v.applyMatrix4(mesh.matrixWorld);
      maxRadius = Math.max(maxRadius, Math.hypot(v.x, v.z));
      minFloor = Math.min(minFloor, v.y);
    }
  }
  assert.ok(maxRadius <= GUIDE_RADIUS, `Animated body escapes clearance: ${maxRadius}`);
  assert.ok(minFloor > -.015, `Shoe clips the floor: ${minFloor}`);
});

test('pausing or reduced motion settles both legs to the original pose', () => {
  for (let i = 0; i < 90; i++) update({ distance: 0, dt: 1 / 60 });
  for (const leg of presenter.userData.legs) assert.ok(Math.abs(leg.hip.rotation.x) < 1e-6);
  for (let i = 0; i < 90; i++) update({ distance: .04, dt: 1 / 60, reducedMotion: true });
  for (const leg of presenter.userData.legs) assert.ok(Math.abs(leg.knee.rotation.x) < 1e-6);
});

test('the suit shader preserves the original texture and adds clothing-only tailoring', () => {
  const shader = {vertexShader: '#include <common>\n#include <begin_vertex>', fragmentShader: '#include <common>\n#include <map_fragment>'};
  mesh.material.onBeforeCompile(shader);
  assert.match(shader.vertexShader, /vSuitPosition = position/);
  assert.match(shader.fragmentShader, /bool hand/);
  assert.match(shader.fragmentShader, /bool shirt/);
  assert.match(shader.fragmentShader, /bool lapel/);
  assert.equal(mesh.material.metalness, 0);
});
