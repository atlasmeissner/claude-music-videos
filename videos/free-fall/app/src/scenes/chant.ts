// chant — the post-chorus: no words, a crowd chant ("yeah, yeah — oh, oh, oh…") over the full band.
// A festival field in plan, top-down, like a venue's site plan: a stage at the top, the spark on it, and the crowd as
// a field of hundreds of dots. Everyone bounces on the beat; every chanted syllable sends a wave from the stage
// through the crowd (a dot jumps as the wave front passes it: it grows toward the camera and its shadow slips), and
// the syllable is stamped big (YEAH, then OH). JUMPED counts the people who have jumped. In the last bars the dots
// stop coming down: they lift off the plan and become sparks, until the field is empty for the bridge.
import type * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { Layer2D, clearRT, W, H } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { LIN, rgba } from '../engine/palette';
import { F, font } from '../engine/type';
import { clamp, ease, frameIdx, hash, lerp, prog, pulse, TAU } from '../engine/util';
import { mono, sparkHead, sparkParticles } from './_ff';

const COLS = 44, ROWS = 15;
const FX0 = 150, FX1 = 1770, FY0 = 330, FY1 = 960; // the crowd field
const SX = 960, SY = 200; // the spark on stage
const WAVE = 1500; // px/s

export default class Chant extends Scene {
  L = new Layer2D();
  lb = new LineBatch(8000);
  sy: number[] = []; // syllable times
  dots: { x: number; y: number; d: number; lift: number; seed: number }[] = [];

  override init() {
    const au = this.ctx.audio;
    const ev = au.events('vocal', this.ctx.start + 0.5, this.ctx.end - 0.25).filter(([, s]) => s >= 0.3).map(([t]) => t);
    for (const t of ev) if (!this.sy.length || t - this.sy[this.sy.length - 1]! > 0.38) this.sy.push(t);
    for (let r = 0; r < ROWS; r++) for (let q = 0; q < COLS; q++) {
      const x = lerp(FX0, FX1, (q + 0.5 + (r % 2) * 0.5) / (COLS + 0.5)) + (hash(q, r) - 0.5) * 14;
      const y = lerp(FY0, FY1, (r + 0.5) / ROWS) + (hash(q, r + 99) - 0.5) * 12;
      const d = Math.hypot(x - SX, y - SY);
      // lift-off order: the last bars, front rows first, with scatter
      const lift = lerp(this.ctx.end - 4.2, this.ctx.end - 0.4, clamp((d - 150) / 1100) * 0.7 + hash(q, r + 7) * 0.3);
      this.dots.push({ x, y, d, lift, seed: r * 100 + q });
    }
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const { renderer, comp, audio } = this.ctx;
    const t = f.t, s0 = this.ctx.start, end = this.ctx.end;
    clearRT(renderer, out, LIN.ink);
    const L = this.L, c = L.ctx; L.clear();
    const lb = this.lb; lb.clear();
    const intro = prog(t, s0, s0 + 0.6, ease.outCubic);
    // site plan: stage, barrier, sections, hairlines
    c.strokeStyle = rgba('bone', 0.85); c.lineWidth = 2;
    c.strokeRect(SX - 360 * intro, 120, 720 * intro, 150);
    c.strokeStyle = rgba('graphite', 1); c.lineWidth = 1;
    for (let x = SX - 350; x < SX + 350 * intro; x += 11) { c.beginPath(); c.moveTo(x, 122); c.lineTo(x + 30, 150); c.stroke(); }
    mono(c, 'STAGE', SX + 280, 255, { size: 13, color: rgba('ash', 0.85), track: 5, align: 'right' });
    c.strokeStyle = rgba('bone', 0.6); c.setLineDash([12, 8]);
    c.beginPath(); c.moveTo(FX0 - 20, FY0 - 34); c.lineTo(FX1 + 20, FY0 - 34); c.stroke(); c.setLineDash([]);
    mono(c, 'BARRIER', FX0 - 20, FY0 - 46, { size: 11, color: rgba('ash', 0.7), track: 4 });
    for (let k = 1; k < 4; k++) { const x = lerp(FX0, FX1, k / 4); c.strokeStyle = rgba('graphite', 0.6); c.beginPath(); c.moveTo(x, FY0 - 20); c.lineTo(x, FY1 + 20); c.stroke(); }
    ['A', 'B', 'C', 'D'].forEach((n, k) => mono(c, `SECTION ${n}`, lerp(FX0, FX1, k / 4) + 12, FY1 + 44, { size: 11, color: rgba('ash', 0.7), track: 4 }));
    // waves (rings from the stage) for each syllable
    for (const ts of this.sy) {
      const r = (t - ts) * WAVE;
      if (r <= 0 || r > 2200) continue;
      c.strokeStyle = rgba('signal', 0.35 * (1 - r / 2200)); c.lineWidth = 2;
      c.beginPath(); c.arc(SX, SY, r, 0, Math.PI); c.stroke();
    }
    // the crowd
    const bp = f.beatPhase;
    const beatBounce = Math.exp(-bp * 5) * 0.25;
    let jumped = 0;
    const airborne: { x: number; y: number }[] = [];
    for (const d of this.dots) {
      if (intro < 1 && d.d > 1300 * intro + 200) continue;
      // jump: the last wave that passed this dot
      let h = beatBounce * (0.6 + 0.4 * hash(d.seed, 3));
      let any = false;
      for (const ts of this.sy) {
        const tp = ts + d.d / WAVE;
        if (t >= tp) any = true;
        const u = t - tp;
        if (u > 0 && u < 0.42) h = Math.max(h, 4 * (u / 0.42) * (1 - u / 0.42));
      }
      if (any) jumped++;
      // lift-off: rise and never come down
      const lk = prog(t, d.lift, d.lift + 0.9, ease.inQuad);
      if (lk >= 1) continue;
      const sc = lk > 0 ? lerp(1 + h * 0.55, 0.6, lk) : 1 + h * 0.55;
      h += lk * 6;
      const col = lk > 0 ? rgba('signal', 1) : any && h > 0.4 ? rgba('bone', 1) : rgba('ash', 0.8);
      // shadow stays, the body slips up-left with height
      c.fillStyle = rgba('graphite', 0.55);
      c.beginPath(); c.arc(d.x + 3, d.y + 3, 5, 0, TAU); c.fill();
      c.fillStyle = col;
      c.beginPath(); c.arc(d.x - h * 4, d.y - h * 9 - lk * 160, 5 * sc, 0, TAU); c.fill();
      if (lk > 0) airborne.push({ x: d.x - h * 4, y: d.y - h * 9 - lk * 160 });
    }
    // the syllables, stamped: YEAH ×2 first, then OH
    const fam = F.archivo(125, 900);
    this.sy.forEach((ts, i) => {
      const age = t - ts;
      if (age < 0 || age > 0.75) return;
      const word = ts < 107.1 ? 'YEAH' : 'OH';
      const k = clamp(age / 0.1);
      const fade = 1 - prog(age, 0.35, 0.75);
      const sz = 260 + 60 * hash(i, 4);
      const x = 160 + hash(i, 5) * 1100, y = 360 + hash(i, 6) * 520;
      c.save();
      c.globalAlpha = clamp(k * 3) * fade;
      c.font = font(fam, sz); c.letterSpacing = `${-sz * 0.03}px`; c.textBaseline = 'alphabetic';
      c.fillStyle = i % 3 === 2 ? rgba('bone', 1) : rgba('signal', 1);
      c.translate(x, y + sz * 0.35); const s = 1 + 0.3 * (1 - ease.outBack(k, 2)); c.scale(s, s);
      c.fillText(word, 0, 0);
      c.restore();
    });
    // readouts
    const per = 120; // people per dot
    mono(c, 'FIG. — A CROWD, IN PLAN', 104, 96, { size: 13, color: rgba('ash', 0.75), track: 4 });
    mono(c, `CROWD  ${(this.dots.length * per).toLocaleString('en-US')}`, W - 104, 96, { size: 14, color: rgba('ash', 0.85), track: 3, align: 'right' });
    mono(c, `JUMPED  ${(jumped * per).toLocaleString('en-US')}`, W - 104, 124, { size: 18, color: rgba('signal', 1), track: 3, align: 'right', weight: 500 });
    const gone = this.dots.filter((d) => t > d.lift + 0.9).length;
    if (gone > 0) mono(c, `LEFT THE GROUND  ${(gone * per).toLocaleString('en-US')}`, W - 104, 152, { size: 14, color: rgba('bone', 0.9), track: 3, align: 'right' });
    comp.draw(renderer, L.upload(), out);
    // sparks: the singer on stage, and every dot that lifts off
    sparkParticles(lb, t, () => ({ x: SX, y: SY }), { rate: 70 + 120 * audio.env('vocal', t) });
    sparkHead(lb, SX, SY, t, 1 + audio.env('vocal', t) * 0.6, 1 + audio.env('vocal', t));
    for (const a of airborne.slice(0, 220)) sparkHead(lb, a.x, a.y, t, 0.35, 0.7);
    lb.render(renderer, out);
    let hit = 0;
    for (const ts of this.sy) hit = Math.max(hit, pulse(t, ts, 0.07));
    const sh = hit * 6;
    void H;
    return { bloom: 0.7, vignette: 0.4, shake: [(hash(frameIdx(t), 1) - 0.5) * sh, (hash(frameIdx(t), 2) - 0.5) * sh] as [number, number], zoom: 1 + hit * 0.01 + prog(t, end - 4, end) * 0.05 };
  }
}
