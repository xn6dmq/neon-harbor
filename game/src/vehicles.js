// Cars: the player's ride and the traffic. A car is a heading, a speed along it and a
// little lateral grip, so driving feels like steering a weight rather than sliding a
// cursor. Traffic cars pick a road, follow its centreline and turn at intersections;
// both kinds bounce off buildings and each other with a simple circle test.

import { CAR, ROADS, WORLD } from './config.js';
import { collideBuildings, isInWater, isOnRoad, nearestRoadPoint } from './city.js';
import { intBetween, pick } from './rng.js';

/** Paint jobs for traffic and parked cars; the player's stolen cars keep theirs. */
export const CAR_COLORS = ['#c94f43', '#4f7dc9', '#e8b93c', '#7dc94f', '#9b6bc9', '#d8d3c4', '#3aa88f'];
export const POLICE_COLOR = '#2f6fd0';

export function makeCar(x, y, angle, color, kind = 'traffic') {
  return {
    kind, x, y, angle, speed: 0, color,
    health: CAR.health,
    // Traffic only: which road it follows and which way along it.
    vertical: null, direction: 1, targetSpeed: 0, waitTimer: 0,
    // Police only, set by police.js.
    police: false,
  };
}

/** Put a car on a random road, facing along it, at a cruise speed. */
export function spawnTrafficCar(random, city) {
  const point = nearestRoadPoint(
    COAST_SAND + 200 + random() * (WORLD.width - 500),
    200 + random() * (WORLD.height - 400),
    random,
  );
  const vertical = point.vertical;
  const direction = random() < 0.5 ? 1 : -1;
  const car = makeCar(point.x, point.y, vertical ? (direction > 0 ? Math.PI / 2 : -Math.PI / 2) : (direction > 0 ? 0 : Math.PI), pick(random, CAR_COLORS));
  car.vertical = vertical;
  car.direction = direction;
  car.targetSpeed = 150 + random() * 90;
  car.speed = car.targetSpeed;
  return car;
}

const COAST_SAND = 330;

/** One fixed step of arcade driving: throttle along the heading, steering that bites
 *  harder the faster the car goes, grip that pulls velocity back to the heading. */
export function driveCar(car, dt, throttle, steer, city) {
  const onRoad = isOnRoad(car.x, car.y);
  const grip = onRoad ? 1 : CAR.offRoadFactor;
  const accel = throttle > 0 ? CAR.accel : CAR.reverseAccel;
  car.speed += throttle * accel * grip * dt;
  car.speed -= car.speed * 0.55 * dt;
  if (car.speed > CAR.maxSpeed * grip) car.speed = CAR.maxSpeed * grip;
  if (car.speed < -CAR.maxReverse) car.speed = -CAR.maxReverse;
  const steerRate = CAR.steer * Math.min(1, Math.abs(car.speed) / 160) * Math.sign(car.speed || 1);
  car.angle += steer * steerRate * dt;
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const next = { x: nx, y: ny };
  const radius = CAR.length / 2 - 4;
  const hitBuilding = collideBuildings(city, next, radius);
  if (hitBuilding) {
    car.speed *= -0.25;
    car.x = next.x;
    car.y = next.y;
    return { crashed: true, hard: Math.abs(car.speed) > 200 };
  }
  if (isInWater(nx, ny)) {
    car.speed *= 0.2;
    return { crashed: true, hard: false };
  }
  car.x = nx;
  car.y = ny;
  car.x = Math.max(30, Math.min(WORLD.width - 30, car.x));
  car.y = Math.max(30, Math.min(WORLD.height - 30, car.y));
  return { crashed: false, hard: false };
}

/** Traffic AI: cruise along the current road; at an intersection, sometimes turn onto
 *  the crossing road; slow down for the car ahead; stop briefly after a bump. */
export function stepTraffic(car, dt, city, cars, random) {
  if (car.waitTimer > 0) {
    car.waitTimer -= dt;
    car.speed = Math.max(0, car.speed - 400 * dt);
  } else {
    car.speed += (car.targetSpeed - car.speed) * 0.5 * dt;
  }
  const ahead = carAhead(car, cars);
  if (ahead !== null && ahead < 70) car.speed = Math.max(0, car.speed - 500 * dt);

  const turn = maybeTurn(car, random);
  if (turn) {
    car.vertical = !car.vertical;
    car.direction = turn;
    car.angle = car.vertical ? (turn > 0 ? Math.PI / 2 : -Math.PI / 2) : (turn > 0 ? 0 : Math.PI);
  }
  const dx = Math.cos(car.angle) * car.speed * dt;
  const dy = Math.sin(car.angle) * car.speed * dt;
  const next = { x: car.x + dx, y: car.y + dy };
  if (!collideBuildings(city, next, CAR.length / 2 - 4) && !isInWater(next.x, next.y)) {
    car.x = next.x;
    car.y = next.y;
  } else {
    car.speed = 0;
    car.waitTimer = 0.8;
  }
  // Keep the car glued to its road's centreline (a little drift is fine).
  if (car.vertical) {
    const road = nearestVertical(car.x);
    car.x += (road - car.x) * 0.4 * dt;
    car.y = Math.max(60, Math.min(WORLD.height - 60, car.y));
  } else {
    const road = nearestHorizontal(car.y);
    car.y += (road - car.y) * 0.4 * dt;
    car.x = Math.max(COAST_SAND + 40, Math.min(WORLD.width - 60, car.x));
  }
}

function carAhead(car, cars) {
  let nearest = null;
  const fx = Math.cos(car.angle);
  const fy = Math.sin(car.angle);
  for (const other of cars) {
    if (other === car) continue;
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const along = dx * fx + dy * fy;
    if (along < 0 || along > 260) continue;
    const side = Math.abs(-dx * fy + dy * fx);
    if (side > 40) continue;
    if (nearest === null || along < nearest) nearest = along;
  }
  return nearest;
}

function maybeTurn(car, random) {
  const atIntersection = car.vertical
    ? ROADS.horizontal.some((hy) => Math.abs(car.y - hy) < 14)
    : ROADS.vertical.some((vx) => Math.abs(car.x - vx) < 14);
  if (!atIntersection || random() > 0.004) return 0;
  return random() < 0.5 ? 1 : -1;
}

function nearestVertical(x) {
  let best = ROADS.vertical[0];
  for (const vx of ROADS.vertical) if (Math.abs(vx - x) < Math.abs(best - x)) best = vx;
  return best;
}

function nearestHorizontal(y) {
  let best = ROADS.horizontal[0];
  for (const hy of ROADS.horizontal) if (Math.abs(hy - y) < Math.abs(best - y)) best = hy;
  return best;
}

/** Circle test between two cars; pushes both apart and returns the impact speed. */
export function collideCars(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.hypot(dx, dy);
  const min = CAR.length - 6;
  if (dist >= min || dist === 0) return 0;
  const push = (min - dist) / 2;
  const nx = dx / dist;
  const ny = dy / dist;
  a.x -= nx * push;
  a.y -= ny * push;
  b.x += nx * push;
  b.y += ny * push;
  const impact = Math.abs(a.speed - b.speed);
  const aSpeed = a.speed;
  a.speed = b.speed * 0.4;
  b.speed = aSpeed * 0.4;
  return impact;
}

/** Parked cars the player can steal, placed on roadside spots near the story. */
export function spawnParkedCars(random) {
  const spots = [
    { x: 470, y: 430, angle: Math.PI / 2, color: '#e8b93c' },
    { x: 970, y: 880, angle: 0, color: '#4f7dc9' },
    { x: 1470, y: 1330, angle: Math.PI, color: '#c94f43' },
    { x: 1970, y: 1780, angle: -Math.PI / 2, color: '#7dc94f' },
    { x: 2470, y: 430, angle: 0, color: '#d8d3c4' },
    { x: 2970, y: 2230, angle: Math.PI / 2, color: '#9b6bc9' },
    { x: 970, y: 2230, angle: Math.PI, color: '#3aa88f' },
  ];
  return spots.map((spot) => {
    const car = makeCar(spot.x, spot.y, spot.angle, spot.color, 'parked');
    return car;
  });
}

/** A random parked car, for respawning stealable rides far from the player. */
export function randomParkedSpot(random) {
  const road = pick(random, ROADS.vertical);
  const y = intBetween(random, 300, WORLD.height - 300);
  return makeCar(road + 44, y, Math.PI / 2, pick(random, CAR_COLORS), 'parked');
}
