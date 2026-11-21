// The screenshot scenes behind ?shot=cover|foot|chase|mission. Each one poses the real
// world — no separate mock scene — so the frame is what the game really looks like, and
// the same seed always gives the same frame. The loop never runs; the scene is painted
// twice and window.__shotReady is set for the capture script.

import { LANDMARKS } from './city.js';
import { SCREEN_PLAY } from './render.js';
import { makeCar } from './vehicles.js';

function clearDialogue(world) {
  world.state.missions.dialogue = null;
}

function putPlayerInCar(world, x, y, angle, speed) {
  const state = world.state;
  const car = makeCar(x, y, angle, '#c94f43', 'player');
  car.speed = speed;
  state.player.inCar = car;
  state.player.x = x;
  state.player.y = y;
  state.player.angle = angle;
  return car;
}

/** Park traffic cars on the roads around (x, y) so the cover shows a living city. */
function trafficAround(world, x, y) {
  const state = world.state;
  const spots = [
    { x: x - 260, y: y - 40, angle: 0 },
    { x: x + 180, y: y + 58, angle: Math.PI },
    { x: x + 40, y: y - 320, angle: Math.PI / 2 },
    { x: x - 120, y: y + 300, angle: -Math.PI / 2 },
    { x: x + 420, y: y - 40, angle: 0 },
    { x: x - 420, y: y + 58, angle: Math.PI },
  ];
  const colors = ['#4f7dc9', '#e8b93c', '#7dc94f', '#9b6bc9', '#d8d3c4', '#3aa88f'];
  spots.forEach((spot, i) => {
    const car = makeCar(spot.x, spot.y, spot.angle, colors[i % colors.length], 'traffic');
    car.vertical = Math.abs(Math.sin(spot.angle)) > 0.5;
    car.direction = 1;
    car.targetSpeed = 170;
    car.speed = 170;
    state.cars.push(car);
  });
}

function pedsAround(world, x, y) {
  const state = world.state;
  const spots = [
    [-90, -70], [70, -40], [-40, 90], [120, 60], [-160, 30], [30, -130], [180, -90], [-70, 160],
  ];
  spots.forEach(([dx, dy], i) => {
    const ped = state.peds[i % state.peds.length];
    ped.x = x + dx;
    ped.y = y + dy;
    ped.target = { x: x + dx * 2, y: y + dy * 2 };
    ped.idleTimer = 0;
    ped.fleeing = false;
  });
}

/**
 * Set `world` to the named scene and return the screen to draw over it.
 * cover: driving through the city with traffic and the full HUD.
 * foot: on foot among pedestrians on a sidewalk.
 * chase: a three-star police chase with a mission objective on the HUD.
 * mission: a dialogue moment at the Harbor Docks (any other name is the cover).
 */
export function stageShot(name, world) {
  const state = world.state;
  world.reset();
  state.elapsed = 50;
  if (name === 'foot') {
    clearDialogue(world);
    state.player.x = 992;
    state.player.y = 952;
    state.player.angle = -0.6;
    pedsAround(world, 992, 952);
    return { screen: SCREEN_PLAY };
  }
  if (name === 'chase') {
    clearDialogue(world);
    state.missions.index = 1;
    state.missions.stepIndex = 0;
    putPlayerInCar(world, 1420, 1280, Math.PI / 2, 380);
    trafficAround(world, 1420, 1280);
    state.police.wanted = 3;
    const spots = [
      { x: 1420, y: 980, angle: Math.PI / 2 },
      { x: 1362, y: 1560, angle: Math.PI / 2 },
      { x: 1680, y: 1338, angle: Math.PI },
    ];
    for (const spot of spots) {
      const car = makeCar(spot.x, spot.y, spot.angle, '#2f6fd0', 'police');
      car.police = true;
      car.speed = 420;
      state.police.cars.push(car);
    }
    state.toast = 'The patrols are on you — lose them!';
    state.toastTimer = 10;
    return { screen: SCREEN_PLAY };
  }
  if (name === 'mission') {
    // The intro dialogue from reset() stays open: Rook meets Marlow at the docks.
    state.player.x = LANDMARKS.docks.x + 40;
    state.player.y = LANDMARKS.docks.y + 30;
    state.player.angle = Math.PI;
    pedsAround(world, LANDMARKS.docks.x + 120, LANDMARKS.docks.y + 80);
    return { screen: SCREEN_PLAY };
  }
  // cover
  clearDialogue(world);
  putPlayerInCar(world, 920, 1150, Math.PI / 2, 320);
  trafficAround(world, 920, 1150);
  return { screen: SCREEN_PLAY };
}
