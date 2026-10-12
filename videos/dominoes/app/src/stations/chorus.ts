// The choruses (paper). Four movements, one per line:
//  A. "Dominoes, dominoes": the word itself as a chain of letter-dominoes, knocked over syllable by
//     syllable; the first row falls off its shelf into the second.
//  B. "Every touch becomes a thousand echoes": a plan view of one domino branching into 1,024
//     (chorus 1: a binary tree; chorus 2: concentric rings).
//  C. "Dominoes, dominoes" again, bigger and faster.
//  D. "You never see how far the falling goes": a row receding to a vanishing point, the front of
//     the fall disappearing into it.
import { type CamKey } from '../engine/camera';
import { type R } from '../engine/draw';
import { archivo, mono } from '../engine/fonts';
import { type Line, line } from '../engine/lyrics';
import { dimension, label, lyric, orderTag } from '../engine/text';
import { clamp, ease, hash, lerp, smoothstep } from '../engine/util';
import { Chain } from '../machine/domino';
import { hit } from '../machine/motion';
import { ground } from '../machine/parts';
import { type Station } from '../station';

export interface ChorusCfg {
  id: string;
  x: number; // world x where the chorus starts
  lines: [number, number, number, number];
  variant: 1 | 2;
  /** time the chorus ends (paper → ink) */
  end: number;
}

// ------------------------------------------------------------------ A / C: letter chains
interface LetterRow { chain: Chain; letters: string[]; x0: number; y: number; h: number; w: number }

function letterRow(word: string, x0: number, y: number, h: number, t0: number, t1: number, dur: number): LetterRow {
  const letters = word.toUpperCase().split('');
  const w = h * 0.62, gap = h * 0.16;
  const d = letters.map((_, i) => ({ x: x0 + i * (w + gap) + w / 2, y, w, h }));
  // a hit per letter spread across the sung word; the first is the word's onset
  const T = letters.map((_, i) => t0 + (i / letters.length) * Math.max(0.3, Math.min(dur, t1 - t0) * 0.95));
  return { chain: new Chain(d, T, { lastFall: 0.32, glowAfter: 0.35 }), letters, x0, y, h, w };
}

function drawLetterRow(r: R, row: LetterRow, t: number, active: number, font: (s: number) => string) {
  const th = row.chain.angles(t);
  const n = row.letters.length;
  for (let i = n - 1; i >= 0; i--) {
    const d = row.chain.d[i]!;
    const heat = row.chain.heat(i, t);
    const spent = t > (row.chain.T[i + 1] ?? row.chain.T[i]! + 0.32) + 0.35;
    const col = heat > 0.01 ? r.mix('fg', 'sig', heat) : r.c('fg');
    r.local(d.x + d.w / 2, d.y, th[i]!, 1, () => {
      const g = r.g;
      g.beginPath();
      g.rect(-d.w, -d.h, d.w, d.h);
      g.fillStyle = heat > 0.5 ? r.c('sig') : r.c('panel');
      g.fill();
      g.strokeStyle = col;
      g.lineWidth = r.px(2);
      g.stroke();
      // the letter: dim until struck, then white on orange, then ink once spent
      const lc = heat > 0.5 ? r.c('panel') : spent || t >= row.chain.T[i]! ? r.c('fg') : r.c('fg', 0.25 + 0.1 * active);
      g.font = font(d.h * 0.62);
      g.fillStyle = lc;
      g.textAlign = 'center';
      g.textBaseline = 'alphabetic';
      g.fillText(row.letters[i]!, -d.w / 2, -d.h * 0.28);
      // pips line at the top, like a real domino's divider
      g.beginPath();
      g.moveTo(-d.w * 0.82, -d.h * 0.86);
      g.lineTo(-d.w * 0.18, -d.h * 0.86);
      g.strokeStyle = col;
      g.lineWidth = r.px(1);
      g.stroke();
    });
  }
}

// ------------------------------------------------------------------ B: plan view of the echoes
const GEN = 10; // 2^10 = 1,024
function drawTree(r: R, x0: number, y0: number, W: number, H: number, T0: number, T1: number, t: number) {
  const g = r.g;
  const dx = W / GEN;
  const tg = (k: number) => T0 + (T1 - T0) * (k / GEN) ** 0.85;
  // edges first
  for (let k = 0; k < GEN; k++) {
    const n = 1 << k;
    const spread = H / (n * 2);
    const lit = t >= tg(k + 1) ? 1 : t > tg(k) ? (t - tg(k)) / (tg(k + 1) - tg(k)) : 0;
    g.beginPath();
    for (let j = 0; j < n; j++) {
      const y = y0 - H / 2 + (j + 0.5) * (H / n);
      for (const s of [-1, 1]) {
        const cy = y + (s * spread) / 2;
        g.moveTo(x0 + k * dx, y);
        g.lineTo(x0 + k * dx + dx * (lit > 0 ? Math.min(1, lit) : 1), y + (cy - y) * (lit > 0 ? Math.min(1, lit) : 1));
      }
    }
    r.stroke(lit > 0 && lit < 1 ? r.c('sig') : lit >= 1 ? r.c('mid') : r.c('faint'), k > 7 ? 0.7 : 1);
  }
  // nodes: tiny dominoes seen from above
  for (let k = 0; k <= GEN; k++) {
    const n = 1 << k;
    const x = x0 + k * dx;
    const fallen = t >= tg(k);
    const heat = fallen ? Math.max(0, 1 - (t - tg(k)) / 0.35) : 0;
    const sz = Math.max(r.px(1.2), Math.min(18, (H / n) * 0.42));
    const len = sz * 0.35;
    g.beginPath();
    for (let j = 0; j < n; j++) {
      const y = y0 - H / 2 + (j + 0.5) * (H / n);
      if (fallen) g.rect(x, y - sz / 2, sz * 1.6, sz);
      else g.rect(x - len / 2, y - sz / 2, len, sz);
    }
    if (fallen) {
      g.fillStyle = heat > 0.01 ? r.mix('fg', 'sig', heat) : r.c('fg');
      g.fill();
    } else r.stroke(r.c('fg', k > 6 ? 0.25 : 0.6), k > 6 ? 0.6 : 1);
    // generation count
    if (k % 2 === 0 || k === GEN) {
      const a = smoothstep(tg(k) - 0.1, tg(k) + 0.1, t);
      r.alpha(0.35 + 0.65 * a, () => r.text(`×${(1 << k).toLocaleString('en-US')}`, x, y0 + H / 2 + 46, mono(17, fallen ? 500 : 400), fallen && heat > 0.01 ? r.c('sig') : r.c('mid'), 'center'));
    }
  }
  label(r, 'PLAN VIEW — ONE TOUCH, TEN GENERATIONS', x0, y0 - H / 2 - 40, 15, undefined, 'left', 500);
}

function drawRings(r: R, cx: number, cy: number, R0: number, T0: number, T1: number, t: number) {
  const g = r.g;
  const rings = 12;
  for (let k = 0; k <= rings; k++) {
    const rad = k === 0 ? 0 : (k / rings) * R0;
    const n = k === 0 ? 1 : Math.round(6 * k * 1.6);
    const tk = T0 + (T1 - T0) * (k / rings);
    const fallen = t >= tk;
    const heat = fallen ? Math.max(0, 1 - (t - tk) / 0.4) : 0;
    for (let j = 0; j < n; j++) {
      const a = (j / n) * Math.PI * 2 + k * 0.13;
      const x = cx + Math.cos(a) * rad, y = cy + Math.sin(a) * rad;
      r.local(x, y, a, 1, () => {
        if (fallen) r.box(0, 0, 0, 0, -5, 22, 10, undefined, heat > 0.01 ? r.mix('fg', 'sig', heat) : r.c('fg'));
        else r.box(0, 0, 0, -3, -9, 6, 18, r.c('fg', 0.55), undefined, 1);
      });
    }
    if (k > 0 && k % 3 === 0) {
      r.alpha(0.35 + 0.65 * smoothstep(tk - 0.1, tk + 0.1, t), () => r.text(`ECHO ${k}`, cx + rad + 8, cy - 8, mono(14), fallen ? r.c('sig') : r.c('mid')));
    }
    void g;
  }
  label(r, 'PLAN VIEW — ONE TOUCH, TWELVE ECHOES', cx - R0, cy - R0 - 50, 15, undefined, 'left', 500);
}

// ------------------------------------------------------------------ D: a row receding in perspective
function drawPerspectiveRow(r: R, ox: number, oy: number, t: number, T0: number, T1: number, curve: number) {
  const g = r.g;
  const f = 900; // focal length
  const camH = 300; // eye height above the floor (world px)
  const hzY = oy - 560; // horizon (relative world y)
  const N = 220;
  const dz = 60;
  const z0 = 260;
  const proj = (X: number, Y: number, Z: number) => ({ x: ox + (X * f) / Z, y: hzY + ((camH - Y) * f) / Z });
  // the front of the fall travels into the distance, decelerating in screen space
  const front = (tt: number) => (tt < T0 ? -1 : (N * ease.outQuad(clamp((tt - T0) / (T1 - T0)))) * 1.3);
  const fr = front(t);
  // floor lines converging to the vanishing point
  for (const X of [-620, -220]) {
    const a = proj(X, 0, z0 - 100), b = proj(X, 0, 30000);
    r.line(a.x, a.y, b.x, b.y, r.c('faint'), 1);
  }
  for (let k = N - 1; k >= 0; k--) {
    const Z = z0 + k * dz;
    const Xc = -420 + Math.sin(k * 0.035) * curve * Math.min(1, k / 40);
    const h = 170, w = 100;
    let th = 0;
    if (fr > k) th = Math.min(1.35, (fr - k) * 0.9);
    const heat = fr > k && fr < k + 6 ? 1 - (fr - k) / 6 : 0;
    const topY = h * Math.cos(th), topZ = Z + h * Math.sin(th);
    const p0 = proj(Xc - w / 2, 0, Z), p1 = proj(Xc + w / 2, 0, Z);
    const p2 = proj(Xc + w / 2, topY, topZ), p3 = proj(Xc - w / 2, topY, topZ);
    if (Math.abs(p1.x - p0.x) < r.px(0.6)) {
      // too far to draw as a shape: a dot
      r.circle((p0.x + p1.x) / 2, p0.y, r.px(0.7), undefined, heat > 0 ? r.c('sig') : r.c('fg', 0.5));
      continue;
    }
    r.poly([p0, p1, p2, p3], heat > 0.01 ? r.mix('fg', 'sig', heat) : fr > k + 6 ? r.c('mid') : r.c('fg'), heat > 0.5 ? r.c('sig', 0.9) : r.c('panel'), k < 30 ? 1.6 : 1);
  }
  // horizon and vanishing point
  r.line(ox - 1400, hzY, ox + 1400, hzY, r.c('faint'), 1);
  r.circle(ox, hzY, r.px(3), r.c('mid'), undefined, 1);
  label(r, 'V.P.', ox + 12, hzY - 10, 13);
  void g;
}

// ------------------------------------------------------------------ the station
export function makeChorus(cfg: ChorusCfg): Station {
  const [la, lb, lc, ld] = cfg.lines.map((i) => line(i)) as [Line, Line, Line, Line];
  const X = cfg.x;
  const v2 = cfg.variant === 2;
  // A: two rows of letters (shelf + floor)
  const hA = v2 ? 300 : 260;
  const rowA1 = letterRow('dominoes', X + 260, -560, hA, la.words[0]!.start, la.words[1]!.start, la.words[1]!.start - la.words[0]!.start);
  const wA = rowA1.letters.length * (rowA1.w + hA * 0.16);
  const rowA2 = letterRow('dominoes', X + 260 + wA * 0.35, 0, hA, la.words[1]!.start, lb.start, la.end - la.words[1]!.start + 0.2);
  // B: the plan view sits to the right, on the same sheet
  const BX = X + 260 + wA * 1.35 + 500;
  const B = { x: BX, y: -520, w: 2000, h: 900 };
  // C: a bigger pair of rows
  const CX = BX + B.w + 600;
  const hC = v2 ? 440 : 380;
  const rowC1 = letterRow('dominoes', CX, -620, hC, lc.words[0]!.start, lc.words[1]!.start, lc.words[1]!.start - lc.words[0]!.start);
  const wC = rowC1.letters.length * (rowC1.w + hC * 0.16);
  const rowC2 = letterRow('dominoes', CX + wC * 0.3, 0, hC, lc.words[1]!.start, ld.start, lc.end - lc.words[1]!.start + 0.2);
  // D: perspective row
  const DX = CX + wC * 1.3 + 1400;
  const D = { x: DX, y: 0 };
  const T_D1 = ld.words[ld.words.length - 1]!.start + 0.6;

  const font = (s: number) => archivo(s, v2 ? 1125 : 875, 900);
  const cam: CamKey[] = [
    { t: la.words[0]!.start + 0.05, x: X + 260 + wA * 0.45, y: -420, z: 0.62, e: ease.outCubic },
    { t: la.words[1]!.start + 0.5, x: X + 260 + wA * 0.75, y: -300, z: 0.6, e: ease.inOutSine },
    { t: lb.start + 0.1, x: B.x + B.w * 0.45, y: B.y - 40, z: 0.68, e: ease.inOutCubic },
    { t: lb.end - 0.2, x: B.x + B.w * 0.62, y: B.y - 20, z: 0.66, e: ease.linear },
    { t: lc.words[0]!.start + 0.05, x: CX + wC * 0.42, y: -480, z: 0.5, e: ease.inOutCubic },
    { t: lc.words[1]!.start + 0.6, x: CX + wC * 0.8, y: -380, z: 0.48, e: ease.inOutSine },
    { t: ld.start + 0.05, x: D.x + 80, y: D.y - 560, z: 0.82, e: ease.inOutCubic },
    { t: T_D1, x: D.x + 120, y: D.y - 600, z: 0.95, e: ease.inOutSine },
  ];

  return {
    id: cfg.id,
    x0: X - 200, x1: DX + 1600, y0: -1300, y1: 200,
    t0: la.start - 0.5, t1: cfg.end,
    cam,
    hits: [
      { t: la.words[0]!.start, amp: 10 }, { t: la.words[1]!.start, amp: 10 },
      { t: lc.words[0]!.start, amp: 14 }, { t: lc.words[1]!.start, amp: 14 },
    ],
    draw(r: R, t: number) {
      const g = r.g;
      ground(r, X - 200, DX + 1600, 0);
      // ---- A
      // shelf for the first row
      r.line(rowA1.x0 - 80, rowA1.y, rowA1.x0 + wA + 10, rowA1.y, r.c('fg'), 2);
      r.line(rowA1.x0 - 40, rowA1.y, rowA1.x0 - 40, 0, r.c('dim'), 1);
      drawLetterRow(r, rowA2, t, 0, font);
      drawLetterRow(r, rowA1, t, 0, font);
      orderTag(r, v2 ? '1,026' : 12, rowA1.x0 - 60, rowA1.y - hA - 50, 18, hit(t, la.start, 0.4));
      dimension(r, rowA1.x0, rowA1.y - hA - 30, rowA1.x0 + rowA1.w, rowA1.y - hA - 30, `h = ${hA}`, 15);
      // ---- B
      const bT0 = lb.words[0]!.start, bT1 = lb.words[lb.words.length - 1]!.start + 0.3;
      if (v2) drawRings(r, B.x + B.w / 2, B.y, B.h / 2, bT0, bT1, t);
      else drawTree(r, B.x, B.y, B.w, B.h, bT0, bT1, t);
      lyric(r, lb, B.x + (v2 ? B.w / 2 - 900 : 0), B.y - B.h / 2 - 110, { size: 92, width: 1000, weight: 800, appear: 0.5 });
      // ---- C
      r.line(rowC1.x0 - 80, rowC1.y, rowC1.x0 + wC + 10, rowC1.y, r.c('fg'), 2);
      r.line(rowC1.x0 - 40, rowC1.y, rowC1.x0 - 40, 0, r.c('dim'), 1);
      drawLetterRow(r, rowC2, t, 0, font);
      drawLetterRow(r, rowC1, t, 0, font);
      // ---- D
      drawPerspectiveRow(r, D.x, D.y, t, ld.words[0]!.start, T_D1 + 0.8, v2 ? 260 : 0);
      lyric(r, ld, D.x - 40, D.y - 900, { size: 84, width: 1000, weight: 800, appear: 0.5, maxWidth: 1000 });
      r.alpha(smoothstep(T_D1 - 0.3, T_D1 + 0.2, t), () => {
        r.text('→ CONTINUES BEYOND FRAME (FIG. OMITTED)', D.x + 20, D.y - 520, mono(15, 500), r.c('mid'));
      });
      void g; void hash; void lerp;
    },
  };
}
