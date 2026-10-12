// orders — chorus 2. Bone paper: one column, engraved, Corinthian and gilded, stripped down a word at a time
// through the orders of architecture. "down": the acanthus falls (Ionic); "bones": the volutes (Doric);
// "Strip": the gilded frieze; "gold": the fluting; "stone": the base mouldings and the cornice; "need": the
// echinus; "shown": the last block — a bare post under a bare beam. "Build it up from the bones": the post is
// repeated on the beat into a colonnade, and the beam runs across them all.
import * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { Layer2D, clearRT } from '../engine/gl';
import { F } from '../engine/type';
import { LIN, rgba } from '../engine/palette';
import type { Line, Word } from '../engine/lyrics';
import { clamp, ease, lerp, prog, TAU } from '../engine/util';
import { drawLedger, drop, mono, pointPaper, slamRows, titleBlock } from './_bones';

const X = 1260, YB = 960, YS = 350, RB = 54, RT = 46, YC = 268, YE = 120;

export default class Orders extends Scene {
  text = new Layer2D();
  L: Line[] = [];
  ts: Record<string, number> = {};
  posts: number[] = [];

  override init() {
    const { lyrics, audio } = this.ctx;
    this.L = [16, 17, 18, 19].map((i) => lyrics.lines[i]!);
    const w = (li: number, wi: number) => this.L[li]!.words[wi]!.start;
    this.ts = {
      acanthus: w(0, 2), volutes: w(0, 5), frieze: w(1, 0), flutes: w(1, 2), base: w(1, 5), cornice: w(1, 5) + 0.1,
      echinus: w(2, 2), abacus: w(2, 6), plinth: w(2, 6) + 0.08,
    };
    const b0 = Math.ceil(audio.beatAt(this.L[3]!.words[0]!.start - 0.02));
    for (let i = 0; i < 6; i++) this.posts.push(audio.timeOfBeat(b0 + i * 0.5));
  }

  render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer, comp, lyrics, audio } = this.ctx;
    const t = f.t, s0 = this.ctx.start;
    clearRT(renderer, out, LIN.bone);
    const T = this.text, c = T.ctx; T.clear();
    const ink = (a = 1) => rgba('ink', a);
    // a feature falls when stripped: draws inside a transformed context
    const feat = (key: string, r: number, draw: () => void, cx = X, cy = 300) => {
      const [dy, rot, a] = drop(t, this.ts[key]!, r, 2400, 1.0);
      if (a <= 0) return;
      c.save(); c.globalAlpha *= a; c.translate(cx, cy + dy); c.rotate(rot); c.translate(-cx, -cy); draw(); c.restore();
    };
    c.lineWidth = 1.3; c.strokeStyle = ink(0.9);
    const shaftR = (u: number) => lerp(RB, RT, Math.pow(u, 1.3));
    // the colonnade (line 4): extra bare posts, appearing on the beat, outward from the column
    const postX = [X - 230, X + 230, X - 460, X + 460, X - 690, X + 690];
    this.posts.forEach((tp, i) => {
      const k = prog(t, tp - 0.05, tp + 0.15, ease.outCubic);
      if (k <= 0) return;
      const px = postX[i]!;
      if (px < 700 || px > 1880) return;
      c.save(); c.globalAlpha = k;
      c.fillStyle = ink(0.06); c.fillRect(px - RT, YC + (1 - k) * 200, RT * 2, YB - YC - (1 - k) * 200);
      c.strokeStyle = ink(0.9); c.lineWidth = 2; c.strokeRect(px - RT, YC + (1 - k) * 200, RT * 2, YB - YC - (1 - k) * 200);
      c.restore();
      pointPaper(c, px, YB, t, 0.8, k);
    });
    // the beam: the entablature, stripped to a beam; on line 4 it runs across all posts
    const beamK = prog(t, this.L[3]!.words[5]!.start - 0.1, this.L[3]!.words[5]!.start + 0.25, ease.outCubic);
    const half = lerp(270, 640, beamK);
    c.save(); c.strokeStyle = ink(0.95); c.lineWidth = 2;
    c.strokeRect(X - half, YE + 60, half * 2, YC - YE - 60);
    c.restore();
    feat('cornice', 0.3, () => {
      c.strokeRect(X - 300, YE, 600, 30); c.strokeRect(X - 285, YE + 30, 570, 14);
      for (let x = X - 280; x < X + 280; x += 16) c.strokeRect(x, YE + 44, 9, 12);
    }, X, YE + 30);
    feat('frieze', 0.6, () => {
      // gilded rinceau in the frieze band
      c.save(); c.strokeStyle = rgba('gold', 1); c.lineWidth = 1.4;
      for (let k = 0; k < 9; k++) {
        const cx = X - 240 + k * 60, cy = YE + 100;
        c.beginPath();
        for (let i = 0; i <= 40; i++) { const a = (i / 40) * TAU * 1.4, r = 22 * (1 - i / 52); c.lineTo(cx + Math.cos(a) * r * (k % 2 ? 1 : -1), cy + Math.sin(a) * r * 0.7); }
        c.stroke();
      }
      c.restore();
    }, X, YE + 100);
    // capital
    feat('abacus', 0.45, () => { c.strokeRect(X - 70, YC - 22, 140, 22); }, X, YC - 10);
    feat('echinus', 0.7, () => {
      c.beginPath(); c.moveTo(X - 62, YC); c.quadraticCurveTo(X - 66, YC + 34, X - RT, YC + 48); c.lineTo(X + RT, YC + 48); c.quadraticCurveTo(X + 66, YC + 34, X + 62, YC); c.stroke();
      for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(X - RT - 2, YC + 54 + i * 6); c.lineTo(X + RT + 2, YC + 54 + i * 6); c.stroke(); }
    }, X, YC + 30);
    feat('volutes', 0.2, () => {
      c.save(); c.strokeStyle = rgba('gold', 1); c.lineWidth = 1.6;
      for (const s of [-1, 1]) {
        c.beginPath();
        for (let i = 0; i <= 60; i++) { const u = i / 60, a = u * TAU * 2.2, r = 30 * (1 - u * 0.85); c.lineTo(X + s * 70 + Math.cos(a) * r * s, YC + 30 + Math.sin(a) * r); }
        c.stroke();
      }
      c.beginPath(); c.moveTo(X - 70, YC + 2); c.bezierCurveTo(X - 30, YC + 14, X + 30, YC + 14, X + 70, YC + 2); c.stroke();
      c.restore();
    }, X, YC + 30);
    feat('acanthus', 0.8, () => {
      c.save(); c.strokeStyle = rgba('gold', 1); c.lineWidth = 1.3;
      for (let row = 0; row < 3; row++) {
        for (let i = -3; i <= 3; i++) {
          const lx = X + i * 19 + (row % 2 ? 9 : 0), yb = YC + 70 - row * 20, h = 46 - row * 6;
          c.beginPath();
          c.moveTo(lx - 10, yb); c.quadraticCurveTo(lx - 12, yb - h * 0.6, lx + (i * 1.5), yb - h); c.quadraticCurveTo(lx + 12, yb - h * 0.6, lx + 10, yb); c.stroke();
          c.beginPath(); c.moveTo(lx, yb); c.lineTo(lx + i * 1.2, yb - h * 0.8); c.stroke();
        }
      }
      c.restore();
    }, X, YC + 40);
    // shaft: the post itself (always), plus fluting
    c.save(); c.strokeStyle = ink(0.95); c.lineWidth = 2;
    const top = YC + 60 > YS ? YS : YC + 60;
    c.beginPath(); c.moveTo(X - shaftR(0), YB - 40); c.lineTo(X - shaftR(1), top); c.moveTo(X + shaftR(0), YB - 40); c.lineTo(X + shaftR(1), top); c.stroke();
    c.restore();
    // after the abacus goes, the post reaches the beam
    const pk = prog(t, this.ts.abacus!, this.ts.abacus! + 0.3, ease.outCubic);
    if (pk > 0) { c.save(); c.globalAlpha = pk; c.strokeStyle = ink(0.95); c.lineWidth = 2; c.beginPath(); c.moveTo(X - RT, top); c.lineTo(X - RT, YC); c.moveTo(X + RT, top); c.lineTo(X + RT, YC); c.stroke(); c.restore(); }
    feat('flutes', 0.5, () => {
      c.save(); c.lineWidth = 0.9; c.strokeStyle = ink(0.6);
      for (let k = -5; k <= 5; k++) { const f0 = k / 6; c.beginPath(); c.moveTo(X + f0 * shaftR(0) * 0.95, YB - 46); c.lineTo(X + f0 * shaftR(1) * 0.95, top + 6); c.stroke(); }
      c.restore();
    }, X, 640);
    // base
    feat('base', 0.35, () => {
      c.beginPath(); c.ellipse(X, YB - 32, RB + 14, 8, 0, 0, TAU); c.stroke();
      c.beginPath(); c.ellipse(X, YB - 18, RB + 20, 9, 0, 0, TAU); c.stroke();
    }, X, YB - 25);
    feat('plinth', 0.55, () => { c.strokeRect(X - RB - 26, YB - 10, (RB + 26) * 2, 10); }, X, YB - 5);
    // when the base is gone the post meets the ground
    const gk = prog(t, this.ts.plinth!, this.ts.plinth! + 0.3, ease.outCubic);
    if (gk > 0) { c.save(); c.globalAlpha = gk; c.strokeStyle = ink(0.95); c.lineWidth = 2; c.beginPath(); c.moveTo(X - RB, YB - 40); c.lineTo(X - RB * 0.97, YB); c.moveTo(X + RB, YB - 40); c.lineTo(X + RB * 0.97, YB); c.stroke(); c.restore(); }
    // ground
    c.save(); c.strokeStyle = ink(0.85); c.lineWidth = 1.2; c.beginPath(); c.moveTo(80, YB); c.lineTo(1840, YB); c.stroke(); c.restore();
    pointPaper(c, X, YB, t, 1);
    // the order's name
    const order = t < this.ts.acanthus! ? 'CORINTHIAN' : t < this.ts.volutes! ? 'IONIC' : t < this.ts.flutes! ? 'DORIC' : t < this.ts.base! ? 'TUSCAN' : t < this.ts.abacus! ? 'NONE IN PARTICULAR' : 'POST';
    mono(c, `ORDER  ${order}`, 102, 760, { size: 14, color: ink(0.9), track: 4, weight: 600 });
    const gone = ['acanthus', 'volutes', 'frieze', 'flutes', 'base', 'cornice', 'echinus', 'abacus', 'plinth'].filter((k) => t >= this.ts[k]!).length;
    mono(c, `PARTS  ${12 - gone}`, 102, 786, { size: 12, color: rgba('graphite', 1), track: 3 });
    mono(c, `GOLD  ${t < this.ts.frieze! ? 'YES' : 'NO'}`, 102, 810, { size: 12, color: t < this.ts.frieze! ? rgba('gold', 1) : rgba('graphite', 1), track: 3 });
    // lyrics: the current line, slammed, on the left
    let li = 0;
    for (let i = 0; i < 4; i++) if (t >= this.L[i]!.words[0]!.start - 0.12) li = i;
    const ln = this.L[li]!;
    const ws = ln.words;
    const split = li === 2 ? 3 : 2;
    const rows: { words: Word[]; x: number; y: number }[] = li === 2
      ? [{ words: ws.slice(0, 3), x: 100, y: 330 }, { words: ws.slice(3, 5), x: 100, y: 480 }, { words: ws.slice(5), x: 100, y: 630 }]
      : [{ words: ws.slice(0, split), x: 100, y: 330 }, { words: ws.slice(split, 4), x: 100, y: 480 }, { words: ws.slice(4), x: 100, y: 630 }];
    slamRows(c, rows, t, { family: F.archivo(62, 900), size: 150, tracking: -2, upper: true, base: ink(1), hot: rgba('signal', 1),
      xf: (w) => (w.w.toLowerCase() === 'gold' && li === 1 ? { color: rgba('gold', 1) } : {}) });
    mono(c, 'THE ORDERS, IN REVERSE', 102, 700, { size: 12, color: rgba('graphite', prog(t, s0, s0 + 0.6)), track: 3 });
    drawLedger(c, lyrics, audio, 120, 1012, t, { paper: true });
    titleBlock(c, li < 3 ? 'D-701' : 'S-003', li < 3 ? 'ONE COLUMN, STRIPPED' : 'COLONNADE', [['SCALE', '1:20'], ['ORDER', order]], { paper: true, y: 24 });
    comp.draw(renderer, T.upload(), out);
    void clamp;
    return { bloom: 0.4, ca: 0.35 + f.a.kick * 0.5, vignette: 0.25, paper: 1, grain: 0.045, shake: [f.a.kick * 3, f.a.kick * 2] as [number, number] };
  }
}
