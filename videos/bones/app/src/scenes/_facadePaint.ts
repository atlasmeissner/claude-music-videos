// The façade as a solid, lit building (for plates that treat it as masonry rather than as a drawing): painted
// once into a canvas in façade units (see _facade.ts) — stone in courses with per-block tone, a floodlight from
// the upper left, deep shadow in the portico, cylindrical shading on the columns, a shaded dome, gold leaf, dark
// glass — with the line members laid over it lightly as carved detail. Transparent outside the silhouette.
import { FACADE, COLS, STEP_Y, SHAFT, CAP, ARCH, FRIEZE, CORNICE, PED, WING, DOME } from './_facade';
import { hash } from '../engine/util';

export const PAINT = { x0: -800, x1: 800, y0: -1040, y1: 20, px: 2 };

const STONE = [186, 176, 160], LIT = [214, 205, 188], SHADE = [92, 85, 76], DEEP = [26, 23, 20];
const rgb = (c: number[], k = 1, a = 1) => `rgba(${Math.round(c[0]! * k)},${Math.round(c[1]! * k)},${Math.round(c[2]! * k)},${a})`;
const GOLD = '#C8A04A', GOLD_HI = '#EBCB7C', GOLD_LO = '#7E6224', GLASS = '#121315';

/** Paint the façade; returns the canvas (PAINT.px canvas px per façade unit). */
export function paintFacade(): HTMLCanvasElement {
  const P = PAINT;
  const cv = document.createElement('canvas');
  cv.width = (P.x1 - P.x0) * P.px; cv.height = (P.y1 - P.y0) * P.px;
  const c = cv.getContext('2d')!;
  c.setTransform(P.px, 0, 0, P.px, -P.x0 * P.px, -P.y0 * P.px);
  c.lineJoin = 'round';
  const blockTone = (i: number, j: number, s: number) => 0.9 + 0.16 * hash(i, j, s);

  // ---- steps
  STEP_Y.forEach((y, i) => {
    const y0 = i === 0 ? 0 : STEP_Y[i - 1]!;
    const w = i === 0 ? 800 : i === 1 ? 470 : 455;
    c.fillStyle = rgb(STONE, 0.86 - i * 0.03); c.fillRect(-w, y, w * 2, y0 - y);
    c.fillStyle = rgb(LIT, 1); c.fillRect(-w, y, w * 2, 2.2);
    c.fillStyle = rgb(SHADE, 0.8, 0.8); c.fillRect(-w, y0 - 1.5, w * 2, 1.5);
  });

  // ---- wings: rusticated courses, per-block tone, bevel light/shadow
  for (const side of [-1, 1]) {
    const x0 = side < 0 ? -WING.x1 : WING.x0, x1 = side < 0 ? -WING.x0 : WING.x1;
    let row = 0;
    for (let y = STEP_Y[0]!; y > WING.top + 1; y -= 34) {
      const yt = Math.max(WING.top, y - 34);
      const off = row % 2 ? 0 : 33;
      for (let x = x0 - 66 + off; x < x1; x += 66) {
        const a = Math.max(x0, x), b = Math.min(x1, x + 66);
        if (b <= a) continue;
        // floodlight falloff: brighter high and left
        const lightK = 0.82 + 0.18 * ((yt - STEP_Y[0]!) / (WING.top - STEP_Y[0]!)) + (side < 0 ? 0.04 : -0.03);
        c.fillStyle = rgb(STONE, blockTone(Math.round(x), row, side) * lightK); c.fillRect(a, yt, b - a, y - yt);
        c.fillStyle = rgb(LIT, 1, 0.55); c.fillRect(a + 1, yt + 1, b - a - 2, 1.6);
        c.fillStyle = rgb(DEEP, 1, 0.7); c.fillRect(a, y - 2, b - a, 2); c.fillRect(b - 1.6, yt, 1.6, y - yt);
      }
      row++;
    }
    // cornice band and balustrade
    c.fillStyle = rgb(LIT, 0.95); c.fillRect(x0 - 10, WING.top - 10, x1 - x0 + 20, 10);
    c.fillStyle = rgb(SHADE, 1); c.fillRect(x0 - 10, WING.top, x1 - x0 + 20, 4);
    c.fillStyle = rgb(STONE, 0.95); c.fillRect(x0, WING.bal, x1 - x0, 6); c.fillRect(x0, WING.top - 22, x1 - x0, 6);
    c.fillStyle = rgb(DEEP, 1, 0.9); c.fillRect(x0, WING.bal + 6, x1 - x0, WING.top - 22 - WING.bal - 6);
    for (let x = x0 + 14; x < x1 - 8; x += 22) {
      c.fillStyle = rgb(STONE, 0.9);
      c.beginPath(); c.moveTo(x - 4, WING.top - 22); c.lineTo(x - 7, WING.top - 30); c.lineTo(x - 3, WING.top - 38); c.lineTo(x - 5, WING.bal + 6);
      c.lineTo(x + 5, WING.bal + 6); c.lineTo(x + 3, WING.top - 38); c.lineTo(x + 7, WING.top - 30); c.lineTo(x + 4, WING.top - 22); c.closePath(); c.fill();
    }
    // windows: dark glass with a faint reflection, gold surround and pediment, shadow under the sill
    for (const [yb, yt] of [[-90, -220], [-310, -440]] as const) {
      for (const k of [0.3, 0.7]) {
        const cx = x0 + (x1 - x0) * k;
        c.fillStyle = GOLD_LO; c.fillRect(cx - 44, yt - 10, 88, yb - yt + 20);
        c.fillStyle = GLASS; c.fillRect(cx - 34, yt, 68, yb - yt);
        const g = c.createLinearGradient(cx - 34, yt, cx + 34, yb);
        g.addColorStop(0, 'rgba(120,124,128,0.22)'); g.addColorStop(0.4, 'rgba(60,62,66,0.05)'); g.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = g; c.fillRect(cx - 34, yt, 68, yb - yt);
        c.fillStyle = rgb(STONE, 0.7); c.fillRect(cx - 1.5, yt, 3, yb - yt); c.fillRect(cx - 34, (yb + yt) / 2 - 1.5, 68, 3);
        c.strokeStyle = GOLD; c.lineWidth = 3; c.strokeRect(cx - 41, yt - 7, 82, yb - yt + 14);
        c.fillStyle = GOLD; c.beginPath(); c.moveTo(cx - 52, yt - 13); c.lineTo(cx, yt - 46); c.lineTo(cx + 52, yt - 13); c.closePath(); c.fill();
        c.fillStyle = GOLD_HI; c.beginPath(); c.moveTo(cx - 52, yt - 13); c.lineTo(cx, yt - 46); c.lineTo(cx, yt - 40); c.lineTo(cx - 44, yt - 15); c.closePath(); c.fill();
        c.fillStyle = rgb(LIT, 1); c.fillRect(cx - 50, yb + 8, 100, 6);
        c.fillStyle = rgb(DEEP, 1, 0.6); c.fillRect(cx - 48, yb + 14, 96, 8);
      }
    }
    // medallion
    const mx = (x0 + x1) / 2;
    c.fillStyle = GOLD; c.beginPath(); c.ellipse(mx, -265, 20, 14, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = GOLD_HI; c.beginPath(); c.ellipse(mx - 5, -269, 10, 6, 0, 0, Math.PI * 2); c.fill();
  }

  // ---- portico: the deep shadow behind the columns, a door
  {
    const g = c.createLinearGradient(0, ARCH.y0, 0, STEP_Y[2]!);
    g.addColorStop(0, rgb(DEEP, 0.6)); g.addColorStop(1, rgb(SHADE, 0.55));
    c.fillStyle = g; c.fillRect(-440, ARCH.y0, 880, STEP_Y[2]! - ARCH.y0);
    for (let y = STEP_Y[2]!; y > ARCH.y0; y -= 34) { c.fillStyle = rgb(DEEP, 0.5, 0.5); c.fillRect(-440, y - 1.2, 880, 1.2); }
    c.fillStyle = GOLD_LO; c.fillRect(-58, -300, 116, 258);
    c.fillStyle = rgb(DEEP, 0.4); c.fillRect(-48, -290, 96, 248);
  }

  // ---- columns: cylindrical shading, fluting, bases, gilded capitals
  for (const x of COLS) {
    const sh = (u: number) => SHAFT.rb + (SHAFT.rt - SHAFT.rb) * Math.pow(u, 1.4);
    // cast shadow of the column on the back wall (light from upper left)
    c.fillStyle = 'rgba(0,0,0,0.35)';
    c.beginPath(); c.moveTo(x + sh(0), SHAFT.y0); c.lineTo(x + sh(0) + 40, SHAFT.y0); c.lineTo(x + sh(1) + 70, SHAFT.y1); c.lineTo(x + sh(1), SHAFT.y1); c.closePath(); c.fill();
    const g = c.createLinearGradient(x - SHAFT.rb, 0, x + SHAFT.rb, 0);
    g.addColorStop(0, rgb(STONE, 0.75)); g.addColorStop(0.3, rgb(LIT, 1.03)); g.addColorStop(0.65, rgb(STONE, 0.85)); g.addColorStop(1, rgb(SHADE, 0.7));
    c.fillStyle = g;
    c.beginPath();
    for (let i = 0; i <= 14; i++) { const u = i / 14; c.lineTo(x - sh(u), SHAFT.y0 + (SHAFT.y1 - SHAFT.y0) * u); }
    for (let i = 14; i >= 0; i--) { const u = i / 14; c.lineTo(x + sh(u), SHAFT.y0 + (SHAFT.y1 - SHAFT.y0) * u); }
    c.closePath(); c.fill();
    c.strokeStyle = 'rgba(40,34,28,0.35)'; c.lineWidth = 1;
    for (const fl of [-0.66, -0.33, 0, 0.33, 0.66]) { c.beginPath(); c.moveTo(x + fl * sh(0), SHAFT.y0 - 4); c.lineTo(x + fl * sh(1), SHAFT.y1 + 4); c.stroke(); }
    c.fillStyle = rgb(LIT, 0.95); c.fillRect(x - 36, STEP_Y[2]! - 8, 72, 8);
    c.beginPath(); c.ellipse(x, STEP_Y[2]! - 13, 32, 6, 0, 0, Math.PI * 2); c.fillStyle = rgb(STONE, 0.95); c.fill();
    // capital
    c.fillStyle = rgb(STONE, 0.95); c.fillRect(x - 38, CAP.y1, 76, 9);
    const cg = c.createLinearGradient(x - 32, 0, x + 32, 0);
    cg.addColorStop(0, GOLD_LO); cg.addColorStop(0.35, GOLD_HI); cg.addColorStop(1, GOLD_LO);
    c.fillStyle = cg;
    c.beginPath(); c.moveTo(x - 22, CAP.y0); c.lineTo(x - 32, CAP.y1 + 9); c.lineTo(x + 32, CAP.y1 + 9); c.lineTo(x + 22, CAP.y0); c.closePath(); c.fill();
  }

  // ---- entablature
  c.fillStyle = rgb(STONE, 1.0); c.fillRect(FRIEZE.x0, ARCH.y1, FRIEZE.x1 - FRIEZE.x0, ARCH.y0 - ARCH.y1);
  c.fillStyle = rgb(LIT, 1); c.fillRect(FRIEZE.x0, ARCH.y1, FRIEZE.x1 - FRIEZE.x0, 2); c.fillRect(FRIEZE.x0, ARCH.y0 - 27, FRIEZE.x1 - FRIEZE.x0, 1.5); c.fillRect(FRIEZE.x0, ARCH.y0 - 13, FRIEZE.x1 - FRIEZE.x0, 1.5);
  c.fillStyle = rgb(STONE, 0.9); c.fillRect(FRIEZE.x0, FRIEZE.y1, FRIEZE.x1 - FRIEZE.x0, FRIEZE.y0 - FRIEZE.y1);
  c.fillStyle = rgb(LIT, 1.02); c.fillRect(FRIEZE.x0 - 14, CORNICE.y1, FRIEZE.x1 - FRIEZE.x0 + 28, CORNICE.y0 - CORNICE.y1 - 10);
  c.fillStyle = rgb(DEEP, 0.9); c.fillRect(FRIEZE.x0 - 14, CORNICE.y0 - 10, FRIEZE.x1 - FRIEZE.x0 + 28, 10);
  for (let x = FRIEZE.x0 - 8; x < FRIEZE.x1 + 8; x += 13) { c.fillStyle = rgb(STONE, 0.95); c.fillRect(x, CORNICE.y0 - 11, 7, 9); }
  c.fillStyle = rgb(DEEP, 1, 0.5); c.fillRect(FRIEZE.x0, ARCH.y0, FRIEZE.x1 - FRIEZE.x0, 6);

  // ---- pediment
  c.fillStyle = rgb(LIT, 0.98);
  c.beginPath(); c.moveTo(PED.x0, PED.y0); c.lineTo(0, PED.apex); c.lineTo(PED.x1, PED.y0); c.closePath(); c.fill();
  c.fillStyle = rgb(STONE, 0.78);
  c.beginPath(); c.moveTo(PED.x0 + 40, PED.y0 - 10); c.lineTo(0, PED.apex + 26); c.lineTo(PED.x1 - 40, PED.y0 - 10); c.closePath(); c.fill();
  c.fillStyle = rgb(DEEP, 1, 0.5);
  c.beginPath(); c.moveTo(PED.x0 + 40, PED.y0 - 10); c.lineTo(0, PED.apex + 26); c.lineTo(0, PED.apex + 34); c.lineTo(PED.x0 + 54, PED.y0 - 12); c.closePath(); c.fill();
  {
    const wy = PED.y0 - 62;
    const g = c.createRadialGradient(-8, wy - 8, 2, 0, wy, 40);
    g.addColorStop(0, GOLD_HI); g.addColorStop(1, GOLD_LO);
    c.fillStyle = g; c.beginPath(); c.arc(0, wy, 38, 0, Math.PI * 2); c.fill();
    c.fillStyle = rgb(STONE, 0.78); c.beginPath(); c.arc(0, wy, 24, 0, Math.PI * 2); c.fill();
  }

  // ---- dome: drum, shaded shell, lantern
  {
    const { cy, R } = DOME;
    c.fillStyle = rgb(STONE, 0.92); c.fillRect(-R - 12, DOME.drum0, 2 * R + 24, cy - DOME.drum0);
    for (let i = -3; i <= 3; i++) { c.fillStyle = rgb(LIT, 1, 0.6); c.fillRect(i * (R / 3.3) - 4, cy, 6, DOME.drum0 - cy); c.fillStyle = rgb(DEEP, 1, 0.45); c.fillRect(i * (R / 3.3) + 2, cy, 3, DOME.drum0 - cy); }
    c.fillStyle = rgb(LIT, 1); c.fillRect(-R - 18, cy - 4, 2 * R + 36, 8);
    const g = c.createRadialGradient(-R * 0.4, cy - R * 0.6, R * 0.1, 0, cy, R * 1.15);
    g.addColorStop(0, 'rgb(150,150,142)'); g.addColorStop(0.6, 'rgb(84,86,82)'); g.addColorStop(1, 'rgb(38,40,38)');
    c.fillStyle = g; c.beginPath(); c.arc(0, cy, R, Math.PI, 2 * Math.PI); c.closePath(); c.fill();
    c.fillStyle = GOLD; c.fillRect(-22, cy - R - 60, 44, 60);
    c.fillStyle = GOLD_HI; c.fillRect(-22, cy - R - 60, 12, 60);
    c.beginPath(); c.arc(0, cy - R - 60, 22, Math.PI, 2 * Math.PI); c.fillStyle = GOLD; c.fill();
  }

  // ---- the line members as carved detail (gold ornament in gold, stone joints darker)
  for (const m of FACADE) {
    if (m.layer === 'frame' || m.layer === 'found') continue;
    c.strokeStyle = m.layer === 'gold' ? 'rgba(236,200,110,0.95)' : 'rgba(30,26,22,0.45)';
    c.lineWidth = m.layer === 'gold' ? Math.max(1.2, m.w * 1.4) : Math.max(0.8, m.w * 0.8);
    c.beginPath(); m.pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke();
  }

  // ---- weathering: streaks under ledges and a fine grain
  for (let i = 0; i < 900; i++) {
    const x = P.x0 + hash(i, 1) * (P.x1 - P.x0), y = -600 + hash(i, 2) * 590, len = 10 + hash(i, 3) * 60;
    c.fillStyle = `rgba(20,16,12,${0.04 + 0.05 * hash(i, 4)})`; c.fillRect(x, y, 0.8 + hash(i, 5) * 1.5, len);
  }
  for (let i = 0; i < 9000; i++) {
    const x = P.x0 + hash(i, 6) * (P.x1 - P.x0), y = P.y0 + hash(i, 7) * (P.y1 - P.y0);
    c.fillStyle = hash(i, 8) < 0.5 ? 'rgba(0,0,0,0.07)' : 'rgba(255,250,235,0.05)'; c.fillRect(x, y, 1, 1);
  }
  // keep the grain inside the silhouette: mask with the building's outline
  const mk = document.createElement('canvas');
  mk.width = cv.width; mk.height = cv.height;
  const m = mk.getContext('2d')!;
  m.setTransform(P.px, 0, 0, P.px, -P.x0 * P.px, -P.y0 * P.px);
  m.fillStyle = '#000';
  const R = (x: number, y: number, w: number, h: number) => m.fillRect(Math.min(x, x + w), Math.min(y, y + h), Math.abs(w), Math.abs(h));
  R(-800, 0, 1600, STEP_Y[0]!);
  R(-470, STEP_Y[0]!, 940, STEP_Y[1]! - STEP_Y[0]!);
  R(-455, STEP_Y[1]!, 910, STEP_Y[2]! - STEP_Y[1]!);
  R(-WING.x1 - 10, 0, WING.x1 - WING.x0 + 20, WING.bal);
  R(WING.x0 - 10, 0, WING.x1 - WING.x0 + 20, WING.bal);
  R(-455, 0, 910, CORNICE.y1);
  m.beginPath(); m.moveTo(PED.x0 - 4, PED.y0 + 1); m.lineTo(0, PED.apex - 6); m.lineTo(PED.x1 + 4, PED.y0 + 1); m.closePath(); m.fill();
  R(-DOME.R - 20, DOME.cy - 2, 2 * DOME.R + 40, DOME.drum0 - DOME.cy + 70);
  m.beginPath(); m.arc(0, DOME.cy, DOME.R + 1, Math.PI, 2 * Math.PI); m.closePath(); m.fill();
  R(-24, DOME.lantern - 12, 48, DOME.cy - DOME.R - DOME.lantern + 14);
  R(-30, PED.apex - 40, 60, 40); R(PED.x0 - 20, PED.y0 - 34, 40, 34); R(PED.x1 - 20, PED.y0 - 34, 40, 34);
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.globalCompositeOperation = 'destination-in';
  c.drawImage(mk, 0, 0);
  c.globalCompositeOperation = 'source-over';
  return cv;
}
