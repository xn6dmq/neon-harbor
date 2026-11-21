// NEON HARBOR — every tuning number, colour and layout constant in one place.
// Port Aurelia is a fixed-size world (3600 x 2600 px) drawn top-down; the renderer
// scales the 1280x720 view to the window, so no rule below depends on the screen size.

export const WORLD = { width: 3600, height: 2600 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** Road centrelines: the grid the city, the traffic and the missions all share. */
export const ROADS = {
  vertical: [420, 920, 1420, 1920, 2420, 2920],
  horizontal: [380, 830, 1280, 1730, 2180],
  width: 116,
  lane: 30,
};

/** The coast on the west edge: water, then sand, then the palm-lined promenade. */
export const COAST = { waterEnd: 230, sandEnd: 330 };

export const PLAYER = {
  radius: 13,
  walkSpeed: 170,
  runSpeed: 285,
  health: 100,
  fireInterval: 0.16,
  bulletSpeed: 780,
  bulletDamage: 34,
};

export const CAR = {
  length: 52,
  width: 26,
  accel: 420,
  brake: 620,
  reverseAccel: 260,
  maxSpeed: 560,
  maxReverse: 170,
  steer: 2.6,
  grip: 3.2,
  offRoadFactor: 0.45,
  health: 100,
};

export const TRAFFIC_COUNT = 14;
export const PED_COUNT = 26;
export const MAX_WANTED = 5;

/** Seconds out of every police car's sight before the heat starts to cool. */
export const WANTED = {
  steal: 1,
  shoot: 1,
  hitPed: 2,
  ramPolice: 1,
  coolDelay: 6,
  coolRate: 0.25,
  bustDistance: 78,
  bustTime: 1.6,
};

export const PALETTE = {
  water: '#1e7fa8',
  waterDeep: '#14607f',
  sand: '#e8d39a',
  grass: '#7fae5a',
  block: '#b9b3a4',
  sidewalk: '#c9c4b2',
  road: '#3a3f47',
  roadLine: '#e8d44d',
  building: '#5d6b7a',
  buildingRoof: '#7d8b9c',
  buildingAccent: '#e2725b',
  palm: '#2f7d4f',
  palmTrunk: '#8a6b48',
  player: '#ffd23f',
  ped: '#e8e4da',
  police: '#2f6fd0',
  policeLight: '#ff3b30',
  traffic: '#c94f43',
  objective: '#ff5fa2',
  safehouse: '#3ddc84',
  text: '#f2f0e8',
  muted: '#9aa3ad',
  panel: 'rgba(12, 16, 24, 0.82)',
  panelEdge: 'rgba(255, 255, 255, 0.16)',
  minimapBg: 'rgba(10, 14, 20, 0.78)',
  health: '#3ddc84',
  healthLow: '#ff5a4e',
  star: '#ffd23f',
  starEmpty: 'rgba(255, 255, 255, 0.25)',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where a saved game is kept between visits (this browser only). */
export const SAVE_KEY = 'neon-harbor.save.v1';

/** Mission rewards, in dollars, in story order. */
export const MISSION_REWARDS = [200, 450, 650, 1500];
