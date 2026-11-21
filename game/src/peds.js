// Pedestrians: the people of Port Aurelia. They stroll the sidewalks between random
// corners, chat in place sometimes, and run from danger — a gunshot, a speeding car, a
// police chase nearby sends them scattering away from it.

import { ROADS, WORLD } from './config.js';
import { COAST } from './config.js';
import { isOnSidewalk } from './city.js';
import { intBetween, pick } from './rng.js';

const PED_COLORS = ['#e8e4da', '#c9a86a', '#7fb3d5', '#d58a7f', '#9db38a', '#b39ddb'];
const WALK_SPEED = 55;
const FLEE_SPEED = 210;

/** A random sidewalk corner to stroll between. */
export function randomSidewalkPoint(random) {
  const vertical = random() < 0.5;
  if (vertical) {
    const vx = pick(random, ROADS.vertical);
    const side = random() < 0.5 ? -1 : 1;
    return { x: vx + side * (ROADS.width / 2 + 12), y: intBetween(random, 120, WORLD.height - 120) };
  }
  const hy = pick(random, ROADS.horizontal);
  const side = random() < 0.5 ? -1 : 1;
  return { x: intBetween(random, COAST.sandEnd + 60, WORLD.width - 120), y: hy + side * (ROADS.width / 2 + 12) };
}

export function makePed(random) {
  const at = randomSidewalkPoint(random);
  const ped = {
    x: at.x, y: at.y,
    angle: random() * Math.PI * 2,
    speed: WALK_SPEED * (0.8 + random() * 0.5),
    color: pick(random, PED_COLORS),
    target: randomSidewalkPoint(random),
    idleTimer: random() * 4,
    fleeing: false,
    fleeTimer: 0,
    panicX: 0, panicY: 0,
  };
  return ped;
}

/** A gunshot, a crash or a chase nearby makes every ped in earshot run away from it. */
export function scarePeds(peds, x, y, radius) {
  for (const ped of peds) {
    const dx = ped.x - x;
    const dy = ped.y - y;
    if (dx * dx + dy * dy < radius * radius) {
      ped.fleeing = true;
      ped.fleeTimer = 2.5 + Math.random() * 1.5;
      ped.panicX = x;
      ped.panicY = y;
    }
  }
}

export function stepPed(ped, dt, random) {
  if (ped.fleeTimer > 0) {
    ped.fleeTimer -= dt;
    if (ped.fleeTimer <= 0) ped.fleeing = false;
  }
  if (ped.idleTimer > 0) {
    ped.idleTimer -= dt;
    return;
  }
  let tx;
  let ty;
  let speed = ped.speed;
  if (ped.fleeing) {
    const dx = ped.x - ped.panicX;
    const dy = ped.y - ped.panicY;
    const dist = Math.hypot(dx, dy) || 1;
    tx = ped.x + (dx / dist) * 200;
    ty = ped.y + (dy / dist) * 200;
    speed = FLEE_SPEED;
  } else {
    tx = ped.target.x;
    ty = ped.target.y;
  }
  const dx = tx - ped.x;
  const dy = ty - ped.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 12) {
    if (ped.fleeing) {
      ped.fleeing = false;
      ped.idleTimer = 0.5 + random() * 2;
    } else {
      ped.target = randomSidewalkPoint(random);
      if (random() < 0.25) ped.idleTimer = 1 + random() * 3;
    }
    return;
  }
  ped.angle = Math.atan2(dy, dx);
  ped.x += (dx / dist) * speed * dt;
  ped.y += (dy / dist) * speed * dt;
  ped.x = Math.max(COAST.sandEnd + 8, Math.min(WORLD.width - 12, ped.x));
  ped.y = Math.max(12, Math.min(WORLD.height - 12, ped.y));
  if (!isOnSidewalk(ped.x, ped.y) && !ped.fleeing) {
    // Drifted off the pavement (a corner cut): head for the nearest sidewalk point.
    ped.target = randomSidewalkPoint(random);
  }
}
