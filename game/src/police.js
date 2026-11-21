// The wanted level and the Aurelia police. Heat rises when the player steals, shoots
// or runs someone over, and cools when no patrol can see them. Patrol cars spawn on the
// roads near the player, chase the player's car or the player on foot, and ram to stop
// them; cornered on foot, the player is busted.

import { MAX_WANTED, ROADS, WANTED, WORLD } from './config.js';
import { makeCar, POLICE_COLOR } from './vehicles.js';
import { collideBuildings, isInWater, nearestRoadPoint } from './city.js';
import { pick } from './rng.js';

export function createPolice() {
  return {
    wanted: 0,
    cars: [],
    coolTimer: 0,
    bustTimer: 0,
    sirenOn: false,
  };
}

/** Add heat, capped at five stars. Shooting, stealing and hurting people all count. */
export function addWanted(police, amount) {
  police.wanted = Math.min(MAX_WANTED, police.wanted + amount);
  police.coolTimer = 0;
}

/** How many patrol cars the current heat calls for. */
export function wantedCarCount(wanted) {
  return wanted === 0 ? 0 : Math.min(1 + wanted, 6);
}

function spawnPoliceCar(police, playerX, playerY, random) {
  const angle = random() * Math.PI * 2;
  const dist = 700 + random() * 300;
  const point = nearestRoadPoint(playerX + Math.cos(angle) * dist, playerY + Math.sin(angle) * dist, random);
  const car = makeCar(point.x, point.y, random() * Math.PI * 2, POLICE_COLOR, 'police');
  car.police = true;
  car.targetSpeed = 0;
  police.cars.push(car);
  return car;
}

/** Keep the patrol at the strength the heat demands, spawning on nearby roads. */
export function maintainPatrol(police, playerX, playerY, random) {
  const want = wantedCarCount(police.wanted);
  while (police.cars.length < want) spawnPoliceCar(police, playerX, playerY, random);
  while (police.cars.length > want) police.cars.pop();
}

/** A patrol car steers at the player and rams; off-road it still closes in, slower. */
export function stepPoliceCar(car, dt, target, city) {
  const dx = target.x - car.x;
  const dy = target.y - car.y;
  const dist = Math.hypot(dx, dy) || 1;
  const wantAngle = Math.atan2(dy, dx);
  let diff = wantAngle - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  car.angle += Math.max(-3.4 * dt, Math.min(3.4 * dt, diff));
  const speedTarget = dist > 320 ? 520 : 430;
  car.speed += (speedTarget - car.speed) * 0.8 * dt;
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const next = { x: nx, y: ny };
  const hit = collideBuildings(city, next, 22);
  if (!hit && !isInWater(nx, ny)) {
    car.x = nx;
    car.y = ny;
  } else {
    car.speed *= 0.4;
    car.angle += 0.6 * dt;
  }
  car.x = Math.max(30, Math.min(WORLD.width - 30, car.x));
  car.y = Math.max(30, Math.min(WORLD.height - 30, car.y));
  return dist;
}

/** Heat cools only while no patrol car is close enough to see the player. */
export function coolWanted(police, dt, nearestPoliceDistance) {
  if (police.wanted === 0) return;
  if (nearestPoliceDistance !== null && nearestPoliceDistance < 650) {
    police.coolTimer = 0;
    return;
  }
  police.coolTimer += dt;
  if (police.coolTimer > WANTED.coolDelay) {
    police.wanted = Math.max(0, police.wanted - WANTED.coolRate * dt);
  }
}

/** On foot, a patrol car sitting on the player for a moment means an arrest. */
export function checkBusted(police, dt, playerOnFoot, nearestPoliceDistance) {
  if (!playerOnFoot || police.wanted === 0) {
    police.bustTimer = 0;
    return false;
  }
  if (nearestPoliceDistance !== null && nearestPoliceDistance < WANTED.bustDistance) {
    police.bustTimer += dt;
    return police.bustTimer > WANTED.bustTime;
  }
  police.bustTimer = 0;
  return false;
}

/** A random patrol route name for the HUD flavour line. */
export function patrolCallsign(random) {
  return pick(random, ['Unit 7', 'Unit 12', 'Unit 23', 'Unit 31', 'Unit 44']);
}
