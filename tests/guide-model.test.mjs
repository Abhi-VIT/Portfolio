import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Box3, BoxGeometry, Group, Mesh, MeshStandardMaterial, Vector3 } from '../portfolio_app/static/portfolio_app/vendor/three/three.module.js';
import { fitGuideModel } from '../portfolio_app/static/portfolio_app/js/guide-model.mjs';
import { GUIDE_RADIUS } from '../portfolio_app/static/portfolio_app/js/guide-navigation.mjs';

const glb = readFileSync(new URL('../portfolio_app/static/portfolio_app/models/shadowed-ensemble.glb', import.meta.url));
const jsonLength = glb.readUInt32LE(12);
const data = JSON.parse(glb.subarray(20, 20 + jsonLength).toString());

test('the provided GLB is complete, self-contained and unrigged', () => {
  assert.equal(glb.toString('ascii', 0, 4), 'glTF');
  assert.equal(glb.readUInt32LE(4), 2);
  assert.equal(glb.readUInt32LE(8), glb.length);
  assert.equal(data.skins?.length || 0, 0);
  assert.equal(data.animations?.length || 0, 0);
  assert.ok(data.images.length > 0);
  for (const image of data.images) {
    assert.equal(image.uri, undefined);
    assert.equal(image.mimeType, 'image/png');
    const view = data.bufferViews[image.bufferView];
    const offset = 20 + jsonLength + 8 + (view.byteOffset || 0);
    assert.ok(offset + view.byteLength <= glb.length);
    assert.equal(glb.toString('ascii', offset + 1, offset + 4), 'PNG');
  }
});

test('authored model bounds fit the guide footprint and remain floor-grounded through turns', () => {
  // Reconstruct the asset's actual node hierarchy and accessor bounds without
  // needing a GPU or decoding textures in this geometry-only regression test.
  const nodes = data.nodes.map(node => {
    const group = new Group();
    if (node.translation) group.position.fromArray(node.translation);
    if (node.scale) group.scale.fromArray(node.scale);
    if (node.rotation) group.quaternion.fromArray(node.rotation);
    if (node.mesh !== undefined) {
      for (const primitive of data.meshes[node.mesh].primitives) {
        const accessor = data.accessors[primitive.attributes.POSITION];
        const min = new Vector3().fromArray(accessor.min);
        const max = new Vector3().fromArray(accessor.max);
        const size = max.clone().sub(min);
        const geometry = new BoxGeometry(size.x, size.y, size.z);
        geometry.translate(...min.add(max).multiplyScalar(.5).toArray());
        group.add(new Mesh(geometry, new MeshStandardMaterial()));
      }
    }
    return group;
  });
  data.nodes.forEach((node, i) => (node.children || []).forEach(child => nodes[i].add(nodes[child])));
  const model = new Group();
  data.scenes[data.scene || 0].nodes.forEach(index => model.add(nodes[index]));
  const material = nodes.find(node => node.children.some(child => child.isMesh)).children.find(child => child.isMesh).material;
  const fitted = fitGuideModel(model, GUIDE_RADIUS);
  for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 16) {
    fitted.rotation.y = angle;
    const bounds = new Box3().setFromObject(fitted);
    assert.ok(Math.abs(bounds.min.y) < 1e-6, 'Feet must stay at ground level');
    assert.ok(bounds.max.y <= 3.15 + 1e-6, 'Must fit below the guide door lintel');
    assert.ok(bounds.max.y > 2, 'Must remain human-sized within the room');
    for (const extent of [bounds.min.x, bounds.max.x, bounds.min.z, bounds.max.z]) {
      assert.ok(Math.abs(extent) < GUIDE_RADIUS, 'Turning must not escape collision clearance');
    }
  }
  model.traverse(object => {
    if (!object.isMesh) return;
    assert.equal(object.material, material);
    assert.equal(object.castShadow, true);
    assert.equal(object.receiveShadow, true);
  });
});

test('an empty model is rejected instead of producing an invisible invalid transform', () => {
  assert.throws(() => fitGuideModel(new Group(), GUIDE_RADIUS), /invalid dimensions/);
});
