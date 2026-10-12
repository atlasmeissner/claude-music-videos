// The seven figure plates of Mara's life. Each one is an engraving on a dark plate (bright lines, like the
// territory itself: the life as lived), drawn stroke by stroke as it unfolds from its place on the map, with its own
// small animation and its gold lights, and a caption that sets what was planned against what happened.
//
// Drawing area: DW × DH px (plate coordinates, origin top-left). `build` lays down the static engraving once (a Plot,
// drawn progressively); `anim` draws what moves, every frame; `glow` places gold lights (drawn additively on top).
import { rgba, LIN } from '../engine/palette';
import { clamp, ease, hash, noise1, TAU, lerp } from '../engine/util';
import { strokeText } from '../engine/stroke';
import { Plot, type Pt } from './_plot';
import { PLAN_PTS } from './_world';
import type { RGB } from './_mt';

export const DW = 700, DH = 380;
export interface AnimCtx {
  /** Song time, seconds since the plate opened, the static drawing's progress, and 0..1 over the plate's life. */
  t: number; age: number; k: number; life: number;
}
export interface Glow {
  lamp(x: number, y: number, scale: number, I: number): void;
  seg(x0: number, y0: number, x1: number, y1: number, w: number, col: RGB, I: number): void;
}
export interface PlateDef {
  fig: number; title: string; year: string; planned: string; happened: string;
  build(p: Plot): void;
  anim?(c: CanvasRenderingContext2D, a: AnimCtx): void;
  glow?(g: Glow, a: AnimCtx): void;
  /** Seconds the static engraving takes to draw (at most; short plates draw faster). */
  draw?: number;
}

// ------------------------------------------------------------------ shared motifs
const sst = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
/** Rows of broken wave dashes from y0 to y1, closer together toward the horizon. */
function sea(p: Plot, y0: number, y1: number, seed: number, bright: (x: number, y: number) => number = () => 0, x0 = 0, x1 = DW) {
  let row = 0;
  for (let u = 0.02; u < 1; u += 0.028 + 0.05 * u, row++) {
    const y = y0 + (y1 - y0) * u;
    let x = x0 + hash(row, seed) * 30;
    let i = 0;
    while (x < x1) {
      const L = (8 + 34 * hash(row, i, seed + 1)) * (0.5 + u);
      const g = (6 + 22 * hash(row, i, seed + 2)) * (0.6 + u * 0.6);
      const xe = Math.min(x1, x + L);
      const b = bright((x + xe) / 2, y);
      if (hash(row, i, seed + 3) < 0.5 + 0.5 * b) {
        p.with({ a: 0.35 + 0.5 * b + 0.15 * u, w: 0.8 + 0.4 * u }, () => p.wave(x, xe, y, 0.6 + u, 14 + 20 * u, hash(row, i) * 6));
      }
      x = xe + g; i++;
    }
  }
}
function stars(p: Plot, n: number, x0: number, y0: number, x1: number, y1: number, seed: number) {
  for (let i = 0; i < n; i++) {
    const x = lerp(x0, x1, hash(i, seed)), y = lerp(y0, y1, Math.pow(hash(i, seed + 1), 1.3));
    const r = 1.2 + 2.6 * Math.pow(hash(i, seed + 2), 3);
    p.with({ w: 0.8, a: 0.5 + 0.4 * hash(i, seed + 3), wobble: 0 }, () => {
      if (r > 2.4) { p.line(x - r, y, x + r, y); p.line(x, y - r, x, y + r); } else p.line(x - 0.6, y, x + 0.6, y);
    });
  }
}
/** A simple standing figure (head, body, legs), feet at (x, y), height h. */
function figure(p: Plot, x: number, y: number, h: number, skirt = false) {
  const hr = h * 0.09;
  p.circle(x, y - h + hr, hr);
  if (skirt) p.path([[x - h * 0.06, y - h * 0.8], [x - h * 0.15, y - h * 0.35], [x + h * 0.15, y - h * 0.35], [x + h * 0.06, y - h * 0.8]], true);
  else p.path([[x - h * 0.09, y - h * 0.8], [x - h * 0.11, y - h * 0.4], [x + h * 0.11, y - h * 0.4], [x + h * 0.09, y - h * 0.8]], true);
  p.line(x - h * 0.05, y - h * 0.38, x - h * 0.07, y); p.line(x + h * 0.05, y - h * 0.38, x + h * 0.07, y);
}
const rect = (x: number, y: number, w: number, h: number): Pt[] => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
/** Polygon of an ellipse. */
const ell = (cx: number, cy: number, rx: number, ry: number, a0 = 0, a1 = TAU, n = 40): Pt[] => Array.from({ length: n + 1 }, (_, i) => { const a = a0 + ((a1 - a0) * i) / n; return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry] as Pt; });
/** A flame: a teardrop that flickers (Canvas2D path). */
function flame(c: CanvasRenderingContext2D, x: number, y: number, h: number, t: number, seed: number, col = rgba('ember', 0.95)) {
  const sway = 0.18 * noise1(t * 3.1, seed) * h, hh = h * (0.85 + 0.25 * noise1(t * 5.3, seed + 4));
  c.beginPath();
  c.moveTo(x - h * 0.22, y);
  c.bezierCurveTo(x - h * 0.3, y - hh * 0.45, x + sway * 0.4, y - hh * 0.7, x + sway, y - hh);
  c.bezierCurveTo(x + sway * 0.4 + h * 0.08, y - hh * 0.65, x + h * 0.32, y - hh * 0.4, x + h * 0.22, y);
  c.closePath();
  c.fillStyle = col; c.fill();
}

// ------------------------------------------------------------------ the plates
const P1: PlateDef = {
  fig: 1, title: 'THE FERRY', year: '2011',
  planned: 'MEDICAL SCHOOL, 2008–2014',
  happened: 'She left on the morning ferry, at twenty-one.',
  draw: 3.0,
  build(p) {
    const H = 214, S: Pt = [505, H];
    // the dawn sky: horizontal rules, close together near the sun
    p.set({ w: 0.7, a: 0.55, speed: 3 });
    p.hatch(rect(0, 4, DW, H - 8), 0, 6.5, (x, y) => 1 - sst(50, 380, Math.hypot(x - S[0], (y - S[1]) * 1.6)));
    // the sun, half risen, and its rays
    p.set({ w: 1.3, a: 0.95, speed: 1 });
    p.arc(S[0], S[1], 30, 30, Math.PI, TAU);
    p.set({ w: 0.9, a: 0.7 });
    for (let i = 0; i <= 14; i++) { const a = Math.PI + (i / 14) * Math.PI; const r0 = 40, r1 = 58 + 26 * hash(i, 5); p.line(S[0] + Math.cos(a) * r0, S[1] + Math.sin(a) * r0, S[0] + Math.cos(a) * r1, S[1] + Math.sin(a) * r1); }
    // the far shore: low hills, backlit
    p.set({ w: 1.1, a: 0.85 });
    const hills: Pt[] = [];
    for (let x = 300; x <= DW; x += 10) hills.push([x, H - 4 - 16 * Math.max(0, Math.sin((x - 300) / 70)) * (0.6 + 0.4 * Math.sin(x / 23)) - (x > 600 ? (x - 600) * 0.12 : 0)]);
    p.path(hills);
    p.line(0, H, 300, H);
    // the near shore and the pier she left from
    p.set({ w: 1.2, a: 0.9 });
    p.path([[0, 262], [40, 258], [110, 252], [150, 252]]);
    p.path([[0, 270], [150, 262]]);
    for (let x = 14; x < 150; x += 22) p.line(x, 262 - x * 0.06, x + 1, 318);
    p.set({ w: 0.7, a: 0.5, speed: 2.5 });
    p.hatch([[0, 300], [60, 296], [110, 310], [130, 380], [0, 380]], 0.9, 5);
    p.set({ w: 1.0, a: 0.9, speed: 1 });
    p.path([[0, 298], [60, 294], [112, 308], [134, 380]]);
    // the water, with the sun's road on it
    p.set({ w: 0.8, a: 0.5, speed: 2.5 });
    sea(p, H + 4, DH, 11, (x, y) => 1 - sst(14 + (y - H) * 0.35, 40 + (y - H) * 0.7, Math.abs(x - S[0])), 140, DW);
  },
  anim(c, a) {
    // the ferry crosses while her line is sung
    const u = ease.inOutSine(clamp(a.life * 1.05));
    const bx = lerp(205, 470, u), by = 296 + 1.5 * Math.sin(a.t * 1.7);
    const k = clamp((a.k - 0.25) / 0.5);
    if (k <= 0) return;
    c.save();
    c.translate(bx, by); c.rotate(0.015 * Math.sin(a.t * 1.3));
    c.globalAlpha *= k;
    c.lineCap = 'round'; c.lineJoin = 'round';
    // the wake
    c.strokeStyle = rgba('bone', 0.55); c.lineWidth = 0.9;
    for (let i = 0; i < 5; i++) {
      const ph = (a.t * 0.9 + i * 0.2) % 1, x = -118 - ph * 120, s = 4 + ph * 14;
      c.globalAlpha = k * (1 - ph) * 0.8;
      c.beginPath(); c.moveTo(x, 6 - s * 0.2); c.quadraticCurveTo(x - 10, 6, x, 6 + s * 0.4); c.stroke();
    }
    c.globalAlpha = k;
    // hull
    c.fillStyle = rgba('ink2', 1); c.strokeStyle = rgba('bone', 0.95); c.lineWidth = 1.4;
    c.beginPath(); c.moveTo(-114, -16); c.lineTo(80, -16); c.lineTo(96, -24); c.lineTo(78, 6); c.lineTo(-104, 6); c.closePath(); c.fill(); c.stroke();
    c.save(); c.clip();
    c.lineWidth = 0.7; c.strokeStyle = rgba('bone', 0.5);
    for (let x = -130; x < 110; x += 6) { c.beginPath(); c.moveTo(x, 8); c.lineTo(x + 18, -18); c.stroke(); }
    c.restore();
    c.lineWidth = 1; c.strokeStyle = rgba('bone', 0.8);
    c.beginPath(); c.moveTo(-108, -6); c.lineTo(86, -6); c.stroke();
    // cabin, upper deck, funnel, mast
    c.lineWidth = 1.2; c.strokeStyle = rgba('bone', 0.95); c.fillStyle = rgba('ink2', 1);
    c.fillRect(-72, -36, 92, 20); c.strokeRect(-72, -36, 92, 20);
    for (let i = 0; i < 6; i++) c.strokeRect(-66 + i * 14, -31, 8, 8);
    c.fillRect(-52, -50, 52, 14); c.strokeRect(-52, -50, 52, 14);
    c.fillRect(-34, -76, 16, 26); c.strokeRect(-34, -76, 16, 26);
    c.beginPath(); c.moveTo(-34, -68); c.lineTo(-18, -68); c.stroke();
    c.beginPath(); c.moveTo(52, -16); c.lineTo(52, -66); c.moveTo(52, -66); c.lineTo(-52, -50); c.moveTo(52, -66); c.lineTo(92, -22); c.stroke();
    c.fillStyle = rgba('signal', 1);
    c.beginPath(); c.moveTo(52, -66); c.lineTo(70, -62 + Math.sin(a.t * 6) * 2); c.lineTo(52, -58); c.closePath(); c.fill();
    // rail, and Mara at the stern, looking back
    c.strokeStyle = rgba('bone', 0.8); c.lineWidth = 0.9;
    c.beginPath(); c.moveTo(-112, -24); c.lineTo(-72, -24); c.stroke();
    for (let x = -110; x <= -74; x += 9) { c.beginPath(); c.moveTo(x, -24); c.lineTo(x, -16); c.stroke(); }
    c.strokeStyle = rgba('ember', 1); c.lineWidth = 1.4;
    c.beginPath(); c.arc(-96, -38, 3.4, 0, TAU); c.stroke();
    c.beginPath(); c.moveTo(-96, -34); c.lineTo(-99, -18); c.lineTo(-93, -18); c.closePath(); c.stroke();
    // smoke
    for (let i = 0; i < 7; i++) {
      const ph = (a.t * 0.35 + i / 7) % 1;
      c.globalAlpha = k * (1 - ph) * 0.6;
      c.strokeStyle = rgba('bone', 0.8); c.lineWidth = 0.9;
      c.beginPath(); c.arc(-26 - ph * 90, -80 - ph * 40 - 6 * Math.sin(ph * 6 + i), 4 + ph * 12, 0, TAU); c.stroke();
    }
    c.restore();
  },
  glow(g, a) {
    g.lamp(505, 214, 2.4, 0.85);
    // the sun's road: glints
    for (let i = 0; i < 26; i++) {
      const y = 222 + Math.pow(hash(i, 3), 1.4) * 150, w = 6 + (y - 214) * 0.25 * hash(i, 4);
      const x = 505 + (hash(i, 5) - 0.5) * (14 + (y - 214) * 0.5);
      const f = 0.5 + 0.5 * Math.sin(a.t * (3 + 4 * hash(i, 6)) + i);
      g.seg(x - w, y, x + w, y, 1.6, LIN.ember, 0.9 * f * clamp(a.k * 2 - 0.6));
    }
    const u = ease.inOutSine(clamp(a.life * 1.05)), bx = lerp(205, 470, u), by = 296 + 1.5 * Math.sin(a.t * 1.7);
    const k = clamp((a.k - 0.4) / 0.4);
    for (let i = 0; i < 6; i++) g.lamp(bx - 62 + i * 14, by - 27, 0.16, 0.7 * k);
  },
};

const P2: PlateDef = {
  fig: 2, title: 'A BAKERY IN THE RAIN', year: '2012',
  planned: 'A SUMMER INTERNSHIP · SUNNY',
  happened: 'Rain. She ducked into a bakery, and stayed to learn.',
  draw: 1.9,
  build(p) {
    // the facade
    p.set({ w: 1.3, a: 0.95, speed: 1 });
    p.rect(150, 14, 400, 316);
    // brick courses on the upper wall
    p.set({ w: 0.6, a: 0.38, speed: 4, wobble: 0.2 });
    for (let y = 22, r = 0; y < 146; y += 9, r++) {
      p.line(152, y, 548, y);
      for (let x = 160 + (r % 2) * 11; x < 548; x += 22) if (!(x > 182 && x < 268 && y > 34 && y < 126) && !(x > 432 && x < 518 && y > 34 && y < 126)) p.line(x, y, x, y + 9);
    }
    p.set({ w: 1.1, a: 0.9, speed: 1, wobble: 0.35 });
    // upstairs windows
    for (const x of [188, 438]) { p.rect(x, 38, 76, 84); p.line(x + 38, 38, x + 38, 122); p.line(x, 80, x + 76, 80); p.line(x - 6, 124, x + 82, 124); }
    // the sign
    p.rect(232, 150, 236, 38);
    const sign = strokeText('BAKERY', 'sans', 30, 6);
    p.with({ w: 1.6, a: 1 }, () => p.text(sign, 350 - sign.width / 2, 180));
    // the awning, striped, with a scalloped edge
    p.path([[178, 198], [522, 198], [544, 240], [156, 240]], true);
    const n = 8;
    for (let i = 0; i < n; i++) {
      const u0 = i / n, u1 = (i + 1) / n;
      const q: Pt[] = [[lerp(178, 522, u0), 198], [lerp(178, 522, u1), 198], [lerp(156, 544, u1), 240], [lerp(156, 544, u0), 240]];
      if (i % 2 === 0) p.with({ w: 0.6, a: 0.6, speed: 3 }, () => p.hatch(q, 1.35, 3.2));
      p.arc(lerp(156, 544, (u0 + u1) / 2), 240, (544 - 156) / n / 2, 7, 0, Math.PI);
    }
    // the shop window, its shelves of bread
    p.rect(186, 252, 218, 76);
    p.line(295, 252, 295, 328);
    for (const y of [280, 306]) { p.line(190, y, 400, y); for (let x = 200; x < 395; x += 26) if (Math.abs(x - 295) > 10) p.arc(x + 8, y, 9, 6, Math.PI, TAU); }
    // the door, ajar
    p.rect(430, 244, 74, 86);
    p.path([[430, 244], [462, 250], [462, 324], [430, 330]]);
    p.circle(456, 290, 2);
    // pavement, kerb, cobbles
    p.line(0, 330, DW, 330);
    p.line(0, 346, DW, 346);
    p.set({ w: 0.6, a: 0.35, speed: 4 });
    for (let r = 0; r < 4; r++) for (let x = (r % 2) * 15; x < DW; x += 30) p.arc(x + 15, 360 + r * 9, 13, 4, Math.PI, TAU);
    // puddles
    p.set({ w: 0.9, a: 0.7, speed: 1 });
    p.arc(300, 358, 64, 7); p.arc(586, 354, 38, 5);
    // the street lamp
    p.set({ w: 1.2, a: 0.9 });
    p.line(84, 330, 84, 92); p.line(80, 330, 88, 330);
    p.path([[72, 92], [96, 92], [92, 70], [76, 70]], true);
    p.path([[76, 70], [84, 62], [92, 70]]);
    // a figure with an umbrella, by the door
    p.set({ w: 1.1, a: 0.95 });
    p.arc(612, 262, 36, 26, Math.PI, TAU);
    for (let i = 0; i <= 4; i++) { const ax = 576 + i * 18; p.arc(ax + 9, 262, 9, 4, 0, Math.PI); }
    p.line(612, 236, 612, 290);
    p.path([[600, 270], [624, 270], [632, 322], [594, 322]], true);
    p.with({ w: 0.6, a: 0.6, speed: 3 }, () => p.hatch([[600, 270], [624, 270], [632, 322], [594, 322]], 1.1, 3.5));
    p.line(604, 322, 601, 330); p.line(620, 322, 624, 330);
  },
  anim(c, a) {
    const k = clamp(a.k * 1.4 - 0.2);
    if (k <= 0) return;
    // the window's warm light
    c.save();
    c.globalAlpha *= k;
    const gw = c.createRadialGradient(295, 290, 10, 295, 290, 150);
    gw.addColorStop(0, rgba('signal', 0.35)); gw.addColorStop(1, rgba('signal', 0));
    c.fillStyle = gw; c.fillRect(186, 252, 218, 76);
    // light from the door across the pavement, and in the puddle
    c.fillStyle = rgba('signal', 0.18);
    c.beginPath(); c.moveTo(434, 330); c.lineTo(462, 324); c.lineTo(520, 380); c.lineTo(400, 380); c.closePath(); c.fill();
    c.restore();
    // rain
    c.save();
    c.lineCap = 'round';
    const fi = Math.floor(a.t * 30);
    for (let i = 0; i < 190; i++) {
      const sp = 900 + 300 * hash(i, 2);
      const y = ((hash(i, 1) * 480 + (a.t * sp)) % 480) - 60, x = hash(i, 3) * 760 - 30 - y * 0.18;
      const L = 14 + 14 * hash(i, 4);
      c.strokeStyle = rgba('bone', (0.25 + 0.35 * hash(i, 5)) * k); c.lineWidth = 0.8;
      c.beginPath(); c.moveTo(x, y); c.lineTo(x - L * 0.18, y + L); c.stroke();
    }
    // splashes and puddle rings
    c.strokeStyle = rgba('bone', 0.5 * k); c.lineWidth = 0.7;
    for (let i = 0; i < 14; i++) {
      const ph = ((a.t * 2.2 + hash(i, fi > 0 ? 9 : 9)) % 1);
      const x = hash(i, 10) * DW, y = 330 + (i % 2) * 16;
      c.globalAlpha = 1 - ph;
      c.beginPath(); c.arc(x, y, 1 + ph * 5, Math.PI * 1.1, Math.PI * 1.9); c.stroke();
    }
    for (let i = 0; i < 5; i++) {
      const ph = (a.t * 0.9 + i * 0.37) % 1, x = 260 + hash(i, 12) * 80;
      c.globalAlpha = (1 - ph) * k;
      c.beginPath(); c.ellipse(x, 358, 2 + ph * 16, 0.6 + ph * 2, 0, 0, TAU); c.stroke();
    }
    c.restore();
  },
  glow(g, a) {
    const k = clamp(a.k * 1.6 - 0.4);
    g.lamp(295, 288, 2.0, 0.65 * k);
    g.lamp(450, 288, 0.9, 0.5 * k);
    g.lamp(84, 82, 0.8, 0.9 * k);
    g.lamp(476, 80, 0.45, 0.35 * k);
    for (let i = 0; i < 8; i++) { const x = 250 + i * 12 + 4 * Math.sin(a.t * 3 + i); g.seg(x - 4, 358 + (i % 3), x + 4, 358 + (i % 3), 1.2, LIN.ember, 0.5 * k); }
  },
};

const LANTERNS: Pt[] = Array.from({ length: 9 }, (_, i) => { const x = 50 + i * 75; const u = (x - 350) / 360; return [x, 36 + 58 * (1 - u * u)]; });
const P3: PlateDef = {
  fig: 3, title: 'THE FEAST', year: '2014',
  planned: 'FINAL EXAMS, JUNE 2014',
  happened: 'Packed for war; found a long table, and Jonah.',
  draw: 1.9,
  build(p) {
    // the trees behind, a dark garden
    p.set({ w: 0.9, a: 0.55, speed: 1.5 });
    const tr: Pt[] = [];
    for (let x = 0; x <= DW; x += 8) tr.push([x, 150 - 22 * Math.abs(Math.sin(x / 41)) - 10 * Math.sin(x / 13) - 8 * hash(x, 2)]);
    p.path(tr);
    // the lantern string
    p.set({ w: 0.8, a: 0.7, speed: 1 });
    const str: Pt[] = [];
    for (let x = -10; x <= DW + 10; x += 10) { const u = (x - 350) / 360; str.push([x, 36 + 58 * (1 - u * u) - 12]); }
    p.path(str);
    // the long table in perspective
    const VP: Pt = [350, 150];
    p.set({ w: 1.3, a: 0.95 });
    p.path([[84, 320], [616, 320], [404, 176], [296, 176]], true);
    p.path([[84, 320], [84, 340], [616, 340], [616, 320]]);
    p.set({ w: 0.6, a: 0.45, speed: 3 });
    for (let i = 0; i <= 18; i++) { const x = lerp(96, 604, i / 18); const e: Pt = [lerp(x, VP[0], 0.84), lerp(320, VP[1], 0.84)]; p.line(x, 320, lerp(x, e[0], 0.97), lerp(320, e[1], 0.97)); }
    for (let x = 92; x < 612; x += 10) p.line(x, 322, x + 2 * Math.sin(x), 340);
    // plates, cups and the guests along both sides
    p.set({ w: 0.9, a: 0.85, speed: 1 });
    for (let i = 0; i < 7; i++) {
      const u = i / 7, s = lerp(1, 0.28, u);
      for (const side of [-1, 1]) {
        const x = 350 + side * lerp(205, 44, u), y = lerp(306, 184, u);
        p.arc(x, y, 18 * s, 6 * s);
        p.arc(x, y, 11 * s, 3.6 * s);
        p.rect(x + side * 22 * s - 3 * s, y - 14 * s, 6 * s, 12 * s);
        if (i > 0) {
          // a guest, seated: head and shoulders
          const gx = 350 + side * lerp(262, 62, u), gy = lerp(286, 168, u);
          p.circle(gx, gy - 26 * s, 9 * s);
          p.arc(gx, gy + 4 * s, 20 * s, 20 * s, Math.PI * 1.08, Math.PI * 1.92);
        }
      }
      if (i % 2 === 1) { const y = lerp(300, 186, u); p.arc(350, y, 16 * s, 6 * s); p.line(350 - 8 * s, y - 2 * s, 350 - 2 * s, y + 3 * s); p.line(350 + 2 * s, y - 3 * s, 350 + 8 * s, y + 2 * s); }
      if (i % 2 === 0 && i > 0) { const y = lerp(300, 186, u); p.path([[346, y], [346, y - 24 * s], [348, y - 30 * s], [352, y - 30 * s], [354, y - 24 * s], [354, y]], true); }
    }
    // the two at the near end, who meet: Mara and Jonah
    p.set({ w: 1.6, a: 1, col: 'ember' });
    p.circle(118, 236, 14); p.arc(118, 296, 32, 34, Math.PI * 1.08, Math.PI * 1.92);
    p.circle(582, 230, 15); p.arc(582, 294, 34, 36, Math.PI * 1.08, Math.PI * 1.92);
    p.set({ col: 'bone' });
    // stars over the garden
    stars(p, 26, 0, 4, DW, 120, 33);
  },
  anim(c, a) {
    const k = clamp(a.k * 1.5 - 0.3);
    if (k <= 0) return;
    c.save(); c.globalAlpha *= k;
    c.strokeStyle = rgba('bone', 0.9); c.lineWidth = 1; c.fillStyle = rgba('ink2', 1);
    LANTERNS.forEach(([x, y], i) => {
      const sw = 0.16 * Math.sin(a.t * 1.9 + i * 0.8);
      c.save(); c.translate(x, y - 12); c.rotate(sw);
      c.beginPath(); c.moveTo(0, 0); c.lineTo(0, 10); c.stroke();
      c.beginPath(); c.ellipse(0, 22, 9, 12, 0, 0, TAU); c.fill(); c.stroke();
      c.beginPath(); c.ellipse(0, 22, 4, 12, 0, 0, TAU); c.stroke();
      c.beginPath(); c.moveTo(-5, 10); c.lineTo(5, 10); c.moveTo(-5, 34); c.lineTo(5, 34); c.moveTo(0, 34); c.lineTo(0, 41); c.stroke();
      c.restore();
    });
    // candle flames on the table
    for (const [x, y, s] of [[350, 270, 1], [350, 222, 0.6]] as [number, number, number][]) {
      c.strokeStyle = rgba('bone', 0.9); c.beginPath(); c.moveTo(x, y); c.lineTo(x, y - 16 * s); c.stroke();
      flame(c, x, y - 17 * s, 10 * s, a.t, x + y);
    }
    c.restore();
  },
  glow(g, a) {
    const k = clamp(a.k * 1.5 - 0.3);
    LANTERNS.forEach(([x, y], i) => {
      const sw = 0.16 * Math.sin(a.t * 1.9 + i * 0.8);
      const f = 0.85 + 0.15 * noise1(a.t * 4 + i, 3);
      g.lamp(x - Math.sin(sw) * 22, y - 12 + Math.cos(sw) * 22, 0.52, 0.85 * f * clamp(k * 3 - i * 0.25));
    });
    g.lamp(350, 248, 0.42, 0.7 * k); g.lamp(350, 207, 0.28, 0.6 * k);
  },
};

const P4: PlateDef = {
  fig: 4, title: 'A DAUGHTER', year: '2016',
  planned: 'THE CLINIC, 2016',
  happened: 'Ida. The detour was the road.',
  draw: 1.8,
  build(p) {
    // the arched window and the night outside
    p.set({ w: 1.3, a: 0.95, speed: 1 });
    p.path([[40, 262], [40, 110], ...ell(120, 110, 80, 80, Math.PI, TAU, 30).slice(1), [200, 262]], true);
    p.line(120, 30, 120, 262); p.line(40, 160, 200, 160);
    p.line(30, 266, 210, 266);
    p.set({ w: 1.2, a: 0.9 });
    p.arc(92, 92, 18, 18, Math.PI * 0.3, Math.PI * 1.7);
    p.arc(100, 92, 14, 16, Math.PI * 0.42, Math.PI * 1.58);
    stars(p, 12, 48, 40, 196, 250, 44);
    // moonlight across the floor
    p.set({ w: 0.6, a: 0.45, speed: 3 });
    p.hatch([[40, 300], [200, 300], [330, 380], [150, 380]], -0.5, 5);
    // the room: floor line, boards
    p.set({ w: 0.9, a: 0.6, speed: 1.5 });
    p.line(0, 300, DW, 300);
    for (let i = 0; i < 10; i++) p.line(lerp(-200, 900, i / 9), DH, lerp(200, 500, i / 9), 300);
    // the mobile's cord and bar
    p.set({ w: 0.9, a: 0.8, speed: 1 });
    p.line(380, 0, 380, 58);
    // the side table with its little lamp
    p.set({ w: 1.2, a: 0.9 });
    p.rect(556, 236, 104, 8);
    p.line(566, 244, 566, 300); p.line(650, 244, 650, 300);
    p.path([[600, 236], [604, 212], [616, 212], [620, 236]]);
    p.path([[588, 212], [632, 212], [622, 186], [598, 186]], true);
    // her name, written large
    const name = strokeText('Ida', 'script', 96, 0);
    p.set({ w: 2.4, a: 1, col: 'ember', speed: 0.9, wobble: 0 });
    p.text(name, 498, 360);
    p.set({ col: 'bone', wobble: 0.35 });
  },
  anim(c, a) {
    const k = clamp(a.k * 1.6 - 0.25);
    if (k <= 0) return;
    c.save(); c.globalAlpha *= k;
    c.lineCap = 'round'; c.lineJoin = 'round';
    // the cradle, rocking on its runners
    const rock = 0.07 * Math.sin(a.t * 1.7);
    c.save(); c.translate(380, 296); c.rotate(rock); c.translate(-380, -296);
    c.strokeStyle = rgba('bone', 0.95); c.lineWidth = 1.4; c.fillStyle = rgba('ink2', 1);
    c.beginPath(); c.moveTo(286, 280); c.quadraticCurveTo(380, 316, 474, 280); c.stroke();
    c.beginPath(); c.moveTo(306, 214); c.lineTo(452, 214); c.lineTo(446, 260); c.quadraticCurveTo(380, 278, 312, 260); c.closePath(); c.fill(); c.stroke();
    c.lineWidth = 0.9;
    for (let x = 316; x < 446; x += 11) { c.beginPath(); c.moveTo(x, 214); c.lineTo(x + (x - 380) * 0.02, 262 + 6 * (1 - ((x - 380) / 70) ** 2)); c.stroke(); }
    c.lineWidth = 1.4;
    c.beginPath(); c.moveTo(452, 214); c.lineTo(456, 178); c.quadraticCurveTo(440, 166, 424, 178); c.lineTo(424, 214); c.stroke();
    c.beginPath(); c.moveTo(330, 268); c.lineTo(326, 284); c.moveTo(430, 268); c.lineTo(434, 284); c.stroke();
    // the blanket and a small head
    c.beginPath(); c.moveTo(330, 214); c.quadraticCurveTo(372, 194, 420, 212); c.stroke();
    c.beginPath(); c.arc(342, 204, 10, 0, TAU); c.fill(); c.stroke();
    c.lineWidth = 0.7;
    for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(356 + i * 14, 206 - i); c.quadraticCurveTo(362 + i * 14, 212, 360 + i * 14, 214); c.stroke(); }
    c.restore();
    // the mobile turning: a bar and five hanging stars
    const rot = a.t * 0.6;
    c.strokeStyle = rgba('bone', 0.85); c.lineWidth = 0.9;
    c.beginPath(); c.moveTo(380 - 70 * Math.cos(rot), 58); c.lineTo(380 + 70 * Math.cos(rot), 58); c.stroke();
    for (let i = 0; i < 5; i++) {
      const ang = rot + (i / 5) * TAU, x = 380 + 70 * Math.cos(ang), d = Math.sin(ang);
      const y = 58 + 24 + 10 * (i % 2);
      c.globalAlpha = k * (0.55 + 0.45 * (d * 0.5 + 0.5));
      c.beginPath(); c.moveTo(x, 58); c.lineTo(x, y - 6); c.stroke();
      c.beginPath();
      for (let j = 0; j <= 10; j++) { const r = j % 2 ? 3 : 7, aa = -Math.PI / 2 + (j / 10) * TAU; c.lineTo(x + Math.cos(aa) * r, y + Math.sin(aa) * r); }
      c.stroke();
    }
    c.restore();
  },
  glow(g, a) {
    const k = clamp(a.k * 1.6 - 0.3);
    g.lamp(610, 204, 1.05, 0.85 * k);
    for (let i = 0; i < 5; i++) {
      const ang = a.t * 0.6 + (i / 5) * TAU, x = 380 + 70 * Math.cos(ang), y = 58 + 24 + 10 * (i % 2);
      g.lamp(x, y, 0.14, 0.5 * k * (0.4 + 0.6 * (Math.sin(ang) * 0.5 + 0.5)));
    }
  },
};

const P5: PlateDef = {
  fig: 5, title: 'HER OWN BAKERY', year: '2018',
  planned: 'MARRIED TO SOMEONE SUITABLE, 2018',
  happened: "Mara's. Every wrong turn headed east.",
  draw: 2.4,
  build(p) {
    // the brick oven: dome, courses, mouth
    p.set({ w: 1.4, a: 0.95, speed: 1 });
    p.arc(290, 300, 176, 150, Math.PI, TAU);
    p.set({ w: 0.7, a: 0.5, speed: 2.5, wobble: 0.2 });
    for (let r = 1; r <= 6; r++) {
      const rx = 176 - r * 16, ry = 150 - r * 13.5;
      if (rx < 78) break;
      p.arc(290, 300, rx, ry, Math.PI, TAU);
      const n = 10 + r;
      for (let i = 0; i < n; i++) { const aa = Math.PI + ((i + (r % 2) * 0.5) / n) * Math.PI; p.line(290 + Math.cos(aa) * rx, 300 + Math.sin(aa) * ry, 290 + Math.cos(aa) * (rx + 16), 300 + Math.sin(aa) * (ry + 13.5)); }
    }
    p.set({ w: 1.4, a: 0.95, speed: 1, wobble: 0.35 });
    p.arc(290, 300, 76, 66, Math.PI, TAU);
    p.arc(290, 300, 86, 76, Math.PI, TAU);
    // the base and the chimney
    p.rect(104, 300, 372, 74);
    p.set({ w: 0.6, a: 0.4, speed: 3, wobble: 0.2 });
    for (let y = 310, r = 0; y < 372; y += 10, r++) { p.line(106, y, 474, y); for (let x = 112 + (r % 2) * 12; x < 474; x += 24) p.line(x, y, x, y + 10); }
    p.set({ w: 1.3, a: 0.92, speed: 1, wobble: 0.35 });
    p.path([[270, 152], [270, 30], [312, 30], [312, 152]]);
    p.set({ w: 0.6, a: 0.4, speed: 3 });
    for (let y = 40; y < 150; y += 10) p.line(272, y, 310, y);
    // the window to the east, the sun coming up
    p.set({ w: 1.2, a: 0.9, speed: 1 });
    p.rect(540, 150, 140, 136);
    p.line(610, 150, 610, 286); p.line(540, 218, 680, 218);
    p.arc(612, 270, 24, 24, Math.PI, TAU);
    p.set({ w: 0.8, a: 0.65 });
    for (let i = 1; i < 10; i++) { const aa = Math.PI + (i / 10) * Math.PI; p.line(612 + Math.cos(aa) * 32, 270 + Math.sin(aa) * 32, 612 + Math.cos(aa) * 52, 270 + Math.sin(aa) * 52); }
    p.set({ w: 0.6, a: 0.5, speed: 3 });
    p.hatch(rect(542, 152, 136, 132), 0, 6, (x, y) => 1 - sst(20, 140, Math.hypot(x - 612, y - 270)));
    // the sign: her name
    p.set({ w: 1.1, a: 0.9, speed: 1 });
    p.line(540, 0, 560, 40); p.line(680, 0, 660, 40);
    p.rect(530, 40, 160, 72);
    const name = strokeText("Mara's", 'script', 56, 0);
    p.set({ w: 2.2, a: 1, col: 'ember', wobble: 0 });
    p.text(name, 610 - name.width / 2, 92);
    p.set({ col: 'bone', wobble: 0.35 });
    // the table of loaves, the flour sack
    p.set({ w: 1.2, a: 0.9 });
    p.line(500, 320, 700, 320); p.line(510, 320, 510, 380); p.line(690, 320, 690, 380);
    for (let i = 0; i < 4; i++) { const x = 530 + i * 44; p.arc(x + 14, 318, 20, 11, Math.PI, TAU); for (let j = 0; j < 3; j++) p.line(x + 4 + j * 9, 312, x + 10 + j * 9, 304); }
    p.path([[30, 376], [24, 320], [40, 300], [70, 296], [88, 308], [92, 376]], true);
    const fl = strokeText('FLOUR', 'sans', 13, 1.5);
    p.with({ w: 0.9 }, () => p.text(fl, 58 - fl.width / 2, 346));
  },
  anim(c, a) {
    const k = clamp(a.k * 1.5 - 0.35);
    if (k <= 0) return;
    c.save();
    // inside the mouth: the fire
    c.beginPath(); c.ellipse(290, 300, 76, 66, 0, Math.PI, TAU); c.closePath(); c.clip();
    c.globalAlpha *= k;
    const gr = c.createRadialGradient(290, 300, 6, 290, 290, 90);
    gr.addColorStop(0, rgba('signal', 0.65)); gr.addColorStop(1, rgba('blood', 0.08));
    c.fillStyle = gr; c.fillRect(200, 220, 180, 90);
    for (let i = 0; i < 9; i++) {
      const x = 236 + i * 13.5, h = 28 + 26 * (0.5 + 0.5 * noise1(a.t * 4 + i * 1.7, 5)) * (1 - Math.abs(i - 4) / 6);
      flame(c, x, 300, h, a.t, i * 3.3, i % 2 ? rgba('ember', 0.9) : rgba('signal', 0.95));
    }
    c.restore();
    // sparks up the chimney, steam off the loaves
    c.save(); c.globalAlpha *= k;
    for (let i = 0; i < 10; i++) {
      const ph = (a.t * 0.5 + hash(i, 1)) % 1;
      c.fillStyle = rgba('ember', (1 - ph) * 0.9);
      c.fillRect(290 + 20 * Math.sin(ph * 7 + i) - 1, 236 - ph * 70, 2, 2);
    }
    c.strokeStyle = rgba('bone', 0.5); c.lineWidth = 0.9;
    for (let i = 0; i < 4; i++) {
      const x = 544 + i * 44, ph = (a.t * 0.4 + i * 0.27) % 1;
      c.globalAlpha = k * Math.sin(ph * Math.PI) * 0.8;
      c.beginPath();
      for (let j = 0; j <= 12; j++) { const y = 300 - j * 5 - ph * 30; c.lineTo(x + 5 * Math.sin(j * 0.7 + a.t * 2 + i), y); }
      c.stroke();
    }
    c.restore();
  },
  glow(g, a) {
    const k = clamp(a.k * 1.5 - 0.35);
    const f = 0.8 + 0.2 * noise1(a.t * 6, 2);
    g.lamp(290, 282, 2.1, 0.75 * f * k);
    g.lamp(612, 266, 1.25, 0.7 * clamp(a.k * 2 - 0.5));
    g.lamp(610, 76, 0.5, 0.35 * k);
  },
};

/** The plan, as he drew it, on his table (the world's sheet mapped into a quad). */
function planOnSheet(p: Plot, q: [Pt, Pt, Pt, Pt]) {
  const at = (x: number, y: number): Pt => {
    const u = x / 100, v = y / 100;
    const top: Pt = [lerp(q[0][0], q[1][0], u), lerp(q[0][1], q[1][1], u)], bot: Pt = [lerp(q[3][0], q[2][0], u), lerp(q[3][1], q[2][1], u)];
    return [lerp(top[0], bot[0], v), lerp(top[1], bot[1], v)];
  };
  p.set({ w: 1.6, a: 0.95, wobble: 0.1 });
  p.path(PLAN_PTS.map((pt) => at(pt.x, pt.y)));
  p.set({ w: 0.9, a: 0.8 });
  for (const pt of PLAN_PTS) { const [x, y] = at(pt.x, pt.y); p.circle(x, y, 3.6); }
  // a tick a year
  p.set({ w: 0.6, a: 0.6, speed: 3 });
  for (let i = 1; i < PLAN_PTS.length; i++) {
    const a = PLAN_PTS[i - 1]!, b = PLAN_PTS[i]!;
    for (let u = 0.12; u < 1; u += 0.12) {
      const [x, y] = at(lerp(a.x, b.x, u), lerp(a.y, b.y, u)), [x2, y2] = at(lerp(a.x, b.x, u) + 1.5, lerp(a.y, b.y, u) + 1.5);
      p.line(x, y, x2, y2);
    }
  }
  // the coast, roughly
  p.set({ w: 0.8, a: 0.6, speed: 1.5, wobble: 0.6 });
  const co: Pt[] = [];
  for (let y = 4; y <= 96; y += 6) co.push(at(84 + 6 * Math.sin(y / 9), y));
  p.path(co);
  p.set({ speed: 1, wobble: 0.35 });
}
const P6: PlateDef = {
  fig: 6, title: 'HER FATHER', year: '2021',
  planned: 'THE HOUSE NEXT DOOR TO HIM, 2020',
  happened: 'She lost him that winter. She kept his pens.',
  draw: 2.4,
  build(p) {
    // the winter window
    p.set({ w: 1.1, a: 0.85, speed: 1 });
    p.rect(24, 14, 150, 92); p.line(99, 14, 99, 106); p.line(24, 60, 174, 60);
    // his drafting board
    p.set({ w: 1.4, a: 0.95 });
    p.path([[56, 330], [644, 330], [566, 120], [134, 120]], true);
    p.path([[56, 330], [56, 344], [644, 344], [644, 330]]);
    p.set({ w: 0.5, a: 0.3, speed: 4 });
    p.hatch([[56, 330], [644, 330], [566, 120], [134, 120]], 0.08, 7);
    // the plan he drew, pinned to it
    const Q: [Pt, Pt, Pt, Pt] = [[214, 146], [474, 146], [526, 306], [168, 306]];
    p.set({ w: 1.2, a: 0.95, speed: 1 });
    p.path(Q, true);
    for (const [x, y] of Q) p.circle(x + (x < 300 ? 7 : -7), y + (y < 200 ? 7 : -7), 2.4);
    planOnSheet(p, Q);
    const fm = strokeText('for Mara', 'script', 26, 0);
    p.set({ w: 1.3, a: 0.9, wobble: 0 });
    p.text(fm, 196, 292);
    p.set({ wobble: 0.35 });
    // dividers, a pen, his glasses
    p.set({ w: 1.2, a: 0.95 });
    p.circle(568, 226, 5);
    p.path([[565, 230], [520, 304], [524, 304], [570, 231]]);
    p.path([[572, 230], [604, 300], [608, 299], [574, 229]]);
    p.path([[84, 296], [196, 244], [199, 249], [88, 301]], true);
    p.line(84, 296, 76, 302);
    p.circle(136, 196, 17); p.circle(178, 200, 17);
    p.arc(157, 198, 5, 4, Math.PI * 1.1, Math.PI * 1.9);
    p.line(120, 192, 98, 176); p.line(194, 196, 216, 182);
    // the candle on its dish
    p.arc(620, 352, 34, 8);
    p.path([[606, 352], [606, 252], [634, 252], [634, 352]]);
    p.arc(620, 252, 14, 3.5);
    p.path([[612, 254], [611, 272], [614, 280], [615, 262]]);
    p.path([[628, 254], [629, 292], [632, 296], [632, 258]]);
  },
  anim(c, a) {
    const k = clamp(a.k * 1.6 - 0.3);
    if (k <= 0) return;
    c.save(); c.globalAlpha *= k;
    // snow in the window
    c.save(); c.beginPath(); c.rect(25, 15, 148, 90); c.clip();
    c.fillStyle = rgba('bone', 0.8);
    for (let i = 0; i < 40; i++) { const y = ((hash(i, 1) * 100 + a.t * (14 + 10 * hash(i, 2))) % 100) + 10, x = 24 + ((hash(i, 3) * 150 + 6 * Math.sin(a.t + i)) % 150); c.fillRect(x, y, 1.6, 1.6); }
    c.restore();
    // the flame: it gutters and goes out toward the end of the line
    const out = clamp((a.life - 0.62) / 0.16);
    const h = 18 * (1 - ease.inQuad(out));
    c.strokeStyle = rgba('bone', 0.9); c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(620, 252); c.lineTo(620, 244); c.stroke();
    if (h > 0.5) flame(c, 620, 245, h, a.t, 6);
    if (out > 0) {
      c.strokeStyle = rgba('bone', 0.55); c.lineWidth = 1;
      const ph = clamp((a.life - 0.7) / 0.3);
      c.globalAlpha = k * (1 - ph * 0.6);
      c.beginPath();
      for (let j = 0; j <= 30; j++) { const y = 244 - j * 4 * (0.3 + ph); c.lineTo(620 + 7 * Math.sin(j * 0.45 + a.t * 1.3) * (j / 30), y); }
      c.stroke();
    }
    c.restore();
  },
  glow(g, a) {
    const k = clamp(a.k * 1.6 - 0.3);
    const out = clamp((a.life - 0.62) / 0.16);
    g.lamp(620, 232, 1.2, 0.85 * k * (1 - out) * (0.85 + 0.15 * noise1(a.t * 7, 4)));
  },
};

const P7: PlateDef = {
  fig: 7, title: 'THE LIGHTHOUSE', year: '2024',
  planned: 'NOTHING DRAWN HERE',
  happened: 'An islet no map had shown. They arrived.',
  draw: 2.6,
  build(p) {
    const H = 250;
    stars(p, 70, 0, 4, DW, H - 30, 71);
    p.set({ w: 0.9, a: 0.7, speed: 1 });
    p.line(0, H, 380, H); p.line(650, H, DW, H);
    // the islet's rocks
    p.set({ w: 1.3, a: 0.95 });
    const rock: Pt[] = [[372, H + 4], [392, H - 8], [420, H - 14], [450, H - 12], [480, H - 22], [520, H - 26], [560, H - 20], [600, H - 10], [640, H - 2], [660, H + 6]];
    p.path(rock);
    p.set({ w: 0.6, a: 0.5, speed: 3 });
    p.hatch([...rock, [660, H + 14], [372, H + 14]], 0.7, 4.5);
    // the cottage
    p.set({ w: 1.2, a: 0.92, speed: 1 });
    p.rect(414, H - 46, 54, 34); p.path([[408, H - 46], [441, H - 70], [474, H - 46]]);
    p.rect(426, H - 38, 12, 12); p.line(452, H - 12, 452, H - 32); p.line(460, H - 12, 460, H - 32); p.line(452, H - 32, 460, H - 32);
    // the tower, banded
    const tw: Pt[] = [[502, H - 24], [538, H - 24], [530, 112], [510, 112]];
    p.path(tw, true);
    for (let b = 0; b < 3; b++) {
      const y0 = H - 24 - (b + 0.5) * 38, y1 = y0 - 18;
      const xl = (y: number) => lerp(502, 510, (H - 24 - y) / (H - 136)), xr = (y: number) => lerp(538, 530, (H - 24 - y) / (H - 136));
      p.with({ w: 0.7, a: 0.7, speed: 3 }, () => p.hatch([[xl(y0), y0], [xr(y0), y0], [xr(y1), y1], [xl(y1), y1]], 1.2, 2.8));
    }
    p.arc(520, H - 24, 6, 9, Math.PI, TAU);
    // gallery, lantern room, roof
    p.line(498, 112, 542, 112); p.line(500, 104, 540, 104);
    for (let x = 500; x <= 540; x += 8) p.line(x, 104, x, 112);
    p.rect(509, 80, 22, 24); p.line(516, 80, 516, 104); p.line(524, 80, 524, 104);
    p.path([[505, 80], [520, 62], [535, 80]]); p.circle(520, 59, 3);
    // the sea
    p.set({ w: 0.8, a: 0.5, speed: 2.5 });
    sea(p, H + 6, DH, 17, (x, y) => 1 - sst(10 + (y - H) * 0.3, 30 + (y - H) * 0.6, Math.abs(x - 520)));
    // the near shore, and the three of them looking out
    p.set({ w: 1.2, a: 0.95, speed: 1 });
    p.path([[0, 336], [70, 330], [160, 334], [230, 348], [270, 380]]);
    p.with({ w: 0.6, a: 0.45, speed: 3 }, () => p.hatch([[0, 340], [70, 334], [160, 338], [230, 352], [266, 380], [0, 380]], -0.7, 5));
    p.set({ w: 1.5, a: 1, col: 'ember' });
    figure(p, 112, 331, 52, true);
    figure(p, 140, 332, 58);
    figure(p, 164, 334, 30, true);
    p.set({ col: 'bone' });
  },
  anim(c, a) {
    const k = clamp((a.k - 0.55) / 0.3);
    if (k <= 0) return;
    c.save(); c.globalAlpha *= k;
    c.fillStyle = rgba('ember', 0.95);
    c.fillRect(511, 84, 18, 18);
    c.fillStyle = rgba('signal', 0.8);
    c.fillRect(428, 214, 8, 8);
    c.restore();
  },
  glow(g, a) {
    const k = clamp((a.k - 0.55) / 0.3);
    if (k <= 0) return;
    // two beams turning: seen from the shore they sweep left and right across the sky
    const ang = a.t * 1.9;
    for (const off of [0, Math.PI]) {
      const d = Math.cos(ang + off), face = Math.sin(ang + off);
      if (Math.abs(d) < 0.04) continue;
      const len = (d > 0 ? DW - 540 : 500) * Math.abs(d);
      for (let j = -6; j <= 6; j++) {
        const spread = j * 1.6 * (0.4 + Math.abs(d));
        const ex = 520 + Math.sign(d) * len, ey = 92 + spread * 4 + (face > 0 ? 6 : -6) * Math.abs(d);
        g.seg(520, 92, ex, Math.max(4, Math.min(DH - 4, ey)), 2.2, LIN.ember, 0.12 * k * (1 - Math.abs(j) / 7) * (0.5 + 0.5 * Math.abs(d)));
      }
    }
    const flare = Math.pow(Math.max(0, Math.sin(ang)), 8) + Math.pow(Math.max(0, Math.sin(ang + Math.PI)), 8);
    g.lamp(520, 92, 1.0 + 1.6 * flare, k);
    g.lamp(432, 218, 0.35, 0.6 * k);
    for (let i = 0; i < 16; i++) {
      const y = 262 + Math.pow(hash(i, 3), 1.3) * 110, w = 4 + (y - 250) * 0.15;
      const x = 520 + (hash(i, 5) - 0.5) * (10 + (y - 250) * 0.4);
      g.seg(x - w, y, x + w, y, 1.4, LIN.ember, 0.6 * k * (0.4 + 0.6 * flare) * (0.5 + 0.5 * Math.sin(a.t * 4 + i)));
    }
  },
};

export const PLATES: Record<string, PlateDef> = { ferry: P1, bakery: P2, feast: P3, ida: P4, oven: P5, father: P6, light: P7 };
const built = new Map<string, Plot>();
/** The static engraving of a plate (built once). */
export function plot(id: string): Plot {
  let p = built.get(id);
  if (!p) { p = new Plot(); PLATES[id]!.build(p); built.set(id, p); }
  return p;
}

// ------------------------------------------------------------------ the card
export const CW = 760, CH = 580, DX = 30, DY = 72;
/** On-screen size of a fully open plate (a fraction of CW × CH). */
export const PS = 0.9;
export interface PlateState {
  /** Card centre (screen px) and unfold scales (0..1 each), opacity. */
  x: number; y: number; sx: number; sy: number; alpha: number;
  a: AnimCtx;
  planK: number; strikeK: number; happenK: number;
}
/** Plate coordinates (drawing area) -> screen px for a plate in state s. */
export const plateToScreen = (s: PlateState, lx: number, ly: number) => ({ x: s.x + (lx + DX - CW / 2) * s.sx * PS, y: s.y + (ly + DY - CH / 2) * s.sy * PS });

/** Draw a plate card (Canvas2D, screen space). */
export function drawPlate(c: CanvasRenderingContext2D, id: string, s: PlateState, fonts: { mono: (w: number) => string; serif: (w: number, it?: boolean) => string }) {
  const def = PLATES[id]!;
  if (s.alpha <= 0.001 || s.sx <= 0.001 || s.sy <= 0.001) return;
  c.save();
  c.globalAlpha = s.alpha;
  c.translate(s.x, s.y);
  c.scale(s.sx * PS, s.sy * PS);
  c.translate(-CW / 2, -CH / 2);
  // shadow and card
  c.fillStyle = 'rgba(0,0,0,0.45)';
  c.fillRect(10, 14, CW, CH);
  c.fillStyle = rgba('ink2', 1);
  c.fillRect(0, 0, CW, CH);
  const vg = c.createRadialGradient(CW / 2, CH * 0.45, 100, CW / 2, CH * 0.45, CW * 0.7);
  vg.addColorStop(0, 'rgba(255,255,255,0.025)'); vg.addColorStop(1, 'rgba(0,0,0,0.25)');
  c.fillStyle = vg; c.fillRect(0, 0, CW, CH);
  c.strokeStyle = rgba('bone', 0.85); c.lineWidth = 1.4; c.strokeRect(5, 5, CW - 10, CH - 10);
  c.strokeStyle = rgba('bone', 0.35); c.lineWidth = 0.7; c.strokeRect(12, 12, CW - 24, CH - 24);
  // header
  const tk = clamp(s.planK * 2);
  c.globalAlpha = s.alpha * tk;
  c.textBaseline = 'alphabetic';
  c.font = `13px "${fonts.mono(500)}"`; c.letterSpacing = '4px'; c.fillStyle = rgba('ash', 0.95); c.textAlign = 'left';
  c.fillText(`FIG. ${def.fig}`, DX, 48);
  c.font = `15px "${fonts.mono(600)}"`; c.letterSpacing = '3px'; c.fillStyle = rgba('signal', 1); c.textAlign = 'right';
  c.fillText(def.year, CW - DX + 3, 48);
  c.font = `30px "${fonts.serif(600)}"`; c.letterSpacing = '5px'; c.fillStyle = rgba('bone', 1); c.textAlign = 'center';
  c.fillText(def.title, CW / 2, 50);
  c.textAlign = 'left'; c.letterSpacing = '0px';
  c.globalAlpha = s.alpha;
  // the drawing area
  c.strokeStyle = rgba('bone', 0.55); c.lineWidth = 0.9; c.strokeRect(DX - 0.5, DY - 0.5, DW + 1, DH + 1);
  c.strokeStyle = rgba('bone', 0.25); c.lineWidth = 0.6; c.strokeRect(DX - 5, DY - 5, DW + 10, DH + 10);
  c.save();
  c.beginPath(); c.rect(DX, DY, DW, DH); c.clip();
  c.translate(DX, DY);
  const head = plot(id).draw(c, s.a.k, 1);
  def.anim?.(c, s.a);
  if (head) {
    c.fillStyle = rgba('ember', 1);
    c.beginPath(); c.arc(head[0], head[1], 2.4, 0, TAU); c.fill();
  }
  c.restore();
  // what was planned (on a strip of the map's paper), struck through
  if (s.planK > 0) {
    const y0 = DY + DH + 18;
    c.save();
    c.globalAlpha = s.alpha * clamp(s.planK * 1.5);
    const w = DW * ease.outCubic(clamp(s.planK));
    c.fillStyle = rgba('bone', 0.96); c.fillRect(DX, y0, w, 38);
    c.beginPath(); c.rect(DX, y0, w, 38); c.clip();
    c.font = `12px "${fonts.mono(600)}"`; c.letterSpacing = '3px'; c.fillStyle = rgba('ink', 0.7);
    c.fillText('PLANNED', DX + 14, y0 + 24);
    c.font = `15px "${fonts.mono(500)}"`; c.letterSpacing = '2px'; c.fillStyle = rgba('ink', 0.92);
    c.fillText(def.planned, DX + 128, y0 + 25);
    const tw = c.measureText(def.planned).width;
    if (s.strikeK > 0) {
      c.strokeStyle = rgba('blood', 1); c.lineWidth = 2.6; c.lineCap = 'round';
      c.beginPath(); c.moveTo(DX + 122, y0 + 20); c.lineTo(DX + 122 + (tw + 14) * ease.inOutSine(s.strikeK), y0 + 19 - 1.5 * s.strikeK); c.stroke();
    }
    c.restore();
  }
  // what happened
  if (s.happenK > 0) {
    const y = DY + DH + 98;
    c.save();
    c.font = `12px "${fonts.mono(600)}"`; c.letterSpacing = '3px'; c.fillStyle = rgba('signal', clamp(s.happenK * 3));
    c.fillText('HAPPENED', DX + 14, y - 6);
    c.letterSpacing = '0px';
    c.font = `29px "${fonts.serif(500, true)}"`;
    const tw = c.measureText(def.happened).width;
    const xr = DX + 128 + (tw + 30) * ease.outCubic(clamp(s.happenK));
    const gr = c.createLinearGradient(xr - 30, 0, xr, 0);
    gr.addColorStop(0, rgba('bone', 1)); gr.addColorStop(1, rgba('bone', 0));
    c.fillStyle = gr;
    c.beginPath(); c.rect(DX + 120, y - 34, xr - DX - 120, 48); c.clip();
    c.fillText(def.happened, DX + 128, y - 4);
    c.restore();
  }
  // the folds: while it opens the paper is creased across the middle and at the quarters
  const fold = 1 - s.sy;
  if (fold > 0.001) {
    for (let i = 0; i < 4; i++) {
      const y0 = (i * CH) / 4, y1 = ((i + 1) * CH) / 4;
      const g = c.createLinearGradient(0, y0, 0, y1);
      const dark = `rgba(0,0,0,${(0.55 * fold).toFixed(3)})`, lite = `rgba(255,255,255,${(0.06 * fold).toFixed(3)})`;
      if (i % 2 === 0) { g.addColorStop(0, lite); g.addColorStop(1, dark); } else { g.addColorStop(0, dark); g.addColorStop(1, lite); }
      c.fillStyle = g; c.fillRect(0, y0, CW, y1 - y0);
    }
  }
  c.strokeStyle = rgba('bone', 0.08); c.lineWidth = 1;
  c.beginPath(); c.moveTo(0, CH / 2); c.lineTo(CW, CH / 2); c.stroke();
  c.restore();
}
