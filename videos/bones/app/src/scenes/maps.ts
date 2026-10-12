// maps — verse 2, "Every map they drew was borrowed" / "Every truth was someone else's guess". Bone paper.
// A map stitched together from borrowed fragments: each patch has its own graticule at its own angle, its own
// contours, and a source note (COPIED FROM …, TRACED, AFTER SOMEONE). The patches arrive one per word and are
// stitched; on "borrowed" every patch is stamped. In the second line spot heights get question marks, and on
// "guess" the patches slide out of register: the grids never agreed. Only the point stays put.
import * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { Layer2D, clearRT } from '../engine/gl';
import { F, font } from '../engine/type';
import { LIN, rgba } from '../engine/palette';
import type { Line } from '../engine/lyrics';
import { clamp, ease, hash, lerp, prog, springStep, TAU } from '../engine/util';
import { drawFlow, drawLedger, mono, pointPaper, titleBlock } from './_bones';

// a 3×2 patchwork over the map area, shared jittered corners
const MX0 = 920, MX1 = 1830, MY0 = 110, MY1 = 900;
const corner = (i: number, j: number): [number, number] => {
  const x = lerp(MX0, MX1, i / 3), y = lerp(MY0, MY1, j / 2);
  const edge = i === 0 || i === 3 || j === 0 || j === 2;
  return edge ? [x, y] : [x + (hash(i, j, 1) - 0.5) * 140, y + (hash(i, j, 2) - 0.5) * 120];
};
const PATCHES = [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1]].map(([i, j], k) => ({
  poly: [corner(i!, j!), corner(i! + 1, j!), corner(i! + 1, j! + 1), corner(i!, j! + 1)],
  ang: (hash(k, 9) - 0.5) * 0.5, sp: 46 + hash(k, 8) * 34, seed: k,
  src: ['COPIED FROM A COPY, 1742', 'TRACED', 'AFTER SOMEONE', 'FROM MEMORY', 'SURVEYOR UNKNOWN', 'AS TOLD'][k]!,
}));
const POINT = { x: 1400, y: 540 };

export default class Maps extends Scene {
  text = new Layer2D();
  l10!: Line; l11!: Line;

  override init() {
    const { lyrics } = this.ctx;
    this.l10 = lyrics.lines[10]!; this.l11 = lyrics.lines[11]!;
  }

  render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer, comp, lyrics, audio } = this.ctx;
    const t = f.t, s0 = this.ctx.start;
    clearRT(renderer, out, LIN.bone);
    const T = this.text, c = T.ctx; T.clear();
    const w10 = this.l10.words, w11 = this.l11.words;
    const guess = w11[w11.length - 1]!;
    const slide = springStep(t - guess.start, 0.9, 0.3);
    PATCHES.forEach((p, k) => {
      const wt = w10[Math.min(k, w10.length - 1)]!.start - (k === 0 ? 0.3 : 0);
      const a = prog(t, wt - 0.05, wt + 0.25, ease.outCubic);
      if (a <= 0) return;
      // out of register on "guess"
      const dx = (hash(k, 31) - 0.5) * 70 * slide, dy = (hash(k, 32) - 0.5) * 50 * slide, rot = (hash(k, 33) - 0.5) * 0.06 * slide;
      const cx = p.poly.reduce((s, q) => s + q[0], 0) / 4, cy = p.poly.reduce((s, q) => s + q[1], 0) / 4;
      c.save();
      c.globalAlpha = a;
      c.translate(cx + dx, cy + dy - (1 - a) * 30); c.rotate(rot); c.translate(-cx, -cy);
      c.beginPath(); p.poly.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath();
      c.fillStyle = k % 2 ? 'rgba(232,223,204,1)' : 'rgba(238,230,212,1)'; c.fill();
      c.save(); c.clip();
      // graticule
      c.strokeStyle = rgba('ink', 0.22); c.lineWidth = 0.8;
      c.save(); c.translate(cx, cy); c.rotate(p.ang);
      for (let u = -700; u <= 700; u += p.sp) { c.beginPath(); c.moveTo(u, -600); c.lineTo(u, 600); c.stroke(); c.beginPath(); c.moveTo(-700, u); c.lineTo(700, u); c.stroke(); }
      c.restore();
      // contours: a hill per patch
      const hx = cx + (hash(k, 4) - 0.5) * 140, hy = cy + (hash(k, 5) - 0.5) * 90;
      c.strokeStyle = rgba('graphite', 0.75); c.lineWidth = 1;
      for (let r = 26; r < 260; r += 22) {
        c.beginPath();
        for (let i = 0; i <= 72; i++) {
          const th = (i / 72) * TAU;
          const rr = r * (1 + 0.16 * Math.sin(3 * th + k) + 0.08 * Math.sin(5 * th + k * 2.3) + 0.05 * Math.sin(r * 0.05 + th * 2));
          const x = hx + Math.cos(th) * rr * 1.3, y = hy + Math.sin(th) * rr * 0.85;
          i ? c.lineTo(x, y) : c.moveTo(x, y);
        }
        c.stroke();
      }
      c.restore();
      // seam: stitched dashes
      c.setLineDash([7, 5]); c.strokeStyle = rgba('ink', 0.7); c.lineWidth = 1.1;
      c.beginPath(); p.poly.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.stroke(); c.setLineDash([]);
      // source note
      mono(c, p.src, p.poly[0]![0] + 14, p.poly[0]![1] + 24, { size: 10, color: rgba('ink', 0.75), track: 2 });
      // spot height with a question mark in line 2
      const qi = Math.min(k + 1, w11.length - 1);
      const q = prog(t, w11[qi]!.start, w11[qi]!.start + 0.2);
      if (q > 0) {
        c.fillStyle = rgba('ink', 0.85); c.beginPath(); c.arc(hx, hy, 2.6, 0, TAU); c.fill();
        mono(c, `${Math.round(200 + hash(k, 6) * 1800)} m`, hx + 8, hy - 6, { size: 11, color: rgba('ink', 0.85), track: 1 });
        c.save(); c.globalAlpha *= q; c.font = font(F.serif(600, true), 34); c.fillStyle = rgba('signal', 1); c.fillText('?', hx + 62 + (1 - q) * 10, hy - 2); c.restore();
      }
      // the stamp on "borrowed"
      const bw = w10[w10.length - 1]!;
      const st = prog(t, bw.start + k * 0.06, bw.start + k * 0.06 + 0.15, ease.outCubic);
      if (st > 0) {
        c.save(); c.translate(cx + 30, cy + 50); c.rotate(-0.12 + hash(k, 7) * 0.1); c.scale(1 + (1 - st) * 0.5, 1 + (1 - st) * 0.5); c.globalAlpha *= st * 0.9;
        c.strokeStyle = rgba('signal', 1); c.lineWidth = 2.4; c.strokeRect(-92, -22, 184, 36);
        c.font = font(F.mono(700), 18); c.letterSpacing = '4px'; c.fillStyle = rgba('signal', 1); c.textAlign = 'center'; c.fillText('BORROWED', 0, 4);
        c.restore();
      }
      c.restore();
    });
    // compass, scale bar
    const ca = prog(t, s0 + 0.3, s0 + 1);
    c.save(); c.globalAlpha = ca; c.strokeStyle = rgba('ink', 0.8); c.lineWidth = 1;
    c.beginPath(); c.moveTo(1760, 960); c.lineTo(1760, 1010); c.stroke();
    c.beginPath(); c.moveTo(1752, 972); c.lineTo(1760, 958); c.lineTo(1768, 972); c.stroke();
    c.restore();
    mono(c, 'N (APPROX.)', 1745, 1030, { size: 10, color: rgba('ink', 0.8 * ca), track: 2, align: 'right' });
    // the point: the one fixed thing
    pointPaper(c, POINT.x, POINT.y, t, 1);
    mono(c, 'YOU ARE HERE (MEASURED)', POINT.x + 22, POINT.y + 4, { size: 11, color: rgba('signal', prog(t, s0 + 0.8, s0 + 1.4)), track: 2, weight: 600 });
    // lyric
    const st = { family: F.archivo(100, 800), size: 84, tracking: -2, sung: rgba('ink', 1), unsung: rgba('ink', 0.12), active: rgba('signal', 1), lead: 0.5 };
    const row = (l: Line, a: number, b: number, y: number) => drawFlow(c, { ...l, words: l.words.slice(a, b), start: l.words[a]!.start } as Line, 110, y, t, st);
    row(this.l10, 0, 3, 230); row(this.l10, 3, 6, 330);
    row(this.l11, 0, 3, 500); row(this.l11, 3, 6, 600);
    const fn = prog(t, guess.end + 0.2, guess.end + 0.8);
    mono(c, '* THE MAP IS NOT THE TERRITORY.', 112, 680, { size: 13, color: rgba('signal', fn), track: 3, weight: 600 });
    drawLedger(c, lyrics, audio, 120, 1012, t, { paper: true });
    titleBlock(c, 'D-501', 'SURVEY (BORROWED)', [['SCALE', 'VARIES BY PATCH'], ['DATUM', 'NONE AGREED']], { paper: true, x: 1300, y: 950 });
    comp.draw(renderer, T.upload(), out);
    void clamp;
    return { bloom: 0.4, ca: 0.3, vignette: 0.25, paper: 1, grain: 0.045 };
  }
}
