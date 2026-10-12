// edges — verse 1, "But I've been pulling at the edges" / "And the whole thing bends", then the strings come in
// and the voice sings a wordless "oh".
// A: the façade with its structural grid drawn over it. The point walks to the top-right corner and pulls it
//    out ("pulling" stretches as it is sung); on "bends" the whole lattice bends, and the line bends with it.
// B: the strings enter (the boom): close on the pulled corner, deflection readouts.
// C: the "oh"s: each one runs a standing wave through the grid, like a plucked string. The point walks back
//    down to the foot of the building, under all of it.
import * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { Layer2D, clearRT, W } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { F } from '../engine/type';
import { LIN, rgba } from '../engine/palette';
import type { Line } from '../engine/lyrics';
import { clamp, ease, lerp, prog, springStep } from '../engine/util';
import { drawFacade, drawFlow, drawLedger, drawWarpedLine, mono, point, titleBlock } from './_bones';
import { GRID_X, GRID_XN } from './_facade';

const LEVELS = [0, -42, -270, -470, -540, -600, -770];
const CORNER = { x: 770, y: -540 };

export default class Edges extends Scene {
  lb = new LineBatch(40000);
  text = new Layer2D();
  l2!: Line; l3!: Line;
  tBoom = 0; tC = 0; tHome = 0;
  ohs: number[] = [];

  override init() {
    const { lyrics, audio, start, end } = this.ctx;
    this.l2 = lyrics.lines[2]!; this.l3 = lyrics.lines[3]!;
    // the strings' entrance: the big low hit after the verse
    const hit = (audio.onsets.kick ?? []).find(([t, s]) => t > this.l3.end && t < end && s > 0.5);
    this.tBoom = hit ? hit[0] : start + 8;
    this.tC = audio.downbeats.find((d) => d > this.tBoom + 2) ?? this.tBoom + 2.6;
    this.tHome = audio.downbeats.filter((d) => d < end - 0.5).pop() ?? end - 1.7;
    // the "oh"s: vocal onsets between C and the home move
    const vo = (audio.onsets.vocal ?? []).filter(([t, s]) => t > this.tC - 0.2 && t < this.tHome && s > 0.45).map(([t]) => t);
    this.ohs = [];
    for (const v of vo) if (!this.ohs.length || v - this.ohs[this.ohs.length - 1]! > 0.55) this.ohs.push(v);
  }

  pull(t: number) {
    const ws = this.l2.words;
    const pl = ws.find((w) => w.w.startsWith('pulling'))!;
    return ease.inOutCubic(prog(t, pl.start - 0.1, this.l2.end + 0.3)) * (1 + 0.06 * Math.sin((t - pl.start) * 2.1) * prog(t, this.l2.end, this.l2.end + 1));
  }
  bend(t: number) {
    const b = this.l3.words[this.l3.words.length - 1]!;
    return springStep(t - b.start, 1.1, 0.28);
  }
  /** warp in façade units */
  warp(x: number, y: number, t: number): [number, number] {
    const P = this.pull(t);
    const g = Math.exp(-((x - CORNER.x) ** 2 + (y - CORNER.y) ** 2) / (2 * 420 * 420));
    let dx = P * 170 * g, dy = -P * 120 * g;
    const B = this.bend(t);
    const u = x / 800, v = clamp(-y / 1000, -0.2, 1.2);
    dy += -B * 150 * u * u + B * 30 * v;
    dx += B * 120 * u * v;
    // standing waves on the "oh"s
    for (const o of this.ohs) {
      if (t < o) continue;
      const A = 22 * Math.exp(-(t - o) / 0.7);
      if (A < 0.2) continue;
      dx += A * Math.sin(Math.PI * v * 2) * Math.sin((t - o) * 26) * Math.cos(u * 1.4);
      dy += A * 0.6 * Math.sin(Math.PI * (u + 1) * 2) * Math.sin((t - o) * 23);
    }
    return [x + dx, y + dy];
  }

  render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer, comp, lyrics, audio } = this.ctx;
    const t = f.t, s0 = this.ctx.start, end = this.ctx.end;
    clearRT(renderer, out, LIN.ink);
    const lb = this.lb; lb.clear();
    const T = this.text, c = T.ctx; T.clear();
    const shot = t < this.tBoom ? 'A' : t < this.tC ? 'B' : 'C';
    // camera
    let s = 0.6, ox = W / 2, oy = 930;
    if (shot === 'A') { s = lerp(0.6, 0.63, prog(t, s0, this.tBoom)); }
    if (shot === 'B') {
      const z = prog(t, this.tBoom, this.tBoom + 0.5, ease.outExpo);
      s = lerp(1.25, 1.42, z + prog(t, this.tBoom, this.tC) * 0.3);
      const cw = this.warp(CORNER.x, CORNER.y, t);
      ox = W * 0.55 - cw[0] * s; oy = H2 - cw[1] * s;
    }
    if (shot === 'C') {
      const z = prog(t, this.tC, this.tC + 1.2, ease.outCubic);
      s = lerp(0.5, 0.58, z) + (t - this.tC) * 0.006;
      const down = ease.inOutCubic(prog(t, this.tHome, end));
      oy = lerp(900, 640, down); s = lerp(s, 0.7, down);
    }
    const toS = (x: number, y: number): [number, number] => { const [a, b] = this.warp(x, y, t); return [ox + a * s, oy + b * s]; };
    // façade, warped
    drawFacade(lb, {
      ox: 0, oy: 0, s: 1, alpha: { gold: 0.9, stone: 0.55, found: 0.7 }, wk: { gold: Math.min(1.4, s * 1.6), stone: Math.min(1.4, s * 1.6), found: 1 },
      warp: (X, Y) => toS(X, Y),
    });
    // the structural grid, dashed, over it
    const ga = prog(t, s0 + 0.2, s0 + 1.2);
    const dash = (x0: number, y0: number, x1: number, y1: number, al: number) => {
      const L = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(L / 22);
      for (let i = 0; i < n; i++) {
        const a = i / n, b = Math.min(1, a + 0.7 / n);
        const [ax, ay] = toS(lerp(x0, x1, a), lerp(y0, y1, a)), [bx, by] = toS(lerp(x0, x1, b), lerp(y0, y1, b));
        lb.seg2(ax, ay, bx, by, 1, LIN.ash, al);
      }
    };
    GRID_X.forEach((x, i) => { const k = prog(t, s0 + 0.1 + i * 0.04, s0 + 0.9 + i * 0.04, ease.outCubic); if (k > 0) dash(x, 80, x, 80 - 1130 * k, 0.55 * ga); });
    LEVELS.forEach((y, i) => { const k = prog(t, s0 + 0.3 + i * 0.05, s0 + 1.1 + i * 0.05, ease.outCubic); if (k > 0) dash(-880, y, -880 + 1760 * k, y, 0.45 * ga); });
    // the pull: the corner's rest position, a tether, the point at the displaced corner
    const P = this.pull(t);
    const walk = prog(t, s0 + 0.2, this.l2.words[0]!.start + 0.6, ease.inOutCubic);
    const home = prog(t, this.tHome, end - 0.2, ease.inOutCubic);
    const [cxs, cys] = toS(CORNER.x, CORNER.y);
    const restX = ox + CORNER.x * s, restY = oy + CORNER.y * s;
    if (P > 0.01 && home < 1) {
      lb.seg2(restX, restY, cxs, cys, 1, LIN.signal, 0.6 * (1 - home));
      lb.seg2(restX - 6, restY, restX + 6, restY, 1, LIN.signal, 0.8 * (1 - home)); lb.seg2(restX, restY - 6, restX, restY + 6, 1, LIN.signal, 0.8 * (1 - home));
    }
    const [gx, gy] = toS(0, 0);
    const startX = ox, startY = oy;
    let px = lerp(startX, cxs, walk), py = lerp(startY, cys, walk);
    px = lerp(px, gx, home); py = lerp(py, gy, home);
    point(lb, px, py, t, shot === 'B' ? 1.2 : 0.9);
    lb.render(renderer, out);

    // bubbles at the top of the grid
    GRID_X.forEach((x, i) => {
      const [bx, by] = toS(x, -1060);
      const k = prog(t, s0 + 0.8 + i * 0.04, s0 + 1.2 + i * 0.04);
      if (k <= 0 || by < 20 || shot !== 'C') return;
      c.save(); c.globalAlpha = k * 0.8; c.strokeStyle = rgba('ash', 0.7); c.lineWidth = 1;
      c.beginPath(); c.arc(bx, by - 12, 10, 0, Math.PI * 2); c.stroke(); c.restore();
      mono(c, GRID_XN[i]!, bx, by - 8, { size: 10, color: rgba('ash', 0.8 * k), align: 'center', track: 0 });
    });

    // lyrics
    if (shot === 'A') {
      const pl = this.l2.words.find((w) => w.w.startsWith('pulling'))!;
      const st = prog(t, pl.start, pl.end + 0.15, ease.inOutQuad) * (1 - prog(t, this.l2.end + 1.5, this.l3.start, ease.inOutQuad) * 0.6);
      drawFlow(c, this.l2, 120, 170, t, { family: F.archivo(100, 700), size: 76, tracking: -1.5, sung: rgba('bone', 1), unsung: rgba('bone', 0.16), active: rgba('signal', 1), lead: 0.5 },
        (w) => (w === pl ? { family: F.archivo(lerp(100, 125, st), lerp(700, 300, st)), tracking: lerp(-1.5, 22, st) } : {}));
      const B = this.bend(t);
      drawWarpedLine(c, this.l3, 120, 280, t, { family: F.archivo(100, 700), size: 76, tracking: -1.5, sung: rgba('bone', 1), unsung: rgba('bone', 0.16), active: rgba('signal', 1), lead: 0.5 },
        (x, y) => { const u = (x - 120) / 900; return [x, y + B * 46 * u * u]; });
      const n = prog(t, this.l2.words[3]!.start, this.l2.words[3]!.start + 0.4);
      mono(c, `DEFLECTION  ${(P * 2.07 + this.bend(t) * 1.6).toFixed(2)} M`, 1800, 160, { size: 11, color: rgba('ash', 0.85 * n), track: 3, align: 'right' });
      mono(c, 'TOLERANCE  NONE GIVEN', 1800, 182, { size: 11, color: rgba('ash', 0.85 * n), track: 3, align: 'right' });
    } else if (shot === 'B') {
      // close on the corner: readouts beside the point
      const k = prog(t, this.tBoom, this.tBoom + 0.4, ease.outCubic);
      c.save(); c.globalAlpha = k;
      c.strokeStyle = rgba('signal', 0.8); c.lineWidth = 1;
      c.beginPath(); c.moveTo(px + 16, py + 10); c.lineTo(px + 120, py + 110); c.lineTo(px + 420, py + 110); c.stroke();
      c.restore();
      mono(c, 'CORNER M/6 · CORNICE', px + 128, py + 100, { size: 13, color: rgba('bone', 0.9 * k), track: 3 });
      mono(c, `DISPLACED  ${(P * 2.07 + this.bend(t) * 1.6).toFixed(2)} M`, px + 128, py + 136, { size: 13, color: rgba('signal', k), track: 3, weight: 500 });
      mono(c, 'STATUS  STILL STANDING. BENT.', px + 128, py + 160, { size: 13, color: rgba('bone', 0.8 * k), track: 3 });
      mono(c, '+ STRINGS', 120, 170, { size: 14, color: rgba('ash', 0.9 * k), track: 6, weight: 500 });
    } else {
      // the "oh"s: a small mark per one, like a tally of plucks
      this.ohs.forEach((o, i) => {
        const k = prog(t, o, o + 0.2, ease.outCubic) * (1 - home);
        if (k <= 0) return;
        mono(c, 'OH', 120 + i * 56, 170, { size: 14, color: rgba(t - o < 0.5 ? 'signal' : 'ash', 0.9 * k), track: 4, weight: 500 });
      });
    }
    const la = 1 - prog(t, end - 0.6, end);
    drawLedger(c, lyrics, audio, 120, 1012, t, { alpha: la });
    titleBlock(c, shot === 'B' ? 'D-104' : 'D-103', shot === 'B' ? 'DETAIL: THE EDGE' : 'GRID, UNDER LOAD', [['SCALE', 'INHERITED'], ['INSTRUMENTS', t < this.tBoom ? 'PIANO' : 'PIANO + STRINGS']], { alpha: la });
    comp.draw(renderer, T.upload(), out);
    const kick = Math.max(0, 1 - (t - this.tBoom) / 0.25) * (t >= this.tBoom ? 1 : 0);
    return { bloom: 0.7, ca: 0.5 + kick, vignette: 0.45, shake: [kick * 6, kick * 3] as [number, number], flash: kick * 0.01 };
  }
}
const H2 = 540;
