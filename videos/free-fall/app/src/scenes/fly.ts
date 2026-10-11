// FLY ×2 — the chorus body: "I'd rather fly and hit a wall / Than spend forever standing tall / On ground that never
// moves at all" — three sub-shots, cut on beats, each one a plate from the treatise:
//   A. Ballistics. The spark runs up the platform ("I'd rather"), leaps on "fly" and flies a parabola (dashed
//      prediction, stroboscopic ghosts, velocity vectors) into an engraved brick wall on "wall": cracks, a burst,
//      DAMAGE: ONE (1) BRUISE. The words of the line ride the trajectory, each where the spark was when it was sung.
//   B. Statics. A free-body diagram of a tall column standing on the ground (W ↓, N ↑, ΣF = 0, Δx = 0, v = 0) and
//      a clock that runs to forever. "forever" stretches while held; TALL is set tall up the column.
//   C. Seismograph. A drum of paper scrolling under a pen that draws a perfectly flat line; GROUND DISPLACEMENT
//      0.000 mm; the line's words are printed on the paper as the pen passes and scroll away.
// v=1: ink, hairlines in bone (chorus 1). v=2: bone paper, ink lines, faster camera (chorus 2), and a tag: on
// "Free fall" (line 21) the flat trace drops off the bottom of the paper and THE ODDS tick to 100 : 1.
import type * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { Layer2D, clearRT, W, H } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { LIN, rgba } from '../engine/palette';
import { F, font } from '../engine/type';
import type { Line } from '../engine/lyrics';
import { Lyrics } from '../engine/lyrics';
import { clamp, ease, frameIdx, hash, lerp, prog, pulse, TAU } from '../engine/util';
import { drawKaraoke, drawOdds, fmtOdds, mixCss, mono, odds, sparkHead, sparkParticles, wordColor } from './_ff';
import { stamp } from './ledger-kit';

type P2 = { x: number; y: number };
// shot A geometry
const PLAT_Y = 720, PLAT_X = 600, FLOOR_Y = 920, WALL_X = 1520, WALL_W = 170, WALL_TOP = 300;

export default class Fly extends Scene {
  v = 1;
  L = new Layer2D();
  lb = new LineBatch(6000);
  la!: Line; lbL!: Line; lc!: Line; tag: Line | null = null;
  tB = 0; tC = 0; tRun = 0; tFly = 0; tWall = 0;
  // ballistics (px, s)
  vx = 0; vy = 0; g = 0;

  override init() {
    const { lyrics, audio, params } = this.ctx;
    this.v = params.v ?? 1;
    const [a, b, c] = (params.lines ?? [7, 8, 9]) as number[];
    this.la = lyrics.lines[a!]!; this.lbL = lyrics.lines[b!]!; this.lc = lyrics.lines[c!]!;
    if (params.tag !== undefined) this.tag = lyrics.lines[params.tag]!;
    const cut = (l: Line) => audio.timeOfBeat(Math.floor(audio.beatAt(l.words[0]!.start + 0.05)));
    this.tB = cut(this.lbL); this.tC = cut(this.lc);
    this.tRun = this.la.words[0]!.start - 0.1;
    this.tFly = this.la.words[2]!.start; // "fly"
    this.tWall = this.la.words[this.la.words.length - 1]!.start; // "wall"
    const T = this.tWall - this.tFly;
    const apex = 330;
    this.vy = (2 * apex) / (T * 0.55);
    this.g = this.vy / (T * 0.55);
    this.vx = (WALL_X - PLAT_X) / T;
  }

  pal() {
    return this.v === 2
      ? { bg: LIN.bone, ink: rgba('ink', 1), line: rgba('ink', 0.85), dim: rgba('graphite', 0.85), faint: rgba('ink', 0.14), hot: rgba('signal', 1), hatch: rgba('ink', 0.35), sung: rgba('ink', 1), unsung: rgba('ink', 0.18) }
      : { bg: LIN.ink, ink: rgba('bone', 1), line: rgba('bone', 0.85), dim: rgba('ash', 0.75), faint: rgba('bone', 0.12), hot: rgba('signal', 1), hatch: rgba('graphite', 0.7), sung: rgba('bone', 1), unsung: rgba('bone', 0.2) };
  }

  /** The spark's position in shot A at time tb. */
  sparkA(tb: number): P2 {
    if (tb < this.tFly) {
      const k = prog(tb, this.tRun, this.tFly);
      return { x: lerp(110, PLAT_X, k), y: PLAT_Y - 9 };
    }
    if (tb < this.tWall) {
      const u = tb - this.tFly;
      return { x: PLAT_X + this.vx * u, y: PLAT_Y - 9 - this.vy * u + 0.5 * this.g * u * u };
    }
    // after impact: slides down the wall face to the floor, then sits
    const hit = this.sparkA(this.tWall - 1e-4);
    const u = tb - this.tWall;
    const y = Math.min(FLOOR_Y - 9, hit.y + 0.5 * 2600 * Math.max(0, u - 0.12) ** 2);
    return { x: WALL_X - 10 - Math.min(40, u * 60), y };
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const { renderer, comp } = this.ctx;
    const t = f.t, P = this.pal();
    clearRT(renderer, out, P.bg);
    const L = this.L, c = L.ctx; L.clear();
    const lb = this.lb; lb.clear();
    let hit = 0;
    const shot = t < this.tB ? 0 : t < this.tC ? 1 : 2;
    if (shot === 0) hit = this.shotA(c, lb, t, P);
    else if (shot === 1) hit = this.shotB(c, lb, t, P, f);
    else hit = this.shotC(c, lb, t, P);
    comp.draw(renderer, L.upload(), out);
    lb.render(renderer, out);
    const sh = hit * 10;
    return {
      bloom: 0.6, vignette: this.v === 2 ? 0.2 : 0.4, paper: this.v === 2 ? 1 : 0, grain: this.v === 2 ? 0.045 : 0.055,
      shake: [(hash(frameIdx(t), 1) - 0.5) * sh, (hash(frameIdx(t), 2) - 0.5) * sh] as [number, number], zoom: 1 + hit * 0.012,
    };
  }

  // ------------------------------------------------------------------ A. ballistics
  shotA(c: CanvasRenderingContext2D, lb: LineBatch, t: number, P: ReturnType<Fly['pal']>) {
    const s0 = this.ctx.start;
    const intro = prog(t, s0, s0 + 0.45, ease.outCubic);
    // camera: a slow push toward the wall after launch
    const cam = prog(t, this.tFly, this.tWall, ease.inOutCubic);
    const z = 1 + 0.05 * cam, cx = lerp(W / 2, W / 2 + 60, cam), cy = H / 2;
    c.save();
    c.translate(W / 2, H / 2); c.scale(z, z); c.translate(-cx, -cy);
    c.lineCap = 'butt';
    // platform (the cliff, hatched section) and the floor below (1.40 m lower)
    c.strokeStyle = P.line; c.lineWidth = 2;
    c.beginPath(); c.moveTo(-200, PLAT_Y); c.lineTo(PLAT_X * intro, PLAT_Y); c.stroke();
    c.beginPath(); c.moveTo(PLAT_X, PLAT_Y); c.lineTo(PLAT_X, PLAT_Y + (FLOOR_Y - PLAT_Y) * intro); c.stroke();
    c.beginPath(); c.moveTo(PLAT_X, FLOOR_Y); c.lineTo(PLAT_X + (WALL_X - PLAT_X + 600) * intro, FLOOR_Y); c.stroke();
    c.save(); c.beginPath(); c.rect(-200, PLAT_Y, PLAT_X + 200, 600); c.rect(PLAT_X, FLOOR_Y, 2000, 400); c.clip();
    c.strokeStyle = P.hatch; c.lineWidth = 1;
    for (let x = -600; x < 2400; x += 13) { c.beginPath(); c.moveTo(x, PLAT_Y); c.lineTo(x - 380, PLAT_Y + 380); c.stroke(); }
    c.restore();
    // dimension: the drop, 1.40 m
    c.strokeStyle = P.dim; c.fillStyle = P.dim; c.lineWidth = 1;
    const dx = PLAT_X + 34;
    c.beginPath(); c.moveTo(dx, PLAT_Y + 6); c.lineTo(dx, FLOOR_Y - 6); c.stroke();
    mono(c, '1.40 m', dx + 12, (PLAT_Y + FLOOR_Y) / 2 + 5, { size: 13, color: P.dim, track: 2 });
    // the wall: engraved bricks (running bond), cracked on impact
    const imp = this.sparkA(this.tWall - 1e-4);
    const wk = prog(t, s0 + 0.1, s0 + 0.6, ease.outCubic);
    const crack = prog(t, this.tWall, this.tWall + 0.25, ease.outExpo);
    const shakeW = pulse(t, this.tWall, 0.08) * 8;
    c.save();
    c.translate((hash(frameIdx(t), 4) - 0.5) * shakeW, 0);
    const broken = this.v === 3 && t >= this.tWall;
    const bh = 34, bw = 84;
    if (broken) {
      // the wall breaks: every brick flies off the impact, outlined in acid (the video's one acid moment)
      const u = t - this.tWall;
      const fade = 1 - prog(u, 0.9, 1.6);
      for (let r = 0; r * bh < FLOOR_Y - WALL_TOP; r++) {
        const y = FLOOR_Y - r * bh;
        for (let x = WALL_X + (r % 2 ? bw / 2 : 0) - bw; x < WALL_X + WALL_W; x += bw) {
          const x0 = Math.max(WALL_X, x), x1 = Math.min(WALL_X + WALL_W, x + bw);
          if (x1 - x0 < 4) continue;
          const bx = (x0 + x1) / 2, by = y - bh / 2;
          const dx = bx - imp.x + 30, dy = by - imp.y;
          const dl = Math.hypot(dx, dy) + 1;
          const sp = (900 + 700 * hash(r, x)) * Math.exp(-dl / 500);
          const px = bx + (dx / dl) * sp * u, py = by + (dy / dl) * sp * u + 0.5 * 1800 * u * u * (dl > 220 ? 0.6 : 1);
          const rot = (hash(x, r) - 0.5) * 8 * u;
          c.save(); c.translate(px, py); c.rotate(rot);
          c.globalAlpha = fade;
          c.strokeStyle = u < 0.7 ? rgba('acid', 1) : P.line; c.lineWidth = 2;
          c.strokeRect(-(x1 - x0) / 2, -bh / 2, x1 - x0, bh);
          c.restore();
        }
      }
    } else {
    c.beginPath(); c.rect(WALL_X, lerp(FLOOR_Y, WALL_TOP, wk), WALL_W, FLOOR_Y - WALL_TOP); c.clip();
    c.fillStyle = this.v === 2 ? rgba('bone', 1) : rgba('ink2', 1); c.fillRect(WALL_X, WALL_TOP, WALL_W, FLOOR_Y - WALL_TOP);
    c.strokeStyle = P.line; c.lineWidth = 1.2;
    for (let r = 0; (r * bh) < FLOOR_Y - WALL_TOP; r++) {
      const y = FLOOR_Y - r * bh;
      c.beginPath(); c.moveTo(WALL_X, y); c.lineTo(WALL_X + WALL_W, y); c.stroke();
      for (let x = WALL_X + (r % 2 ? bw / 2 : 0); x < WALL_X + WALL_W; x += bw) { c.beginPath(); c.moveTo(x, y); c.lineTo(x, y - bh); c.stroke(); }
      // brick shading: a few hatch strokes per brick
      c.save(); c.strokeStyle = P.faint;
      for (let x = WALL_X + (r % 2 ? bw / 2 : 0) - bw; x < WALL_X + WALL_W; x += bw)
        for (let k = 1; k < 4; k++) { c.beginPath(); c.moveTo(x + 6, y - bh + k * 8); c.lineTo(x + bw - 6, y - bh + k * 8); c.stroke(); }
      c.restore();
    }
    c.strokeStyle = P.line; c.lineWidth = 2; c.strokeRect(WALL_X, WALL_TOP, WALL_W, FLOOR_Y - WALL_TOP);
    }
    // cracks from the impact point
    if (crack > 0 && !broken) {
      c.strokeStyle = P.ink; c.lineWidth = 1.6;
      for (let i = 0; i < 9; i++) {
        let x = imp.x + 10, y = imp.y, a = -Math.PI * 0.45 + (i / 8) * Math.PI * 0.9;
        c.beginPath(); c.moveTo(x, y);
        const n = 6;
        for (let j = 0; j < n; j++) {
          a += (hash(i, j + 10) - 0.5) * 0.9;
          const len = (16 + 26 * hash(i, j)) * crack;
          x += Math.cos(a) * len; y += Math.sin(a) * len;
          c.lineTo(x, y);
        }
        c.stroke();
      }
    }
    c.restore();
    // the predicted parabola, dashed, drawn from launch
    const pred = prog(t, this.tFly - 0.35, this.tFly + 0.1, ease.outCubic);
    if (pred > 0) {
      c.save(); c.setLineDash([6, 9]); c.strokeStyle = P.dim; c.lineWidth = 1.2;
      c.beginPath();
      const T = (this.tWall - this.tFly) * pred;
      for (let i = 0; i <= 60; i++) { const p = this.sparkA(this.tFly + (T * i) / 60); if (i === 0) c.moveTo(p.x, p.y); else c.lineTo(p.x, p.y); }
      c.stroke(); c.restore();
      mono(c, `v₀ = ${(Math.hypot(this.vx, this.vy) / 250).toFixed(1)} m/s  ·  θ = ${(Math.atan2(this.vy, this.vx) * 180 / Math.PI).toFixed(0)}°`, PLAT_X - 10, PLAT_Y - 60, { size: 13, color: P.dim, track: 2, align: 'right' });
    }
    // stroboscopic ghosts + velocity vectors every 0.1 s of flight
    for (let tb = this.tFly; tb < Math.min(t, this.tWall); tb += 0.1) {
      const p = this.sparkA(tb), i = Math.round((tb - this.tFly) / 0.1);
      c.fillStyle = P.line; c.globalAlpha = 0.85;
      c.beginPath(); c.arc(p.x, p.y, 4.5, 0, TAU); c.fill();
      c.globalAlpha = 1;
      if (i % 4 === 0) {
        const u = tb - this.tFly, vx = this.vx, vy = -this.vy + this.g * u, k = 0.16;
        const ex = p.x + vx * k, ey = p.y + vy * k;
        c.strokeStyle = P.hot; c.fillStyle = P.hot; c.lineWidth = 1.6;
        c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(ex, ey); c.stroke();
        const a = Math.atan2(ey - p.y, ex - p.x);
        c.beginPath(); c.moveTo(ex, ey); c.lineTo(ex - Math.cos(a - 0.4) * 10, ey - Math.sin(a - 0.4) * 10); c.lineTo(ex - Math.cos(a + 0.4) * 10, ey - Math.sin(a + 0.4) * 10); c.closePath(); c.fill();
      }
    }
    // the words ride the trajectory: each word where the spark was when it was sung
    const fam = F.archivo(112.5, 900), size = 58;
    // word anchors: where the spark was when each word was sung, pushed apart so no two words touch
    const anchors: P2[] = [];
    c.font = font(fam, size); c.letterSpacing = '-1px';
    const n7 = this.la.words.length;
    this.la.words.forEach((w, i) => {
      let p = this.sparkA(w.start);
      if (i === 0) p = { x: 150, y: PLAT_Y - 9 };
      if (i === 1) p = { x: 390, y: PLAT_Y - 9 };
      if (i > 0 && i < n7 - 1) {
        const q = anchors[i - 1]!;
        const need = (c.measureText(this.la.words[i - 1]!.w.toUpperCase()).width + c.measureText(w.w.toUpperCase()).width) / 2 + 26;
        if (p.x - q.x < need) p = { x: q.x + need, y: i >= 2 && Math.abs(p.y - q.y) < 60 ? p.y : p.y };
      }
      anchors.push(p);
    });
    for (let i = 0; i < this.la.words.length; i++) {
      const w = this.la.words[i]!;
      const lead = 0.4;
      if (t < w.start - lead) continue;
      const p = anchors[i]!;
      const k = clamp((t - w.start + 0.02) / 0.12);
      const col = t < w.start ? P.unsung : wordColor(w, t, P.sung, P.hot);
      c.save();
      c.font = font(fam, size); c.letterSpacing = '-1px'; c.textAlign = 'center'; c.textBaseline = 'alphabetic';
      c.fillStyle = col;
      const yy = p.y - 34 - (i === this.la.words.length - 1 ? 0 : 0);
      const xx = i === this.la.words.length - 1 ? p.x - 120 : p.x;
      const sc = t < w.start ? 1 : 1 + 0.18 * (1 - ease.outBack(k, 2));
      c.translate(xx, yy); c.scale(sc, sc);
      c.fillText(w.w.toUpperCase(), 0, 0);
      c.restore();
    }
    c.restore();
    // readouts and the stamp
    mono(c, 'FIG. — A BODY, LAUNCHED', 104, 96, { size: 13, color: P.dim, track: 4 });
    const tf = clamp(t - this.tFly, 0, this.tWall - this.tFly);
    mono(c, `t  ${tf.toFixed(2)} s`, 104, 124, { size: 13, color: P.dim, track: 3 });
    stamp(c, 1290, 220, this.v === 3 ? ['DAMAGE:', 'ONE (1) WALL'] : ['DAMAGE:', 'ONE (1) BRUISE'], t, this.tWall + 0.18, { size: 24, rot: -0.1 });
    // the spark
    if (t >= this.tRun - 0.2) {
      const p = this.sparkA(t);
      const map = (q: P2) => ({ x: (q.x - cx) * z + W / 2, y: (q.y - cy) * z + H / 2 });
      const sp = map(p);
      sparkParticles(lb, t, (tb) => (tb < this.tRun - 0.2 ? null : map(this.sparkA(tb))), { rate: 80, intensity: this.v === 2 ? 0.8 : 1 });
      // the burst on impact
      sparkParticles(lb, t, (tb) => (tb >= this.tWall && tb < this.tWall + 0.12 ? map(imp) : null), { rate: 900, speed: 520, life: 0.6, seed: 9 });
      sparkHead(lb, sp.x, sp.y, t, 1 + pulse(t, this.tWall, 0.15), 1 + pulse(t, this.tWall, 0.15) * 2);
      if (this.v === 3) {
        // everyone else jumps too: a fan of trajectories launched just after, all reaching the wall together
        const T = this.tWall - this.tFly;
        for (let i = 0; i < 48; i++) {
          const d = 0.05 + hash(i, 21) * 0.4, fv = 0.75 + 0.5 * hash(i, 22);
          const t0 = this.tFly + d, Ti = T - d;
          const vx = (WALL_X - PLAT_X) / Ti, vy = this.vy * fv * (Ti / T), g = this.g * (T / Ti) ** 2 * fv;
          const at = (tb: number) => { const u = tb - t0; return map({ x: PLAT_X + vx * u, y: PLAT_Y - 9 - vy * u + 0.5 * g * u * u }); };
          if (t < t0) continue;
          const tEnd = Math.min(t, this.tWall);
          let prev = at(Math.max(t0, tEnd - 0.5));
          for (let k = 1; k <= 10; k++) {
            const tb = Math.max(t0, tEnd - 0.5) + (k / 10) * (tEnd - Math.max(t0, tEnd - 0.5));
            const q = at(tb);
            const a = k / 10;
            lb.seg2(prev.x, prev.y, q.x, q.y, 1.4, [LIN.signal[0] * 1.6 * a, LIN.signal[1] * 1.6 * a, LIN.signal[2] * 1.6 * a], a);
            prev = q;
          }
          if (t < this.tWall) sparkHead(lb, prev.x, prev.y, t, 0.45, 0.8);
        }
      }
      if (this.v === 2) { c.fillStyle = rgba('signal', 1); c.beginPath(); c.arc(sp.x, sp.y, 9, 0, TAU); c.fill(); }
    }
    return pulse(t, this.tWall, 0.08) * 1.4 + pulse(t, this.tFly, 0.08) * 0.5;
  }

  // ------------------------------------------------------------------ B. statics
  shotB(c: CanvasRenderingContext2D, lb: LineBatch, t: number, P: ReturnType<Fly['pal']>, f: Frame) {
    const l = this.lbL, w = l.words;
    const k0 = prog(t, this.tB, this.tB + 0.5, ease.outCubic);
    const GY = 910, CX = 1180, CW = 170, CH = 640 + 60 * k0;
    // ground
    c.strokeStyle = P.line; c.lineWidth = 2;
    c.beginPath(); c.moveTo(760, GY); c.lineTo(1800, GY); c.stroke();
    c.save(); c.beginPath(); c.rect(760, GY, 1040, 80); c.clip();
    c.strokeStyle = P.hatch; c.lineWidth = 1;
    for (let x = 800; x < 1900; x += 13) { c.beginPath(); c.moveTo(x, GY); c.lineTo(x - 80, GY + 80); c.stroke(); }
    c.restore();
    // the column, engraved: vertical hatching darker toward the right
    const top = GY - CH * k0;
    const nW = w.length, tallW = w[nW - 1]!;
    // v3: on "tall" the column leaves the ground: it hops and topples over
    const topple = this.v === 3 ? prog(t, tallW.start + 0.25, tallW.start + 0.85, ease.inQuad) : 0;
    const hop = this.v === 3 ? Math.max(0, Math.sin(Math.PI * clamp((t - tallW.start) / 0.35))) * 60 : 0;
    c.save();
    c.translate(CX + CW / 2, GY - hop); c.rotate(topple * Math.PI / 2); c.translate(-(CX + CW / 2), -GY);
    c.fillStyle = this.v === 2 ? rgba('bone', 1) : rgba('ink2', 1);
    c.fillRect(CX - CW / 2, top, CW, GY - top);
    c.strokeStyle = P.hatch; c.lineWidth = 1;
    for (let i = 0; i < 22; i++) {
      const x = CX - CW / 2 + 6 + i * 6.6;
      const dens = i / 22;
      if (hash(i, 3) > 0.25 + dens * 0.75) continue;
      c.beginPath(); c.moveTo(x, top + 4); c.lineTo(x, GY - 4); c.stroke();
    }
    c.strokeStyle = P.line; c.lineWidth = 2; c.strokeRect(CX - CW / 2, top, CW, GY - top);
    c.restore();
    if (this.v === 3) stamp(c, 1560, 760, ['ΣF ≠ 0'], t, tallW.start + 0.3, { size: 34, rot: -0.12 });
    // forces: W down from the centre of mass, N up from the base
    const fk = prog(t, w[1]!.start, w[1]!.start + 0.4, ease.outBack) * (1 - topple);
    if (fk > 0.01) {
      const cmY = (top + GY) / 2;
      const arrow = (x: number, y0: number, y1: number, label: string, col: string) => {
        c.strokeStyle = col; c.fillStyle = col; c.lineWidth = 2.4;
        c.beginPath(); c.moveTo(x, y0); c.lineTo(x, y1); c.stroke();
        const d = Math.sign(y1 - y0);
        c.beginPath(); c.moveTo(x, y1); c.lineTo(x - 9, y1 - d * 18); c.lineTo(x + 9, y1 - d * 18); c.closePath(); c.fill();
        mono(c, label, x + 18, (y0 + y1) / 2, { size: 18, color: col, track: 2, weight: 500 });
      };
      c.fillStyle = P.hot; c.beginPath(); c.arc(CX, cmY, 6, 0, TAU); c.fill();
      arrow(CX, cmY, cmY + 200 * fk, 'W = mg', P.hot);
      arrow(CX + CW / 2 + 70, GY + 40, GY + 40 - 200 * fk, 'N', P.ink);
    }
    // the deadpan equations, one per beat after "forever"
    const eqs = ['ΣF = 0', 'Δx = 0', 'v = 0', 'a = 0', 'events = 0'];
    const eqA = 1 - topple;
    eqs.forEach((e, i) => {
      const te = w[2]!.start + i * (this.v === 3 ? 0.3 : 0.42);
      const k = prog(t, te, te + 0.15, ease.outCubic);
      if (k <= 0) return;
      c.save(); c.globalAlpha = k * eqA;
      mono(c, e, 1500, 330 + i * 58, { size: 30, color: i === 4 ? P.hot : P.ink, track: 2, weight: 500 });
      c.restore();
    });
    // the clock: runs to forever
    const run = prog(t, w[2]!.start, this.tC, (x) => x * x * x);
    let yrs = run < 0.999 ? Math.round(Math.pow(10, run * 9) - 1) : Infinity;
    if (this.v === 3 && t > tallW.start) yrs = 0;
    mono(c, 'TIME STANDING', 104, 820, { size: 14, color: P.dim, track: 4 });
    mono(c, Number.isFinite(yrs) ? `${yrs.toLocaleString('en-US')} yr` : '∞ yr', 104, 880, { size: 48, color: P.ink, track: 2, weight: 500 });
    // the lyric: "Than spend forever" big left; "forever" stretches while held; "standing tall" up the column
    const fam = F.archivo(100, 800), size = 110;
    const st = { family: fam, size, tracking: -1, sung: P.sung, unsung: P.unsung, active: P.hot, lead: 0.45 } as const;
    const sub: Line = { ...l, words: w.slice(0, 2), text: `${w[0]!.w} ${w[1]!.w}`, end: w[1]!.end };
    drawKaraoke(c, sub, 104, 330, t, st);
    // forever: width 100 → 125 and tracking out while held
    const mid = w.slice(2, nW - 2);
    const fw = { ...mid[0]!, w: mid.map((x) => x.w).join(' '), end: mid[mid.length - 1]!.end };
    if (t > l.start - 0.45) {
      const hold = prog(t, fw.start, fw.end, ease.inOutQuad);
      const famF = F.archivo(lerp(100, 125, hold), lerp(800, 300, hold));
      c.save();
      c.font = font(famF, size); c.letterSpacing = `${lerp(-1, 26, hold)}px`;
      c.fillStyle = t < fw.start ? P.unsung : wordColor(fw, t, P.sung, P.hot);
      c.fillText(fw.w, 104, 460);
      c.restore();
    }
    // "standing" along the column's left side, "tall" stretched up its height
    for (const [wi, txt] of [[nW - 2, 'STANDING'], [nW - 1, 'TALL']] as const) {
      const ww = w[wi]!;
      if (t < l.start - 0.45) continue;
      c.save();
      c.fillStyle = t < ww.start ? P.unsung : wordColor(ww, t, P.sung, P.hot);
      if (wi === nW - 2) {
        c.translate(CX - CW / 2 - 24, GY - 6); c.rotate(-Math.PI / 2);
        c.font = font(F.archivo(62, 800), 64); c.letterSpacing = '2px';
        c.fillText(txt, 0, 0);
      } else {
        const tk = prog(t, ww.start, ww.start + 0.3, ease.outBack);
        c.translate(CX + CW / 2 + 22, GY);
        c.font = font(F.archivo(62, 900), 120);
        c.scale(1, 1 + 2.6 * (t < ww.start ? 0 : tk));
        c.fillText(txt, 0, 0);
      }
      c.restore();
    }
    mono(c, 'FIG. — A BODY AT REST (STATICS)', 104, 96, { size: 13, color: P.dim, track: 4 });
    void lb; void f;
    let hit = 0;
    for (const x of w) hit = Math.max(hit, pulse(t, x.start, 0.06) * 0.4);
    return hit;
  }

  // ------------------------------------------------------------------ C. seismograph
  shotC(c: CanvasRenderingContext2D, lb: LineBatch, t: number, P: ReturnType<Fly['pal']>) {
    const l = this.lc, w = l.words;
    const speed = 260; // paper px/s
    const PX = 1500, PY = 560; // pen tip
    const k0 = prog(t, this.tC, this.tC + 0.35, ease.outCubic);
    // the tag (v=2): on "Free fall" the trace falls off the bottom of the paper
    const tag = this.tag;
    const v3 = this.v === 3;
    const tFall = tag && !v3 ? tag.words[1]!.start : 1e9;
    // v3: on the held "all" the ground finally moves — the flat trace turns up into the payoff curve
    const tUp = v3 ? w[w.length - 1]!.start + 0.15 : 1e9;
    const traceY = (tb: number) => {
      let y = PY;
      // a hairline of instrument noise (sub-pixel)
      y += (hash(Math.floor(tb * 60), 5) - 0.5) * 0.6;
      if (tb > tFall) y += 0.5 * 4200 * (tb - tFall) ** 2;
      if (tb > tUp) y -= 210 * (tb - tUp) ** 1.8;
      return y;
    };
    // v3: the camera pulls back as the trace climbs, so the hockey stick stays in frame
    const rise = Math.max(0, PY - traceY(t));
    const zc = 1 / (1 + rise / 900);
    c.save();
    c.translate(PX, 820); c.scale(1, zc); c.translate(-PX, -820);
    // paper band
    c.fillStyle = this.v === 2 ? rgba('bone', 1) : rgba('#1C1C1F', 1);
    const PT = 300 - rise * 1.2, PL = 0;
    c.fillRect(PL, PT, W - PL, 820 - PT);
    c.strokeStyle = this.v === 2 ? rgba('ink', 0.12) : rgba('graphite', 0.45); c.lineWidth = 1;
    const off = (t * speed) % 80;
    for (let x = -off; x > PL; x -= 80) { c.beginPath(); c.moveTo(x, PT); c.lineTo(x, 820); c.stroke(); }
    for (let x = -off; x < W; x += 80) { c.beginPath(); c.moveTo(x, PT); c.lineTo(x, 820); c.stroke(); }
    for (let y = 780; y > PT; y -= 40) { c.beginPath(); c.moveTo(PL, y); c.lineTo(W, y); c.stroke(); }
    c.strokeStyle = P.line; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(PL, PT); c.lineTo(W, PT); c.moveTo(PL, 820); c.lineTo(W, 820); c.stroke();
    // the trace: x = PX - (t - tb) * speed
    c.strokeStyle = P.hot; c.lineWidth = 3.2;
    c.beginPath();
    let first = true;
    for (let x = Math.floor(PL / 6) * 6; x <= PX; x += 6) {
      const tb = t - (PX - x) / speed;
      if (tb < this.tC - 0.3) continue;
      const y = Math.max(-1e5, Math.min(1200, traceY(tb)));
      if (first) { c.moveTo(x, y); first = false; } else c.lineTo(x, y);
    }
    c.save(); c.resetTransform(); c.stroke(); c.restore(); // uniform width under the vertical squash
    // pen arm
    const py = Math.max(-1e5, Math.min(1200, traceY(t)));
    if (v3 && t > tUp) {
      // annotate the kink as it scrolls away: this is the payoff curve
      const kx = PX - (t - tUp) * speed;
      c.save(); c.setLineDash([5, 6]); c.strokeStyle = P.dim; c.lineWidth = 1;
      c.beginPath(); c.moveTo(kx, PY + 10); c.lineTo(kx, 820); c.stroke(); c.restore();
      mono(c, 'KINK', kx + 8, 800, { size: 12, color: P.dim, track: 4 });
      mono(c, 'DOWNSIDE: A STUMBLE', kx - 20, PY + 40, { size: 13, color: P.dim, track: 2, align: 'right' });
      if (t > tUp + 0.9) mono(c, 'UPSIDE: ∞', Math.min(PX - 40, kx + 420), 360, { size: 22, color: P.hot, track: 4, weight: 500 });
    }
    c.strokeStyle = P.line; c.lineWidth = 2;
    c.beginPath(); c.moveTo(PX, py); c.lineTo(PX + 260, py - 230); c.stroke();
    c.fillStyle = P.line; c.beginPath(); c.arc(PX + 260, py - 230, 8, 0, TAU); c.fill();
    // the pen logs each sung word on the paper (time-stamped, mono) and the paper carries it away
    for (const wd of w) {
      if (t < wd.start) continue;
      const x = PX - (t - wd.start) * speed;
      c.strokeStyle = P.dim; c.lineWidth = 1;
      c.beginPath(); c.moveTo(x, PY + 14); c.lineTo(x, PY + 40); c.stroke();
      mono(c, `${wd.start.toFixed(2)} s`, x + 6, PY + 58, { size: 11, color: P.dim, track: 1 });
      mono(c, wd.w.toLowerCase(), x + 6, PY + 78, { size: 13, color: wordColor(wd, t, P.dim, P.hot), track: 2 });
    }
    c.restore();
    if (v3 && t > tUp - 0.5) {
      // the spark rides the pen up the curve
      const sx2 = PX + (PX - PX) * zc, sy2 = 820 + (traceY(t) - 820) * zc;
      sparkHead(lb, sx2, sy2, t, 1 + prog(t, tUp, tUp + 2), 1 + prog(t, tUp, tUp + 2));
      sparkParticles(lb, t, (tb) => (tb < tUp - 0.5 ? null : { x: PX, y: 820 + (traceY(tb) - 820) * (1 / (1 + Math.max(0, PY - traceY(tb)) / 900)) }), { rate: 120 });
    }
    // readouts
    mono(c, 'FIG. — THE GROUND (SEISMOGRAM)', 104, 96, { size: 13, color: P.dim, track: 4 });
    const moved = t > tFall || t > tUp;
    const disp = t > tFall ? ((t - tFall) ** 2) * 2100 / 250 * 1000 : t > tUp ? 210 * (t - tUp) ** 1.8 / 250 * 1000 : 0;
    const ra = v3 && tag ? 1 - prog(t, tag.start - 0.3, tag.start) : 1;
    c.save(); c.globalAlpha = ra;
    readoutBig(c, 104, 950, 'GROUND DISPLACEMENT', moved ? `${disp.toLocaleString('en-US', { maximumFractionDigits: 0 })} mm` : '0.000 mm', P, moved);
    readoutBig(c, 760, 950, 'EVENTS RECORDED', moved ? '1' : 'NONE', P, moved);
    c.restore();
    // THE ODDS cameo
    const ov = odds(this.ctx.lyrics).value(t);
    drawOdds(c, 1400, 950, ov, { scale: 0.9, ink: P.ink, dim: P.dim, flash: odds(this.ctx.lyrics).flash(t) });
    // the tag lyric "Free fall", big, falling with the trace
    if (v3 && tag && t > tag.start - 0.4) {
      // the last chorus line: FREE FALL / FREE FALL slammed on two rows, the second at the foot of the frame
      const fam2 = F.archivo(125, 900), s2 = 150;
      c.save(); c.font = font(fam2, s2); c.letterSpacing = '-3px'; c.textBaseline = 'alphabetic';
      const tw = tag.words;
      const row = (i0: number, y: number) => {
        let x = 104;
        for (const [i, txt] of [[i0, 'FREE'], [i0 + 1, 'FALL']] as const) {
          const wd = tw[i]!;
          const k = clamp((t - wd.start) / 0.1);
          c.save();
          c.fillStyle = t < wd.start ? P.unsung : wordColor(wd, t, P.sung, P.hot);
          c.translate(x, y); const sc = t < wd.start ? 1 : 1 + 0.25 * (1 - ease.outBack(k, 2)); c.scale(sc, sc);
          c.fillText(txt, 0, 0); c.restore();
          x += c.measureText(txt + ' ').width;
        }
      };
      row(0, 250);
      if (t > tw[2]!.start - 0.4) row(2, 1010);
      c.restore();
    } else if (tag && t > tag.start - 0.4) {
      const fam2 = F.archivo(125, 900), s2 = 150;
      c.save(); c.font = font(fam2, s2); c.letterSpacing = '-3px'; c.textBaseline = 'alphabetic';
      const wf = tag.words[0]!, wl = tag.words[1]!;
      c.fillStyle = t < wf.start ? P.unsung : wordColor(wf, t, P.sung, P.hot);
      c.fillText('FREE', 104, 260);
      c.fillStyle = t < wl.start ? P.unsung : wordColor(wl, t, P.sung, P.hot);
      const dy = t > wl.start ? 0.5 * 3000 * (t - wl.start) ** 2 : 0;
      c.fillText('FALL', 104 + c.measureText('FREE ').width, 260 + dy);
      c.restore();
    } else {
      drawKaraoke(c, l, 104, 240, t, { family: F.archivo(100, 900), size: 84, tracking: -2, sung: P.sung, unsung: P.unsung, active: P.hot, lead: 0.5 });
    }
    void lb; void k0; void fmtOdds; void mixCss; void Lyrics;
    let h = tag ? pulse(t, tFall, 0.1) : 0;
    if (v3 && tag) for (const wd of tag.words) h = Math.max(h, pulse(t, wd.start, 0.08));
    if (v3) h = Math.max(h, pulse(t, tUp, 0.12) * 1.2);
    return h;
  }
}

function readoutBig(c: CanvasRenderingContext2D, x: number, y: number, label: string, value: string, P: { dim: string; ink: string; hot: string }, hot = false) {
  mono(c, label, x, y - 44, { size: 14, color: P.dim, track: 4 });
  mono(c, value, x, y, { size: 40, color: hot ? P.hot : P.ink, track: 2, weight: 500 });
}
