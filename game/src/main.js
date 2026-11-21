// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps (several in a slow frame, none in a fast one), and the renderer paints what is
// there. The game moves between five screens: title, play, paused, busted and wasted,
// with the story's dialogue boxes layered over play.
//
// ?seed=N fixes the city and the traffic. ?shot=cover|foot|chase|mission (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { STEP } from './config.js';
import { createRandom } from './rng.js';
import {
  EVENT_ALARM, EVENT_BUSTED, EVENT_CASH, EVENT_CRASH, EVENT_HIT, EVENT_MISSION,
  EVENT_SAVED, EVENT_SHOT, EVENT_STEAL, EVENT_WASTED, createWorld,
} from './world.js';
import { ACTION_CONFIRM, ACTION_INTERACT, ACTION_PAUSE, ACTION_SHOOT, createInput } from './input.js';
import {
  SCREEN_BUSTED, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WASTED, createRenderer,
} from './render.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

/** The HUD's view of the world: objective text and marker, the open dialogue line. */
function buildUi() {
  const objective = world.objective();
  return {
    objective: objective.text,
    objectivePos: objective.x === null ? null : { x: objective.x, y: objective.y },
    dialogue: world.dialogueLine(),
    mouse: null,
    hasSave: Boolean(world.loadSave()),
  };
}

function runShot(name) {
  const scene = stageShot(name, world);
  const ui = buildUi();
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, ui, world.state.elapsed);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let accumulator = 0;
  let last = performance.now();
  let hasSave = Boolean(world.loadSave());
  let newGameKey = false;

  window.addEventListener('keydown', (event) => {
    if ((event.key === 'n' || event.key === 'N') && screen === SCREEN_TITLE && hasSave) newGameKey = true;
  });

  // Screen readers (and anyone watching the page's text) hear the screen changes.
  function announce(message) {
    status.textContent = message;
  }

  function startNewGame() {
    world.reset();
    audio.unlock();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Reach the Harbor Docks to meet Marlow.');
  }

  function continueGame() {
    const save = world.loadSave();
    world.reset();
    if (save) world.applySave(save);
    audio.unlock();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Continued from your save at the Safehouse.');
  }

  function retryAfterEnd() {
    const cash = world.state.cash;
    const missionIndex = world.state.missions.index;
    world.reset();
    world.state.cash = cash;
    world.state.missions.index = missionIndex;
    world.state.missions.stepIndex = 0;
    world.state.missions.dialogue = null;
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Back on the streets of Port Aurelia.');
  }

  function aimAngle() {
    const mouse = input.mouse();
    const logical = renderer.toLogical(mouse.x, mouse.y);
    const cam = renderer.camera(world.state);
    return Math.atan2(cam.y + logical.y - world.state.player.y, cam.x + logical.x - world.state.player.x);
  }

  function react(events) {
    if (events & EVENT_SHOT) audio.shoot();
    if (events & EVENT_HIT) audio.hit();
    if (events & EVENT_CASH) audio.pickup();
    if (events & EVENT_CRASH) audio.crash();
    if (events & EVENT_STEAL) audio.horn();
    if (events & EVENT_SAVED) audio.pickup();
    if (events & EVENT_MISSION) audio.missionDone();
    if (events & EVENT_ALARM) audio.horn();
    if (events & EVENT_BUSTED) {
      screen = SCREEN_BUSTED;
      audio.busted();
      announce('Busted. The patrols caught you.');
    } else if (events & EVENT_WASTED) {
      screen = SCREEN_WASTED;
      audio.busted();
      announce('Wasted. Port Aurelia got the better of you.');
    }
  }

  function handleActions(flags) {
    if (screen === SCREEN_TITLE) {
      if (newGameKey) {
        newGameKey = false;
        startNewGame();
      } else if (flags & (ACTION_CONFIRM | ACTION_SHOOT)) {
        if (hasSave) continueGame();
        else startNewGame();
      }
      return;
    }
    if (screen === SCREEN_BUSTED || screen === SCREEN_WASTED) {
      if (flags & (ACTION_CONFIRM | ACTION_SHOOT)) retryAfterEnd();
      return;
    }
    if (flags & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    }
  }

  function stepOnce(actions) {
    const events = world.step(STEP, input, aimAngle(), actions);
    react(events);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const flags = input.takeActions();
    handleActions(flags);
    if (screen === SCREEN_PLAY) {
      // A click while dialogue is open advances the dialogue instead of firing.
      const dialogueOpen = Boolean(world.dialogueLine());
      const actions = {
        shoot: Boolean(flags & ACTION_SHOOT) && !dialogueOpen,
        interact: Boolean(flags & ACTION_INTERACT),
        confirm: Boolean(flags & ACTION_CONFIRM) || (Boolean(flags & ACTION_SHOOT) && dialogueOpen),
      };
      let first = true;
      while (accumulator >= STEP) {
        stepOnce(first ? actions : { shoot: false, interact: false, confirm: false });
        first = false;
        accumulator -= STEP;
        if (screen !== SCREEN_PLAY) break;
      }
      const player = world.state.player;
      audio.siren(world.state.police.wanted > 0);
      audio.engine(player.inCar ? Math.min(1, Math.abs(player.inCar.speed) / 560) : 0, Boolean(player.inCar));
    } else {
      accumulator = 0;
      audio.siren(false);
      audio.engine(0, false);
    }
    const ui = buildUi();
    const mouse = input.mouse();
    ui.mouse = renderer.toLogical(mouse.x, mouse.y);
    renderer.draw(world.state, screen, ui, world.state.elapsed);
  }

  // Leaving the tab pauses a running game rather than letting the city run unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('NEON HARBOR. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
