// edges — verse 1, "But I've been pulling at the edges" / "And the whole thing bends", then the strings come in
// and the voice sings a wordless "oh". The façade, still an engraving, but cut along hidden fracture lines into
// stones (_fracture: Voronoi cells grouped into large fragments) that move rigidly, so it breaks rather than bends.
// A: the point walks to the top-right corner and pulls. The corner tears away from the wall in one piece, the
//    crack running jagged through the courses, chips and stippled dust coming off its edges. On "bends" the whole
//    building gives: the middle settles into the ground, the wings lean out, every fracture opens at once and the
//    loose stones fall as cut, hatched blocks and pile at the foot. The faint structural grid it was set out on
//    stays where it was. The lyric bends with it.
// B: the strings enter (the boom): close on the torn corner as it jolts and sheds.
// C: the "oh"s: each one is a tremor that grinds the blocks against each other and shakes more stone loose.
//    The point walks back down to the foot of the building, under all of it.
import * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { Layer2D, clearRT, W } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { F } from '../engine/type';
import { LIN, rgba } from '../engine/palette';
import type { Line } from '../engine/lyrics';
import { clamp, ease, hash, lerp, prog, springStep } from '../engine/util';
import { drawFlow, drawLedger, drawWarpedLine, mono, point, titleBlock } from './_bones';
import { Fracture, type Pose, type P2 } from './_fracture';
import { FACADE, GRID_X } from './_facade';

const CORNER: P2 = [770, -540];
const LEVELS = [0, -42, -270, -470, -540, -600, -770];
const G = 1180; // gravity, façade units (≈ cm) per s²
const H2 = 540;

interface Fall { t0: number; p0: Pose; vx: number; spin: number; tl: number; drop: number }

export default class Edges extends Scene {
  fr!: Fracture;
  lb = new LineBatch(70000, { blend: 'max' });
  lp = new LineBatch(300);
  text = new Layer2D();
  l2!: Line; l3!: Line;
  tBoom = 0; tC = 0; tHome = 0; tBend = 0;
  ohs: number[] = [];
  falls: (Fall | null)[] = [];
  cellCracks: number[][] = [];
  fragR: [number, number, number, number][] = [];
  pieces: { a: P2; b: P2; w: number; gold: boolean; cell: number }[] = [];

  override init() {
    const { lyrics, audio, start, end } = this.ctx;
    this.l2 = lyrics.lines[2]!; this.l3 = lyrics.lines[3]!;
    const hit = (audio.onsets.kick ?? []).find(([t, s]) => t > this.l3.end && t < end && s > 0.5);
    this.tBoom = hit ? hit[0] : start + 8;
    this.tC = audio.downbeats.find((d) => d > this.tBoom + 2) ?? this.tBoom + 2.6;
    this.tHome = audio.downbeats.filter((d) => d < end - 0.5).pop() ?? end - 1.7;
    this.tBend = this.l3.words[this.l3.words.length - 1]!.start;
    const vo = (audio.onsets.vocal ?? []).filter(([t, s]) => t > this.tC - 0.2 && t < this.tHome && s > 0.45).map(([t]) => t);
    for (const v of vo) if (!this.ohs.length || v - this.ohs[this.ohs.length - 1]! > 0.55) this.ohs.push(v);
    this.fr = new Fracture(34, 230, 7);
    const fr = this.fr;
    this.fragR = fr.frags.map((_, i) => [hash(i, 21), hash(i, 22), hash(i, 23), hash(i, 24)]);
    // the line drawing cut into pieces (≤ 14 units), each belonging to the stone cell it lies in
    const cellOf = (x: number, y: number) => {
      let best = -1, bd = 1e18;
      for (let ci = 0; ci < fr.cells.length; ci++) { const q = fr.cells[ci]!.site; const d = (q[0] - x) ** 2 + (q[1] - y) ** 2; if (d < bd) { bd = d; best = ci; } }
      return best;
    };
    for (const m of FACADE) {
      if (m.layer === 'frame' || m.layer === 'found') continue;
      for (let k = 1; k < m.pts.length; k++) {
        const [x0, y0] = m.pts[k - 1]!, [x1, y1] = m.pts[k]!;
        const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 14));
        for (let j = 0; j < n; j++) {
          const a: P2 = [x0 + (x1 - x0) * (j / n), y0 + (y1 - y0) * (j / n)], b: P2 = [x0 + (x1 - x0) * ((j + 1) / n), y0 + (y1 - y0) * ((j + 1) / n)];
          this.pieces.push({ a, b, w: m.w, gold: m.layer === 'gold', cell: cellOf((a[0] + b[0]) / 2, (a[1] + b[1]) / 2) });
        }
      }
    }
    this.cellCracks = fr.cells.map(() => []);
    fr.cracks.forEach((e, k) => { this.cellCracks[e.cell]!.push(k); this.cellCracks[e.other]!.push(k); });
    // which border stones come loose, and when: the first time the crack beside them opens wider than they
    // can bridge (sampled over the plate at 30 Hz); the boom and the tremors shake more loose near the corner
    this.falls = fr.cells.map(() => null);
    const samples: number[] = [];
    for (let t = start; t < end; t += 1 / 30) samples.push(t);
    const opened = fr.cells.map(() => -1);
    for (const t of samples) {
      const poses = fr.frags.map((_, fi) => this.fragPose(fi, t));
      fr.cells.forEach((cl, ci) => {
        if (!cl.edge || opened[ci]! >= 0) return;
        const theta = 10 + 45 * cl.r[0];
        for (const k of this.cellCracks[ci]!) {
          if (this.opening(k, poses) > theta) { opened[ci] = t; break; }
        }
      });
    }
    fr.cells.forEach((cl, ci) => {
      if (!cl.edge) return;
      let t0 = opened[ci]! >= 0 && cl.r[1] < 0.45 ? opened[ci]! + cl.r[2] * 0.5 : -1;
      const dCorner = Math.hypot(cl.c[0] - CORNER[0], cl.c[1] - CORNER[1]);
      if (dCorner < 330 && cl.r[1] < 0.7) t0 = t0 < 0 ? this.tBoom + cl.r[2] * 0.7 : Math.min(t0, this.tBoom + cl.r[2] * 0.7);
      for (const o of this.ohs) if (opened[ci]! >= 0 && opened[ci]! < o && cl.r[1] >= 0.45 && cl.r[1] < 0.6 && hash(ci, Math.round(o * 10)) < 0.3) t0 = t0 < 0 ? o + cl.r[2] * 0.4 : Math.min(t0, o + cl.r[2] * 0.4);
      if (t0 < 0 || t0 >= end) return;
      const p0 = this.fragPose(cl.frag, t0);
      const c0 = Fracture.apply(cl.c, p0);
      const drop = Math.max(0, -c0[1] - 6 - cl.r[2] * 10);
      this.falls[ci] = { t0, p0, vx: (cl.r[1] - 0.5) * 70 + Math.sign(cl.c[0]) * 25, spin: (cl.r[2] - 0.5) * 6, tl: Math.sqrt((2 * drop) / G), drop };
    });
  }

  pull(t: number) {
    const pl = this.l2.words.find((w) => w.w.startsWith('pulling'))!;
    return ease.inOutCubic(prog(t, pl.start - 0.1, this.l2.end + 0.3)) * (1 + 0.05 * Math.sin((t - pl.start) * 2.1) * prog(t, this.l2.end, this.l2.end + 1));
  }
  bend(t: number) { return springStep(t - this.tBend, 1.1, 0.32); }
  /** the displacement field (façade units) */
  field(x: number, y: number, t: number): P2 {
    const P = this.pull(t);
    // the corner tears off as one piece (the fragments around it come with it); the wall nearby only gives a little
    const d = Math.hypot(x - CORNER[0], y - CORNER[1]);
    const g = d < 250 ? 1 : Math.exp(-((d - 250) ** 2) / (2 * 90 * 90)) * 0.12;
    let dx = P * 190 * g, dy = -P * 90 * g;
    const B = this.bend(t);
    const u = x / 800, v = clamp(-y / 1000, -0.1, 1.2);
    dy += B * (60 * (1 - u * u) + 18 * v * (1 - u * u)); // the middle settles into the ground
    dx += B * 70 * u * v;                                 // the wings lean out
    dy -= B * 16 * u * u * v;
    return [dx, dy];
  }
  fragPose(fi: number, t: number): Pose {
    const f = this.fr.frags[fi]!, R = this.fragR[fi]!;
    const [x, y] = f.c;
    const e = 25;
    const [dx, dy] = this.field(x, y, t);
    const [ax] = this.field(x, y + e, t), [bx] = this.field(x, y - e, t);
    const [, cy] = this.field(x + e, y, t), [, dyy] = this.field(x - e, y, t);
    let rot = 0.5 * ((cy - dyy) / (2 * e) - (ax - bx) / (2 * e));
    const B = this.bend(t);
    rot += B * (R[0] - 0.5) * 0.05;
    let ex = 0, ey = 0;
    // after the bend, some blocks keep slumping
    const slump = R[1] < 0.45 ? prog(t, this.tBend + 0.4, this.ctx.end, ease.outQuad) * (6 + 30 * R[2]) : 0;
    ey += slump;
    // tremors: the boom and each "oh" jostle every block on its own phase
    const quake = (te: number, A: number, hl: number) => {
      if (t < te) return;
      const k = A * Math.pow(0.5, (t - te) / hl);
      if (k < 0.05) return;
      ex += k * Math.sin((t - te) * 37 + R[0] * 6.28); ey += k * 0.7 * Math.sin((t - te) * 29 + R[1] * 6.28);
      rot += k * 0.0016 * Math.sin((t - te) * 23 + R[2] * 6.28);
    };
    quake(this.tBend, 9, 0.35);
    quake(this.tBoom, 14, 0.3);
    for (const o of this.ohs) quake(o, 6, 0.4);
    return { dx: dx + ex, dy: dy + ey, rot, cx: x, cy: y };
  }
  opening(k: number, poses: Pose[]) {
    const e = this.fr.cracks[k]!;
    const m: P2 = [(e.a[0] + e.b[0]) / 2, (e.a[1] + e.b[1]) / 2];
    const pa = Fracture.apply(m, poses[this.fr.cells[e.cell]!.frag]!), pb = Fracture.apply(m, poses[this.fr.cells[e.other]!.frag]!);
    return Math.hypot(pa[0] - pb[0], pa[1] - pb[1]);
  }
  /** a fallen stone's pose at t: it leaves its block's pose at t0, falls, spins about its own centre, lands */
  fallPose(f: Fall, t: number, cc: P2): Pose {
    const u = Math.max(0, t - f.t0);
    const ul = Math.min(u, f.tl);
    const landed = u >= f.tl;
    const a2 = f.spin * ul, cs = Math.cos(a2), sn = Math.sin(a2);
    const m = Fracture.apply(cc, f.p0);
    const c1: P2 = [f.p0.cx, f.p0.cy];
    const q: P2 = [c1[0] + f.p0.dx - m[0], c1[1] + f.p0.dy - m[1]];
    const d2: P2 = [f.vx * ul, landed ? f.drop : 0.5 * G * ul * ul];
    return { dx: q[0] * cs - q[1] * sn + m[0] + d2[0] - c1[0], dy: q[0] * sn + q[1] * cs + m[1] + d2[1] - c1[1], rot: f.p0.rot + a2, cx: c1[0], cy: c1[1] };
  }

  render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer, comp, lyrics, audio } = this.ctx;
    const t = f.t, s0 = this.ctx.start, end = this.ctx.end;
    clearRT(renderer, out, LIN.ink);
    const fr = this.fr;
    const poses = fr.frags.map((_, fi) => this.fragPose(fi, t));
    const shot = t < this.tBoom ? 'A' : t < this.tC ? 'B' : 'C';
    // camera
    let s = 0.6, ox = W / 2, oy = 930;
    if (shot === 'A') s = lerp(0.6, 0.63, prog(t, s0, this.tBoom));
    const cornerNow = () => {
      const fi = this.cornerFrag();
      return Fracture.apply(CORNER, poses[fi]!);
    };
    if (shot === 'B') {
      const z = prog(t, this.tBoom, this.tBoom + 0.5, ease.outExpo);
      s = lerp(1.2, 1.38, z + prog(t, this.tBoom, this.tC) * 0.3);
      const cw = cornerNow();
      ox = W * 0.55 - cw[0] * s; oy = H2 + 60 - cw[1] * s;
    }
    if (shot === 'C') {
      const z = prog(t, this.tC, this.tC + 1.2, ease.outCubic);
      s = lerp(0.5, 0.58, z) + (t - this.tC) * 0.006;
      const down = ease.inOutCubic(prog(t, this.tHome, end));
      oy = lerp(880, 640, down); s = lerp(s, 0.7, down);
    }
    const toS = (p: P2): P2 => [ox + p[0] * s, oy + p[1] * s];
    const open = fr.cracks.map((_, k) => this.opening(k, poses));
    let down = 0;
    const cellPose = fr.cells.map((cl, ci) => {
      const fl = this.falls[ci];
      if (fl && t >= fl.t0) { down++; return this.fallPose(fl, t, cl.c); }
      return poses[cl.frag]!;
    });
    const lb = this.lb; lb.clear();
    // the reference: the structural grid it was set out on, unbroken, faint — the building breaks away from it
    const ga = 0.35 * prog(t, s0 + 0.2, s0 + 1.2);
    for (const x of GRID_X) for (let y = 60; y > -1080; y -= 22) { const p0 = toS([x, y]), p1 = toS([x, y - 15]); lb.seg2(p0[0], p0[1], p1[0], p1[1], 0.8, LIN.ash, ga); }
    for (const y of LEVELS) for (let x = -880; x < 880; x += 22) { const p0 = toS([x, y]), p1 = toS([x + 15, y]); lb.seg2(p0[0], p0[1], p1[0], p1[1], 0.8, LIN.ash, ga * 0.8); }
    // the façade: every line piece moves with the stone it is cut into
    const wk = Math.max(0.7, Math.min(1.5, s * 1.6));
    for (const pc of this.pieces) {
      const q = cellPose[pc.cell]!;
      const A = toS(Fracture.apply(pc.a, q)), Bp = toS(Fracture.apply(pc.b, q));
      lb.seg2(A[0], A[1], Bp[0], Bp[1], pc.w * wk, pc.gold ? LIN.gold : LIN.bone, pc.gold ? 0.95 : 0.66);
    }
    // the fracture: an engraved hairline on both lips of every opened crack
    fr.cracks.forEach((e, k) => {
      const o = open[k]!;
      if (o < 0.6) return;
      const al = clamp((o - 0.6) / 3) * 0.85;
      for (const ci of [e.cell, e.other]) {
        const q = cellPose[ci]!;
        const A = toS(Fracture.apply(e.a, q)), Bp = toS(Fracture.apply(e.b, q));
        lb.seg2(A[0], A[1], Bp[0], Bp[1], 1, LIN.bone, al);
      }
    });
    // stones that came loose: drawn as cut blocks — outline and a few hatch strokes — falling and lying at the foot
    fr.cells.forEach((cl, ci) => {
      const fl = this.falls[ci];
      if (!fl || t < fl.t0) return;
      const q = cellPose[ci]!;
      const pts = cl.poly.map((p) => toS(Fracture.apply(p, q)));
      const landed = t >= fl.t0 + fl.tl;
      for (let n = 0; n < pts.length; n++) { const A = pts[n]!, Bp = pts[(n + 1) % pts.length]!; lb.seg2(A[0], A[1], Bp[0], Bp[1], 1, LIN.bone, landed ? 0.45 : 0.7); }
      const c0 = toS(Fracture.apply(cl.c, q));
      const ang = q.rot + 0.7, r = 10 * s;
      for (let h = -2; h <= 2; h++) {
        const ox2 = Math.cos(ang + Math.PI / 2) * h * 3.2 * s, oy2 = Math.sin(ang + Math.PI / 2) * h * 3.2 * s;
        const L = r * (1 - Math.abs(h) * 0.22);
        lb.seg2(c0[0] + ox2 - Math.cos(ang) * L, c0[1] + oy2 - Math.sin(ang) * L, c0[0] + ox2 + Math.cos(ang) * L, c0[1] + oy2 + Math.sin(ang) * L, 0.7, LIN.ash, landed ? 0.3 : 0.5);
      }
    });
    // chips and dust, stippled: short strokes thrown off, then a drift of fine dots where stones break and land
    fr.cells.forEach((cl, ci) => {
      const fl = this.falls[ci];
      if (!fl || t < fl.t0) return;
      const c0 = Fracture.apply(cl.c, fl.p0);
      if (t < fl.t0 + 1.4) {
        for (let j = 0; j < 4; j++) {
          const u = t - fl.t0 - j * 0.04;
          if (u < 0) continue;
          const vx = (hash(ci, j, 31) - 0.5) * 260, vy = -hash(ci, j, 32) * 160;
          const y = Math.min(-2, c0[1] + vy * u + 0.5 * G * u * u), x = c0[0] + vx * u;
          const p = toS([x, y]);
          const sz = (2 + hash(ci, j, 33) * 4) * Math.max(0.6, s * 1.4);
          const a2 = hash(ci, j, 34) * 6.28;
          lb.seg2(p[0], p[1], p[0] + Math.cos(a2) * sz, p[1] + Math.sin(a2) * sz, 1, LIN.bone, 0.8 * clamp(1 - u / 1.4));
        }
      }
      const stipple = (t0: number, at: P2, n: number, life: number, seed: number) => {
        const u = t - t0;
        if (u < 0 || u > life) return;
        for (let j = 0; j < n; j++) {
          const a2 = hash(ci, j, seed) * 6.28, sp = 20 + 70 * hash(ci, j, seed + 1);
          const rr = sp * Math.sqrt(u) * 1.6;
          const p = toS([at[0] + Math.cos(a2) * rr + 25 * u, at[1] + Math.sin(a2) * rr * 0.6 - 22 * u * hash(ci, j, seed + 2)]);
          lb.seg2(p[0], p[1], p[0] + 0.01, p[1], 1.6, LIN.ash, 0.6 * Math.pow(1 - u / life, 1.3));
        }
      };
      stipple(fl.t0, c0, 7, 1.8, 41);
      if (cl.r[0] < 0.5) { const c1 = Fracture.apply(cl.c, this.fallPose(fl, fl.t0 + fl.tl, cl.c)); stipple(fl.t0 + fl.tl, [c1[0], -8], 10, 2.4, 51); }
    });
    lb.render(renderer, out);
    // the pull: tether from the corner's rest position, the point at the torn corner
    const lp = this.lp; lp.clear();
    const P = this.pull(t);
    const walk = prog(t, s0 + 0.2, this.l2.words[0]!.start + 0.6, ease.inOutCubic);
    const home = prog(t, this.tHome, end - 0.2, ease.inOutCubic);
    const cs = toS(cornerNow()), rest = toS(CORNER);
    if (P > 0.01 && home < 1) {
      lp.seg2(rest[0], rest[1], cs[0], cs[1], 1, LIN.signal, 0.55 * (1 - home));
      lp.seg2(rest[0] - 6, rest[1], rest[0] + 6, rest[1], 1, LIN.signal, 0.8 * (1 - home)); lp.seg2(rest[0], rest[1] - 6, rest[0], rest[1] + 6, 1, LIN.signal, 0.8 * (1 - home));
    }
    const g0 = toS([0, 0]);
    let px = lerp(ox, cs[0], walk), py = lerp(oy, cs[1], walk);
    px = lerp(px, g0[0], home); py = lerp(py, g0[1] - 5, home);
    point(lp, px, py, t, shot === 'B' ? 1.2 : 0.9);
    lp.render(renderer, out);

    const T = this.text, c = T.ctx; T.clear();
    // the ground: whatever settles below it disappears into it
    if (oy < 1080) {
      c.fillStyle = rgba('ink', 1); c.fillRect(0, oy + 0.5, W, 1080 - oy);
      c.strokeStyle = rgba('bone', 0.5); c.lineWidth = 1; c.beginPath(); c.moveTo(0, oy); c.lineTo(W, oy); c.stroke();
      c.strokeStyle = rgba('graphite', 0.35);
      for (let x = -20; x < W; x += 16) { c.beginPath(); c.moveTo(x, oy + 2); c.lineTo(x - 14, oy + 16); c.stroke(); }
    }

    // lyrics and readouts
    const B = this.bend(t);
    let cracked = 0; for (const o of open) if (o > 1) cracked++;
    if (shot === 'A') {
      const pl = this.l2.words.find((w) => w.w.startsWith('pulling'))!;
      const st = prog(t, pl.start, pl.end + 0.15, ease.inOutQuad) * (1 - prog(t, this.l2.end + 1.5, this.l3.start, ease.inOutQuad) * 0.6);
      drawFlow(c, this.l2, 120, 170, t, { family: F.archivo(100, 700), size: 76, tracking: -1.5, sung: rgba('bone', 1), unsung: rgba('bone', 0.16), active: rgba('signal', 1), lead: 0.5 },
        (w) => (w === pl ? { family: F.archivo(lerp(100, 125, st), lerp(700, 300, st)), tracking: lerp(-1.5, 22, st) } : {}));
      drawWarpedLine(c, this.l3, 120, 280, t, { family: F.archivo(100, 700), size: 76, tracking: -1.5, sung: rgba('bone', 1), unsung: rgba('bone', 0.16), active: rgba('signal', 1), lead: 0.5 },
        (x, y) => { const u = (x - 120) / 900; return [x, y + B * 46 * u * u]; });
      const n = prog(t, this.l2.words[3]!.start, this.l2.words[3]!.start + 0.4);
      mono(c, `DEFLECTION  ${(P * 2.07 + B * 0.85).toFixed(2)} M`, 1800, 160, { size: 11, color: rgba('ash', 0.85 * n), track: 3, align: 'right' });
      mono(c, `CRACKS OPEN  ${cracked}`, 1800, 182, { size: 11, color: rgba(cracked > 0 ? 'signal' : 'ash', 0.9 * n), track: 3, align: 'right' });
      mono(c, `STONES DOWN  ${down}`, 1800, 204, { size: 11, color: rgba('ash', 0.85 * n), track: 3, align: 'right' });
    } else if (shot === 'B') {
      const k = prog(t, this.tBoom, this.tBoom + 0.4, ease.outCubic);
      c.save(); c.globalAlpha = k;
      c.strokeStyle = rgba('signal', 0.8); c.lineWidth = 1;
      c.beginPath(); c.moveTo(px + 16, py + 10); c.lineTo(px + 120, py + 110); c.lineTo(px + 420, py + 110); c.stroke();
      c.restore();
      mono(c, 'CORNER M/6 · CORNICE', px + 128, py + 100, { size: 13, color: rgba('bone', 0.9 * k), track: 3 });
      mono(c, `TORN  ${(P * 2.07 + B * 0.85).toFixed(2)} M FROM THE WALL`, px + 128, py + 136, { size: 13, color: rgba('signal', k), track: 3, weight: 500 });
      mono(c, 'STATUS  CRACKED THROUGH. STILL STANDING.', px + 128, py + 160, { size: 13, color: rgba('bone', 0.8 * k), track: 3 });
      mono(c, '+ STRINGS', 120, 170, { size: 14, color: rgba('ash', 0.9 * k), track: 6, weight: 500 });
    } else {
      this.ohs.forEach((o, i) => {
        const k = prog(t, o, o + 0.2, ease.outCubic) * (1 - home);
        if (k <= 0) return;
        mono(c, 'OH', 120 + i * 56, 170, { size: 14, color: rgba(t - o < 0.5 ? 'signal' : 'ash', 0.9 * k), track: 4, weight: 500 });
      });
      mono(c, `CRACKS OPEN  ${cracked} · STONES DOWN  ${down}`, 120, 200, { size: 11, color: rgba('ash', 0.85 * (1 - home)), track: 3 });
    }
    const la = 1 - prog(t, end - 0.6, end);
    drawLedger(c, lyrics, audio, 120, 1012, t, { alpha: la });
    titleBlock(c, shot === 'B' ? 'D-104' : 'D-103', shot === 'B' ? 'DETAIL: THE EDGE' : 'GRID, UNDER LOAD', [['SCALE', 'INHERITED'], ['INSTRUMENTS', t < this.tBoom ? 'PIANO' : 'PIANO + STRINGS']], { alpha: la });
    comp.draw(renderer, T.upload(), out);
    const kick = Math.max(0, 1 - (t - this.tBoom) / 0.3) * (t >= this.tBoom ? 1 : 0);
    const bendJolt = Math.max(0, 1 - (t - this.tBend) / 0.5) * (t >= this.tBend ? 1 : 0);
    const ohJolt = this.ohs.reduce((m, o) => Math.max(m, t >= o ? Math.max(0, 1 - (t - o) / 0.3) : 0), 0);
    const sh = kick * 7 + bendJolt * 9 + ohJolt * 3;
    const ph = t * 61;
    return { bloom: 0.7, ca: 0.5 + kick + bendJolt * 0.6, vignette: 0.5, shake: [Math.sin(ph) * sh, Math.cos(ph * 1.3) * sh * 0.6] as [number, number] };
  }

  private cf = -1;
  cornerFrag() {
    if (this.cf < 0) {
      let best = 0, bd = 1e18;
      this.fr.cells.forEach((cl) => { const d = (cl.c[0] - (CORNER[0] - 30)) ** 2 + (cl.c[1] - (CORNER[1] + 30)) ** 2; if (d < bd) { bd = d; best = cl.frag; } });
      this.cf = best;
    }
    return this.cf;
  }
}
