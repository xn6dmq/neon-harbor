// Drawing only: the world's state and the current screen in, pixels out. The camera
// follows the player through Port Aurelia; the HUD (minimap, stars, health, cash,
// objective) and the dialogue box sit on top; title, pause, busted and wasted are
// full-screen panels. Flat shapes and canvas text, no images, no network.

import { CAR, COAST, FONT, PALETTE, ROADS, WORLD } from './config.js';
import { LANDMARKS } from './city.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_WASTED = 'wasted';

const MINIMAP = { width: 230, height: 166, margin: 16 };
const VIEW = { width: 1280, height: 720 };

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const fonts = new Map();
  const view = { width: VIEW.width, height: VIEW.height, scale: 1, ox: 0, oy: 0 };

  function resize() {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    const scale = Math.min(width / VIEW.width, height / VIEW.height);
    view.scale = scale;
    // Device-pixel offsets that centre the 1280x720 logical view in the window.
    view.ox = (width - VIEW.width * scale) / 2;
    view.oy = (height - VIEW.height * scale) / 2;
    view.width = VIEW.width;
    view.height = VIEW.height;
  }

  function text(value, x, y, size, color, align = 'left', baseline = 'alphabetic') {
    const key = `${size}`;
    if (!fonts.has(key)) fonts.set(key, `bold ${size}px ${FONT}`);
    context.font = fonts.get(key);
    context.fillStyle = color;
    context.textAlign = align;
    context.textBaseline = baseline;
    context.fillText(value, x, y);
  }

  function camera(state) {
    const player = state.player;
    const halfW = view.width / 2;
    const halfH = view.height / 2;
    const x = Math.max(halfW, Math.min(WORLD.width - halfW, player.x)) - halfW;
    const y = Math.max(halfH, Math.min(WORLD.height - halfH, player.y)) - halfH;
    return { x, y };
  }

  function drawGround(cam) {
    // Grass base, then the sea and sand on the west edge.
    context.fillStyle = PALETTE.grass;
    context.fillRect(cam.x, cam.y, view.width, view.height);
    context.fillStyle = PALETTE.waterDeep;
    context.fillRect(cam.x, cam.y, Math.max(0, COAST.waterEnd - cam.x), view.height);
    context.fillStyle = PALETTE.water;
    context.fillRect(cam.x, cam.y, Math.max(0, COAST.waterEnd - 26 - cam.x), view.height);
    context.fillStyle = PALETTE.sand;
    context.fillRect(COAST.waterEnd, cam.y, COAST.sandEnd - COAST.waterEnd, view.height);
    // Block paving between the roads.
    context.fillStyle = PALETTE.block;
    const half = ROADS.width / 2;
    for (let vi = 0; vi < ROADS.vertical.length - 1; vi += 1) {
      for (let hi = 0; hi < ROADS.horizontal.length - 1; hi += 1) {
        context.fillRect(
          ROADS.vertical[vi] + half, ROADS.horizontal[hi] + half,
          ROADS.vertical[vi + 1] - ROADS.vertical[vi] - ROADS.width,
          ROADS.horizontal[hi + 1] - ROADS.horizontal[hi] - ROADS.width,
        );
      }
    }
    // Roads and their centre dashes.
    context.fillStyle = PALETTE.road;
    for (const vx of ROADS.vertical) context.fillRect(vx - half, cam.y, ROADS.width, view.height);
    for (const hy of ROADS.horizontal) context.fillRect(cam.x, hy - half, view.width, ROADS.width);
    context.fillStyle = PALETTE.roadLine;
    for (const vx of ROADS.vertical) {
      for (let y = Math.floor(cam.y / 64) * 64; y < cam.y + view.height; y += 64) {
        context.fillRect(vx - 2, y, 4, 30);
      }
    }
    for (const hy of ROADS.horizontal) {
      for (let x = Math.floor(cam.x / 64) * 64; x < cam.x + view.width; x += 64) {
        context.fillRect(x, hy - 2, 30, 4);
      }
    }
  }

  function drawBuildings(state, cam) {
    for (const b of state.city.buildings) {
      if (b.x > cam.x + view.width || b.x + b.w < cam.x || b.y > cam.y + view.height || b.y + b.h < cam.y) continue;
      context.fillStyle = PALETTE.building;
      context.fillRect(b.x, b.y, b.w, b.h);
      context.fillStyle = b.hue > 0.66 ? PALETTE.buildingAccent : PALETTE.buildingRoof;
      context.fillRect(b.x + 8, b.y + 8, b.w - 16, b.h - 16);
      context.fillStyle = 'rgba(255,255,255,0.12)';
      const cols = Math.max(1, Math.floor(b.w / 34));
      const rows = Math.max(1, Math.floor(b.h / 34));
      for (let c = 0; c < cols; c += 1) {
        for (let r = 0; r < rows; r += 1) {
          context.fillRect(b.x + 14 + c * 34, b.y + 14 + r * 34, 16, 12);
        }
      }
    }
    // Palms along the beach.
    for (const palm of state.city.palms) {
      if (palm.x < cam.x - 40 || palm.x > cam.x + view.width + 40 || palm.y < cam.y - 40 || palm.y > cam.y + view.height + 40) continue;
      context.strokeStyle = PALETTE.palmTrunk;
      context.lineWidth = 5;
      context.beginPath();
      context.moveTo(palm.x, palm.y);
      context.lineTo(palm.x + 4, palm.y - 22);
      context.stroke();
      context.fillStyle = PALETTE.palm;
      for (let i = 0; i < 5; i += 1) {
        const a = (i / 5) * Math.PI * 2;
        context.beginPath();
        context.ellipse(palm.x + 4 + Math.cos(a) * 12, palm.y - 24 + Math.sin(a) * 8, 14, 5, a, 0, Math.PI * 2);
        context.fill();
      }
    }
  }

  function drawMarker(x, y, color, pulse) {
    const r = 14 + Math.sin(pulse * 4) * 3;
    context.strokeStyle = color;
    context.lineWidth = 4;
    context.beginPath();
    context.arc(x, y, r, 0, Math.PI * 2);
    context.stroke();
    context.fillStyle = color;
    context.beginPath();
    context.moveTo(x, y - 26);
    context.lineTo(x - 10, y - 8);
    context.lineTo(x + 10, y - 8);
    context.closePath();
    context.fill();
  }

  function drawCar(car, time) {
    context.save();
    context.translate(car.x, car.y);
    context.rotate(car.angle);
    const halfL = CAR.length / 2;
    const halfW = CAR.width / 2;
    context.fillStyle = 'rgba(0,0,0,0.25)';
    context.fillRect(-halfL + 3, -halfW + 4, CAR.length, CAR.width);
    context.fillStyle = car.color;
    context.fillRect(-halfL, -halfW, CAR.length, CAR.width);
    context.fillStyle = 'rgba(255,255,255,0.35)';
    context.fillRect(halfL - 16, -halfW + 4, 10, CAR.width - 8);
    context.fillStyle = '#1d2733';
    context.fillRect(-6, -halfW + 3, 16, CAR.width - 6);
    if (car.police) {
      const blink = Math.floor(time * 6) % 2 === 0;
      context.fillStyle = blink ? '#ff3b30' : '#3b82ff';
      context.fillRect(-halfL + 2, -halfW + 2, 8, 6);
      context.fillStyle = blink ? '#3b82ff' : '#ff3b30';
      context.fillRect(-halfL + 2, halfW - 8, 8, 6);
    }
    if (car.health < 40) {
      context.fillStyle = 'rgba(60,60,60,0.5)';
      context.beginPath();
      context.arc(-halfL + 6, 0, 8 + Math.sin(time * 9) * 2, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
  }

  function drawPed(ped, time) {
    const bob = ped.fleeing ? Math.sin(time * 14) * 2 : Math.sin(time * 6 + ped.x) * 1;
    context.fillStyle = 'rgba(0,0,0,0.25)';
    context.beginPath();
    context.ellipse(ped.x, ped.y + 8, 8, 4, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = ped.color;
    context.beginPath();
    context.arc(ped.x, ped.y + bob, 9, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#2b2b2b';
    context.beginPath();
    context.arc(ped.x, ped.y - 6 + bob, 5, 0, Math.PI * 2);
    context.fill();
  }

  function drawThug(thug, time) {
    context.fillStyle = 'rgba(0,0,0,0.3)';
    context.beginPath();
    context.ellipse(thug.x, thug.y + 9, 9, 4, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#8c2f2f';
    context.beginPath();
    context.arc(thug.x, thug.y, 11, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#f2c94c';
    context.fillRect(thug.x - 8, thug.y - 16, 16, 4);
    context.strokeStyle = '#222';
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(thug.x, thug.y);
    context.lineTo(thug.x + Math.cos(thug.angle) * 20, thug.y + Math.sin(thug.angle) * 20);
    context.stroke();
  }

  function drawPlayer(state, time) {
    const player = state.player;
    if (player.inCar) return;
    const blink = player.hurtTimer > 0 && Math.floor(time * 12) % 2 === 0;
    if (blink) return;
    context.fillStyle = 'rgba(0,0,0,0.3)';
    context.beginPath();
    context.ellipse(player.x, player.y + 10, 10, 5, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.player;
    context.beginPath();
    context.arc(player.x, player.y, 12, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#1d2733';
    context.beginPath();
    context.arc(player.x, player.y - 3, 6, 0, Math.PI * 2);
    context.fill();
    // Aim direction: a short barrel line toward the mouse.
    context.strokeStyle = '#222';
    context.lineWidth = 4;
    context.beginPath();
    context.moveTo(player.x, player.y);
    context.lineTo(player.x + Math.cos(player.angle) * 22, player.y + Math.sin(player.angle) * 22);
    context.stroke();
  }

  function drawWorld(state, cam, time, objective) {
    drawGround(cam);
    drawBuildings(state, cam);
    // Safehouse: a green-roofed garage with a glowing marker.
    const sh = LANDMARKS.safehouse;
    context.fillStyle = PALETTE.building;
    context.fillRect(sh.x - 70, sh.y - 50, 140, 100);
    context.fillStyle = PALETTE.safehouse;
    context.fillRect(sh.x - 70, sh.y - 50, 140, 18);
    text('SAFEHOUSE', sh.x, sh.y - 58, 15, PALETTE.safehouse, 'center');
    if (objective && objective.x !== null && objective.y !== null) {
      drawMarker(objective.x, objective.y, PALETTE.objective, time);
    }
    for (const car of state.cars) drawCar(car, time);
    for (const car of state.police.cars) drawCar(car, time);
    if (state.player.inCar) drawCar(state.player.inCar, time);
    for (const ped of state.peds) drawPed(ped, time);
    for (const thug of state.thugs) drawThug(thug, time);
    drawPlayer(state, time);
    context.fillStyle = '#ffd23f';
    for (const bullet of state.bullets) {
      context.beginPath();
      context.arc(bullet.x, bullet.y, 3.5, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawMinimap(state, objective, time) {
    const x = view.width - MINIMAP.width - MINIMAP.margin;
    const y = MINIMAP.margin;
    const sx = MINIMAP.width / WORLD.width;
    const sy = MINIMAP.height / WORLD.height;
    context.fillStyle = PALETTE.minimapBg;
    context.fillRect(x - 4, y - 4, MINIMAP.width + 8, MINIMAP.height + 8);
    context.fillStyle = PALETTE.water;
    context.fillRect(x, y, COAST.waterEnd * sx, MINIMAP.height);
    context.fillStyle = '#6d7f92';
    for (const vx of ROADS.vertical) context.fillRect(x + vx * sx - 1, y, 2, MINIMAP.height);
    for (const hy of ROADS.horizontal) context.fillRect(x, y + hy * sy - 1, MINIMAP.width, 2);
    context.fillStyle = '#3a4552';
    for (const b of state.city.buildings) context.fillRect(x + b.x * sx, y + b.y * sy, Math.max(1.5, b.w * sx), Math.max(1.5, b.h * sy));
    const dot = (wx, wy, color, r = 2.5) => {
      context.fillStyle = color;
      context.beginPath();
      context.arc(x + wx * sx, y + wy * sy, r, 0, Math.PI * 2);
      context.fill();
    };
    dot(LANDMARKS.safehouse.x, LANDMARKS.safehouse.y, PALETTE.safehouse, 3.5);
    if (objective && objective.x !== null) dot(objective.x, objective.y, PALETTE.objective, 4);
    for (const car of state.cars) {
      if (car.kind === 'traffic') dot(car.x, car.y, '#e8b93c', 2);
    }
    const blink = Math.floor(time * 4) % 2 === 0;
    for (const car of state.police.cars) dot(car.x, car.y, blink ? '#ff3b30' : '#3b82ff', 3.5);
    const player = state.player;
    context.fillStyle = '#ffffff';
    context.strokeStyle = '#111';
    context.lineWidth = 1.5;
    context.beginPath();
    context.arc(x + player.x * sx, y + player.y * sy, 4.5, 0, Math.PI * 2);
    context.fill();
    context.stroke();
  }

  function drawHud(state, ui, time) {
    const player = state.player;
    const wanted = Math.round(state.police.wanted);
    // Wanted stars, top centre.
    const starSize = 30;
    const totalWidth = 5 * (starSize + 6);
    let sx = (view.width - totalWidth) / 2;
    for (let i = 0; i < 5; i += 1) {
      drawStar(sx + starSize / 2, 34, starSize / 2, i < wanted ? PALETTE.star : PALETTE.starEmpty);
      sx += starSize + 6;
    }
    // Health bar, bottom left.
    const hx = 20;
    const hy = view.height - 44;
    context.fillStyle = PALETTE.panel;
    context.fillRect(hx - 8, hy - 8, 248, 36);
    context.fillStyle = '#222';
    context.fillRect(hx, hy, 180, 20);
    context.fillStyle = player.health > 30 ? PALETTE.health : PALETTE.healthLow;
    context.fillRect(hx, hy, 180 * Math.max(0, player.health / 100), 20);
    text('HP', hx + 188, hy + 16, 16, PALETTE.text);
    // Cash, bottom right.
    context.fillStyle = PALETTE.panel;
    context.fillRect(view.width - 228, hy - 8, 208, 36);
    text(`$${state.cash.toLocaleString('en-US')}`, view.width - 32, hy + 16, 20, '#7dff9b', 'right');
    // Objective, top left.
    if (ui.objective) {
      context.fillStyle = PALETTE.panel;
      const lines = wrapText(ui.objective, 34);
      const height = 14 + lines.length * 24 + 10;
      context.fillRect(12, 12, 360, height);
      context.fillStyle = PALETTE.objective;
      context.fillRect(12, 12, 5, height);
      lines.forEach((line, i) => text(line, 28, 36 + i * 24, 17, PALETTE.text));
    }
    drawMinimap(state, ui.objectivePos, time);
    // Toast, centre-top under the stars.
    if (state.toastTimer > 0 && state.toast) {
      context.fillStyle = PALETTE.panel;
      const w = context.measureText(state.toast).width + 32;
      context.fillRect((view.width - w) / 2, 66, w, 34);
      text(state.toast, view.width / 2, 90, 18, PALETTE.text, 'center');
    }
    // Controls hint, bottom centre, fading after the first minute.
    if (state.elapsed < 45) {
      text(
        player.inCar ? 'W/S drive · A/D steer · E exit car' : 'WASD move · Shift run · Mouse aim · Click shoot · E enter car / save at Safehouse',
        view.width / 2, view.height - 14, 15, PALETTE.muted, 'center',
      );
    }
    // Crosshair at the mouse when on foot.
    if (!player.inCar && ui.mouse) {
      const mx = ui.mouse.x;
      const my = ui.mouse.y;
      context.strokeStyle = 'rgba(255,255,255,0.9)';
      context.lineWidth = 2;
      context.beginPath();
      context.arc(mx, my, 10, 0, Math.PI * 2);
      context.stroke();
      context.beginPath();
      context.moveTo(mx - 14, my);
      context.lineTo(mx - 5, my);
      context.moveTo(mx + 5, my);
      context.lineTo(mx + 14, my);
      context.moveTo(mx, my - 14);
      context.lineTo(mx, my - 5);
      context.moveTo(mx, my + 5);
      context.lineTo(mx, my + 14);
      context.stroke();
    }
  }

  function drawStar(cx, cy, r, color) {
    context.fillStyle = color;
    context.beginPath();
    for (let i = 0; i < 5; i += 1) {
      const a = -Math.PI / 2 + (i * Math.PI * 2) / 5;
      const a2 = a + Math.PI / 5;
      context.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      context.lineTo(cx + Math.cos(a2) * r * 0.45, cy + Math.sin(a2) * r * 0.45);
    }
    context.closePath();
    context.fill();
  }

  function wrapText(value, size) {
    context.font = `bold ${size}px ${FONT}`;
    const words = value.split(' ');
    const lines = [];
    let line = '';
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (context.measureText(test).width > 320 && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  function drawDialogue(line, ui) {
    const boxH = 150;
    const boxW = 760;
    const bx = (view.width - boxW) / 2;
    const by = view.height - boxH - 24;
    context.fillStyle = PALETTE.panel;
    context.fillRect(bx, by, boxW, boxH);
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 1;
    context.strokeRect(bx, by, boxW, boxH);
    text(line.who, bx + 24, by + 38, 20, PALETTE.objective);
    const lines = wrapDialogue(line.text);
    lines.forEach((l, i) => text(l, bx + 24, by + 68 + i * 26, 19, PALETTE.text));
    text(ui.dialoguePrompt ?? 'E / Click to continue', bx + boxW - 24, by + boxH - 16, 15, PALETTE.muted, 'right');
  }

  function wrapDialogue(value) {
    context.font = `bold 19px ${FONT}`;
    const words = value.split(' ');
    const lines = [];
    let line = '';
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (context.measureText(test).width > 700 && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  function drawPanel(title, lines, prompt, accent) {
    const width = 640;
    const height = 190 + lines.length * 32;
    const x = (view.width - width) / 2;
    const y = (view.height - height) / 2;
    context.fillStyle = PALETTE.panel;
    context.fillRect(x, y, width, height);
    context.strokeStyle = PALETTE.panelEdge;
    context.strokeRect(x, y, width, height);
    text(title, view.width / 2, y + 78, 46, accent ?? PALETTE.text, 'center');
    lines.forEach((line, i) => text(line, view.width / 2, y + 128 + i * 32, 20, PALETTE.muted, 'center'));
    text(prompt, view.width / 2, y + height - 36, 20, '#f2c94c', 'center');
  }

  function drawTitle(ui) {
    context.fillStyle = '#0e1420';
    context.fillRect(0, 0, view.width, view.height);
    // A sunset gradient skyline behind the title.
    const gradient = context.createLinearGradient(0, 0, 0, view.height);
    gradient.addColorStop(0, '#ff9a5c');
    gradient.addColorStop(0.55, '#c94f7c');
    gradient.addColorStop(1, '#1d2b4a');
    context.fillStyle = gradient;
    context.fillRect(0, 0, view.width, view.height * 0.62);
    context.fillStyle = '#141c2e';
    const skyline = [90, 150, 110, 190, 130, 170, 100, 210, 140, 120];
    let bx = 0;
    skyline.forEach((h, i) => {
      context.fillRect(bx, view.height * 0.62 - h, 128, h);
      bx += 128;
    });
    context.fillStyle = '#ffd23f';
    context.beginPath();
    context.arc(view.width - 260, 150, 64, 0, Math.PI * 2);
    context.fill();
    text('NEON HARBOR', view.width / 2, 210, 84, '#ffffff', 'center');
    text('An open-world crime story in Port Aurelia', view.width / 2, 262, 24, '#ffe9c9', 'center');
    const lines = [
      'Steal cars. Outrun the patrols. Run four jobs for Marlow.',
      'WASD move · Shift run · Mouse aim · Click shoot · E enter cars · Esc pause',
      ui.hasSave ? 'A saved game is waiting at the Safehouse.' : 'A new story begins at the Safehouse.',
    ];
    lines.forEach((line, i) => text(line, view.width / 2, 340 + i * 34, 20, '#f2f0e8', 'center'));
    text(ui.hasSave ? 'Press Enter to continue — or S for a new game' : 'Press Enter or click to start', view.width / 2, 480, 24, '#f2c94c', 'center');
    text('Original story, city and music. No network, no libraries.', view.width / 2, view.height - 40, 15, PALETTE.muted, 'center');
  }

  /** Paint one frame: the world through the camera, then the HUD or a full-screen panel. */
  function draw(state, screen, ui, time) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = '#0e1420';
    context.fillRect(0, 0, canvas.width, canvas.height);
    const scale = view.scale;
    context.setTransform(scale, 0, 0, scale, view.ox, view.oy);
    if (screen === SCREEN_TITLE) {
      drawTitle(ui);
      return;
    }
    const cam = camera(state);
    context.save();
    context.translate(-cam.x, -cam.y);
    drawWorld(state, cam, time, ui.objectivePos);
    context.restore();
    drawHud(state, ui, time);
    if (ui.dialogue) drawDialogue(ui.dialogue, ui);
    if (screen === SCREEN_PAUSED) {
      context.fillStyle = 'rgba(8, 12, 20, 0.55)';
      context.fillRect(0, 0, view.width, view.height);
      drawPanel('Paused', ['Port Aurelia waits for no one — except right now.'], 'Press P or Esc to resume');
    } else if (screen === SCREEN_BUSTED) {
      context.fillStyle = 'rgba(8, 12, 20, 0.6)';
      context.fillRect(0, 0, view.width, view.height);
      drawPanel('BUSTED', [`The patrols caught up with you.`, `Cash kept: $${state.cash.toLocaleString('en-US')}`], 'Press Enter to try again', '#6fa8ff');
    } else if (screen === SCREEN_WASTED) {
      context.fillStyle = 'rgba(8, 12, 20, 0.6)';
      context.fillRect(0, 0, view.width, view.height);
      drawPanel('WASTED', ['Port Aurelia is a rough town, Rook.', `Cash kept: $${state.cash.toLocaleString('en-US')}`], 'Press Enter to try again', '#ff5a4e');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return {
    draw,
    view,
    /** The camera's top-left world corner for the given state. */
    camera,
    /** Mouse position in canvas CSS pixels → logical view coordinates. */
    toLogical(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      return {
        x: (clientX * scaleX - view.ox) / view.scale,
        y: (clientY * scaleY - view.oy) / view.scale,
      };
    },
  };
}
