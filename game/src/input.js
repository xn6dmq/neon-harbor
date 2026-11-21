// Keyboard and mouse, read fresh every frame. Movement is a unit vector from WASD or
// the arrow keys; the mouse aims (its world position is computed by the caller, which
// knows the camera). Actions are edge-triggered: takeActions() returns what was pressed
// since the last call, then clears them.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_INTERACT = 4;
export const ACTION_SHOOT = 8;

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let mouseX = 0;
  let mouseY = 0;
  let mouseDown = false;

  function keyOf(event) {
    return event.key.length === 1 ? event.key.toLowerCase() : event.key;
  }

  window.addEventListener('keydown', (event) => {
    const key = keyOf(event);
    if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) event.preventDefault();
    if (event.repeat) return;
    keys.add(key);
    if (key === ' ' || key === 'Enter') actions |= ACTION_CONFIRM;
    if (key === 'Escape' || key === 'p' || key === 'P') actions |= ACTION_PAUSE;
    if (key === 'e' || key === 'E') actions |= ACTION_INTERACT;
  });
  window.addEventListener('keyup', (event) => keys.delete(keyOf(event)));
  window.addEventListener('blur', () => keys.clear());

  canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
  });
  canvas.addEventListener('mousedown', (event) => {
    if (event.button === 0) {
      mouseDown = true;
      actions |= ACTION_SHOOT;
    }
  });
  window.addEventListener('mouseup', (event) => {
    if (event.button === 0) mouseDown = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  function direction() {
    let x = 0;
    let y = 0;
    if (keys.has('a') || keys.has('ArrowLeft')) x -= 1;
    if (keys.has('d') || keys.has('ArrowRight')) x += 1;
    if (keys.has('w') || keys.has('ArrowUp')) y -= 1;
    if (keys.has('s') || keys.has('ArrowDown')) y += 1;
    if (x !== 0 && y !== 0) {
      const len = Math.hypot(x, y);
      x /= len;
      y /= len;
    }
    return { x, y };
  }

  return {
    direction,
    running: () => keys.has('Shift'),
    throttle: () => (keys.has('w') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('s') || keys.has('ArrowDown') ? 0.6 : 0),
    steering: () => (keys.has('a') || keys.has('ArrowLeft') ? -1 : 0) + (keys.has('d') || keys.has('ArrowRight') ? 1 : 0),
    mouse: () => ({ x: mouseX, y: mouseY, down: mouseDown }),
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
