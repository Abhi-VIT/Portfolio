// Floor navigation is independent of rendering so every route can be checked in Node.
export const ROOM_GAP = 13.5;
export const GUIDE_RADIUS = .6;
export const PRESENTATION_SPOTS = [
  [2.45, -.15], [2.45, -.15], [2.65, -.2], [2.9, .25],
  [-2.45, 1.2], [2.8, .1], [-2.85, .05],
];

export function destination(room) {
  return { x: room * ROOM_GAP + PRESENTATION_SPOTS[room][0], z: PRESENTATION_SPOTS[room][1] };
}

export function createNavigator(obstacles) {
  const step = .2;
  const minX = -4.3;
  const minZ = -2.9;
  const cols = Math.ceil((6 * ROOM_GAP + 8.6) / step) + 1;
  const rows = 31;
  const point = id => ({ x: minX + (id % cols) * step, z: minZ + Math.floor(id / cols) * step });
  function clear(p) {
    if (p.z < -2.95 || p.z > 3.15) return false;
    let onFloor = false;
    for (let room = 0; room < 7; room++) {
      const localX = p.x - room * ROOM_GAP;
      if (localX >= -4.3001 && localX <= 4.3001) onFloor = true;
      // Only the guide's gate/corridor connects adjoining rooms.
      if (room < 6 && localX >= 4.2999 && localX <= ROOM_GAP - 4.2999 && Math.abs(p.z + 1.7) <= .09) onFloor = true;
    }
    return onFloor && !obstacles.some(o => p.x > o.minX - GUIDE_RADIUS && p.x < o.maxX + GUIDE_RADIUS && p.z > o.minZ - GUIDE_RADIUS && p.z < o.maxZ + GUIDE_RADIUS);
  }
  function segmentClear(a, b) {
    const count = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / .04));
    for (let i = 0; i <= count; i++) {
      const fraction = i / count;
      if (!clear({ x: a.x + (b.x - a.x) * fraction, z: a.z + (b.z - a.z) * fraction })) return false;
    }
    return true;
  }
  const valid = new Uint8Array(cols * rows);
  for (let id = 0; id < valid.length; id++) valid[id] = clear(point(id)) ? 1 : 0;
  function nearest(p) {
    let closest = -1;
    let distance = Infinity;
    for (let id = 0; id < valid.length; id++) {
      if (!valid[id]) continue;
      const q = point(id);
      const d = Math.hypot(p.x - q.x, p.z - q.z);
      if (d < distance && segmentClear(p, q)) { distance = d; closest = id; }
    }
    return closest;
  }
  function route(start, finish) {
    if (!clear(start) || !clear(finish)) return null;
    const from = nearest(start);
    const to = nearest(finish);
    if (from < 0 || to < 0) return null;
    // Uniform-cost breadth-first search on a small four-connected floor grid.
    const parent = new Int32Array(valid.length).fill(-1);
    const queue = [from];
    parent[from] = from;
    for (let cursor = 0; cursor < queue.length && parent[to] === -1; cursor++) {
      const id = queue[cursor];
      for (const next of [id - 1, id + 1, id - cols, id + cols]) {
        if (next < 0 || next >= valid.length || !valid[next] || parent[next] !== -1) continue;
        const a = point(id), b = point(next);
        if (Math.abs(a.x - b.x) > step + .001 || !segmentClear(a, b)) continue;
        parent[next] = id;
        queue.push(next);
      }
    }
    if (parent[to] === -1) return null;
    const path = [finish];
    for (let id = to; id !== from; id = parent[id]) path.push(point(id));
    path.push(point(from), start);
    path.reverse();
    // Shorten only where a swept body-sized path is actually unobstructed.
    const result = [];
    let anchor = 0;
    while (anchor < path.length - 1) {
      let next = anchor + 1;
      while (next + 1 < path.length && segmentClear(path[anchor], path[next + 1])) next++;
      result.push(path[next]);
      anchor = next;
    }
    return result;
  }
  return { route, clear, segmentClear };
}
