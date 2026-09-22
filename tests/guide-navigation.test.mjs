import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createNavigator, destination } from '../portfolio_app/static/portfolio_app/js/guide-navigation.mjs';

// Run the real furniture-building functions with render-only objects stubbed out.
// This checks the paths against current scene dimensions, not a duplicated layout.
class RenderObject {
  constructor() {
    this.position = { x: 0, y: 0, z: 0, set(x, y, z) { Object.assign(this, { x, y, z }); } };
    this.scale = { set() {} };
    this.rotation = {};
    this.userData = {};
  }
  add() {}
}
const source = readFileSync(new URL('../portfolio_app/static/portfolio_app/js/home-3d.js', import.meta.url), 'utf8');
const furniture = source.slice(source.indexOf('function createFoyer('), source.indexOf('function createGuide('));
const boxSource = source.slice(source.indexOf('function box('), source.indexOf('function makeTextPanel('));
const extraObstacles = source.slice(source.indexOf('guideObstacles.push({ minX: 3 * roomGap'), source.indexOf('const guideNavigator'));
const obstacles = [];
const context = {
  THREE: new Proxy({}, { get: () => RenderObject }),
  portfolio: JSON.parse(readFileSync(new URL('../resume_data.json', import.meta.url), 'utf8')),
  roomGap: 13.5, guideObstacles: obstacles, animatedObjects: [],
  mat: () => ({}), makeInfoPanel: () => new RenderObject(), makeSkillLogo: () => new RenderObject(),
  addRoomShell(index) {
    const group = new RenderObject();
    group.position.x = index * 13.5;
    group.userData.furnitureZone = true;
    return { group, accent: {} };
  },
};
vm.runInNewContext(boxSource + furniture + extraObstacles, context);
const navigator = createNavigator(obstacles);

test('every room pair has a body-width-clear route through the guide gates', () => {
  for (let from = 0; from < 7; from++) {
    for (let to = 0; to < 7; to++) {
      const start = destination(from), finish = destination(to);
      const path = navigator.route(start, finish);
      assert.ok(path?.length, `No safe path ${from} → ${to}`);
      let previous = start;
      for (const point of path) {
        assert.ok(navigator.segmentClear(previous, point), `Collision ${from} → ${to}`);
        previous = point;
      }
      assert.deepEqual(previous, finish);
    }
  }
});

test('changing rooms during travel replans safely from the current position', () => {
  const path = navigator.route(destination(0), destination(6));
  let previous = destination(0);
  for (const point of path) {
    const interrupted = { x: (previous.x + point.x) / 2, z: (previous.z + point.z) / 2 };
    const reroute = navigator.route(interrupted, destination(2));
    assert.ok(reroute?.length, 'Interrupted route has no safe return');
    assert.ok(navigator.segmentClear(interrupted, reroute[0]));
    previous = point;
  }
});

test('the desk and chair cannot be selected as walking destinations', () => {
  assert.equal(navigator.route(destination(2), { x: 27.8, z: -2.25 }), null);
  assert.equal(navigator.route(destination(2), { x: 27.95, z: -.85 }), null);
});
