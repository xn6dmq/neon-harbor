// The story of NEON HARBOR: four missions for Rook, a driver new to Port Aurelia, and
// the fixer Marlow who hires him. Each mission is a list of steps — go somewhere, talk
// to someone, deliver a car, settle a score, hold a spot — with dialogue in between and
// a cash reward at the end. The module only tracks the story; the world feeds it what
// the player is doing and it answers with what changed.

import { LANDMARKS } from './city.js';
import { MISSION_REWARDS } from './config.js';

const MISSIONS = [
  {
    title: 'Harbor Lights',
    intro: [
      { who: 'Marlow', text: 'You must be Rook. Fresh off the ferry, and already the whole harbor knows your name.' },
      { who: 'Rook', text: 'I drive. That is all I do. What is the job?' },
      { who: 'Marlow', text: 'Meet me at the Harbor Docks. Bring yourself, nothing else. We will see how you handle this town.' },
    ],
    steps: [
      { type: 'goto', x: LANDMARKS.docks.x, y: LANDMARKS.docks.y, label: 'Meet Marlow at the Harbor Docks' },
      {
        type: 'dialogue',
        lines: [
          { who: 'Marlow', text: 'Good. You found the place. First rule of Port Aurelia: the cops watch the boulevards, not the alleys.' },
          { who: 'Marlow', text: 'Second rule: I pay in cash, on time, every time. Do this right and there is more work. Two hundred, for showing up.' },
          { who: 'Rook', text: 'Then let us get to it.' },
        ],
      },
    ],
  },
  {
    title: 'Hot Wheels',
    intro: [
      { who: 'Marlow', text: 'Vic needs a ride, and Vic does not pay for rides. You know what that means.' },
      { who: 'Marlow', text: 'Take any car off the street — quick and quiet, mind the patrols — and bring it to Vic\'s Chop Shop.' },
    ],
    steps: [
      { type: 'deliverCar', x: LANDMARKS.garage.x, y: LANDMARKS.garage.y, label: 'Steal a car and deliver it to Vic\'s Chop Shop' },
      {
        type: 'dialogue',
        lines: [
          { who: 'Vic', text: 'Oh, she is a beauty. Clean plates, clean engine. You have good taste, kid.' },
          { who: 'Vic', text: 'Marlow said you drive. Maybe next time I let you keep one. Four-fifty, as agreed.' },
        ],
      },
    ],
  },
  {
    title: 'Dockside Heat',
    intro: [
      { who: 'Marlow', text: 'The Harbor crew has been taxing my drivers at Sunset Pier. Four of them, armed, and tired of being polite.' },
      { who: 'Marlow', text: 'Go down there and end it. Then meet me at Club Mirage and tell me how it went.' },
    ],
    steps: [
      { type: 'goto', x: LANDMARKS.pier.x, y: LANDMARKS.pier.y, label: 'Reach Sunset Pier' },
      { type: 'defeat', count: 4, label: 'Deal with the Harbor crew' },
      { type: 'goto', x: LANDMARKS.club.x, y: LANDMARKS.club.y, label: 'Meet Marlow at Club Mirage' },
      {
        type: 'dialogue',
        lines: [
          { who: 'Marlow', text: 'The pier is quiet again. Word travels fast in this town, Rook — and right now the word is your name.' },
          { who: 'Marlow', text: 'One last job. The big one. The bank on Aurelia Row. You in?' },
          { who: 'Rook', text: 'I am always in.' },
        ],
      },
    ],
  },
  {
    title: 'The Big Score',
    intro: [
      { who: 'Marlow', text: 'Aurelia Savings Bank. Three minutes inside, then the whole city wakes up.' },
      { who: 'Marlow', text: 'Crack the vault, grab the cash, and lose the heat. Get back to the Safehouse and we split it. Go.' },
    ],
    steps: [
      { type: 'hold', x: LANDMARKS.bank.x, y: LANDMARKS.bank.y, seconds: 3, label: 'Crack the vault at Aurelia Savings Bank' },
      { type: 'escape', x: LANDMARKS.safehouse.x, y: LANDMARKS.safehouse.y, label: 'Lose the heat and get back to the Safehouse' },
      {
        type: 'dialogue',
        lines: [
          { who: 'Marlow', text: 'You did it. Fifteen hundred, your cut, and the whole harbor to spend it in.' },
          { who: 'Rook', text: 'Port Aurelia is mine now.' },
          { who: 'Marlow', text: 'It always was, kid. It just did not know it yet.' },
        ],
      },
    ],
  },
];

export function createMissions() {
  return {
    index: 0,
    stepIndex: 0,
    dialogue: null,
    holdTime: 0,
    completedCount: 0,
    finished: false,
  };
}

export function missionCount() {
  return MISSIONS.length;
}

export function currentMission(state) {
  return MISSIONS[state.index] ?? null;
}

export function currentStep(state) {
  const mission = currentMission(state);
  return mission ? mission.steps[state.stepIndex] ?? null : null;
}

/** The objective line for the HUD, and where its marker sits on the map. */
export function currentObjective(state) {
  const mission = currentMission(state);
  if (!mission) return { text: 'Port Aurelia is yours. Free roam — enjoy the city.', x: null, y: null };
  const step = currentStep(state);
  if (!step) return { text: mission.title, x: null, y: null };
  const remaining = step.type === 'defeat' ? ` (${step.count} left)` : '';
  return { text: `${mission.title}: ${step.label}${remaining}`, x: step.x ?? null, y: step.y ?? null };
}

export function startDialogue(state, lines) {
  state.dialogue = { lines, index: 0 };
}

/** Advance the open dialogue; true when it has run out of lines. */
export function advanceDialogue(state) {
  if (!state.dialogue) return true;
  state.dialogue.index += 1;
  if (state.dialogue.index >= state.dialogue.lines.length) {
    state.dialogue = null;
    return true;
  }
  return false;
}

export function isDialogue(state) {
  return state.dialogue !== null;
}

export function currentDialogueLine(state) {
  if (!state.dialogue) return null;
  return state.dialogue.lines[state.dialogue.index];
}

function nextStep(state) {
  state.stepIndex += 1;
  state.holdTime = 0;
  const mission = currentMission(state);
  if (state.stepIndex >= mission.steps.length) {
    const cash = MISSION_REWARDS[state.index] ?? 0;
    state.completedCount += 1;
    state.index += 1;
    state.stepIndex = 0;
    if (state.index >= MISSIONS.length) state.finished = true;
    return { event: 'missionComplete', cash };
  }
  const step = currentStep(state);
  if (step && step.type === 'dialogue') startDialogue(state, step.lines);
  return { event: 'step' };
}

/**
 * Feed the story what the player is doing. `ctx` carries the player's position, whether
 * they are in a car, how many Harbor crew are left, and whether the heat is gone.
 * Returns null, or { event: 'step' | 'missionComplete' | 'alarm', cash? }.
 */
export function updateMissions(state, ctx, dt) {
  if (state.finished || state.dialogue) return null;
  const step = currentStep(state);
  if (!step) return null;
  if (step.type === 'dialogue') return nextStep(state);
  if (step.type === 'goto') {
    const dist = Math.hypot(ctx.playerX - step.x, ctx.playerY - step.y);
    if (dist < 90) return nextStep(state);
    return null;
  }
  if (step.type === 'deliverCar') {
    if (!ctx.inCar) return null;
    const dist = Math.hypot(ctx.playerX - step.x, ctx.playerY - step.y);
    if (dist < 110) return nextStep(state);
    return null;
  }
  if (step.type === 'defeat') {
    if (ctx.thugsLeft <= 0) return nextStep(state);
    return null;
  }
  if (step.type === 'hold') {
    const dist = Math.hypot(ctx.playerX - step.x, ctx.playerY - step.y);
    if (dist < 110) {
      state.holdTime += dt;
      if (state.holdTime >= step.seconds) {
        const result = nextStep(state);
        return { ...result, alarm: true };
      }
    } else {
      state.holdTime = Math.max(0, state.holdTime - dt * 2);
    }
    return null;
  }
  if (step.type === 'escape') {
    const dist = Math.hypot(ctx.playerX - step.x, ctx.playerY - step.y);
    if (dist < 130 && ctx.wanted < 1) return nextStep(state);
    return null;
  }
  return null;
}

/** The intro dialogue for the mission the player is on; call once when it begins. */
export function missionIntro(state) {
  const mission = currentMission(state);
  return mission ? mission.intro : null;
}
