// The game's rules and state, with no drawing and no browser in it: the player on foot
// and behind the wheel, the traffic, the pedestrians, the Harbor crew, the police and
// the wanted level, the bullets, and the story's progress. step() advances one fixed
// step and returns what happened as bit flags, so the caller can react — sounds, toasts,
// screens — without the world knowing about them. Nothing here allocates after boot
// except bullets and the occasional respawn.

import { CAR, PED_COUNT, PLAYER, SAVE_KEY, TRAFFIC_COUNT, WANTED, WORLD } from './config.js';
import { LANDMARKS, createCity, collideBuildings, isInWater } from './city.js';
import { collideCars, driveCar, spawnParkedCars, spawnTrafficCar, stepTraffic } from './vehicles.js';
import { makePed, scarePeds, stepPed } from './peds.js';
import { addWanted, checkBusted, coolWanted, createPolice, maintainPatrol, stepPoliceCar } from './police.js';
import {
  advanceDialogue, createMissions, currentDialogueLine, currentMission, currentObjective, currentStep,
  isDialogue, missionIntro, startDialogue, updateMissions,
} from './missions.js';

export const EVENT_SHOT = 1;
export const EVENT_HIT = 2;
export const EVENT_CASH = 4;
export const EVENT_BUSTED = 8;
export const EVENT_WASTED = 16;
export const EVENT_MISSION = 32;
export const EVENT_ALARM = 64;
export const EVENT_SAVED = 128;
export const EVENT_STEAL = 256;
export const EVENT_CRASH = 512;
export const EVENT_DIALOGUE = 1024;

const THUG_COUNT = 4;
const THUG_HEALTH = 70;
const SAFEHOUSE_RADIUS = 130;

export function createWorld(random) {
  const city = createCity(random);
  const police = createPolice();
  const missions = createMissions();
  const player = {
    x: LANDMARKS.safehouse.x + 60, y: LANDMARKS.safehouse.y + 40,
    angle: 0, health: PLAYER.health, inCar: null, fireTimer: 0,
    hurtTimer: 0, regenTimer: 0, speed: 0,
  };
  const state = {
    player, city, police, missions,
    cars: [], peds: [], thugs: [], bullets: [],
    cash: 0, elapsed: 0, thugsSpawned: false,
    toast: '', toastTimer: 0,
    dialogueJustClosed: false,
  };

  function allCars() {
    return [...state.cars, ...police.cars, ...(player.inCar ? [player.inCar] : [])];
  }

  function reset() {
    player.x = LANDMARKS.safehouse.x + 60;
    player.y = LANDMARKS.safehouse.y + 40;
    player.angle = 0;
    player.health = PLAYER.health;
    player.inCar = null;
    player.fireTimer = 0;
    state.cash = 0;
    state.elapsed = 0;
    state.cars = [...spawnParkedCars(random)];
    for (let i = 0; i < TRAFFIC_COUNT; i += 1) state.cars.push(spawnTrafficCar(random, city));
    state.peds = [];
    for (let i = 0; i < PED_COUNT; i += 1) state.peds.push(makePed(random));
    state.thugs = [];
    state.bullets = [];
    state.thugsSpawned = false;
    police.wanted = 0;
    police.cars = [];
    police.coolTimer = 0;
    police.bustTimer = 0;
    state.toast = '';
    state.toastTimer = 0;
    startDialogue(missions, missionIntro(missions));
  }

  function nearestCar(maxDist) {
    let best = null;
    let bestDist = maxDist;
    for (const car of [...state.cars, ...police.cars]) {
      const d = Math.hypot(car.x - player.x, car.y - player.y);
      if (d < bestDist) { bestDist = d; best = car; }
    }
    return best;
  }

  function enterCar(car) {
    if (car.kind === 'parked' || car.kind === 'traffic' || car.kind === 'police') {
      addWanted(police, WANTED.steal);
      state.toast = car.kind === 'police' ? 'You stole a patrol car!' : 'Car stolen — the heat is on';
      state.toastTimer = 2.5;
    }
    state.cars = state.cars.filter((c) => c !== car);
    police.cars = police.cars.filter((c) => c !== car);
    car.kind = 'player';
    player.inCar = car;
    player.x = car.x;
    player.y = car.y;
  }

  function exitCar() {
    const car = player.inCar;
    if (!car) return;
    player.inCar = null;
    const side = { x: car.x + Math.cos(car.angle + Math.PI / 2) * 40, y: car.y + Math.sin(car.angle + Math.PI / 2) * 40 };
    player.x = side.x;
    player.y = side.y;
    car.speed = 0;
    car.kind = 'parked';
    state.cars.push(car);
  }

  function fireBullet(fromX, fromY, angle, fromPlayer, damage) {
    state.bullets.push({
      x: fromX + Math.cos(angle) * 20, y: fromY + Math.sin(angle) * 20,
      vx: Math.cos(angle) * PLAYER.bulletSpeed, vy: Math.sin(angle) * PLAYER.bulletSpeed,
      life: 0.9, fromPlayer, damage,
    });
  }

  function spawnThugs() {
    state.thugs = [];
    for (let i = 0; i < THUG_COUNT; i += 1) {
      const angle = (i / THUG_COUNT) * Math.PI * 2;
      state.thugs.push({
        x: LANDMARKS.pier.x + Math.cos(angle) * 120,
        y: LANDMARKS.pier.y + Math.sin(angle) * 120,
        health: THUG_HEALTH, fireTimer: 0.6 + i * 0.4, angle: 0,
      });
    }
    state.thugsSpawned = true;
    state.toast = 'The Harbor crew is here — deal with them';
    state.toastTimer = 3;
  }

  function saveGame() {
    try {
      window.localStorage.setItem(SAVE_KEY, JSON.stringify({
        cash: state.cash,
        missionIndex: missions.index,
        playerX: player.x, playerY: player.y,
        health: player.health,
      }));
      return true;
    } catch {
      return false;
    }
  }

  function loadSave() {
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function applySave(save) {
    state.cash = save.cash ?? 0;
    missions.index = Math.min(save.missionIndex ?? 0, 3);
    missions.stepIndex = 0;
    missions.finished = false;
    player.x = save.playerX ?? LANDMARKS.safehouse.x;
    player.y = save.playerY ?? LANDMARKS.safehouse.y;
    player.health = save.health ?? PLAYER.health;
    player.inCar = null;
    if (missions.index > 0) startDialogue(missions, missionIntro(missions));
  }

  function stepPlayerOnFoot(dt, input, aimAngle, actions) {
    const dir = input.direction();
    const speed = input.running() ? PLAYER.runSpeed : PLAYER.walkSpeed;
    const moving = dir.x !== 0 || dir.y !== 0;
    player.speed = moving ? speed : 0;
    player.angle = aimAngle;
    const nx = player.x + dir.x * speed * dt;
    const ny = player.y + dir.y * speed * dt;
    const next = { x: nx, y: player.y };
    if (!collideBuildings(city, next, PLAYER.radius) && !isInWater(next.x, next.y)) player.x = nx;
    const nextY = { x: player.x, y: ny };
    if (!collideBuildings(city, nextY, PLAYER.radius) && !isInWater(nextY.x, nextY.y)) player.y = ny;
    player.x = Math.max(20, Math.min(WORLD.width - 20, player.x));
    player.y = Math.max(20, Math.min(WORLD.height - 20, player.y));

    player.fireTimer -= dt;
    if ((actions.shoot || input.mouse().down) && player.fireTimer <= 0) {
      player.fireTimer = PLAYER.fireInterval;
      fireBullet(player.x, player.y, aimAngle, true, PLAYER.bulletDamage);
      addWanted(police, 0); // firing alone is not a crime; hitting someone is
      scarePeds(state.peds, player.x, player.y, 420);
      return EVENT_SHOT;
    }
    return 0;
  }

  function stepDriving(dt, input) {
    const car = player.inCar;
    const before = Math.abs(car.speed);
    const result = driveCar(car, dt, input.throttle(), input.steering(), city);
    player.x = car.x;
    player.y = car.y;
    player.angle = car.angle;
    player.speed = Math.abs(car.speed);
    let events = 0;
    if (result.crashed && before > 260) {
      car.health -= 12;
      events |= EVENT_CRASH;
      if (car.health <= 0) {
        car.speed = 0;
        state.toast = 'Your ride is wrecked';
        state.toastTimer = 2.5;
      }
    }
    return events;
  }

  function stepBullets(dt) {
    let events = 0;
    for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
      const bullet = state.bullets[i];
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      bullet.life -= dt;
      let dead = bullet.life <= 0 || isInWater(bullet.x, bullet.y);
      if (!dead) {
        const body = { x: bullet.x, y: bullet.y };
        if (collideBuildings(city, body, 2)) dead = true;
      }
      if (!dead && bullet.fromPlayer) {
        for (let t = state.thugs.length - 1; t >= 0; t -= 1) {
          const thug = state.thugs[t];
          if (Math.hypot(thug.x - bullet.x, thug.y - bullet.y) < 16) {
            thug.health -= bullet.damage;
            dead = true;
            events |= EVENT_HIT;
            if (thug.health <= 0) {
              state.thugs.splice(t, 1);
              state.cash += 25;
              events |= EVENT_CASH;
            }
            break;
          }
        }
      }
      if (!dead && bullet.fromPlayer) {
        for (let p = state.peds.length - 1; p >= 0; p -= 1) {
          const ped = state.peds[p];
          if (Math.hypot(ped.x - bullet.x, ped.y - bullet.y) < 14) {
            state.peds.splice(p, 1);
            addWanted(police, WANTED.hitPed);
            scarePeds(state.peds, bullet.x, bullet.y, 420);
            dead = true;
            break;
          }
        }
      }
      if (!dead && bullet.fromPlayer) {
        for (const car of allCars()) {
          if (car === player.inCar) continue;
          if (Math.hypot(car.x - bullet.x, car.y - bullet.y) < 26) {
            car.health -= bullet.damage;
            if (car.police) addWanted(police, WANTED.ramPolice);
            else addWanted(police, WANTED.shoot);
            if (car.health <= 0) car.speed = 0;
            dead = true;
            events |= EVENT_HIT;
            break;
          }
        }
      }
      if (!dead && !bullet.fromPlayer) {
        if (Math.hypot(player.x - bullet.x, player.y - bullet.y) < PLAYER.radius + 2) {
          hurtPlayer(bullet.damage);
          dead = true;
        }
      }
      if (dead) state.bullets.splice(i, 1);
    }
    return events;
  }

  function hurtPlayer(amount) {
    if (player.hurtTimer > 0) return;
    player.health -= amount;
    player.hurtTimer = 0.5;
    player.regenTimer = 0;
  }

  function stepThugs(dt) {
    for (const thug of state.thugs) {
      const dx = player.x - thug.x;
      const dy = player.y - thug.y;
      const dist = Math.hypot(dx, dy);
      thug.angle = Math.atan2(dy, dx);
      if (dist > 260) {
        thug.x += (dx / dist) * 120 * dt;
        thug.y += (dy / dist) * 120 * dt;
      } else if (dist < 140) {
        thug.x -= (dx / dist) * 60 * dt;
        thug.y -= (dy / dist) * 60 * dt;
      }
      thug.fireTimer -= dt;
      if (thug.fireTimer <= 0 && dist < 520) {
        thug.fireTimer = 1.3 + random() * 0.7;
        fireBullet(thug.x, thug.y, thug.angle + (random() - 0.5) * 0.2, false, 9);
      }
    }
  }

  function step(dt, input, aimAngle, actions) {
    let events = 0;
    state.elapsed += dt;
    if (state.toastTimer > 0) state.toastTimer -= dt;
    if (player.hurtTimer > 0) player.hurtTimer -= dt;
    player.regenTimer += dt;
    if (player.regenTimer > 6 && player.health > 0 && player.health < PLAYER.health) {
      player.health = Math.min(PLAYER.health, player.health + 3 * dt);
    }

    const dialogueOpen = isDialogue(missions);
    if (actions.interact && dialogueOpen) {
      if (advanceDialogue(missions)) events |= EVENT_DIALOGUE;
      actions.interact = false;
      actions.confirm = false;
    } else if (actions.confirm && dialogueOpen) {
      if (advanceDialogue(missions)) events |= EVENT_DIALOGUE;
      actions.confirm = false;
    }

    // The story: spawn the Harbor crew when the pier fight begins.
    const stepNow = currentStep(missions);
    if (!state.thugsSpawned && stepNow && stepNow.type === 'defeat') spawnThugs();
    if (state.thugsSpawned && stepNow && stepNow.type !== 'defeat') state.thugsSpawned = false;

    if (!dialogueOpen) {
      if (player.inCar) {
        events |= stepDriving(dt, input);
      } else {
        events |= stepPlayerOnFoot(dt, input, aimAngle, actions);
      }
      if (actions.interact) {
        if (player.inCar) {
          exitCar();
        } else {
          const nearSafehouse = Math.hypot(player.x - LANDMARKS.safehouse.x, player.y - LANDMARKS.safehouse.y) < SAFEHOUSE_RADIUS;
          if (nearSafehouse) {
            player.health = PLAYER.health;
            if (saveGame()) {
              state.toast = 'Game saved at the Safehouse';
              state.toastTimer = 2.5;
              events |= EVENT_SAVED;
            }
          } else {
            const car = nearestCar(70);
            if (car) {
              const wasParked = car.kind === 'parked' || car.kind === 'traffic';
              enterCar(car);
              if (wasParked) events |= EVENT_STEAL;
            }
          }
        }
      }
    }

    // Traffic keeps flowing; respawn cars that wandered far from the player.
    for (const car of state.cars) {
      if (car.kind === 'traffic') stepTraffic(car, dt, city, state.cars, random);
    }
    for (let i = state.cars.length - 1; i >= 0; i -= 1) {
      const car = state.cars[i];
      if (car.kind === 'traffic' && Math.hypot(car.x - player.x, car.y - player.y) > 1500) {
        state.cars[i] = spawnTrafficCar(random, city);
      }
    }
    if (state.peds.length < PED_COUNT) {
      for (let i = state.peds.length; i < PED_COUNT; i += 1) {
        const ped = makePed(random);
        ped.x = player.x + (random() - 0.5) * 1200;
        ped.y = player.y + (random() - 0.5) * 900;
        state.peds.push(ped);
      }
    }
    for (const ped of state.peds) stepPed(ped, dt, random);

    // The player's car running someone over.
    if (player.inCar && Math.abs(player.inCar.speed) > 170) {
      for (let p = state.peds.length - 1; p >= 0; p -= 1) {
        const ped = state.peds[p];
        if (Math.hypot(ped.x - player.x, ped.y - player.y) < 30) {
          state.peds.splice(p, 1);
          addWanted(police, WANTED.hitPed);
          scarePeds(state.peds, player.x, player.y, 420);
          events |= EVENT_CRASH;
        }
      }
    }

    // Car-on-car collisions, including police rams.
    const cars = allCars();
    for (let a = 0; a < cars.length; a += 1) {
      for (let b = a + 1; b < cars.length; b += 1) {
        const impact = collideCars(cars[a], cars[b]);
        if (impact > 220) {
          events |= EVENT_CRASH;
          if (cars[a].police || cars[b].police) addWanted(police, WANTED.ramPolice);
          const playerCar = cars[a] === player.inCar ? cars[a] : cars[b] === player.inCar ? cars[b] : null;
          if (playerCar && impact > 320) {
            playerCar.health -= 8;
            hurtPlayer(6);
          }
        }
      }
    }

    stepThugs(dt);
    events |= stepBullets(dt);

    // The police: patrol strength follows the heat, and the Safehouse hides the player.
    const nearSafehouse = Math.hypot(player.x - LANDMARKS.safehouse.x, player.y - LANDMARKS.safehouse.y) < SAFEHOUSE_RADIUS;
    if (nearSafehouse && police.wanted > 0) {
      police.wanted = Math.max(0, police.wanted - 1.2 * dt);
      police.coolTimer = 0;
    }
    maintainPatrol(police, player.x, player.y, random);
    let nearestPolice = null;
    for (const car of police.cars) {
      const dist = stepPoliceCar(car, dt, player, city);
      if (nearestPolice === null || dist < nearestPolice) nearestPolice = dist;
    }
    if (!nearSafehouse) coolWanted(police, dt, nearestPolice);
    if (checkBusted(police, dt, !player.inCar, nearestPolice)) events |= EVENT_BUSTED;

    // The story advances on what the player just did.
    const missionEvent = updateMissions(missions, {
      playerX: player.x, playerY: player.y,
      inCar: Boolean(player.inCar),
      thugsLeft: state.thugs.length,
      wanted: police.wanted,
    }, dt);
    if (missionEvent) {
      if (missionEvent.event === 'missionComplete') {
        state.cash += missionEvent.cash;
        state.toast = `Mission complete — $${missionEvent.cash}`;
        state.toastTimer = 3.5;
        saveGame();
        events |= EVENT_MISSION;
        const intro = missionIntro(missions);
        if (intro) startDialogue(missions, intro);
      }
      if (missionEvent.alarm) {
        addWanted(police, 2);
        state.toast = 'The alarm is up — lose the heat!';
        state.toastTimer = 3;
        events |= EVENT_ALARM;
      }
    }

    if (player.health <= 0) events |= EVENT_WASTED;
    return events;
  }

  reset();
  return {
    state, reset, step, saveGame, loadSave, applySave,
    objective: () => currentObjective(missions),
    dialogueLine: () => currentDialogueLine(missions),
  };
}
