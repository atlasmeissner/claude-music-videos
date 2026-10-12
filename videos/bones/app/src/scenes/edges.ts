// edges — verse 1, "But I've been pulling at the edges" / "And the whole thing bends", then the strings come in
// and the voice sings a wordless "oh". Here the façade is not a drawing but a building: solid, floodlit stone
// (see _facadePaint, _fracture), cut along hidden fracture lines.
// A: the point walks to the top-right corner and pulls. The corner tears away from the wall in one piece, the
//    crack running jagged through the courses, dust and chips coming off its edges. On "bends" the whole
//    building gives: the middle settles into the ground, the wings lean out, every fracture opens at once and
//    the loose stones fall and pile at the foot. The lyric bends with it.
// B: the strings enter (the boom): close on the torn corner as it jolts and sheds.
// C: the "oh"s: each one is a tremor that grinds the blocks against each other and shakes more stone loose.
//    The point walks back down to the foot of the building, under all of it.
import * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { FSPass, Layer2D, clearRT, W } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { F } from '../engine/type';
import { LIN, rgba } from '../engine/palette';
import type { Line } from '../engine/lyrics';
import { clamp, ease, hash, lerp, prog, springStep } from '../engine/util';
import { drawFlow, drawLedger, drawWarpedLine, mono, point, titleBlock } from './_bones';
import { Fracture, type Pose, type P2 } from './_fracture';

const CORNER: P2 = [770, -540];
const G = 1180; // gravity, façade units (≈ cm) per s²
const H2 = 540;

interface Fall { t0: number; p0: Pose; vx: number; spin: number; tl: number; drop: number }

export default class Edges extends Scene {
  fr!: Fracture;
  // night sky: a faint warm glow low behind the building, from the floodlights
  sky = new FSPass(`void main() { vec2 p = FRAG_PX; float g = exp(-pow(length((p - vec2(960.0, 200.0)) / vec2(1100.0, 520.0)), 2.0)); fragColor = vec4(C_INK + vec3(0.006, 0.005, 0.004) * g, 1.0); }`);
  lb = new LineBatch(3000, { blend: 'normal' });
  lp = new LineBatch(300);
  text = new Layer2D();
  l2!: Line; l3!: Line;
  tBoom = 0; tC = 0; tHome = 0; tBend = 0;
  ohs: number[] = [];
  falls: (Fall | null)[] = [];
  cellCracks: number[][] = [];
  fragR: [number, number, number, number][] = [];

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
    this.sky.render(renderer, out);
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
    const view = { ox, oy, s };
    const toS = (p: P2): P2 => [ox + p[0] * s, oy + p[1] * s];
    // crack openings per cell (for the broken-edge lip)
    const open = fr.cracks.map((_, k) => this.opening(k, poses));
    const cellOpen = fr.cells.map((_, ci) => { let m = 0; for (const k of this.cellCracks[ci]!) m = Math.max(m, open[k]!); return m; });
    let down = 0;
    fr.update(view,
      (ci) => {
        const fl = this.falls[ci];
        if (fl && t >= fl.t0) { down++; return [this.fallPose(fl, t, fr.cells[ci]!.c), 1]; }
        return [poses[fr.cells[ci]!.frag]!, 1];
      },
      (ci) => clamp(cellOpen[ci]! / 6),
      (ci) => {
        const fl = this.falls[ci];
        const rot = fl && t >= fl.t0 ? this.fallPose(fl, t, fr.cells[ci]!.c).rot : poses[fr.cells[ci]!.frag]!.rot;
        return clamp(1 - rot * 1.6, 0.62, 1.18) * (fl && t >= fl.t0 + fl.tl ? 0.72 : 1);
      },
      0.95);
    fr.render(renderer, out);
    // crack lines: the dark gap along every opened fragment border, drawn on both lips
    const lb = this.lb; lb.clear();
    fr.cracks.forEach((e, k) => {
      const o = open[k]!;
      if (o < 0.4) return;
      const w = Math.min(4, 0.7 + o * s * 0.25), al = clamp((o - 0.4) / 2) * 0.9;
      for (const ci of [e.cell, e.other]) {
        if (this.falls[ci] && t >= this.falls[ci]!.t0) continue;
        const q = poses[fr.cells[ci]!.frag]!;
        const a = toS(Fracture.apply(e.a, q)), b = toS(Fracture.apply(e.b, q));
        lb.seg2(a[0], a[1], b[0], b[1], w, [0.004, 0.0035, 0.003], al);
      }
    });
    // chips: small fragments thrown off as each stone comes loose
    fr.cells.forEach((cl, ci) => {
      const fl = this.falls[ci];
      if (!fl || t < fl.t0 || t > fl.t0 + 1.4) return;
      const c0 = Fracture.apply(cl.c, fl.p0);
      for (let j = 0; j < 4; j++) {
        const u = t - fl.t0 - j * 0.04;
        if (u < 0) continue;
        const vx = (hash(ci, j, 31) - 0.5) * 260, vy = -hash(ci, j, 32) * 160;
        let y = c0[1] + vy * u + 0.5 * G * u * u;
        if (y > -2) y = -2;
        const x = c0[0] + vx * u;
        const p = toS([x, y]);
        const sz = (1.2 + hash(ci, j, 33) * 2.4) * Math.max(0.6, s * 1.4);
        lb.seg2(p[0], p[1], p[0] + sz, p[1] + sz * 0.6, sz, [0.32, 0.29, 0.25], clamp(1 - u / 1.4));
      }
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
    px = lerp(px, g0[0], home); py = lerp(py, g0[1], home);
    point(lp, px, py, t, shot === 'B' ? 1.2 : 0.9);
    lp.render(renderer, out);

    const T = this.text, c = T.ctx; T.clear();
    // dust: a puff where each stone comes loose and where it lands, drifting and spreading
    fr.cells.forEach((cl, ci) => {
      const fl = this.falls[ci];
      if (!fl || t < fl.t0) return;
      const puff = (t0: number, at: P2, size: number, life: number, seed: number) => {
        const u = t - t0;
        if (u < 0 || u > life) return;
        for (let j = 0; j < 2; j++) {
          const r = (size * (0.8 + hash(ci, j, seed)) + 140 * Math.sqrt(u)) * s;
          const p = toS([at[0] + (hash(ci, j, seed + 1) - 0.5) * 60 * u + 20 * u, at[1] - 30 * u * (0.5 + hash(ci, j, seed + 2))]);
          const a = 0.045 * Math.pow(1 - u / life, 1.5) * (0.6 + 0.4 * hash(ci, j, seed + 3));
          const gr = c.createRadialGradient(p[0], p[1], 0, p[0], p[1], r);
          gr.addColorStop(0, `rgba(176,166,150,${a})`); gr.addColorStop(1, 'rgba(176,166,150,0)');
          c.fillStyle = gr; c.fillRect(p[0] - r, p[1] - r, r * 2, r * 2);
        }
      };
      puff(fl.t0, Fracture.apply(cl.c, fl.p0), 18, 1.8, 41);
      const c1 = Fracture.apply(cl.c, this.fallPose(fl, fl.t0 + fl.tl, cl.c));
      if (cl.r[0] < 0.5) puff(fl.t0 + fl.tl, [c1[0], -8], 30, 2.6, 51);
    });
    // a haze of dust hanging at the foot once the building has settled
    const haze = clamp(down / 120) * 0.1;
    if (haze > 0.005) {
      const gr = c.createLinearGradient(0, oy - 260 * s, 0, oy);
      gr.addColorStop(0, 'rgba(150,140,126,0)'); gr.addColorStop(1, `rgba(150,140,126,${haze})`);
      c.fillStyle = gr; c.fillRect(0, oy - 260 * s, W, 260 * s);
    }
    // the ground: whatever settles below it disappears into it
    if (oy < 1080) {
      c.fillStyle = 'rgb(16,14,12)'; c.fillRect(0, oy, W, 1080 - oy);
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
    titleBlock(c, shot === 'B' ? 'D-104' : 'D-103', shot === 'B' ? 'DETAIL: THE EDGE' : 'STRUCTURE, FAILING', [['SCALE', 'INHERITED'], ['INSTRUMENTS', t < this.tBoom ? 'PIANO' : 'PIANO + STRINGS']], { alpha: la });
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
