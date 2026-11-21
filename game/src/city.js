// Port Aurelia itself: the road grid, the blocks and buildings inside it, the coast with
// its palms, and the fixed landmarks the story uses. Everything is placed once, from a
// seeded random source, so the city is identical for every player and every screenshot.

import { COAST, ROADS, WORLD } from './config.js';
import { intBetween } from './rng.js';

/** Landmarks the missions and the safehouse point at, in world coordinates. */
export const LANDMARKS = {
  safehouse: { x: 1180, y: 1010, label: 'Safehouse — Marlow\'s Garage' },
  docks: { x: 470, y: 620, label: 'Harbor Docks' },
  garage: { x: 2690, y: 1010, label: 'Vic\'s Chop Shop' },
  bank: { x: 1690, y: 1460, label: 'Aurelia Savings Bank' },
  club: { x: 2180, y: 560, label: 'Club Mirage' },
  pier: { x: 380, y: 1960, label: 'Sunset Pier' },
};

/** Build the city: buildings (axis-aligned boxes), palms along the beach, and the
 *  plaza in front of the safehouse. Landmark plots are left clear of buildings. */
export function createCity(random) {
  const buildings = [];
  const palms = [];
  const half = ROADS.width / 2;
  const verticals = [COAST.sandEnd + 40, ...ROADS.vertical, WORLD.width - 60];
  const horizontals = [60, ...ROADS.horizontal, WORLD.height - 60];

  for (let vi = 0; vi < verticals.length - 1; vi += 1) {
    for (let hi = 0; hi < horizontals.length - 1; hi += 1) {
      const x0 = verticals[vi] + half + 14;
      const x1 = verticals[vi + 1] - half - 14;
      const y0 = horizontals[hi] + half + 14;
      const y1 = horizontals[hi + 1] - half - 14;
      if (x1 - x0 < 90 || y1 - y0 < 90) continue;
      const count = intBetween(random, 1, 3);
      for (let b = 0; b < count; b += 1) {
        const w = intBetween(random, 90, Math.min(220, x1 - x0));
        const h = intBetween(random, 80, Math.min(190, y1 - y0));
        const x = intBetween(random, x0, Math.max(x0, x1 - w));
        const y = intBetween(random, y0, Math.max(y0, y1 - h));
        const box = { x, y, w, h, hue: random() };
        if (nearLandmark(box)) continue;
        if (buildings.some((other) => overlaps(box, other, 18))) continue;
        buildings.push(box);
      }
    }
  }

  // Palms in two staggered rows along the sand, plus a few by the pier.
  for (let y = 120; y < WORLD.height - 80; y += 86) {
    palms.push({ x: 268 + (random() - 0.5) * 22, y: y + (random() - 0.5) * 26 });
    if (random() < 0.6) palms.push({ x: 306 + (random() - 0.5) * 16, y: y + 44 + (random() - 0.5) * 20 });
  }
  return { buildings, palms };
}

function nearLandmark(box) {
  return Object.values(LANDMARKS).some(
    (mark) => box.x < mark.x + 130 && box.x + box.w > mark.x - 130 && box.y < mark.y + 110 && box.y + box.h > mark.y - 110,
  );
}

function overlaps(a, b, pad) {
  return a.x < b.x + b.w + pad && a.x + a.w + pad > b.x && a.y < b.y + b.h + pad && a.y + a.h + pad > b.y;
}

/** True when a point is on a road (inside the asphalt, not the sidewalk). */
export function isOnRoad(x, y) {
  const half = ROADS.width / 2;
  return ROADS.vertical.some((vx) => Math.abs(x - vx) < half) || ROADS.horizontal.some((hy) => Math.abs(y - hy) < half);
}

/** True when a point is in the sea (west of the sand). */
export function isInWater(x, y) {
  return x < COAST.waterEnd;
}

/** True when a point is on a sidewalk strip beside a road. */
export function isOnSidewalk(x, y) {
  const half = ROADS.width / 2;
  const near = (v) => Math.abs(v) >= half && Math.abs(v) < half + 22;
  return ROADS.vertical.some((vx) => near(x - vx) && y > 40 && y < WORLD.height - 40)
    || ROADS.horizontal.some((hy) => near(y - hy) && x > COAST.sandEnd && x < WORLD.width - 40);
}

/** The nearest point on a road centreline to (x, y), for spawning and respawning cars. */
export function nearestRoadPoint(x, y, random) {
  let best = null;
  let bestDistance = Infinity;
  for (const vx of ROADS.vertical) {
    const d = Math.abs(x - vx);
    if (d < bestDistance) { bestDistance = d; best = { x: vx, y, vertical: true }; }
  }
  for (const hy of ROADS.horizontal) {
    const d = Math.abs(y - hy);
    if (d < bestDistance) { bestDistance = d; best = { x, y: hy, vertical: false }; }
  }
  if (best.vertical) best.y = Math.max(80, Math.min(WORLD.height - 80, best.y));
  else best.x = Math.max(COAST.sandEnd + 60, Math.min(WORLD.width - 80, best.x));
  if (random) {
    best.x += (random() - 0.5) * 30;
    best.y += (random() - 0.5) * 30;
  }
  return best;
}

/** Push a circle (x, y, radius) out of every building it overlaps; returns true if it hit one. */
export function collideBuildings(city, body, radius) {
  let hit = false;
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(body.x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(body.y, b.y + b.h));
    const dx = body.x - cx;
    const dy = body.y - cy;
    const distSq = dx * dx + dy * dy;
    if (distSq >= radius * radius) continue;
    hit = true;
    if (distSq === 0) { body.x = b.x - radius; continue; }
    const dist = Math.sqrt(distSq);
    body.x += (dx / dist) * (radius - dist);
    body.y += (dy / dist) * (radius - dist);
  }
  return hit;
}
