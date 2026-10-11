// ground — "One step doesn't shake the ground" / "One word doesn't make a sound".
// A: a seismograph strip. The lyric is pre-printed on the paper; the drum advances so the pen reaches each word
//    exactly as it is sung (left of the pen = written). The step registers as a 2 px blip: MAGNITUDE 0.0.
// B: a sound-level meter pinned at −∞ dB; the word moves its needle by one degree and back.
import * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { Layer2D, clearRT, W, H } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { F, font, measure } from '../engine/type';
import { LIN, rgba } from '../engine/palette';
import type { Line } from '../engine/lyrics';
import { clamp, ease, lerp, prog, noise1, pulse } from '../engine/util';
import { drawKaraoke, mono, needle, pivot, rad, wordBoxes, type WordBox } from './_od';

const PENX = 1210, TRACE_Y = 640, BASE_Y = 590;
const LY = { fam: F.archivo(100, 700), size: 92, tr: -1 };

export default class Ground extends Scene {
  lb = new LineBatch(8000);
  text = new Layer2D();
  l0!: Line; l1!: Line;
  boxes: WordBox[] = [];
  /** paper offset keys: (time, offset) — the paper x of each word's start reaches the pen at its start time */
  keys: [number, number][] = [];
  tB = 0;

  override init() {
    const { lyrics, audio } = this.ctx;
    this.l0 = lyrics.lines[0]!; this.l1 = lyrics.lines[1]!;
    this.tB = audio.timeOfBeat(Math.floor(audio.beatAt(this.l1.words[0]!.start + 0.02)));
    this.boxes = wordBoxes(this.l0, LY.fam, LY.size, LY.tr);
    const k: [number, number][] = this.boxes.map((b) => [b.w.start, PENX - b.x0]);
    const last = this.boxes[this.boxes.length - 1]!;
    // end of the line: the pen reaches the end of "ground" as the word ends, then the drum coasts to a stop
    k.push([last.w.end, PENX - last.x1 - 30]);
    const v0 = 520; // px/s before the line
    k.unshift([this.ctx.start, PENX - this.boxes[0]!.x0 + v0 * (this.boxes[0]!.w.start - this.ctx.start)]);
    this.keys = k;
  }

  /** Paper offset (screen x of paper x=0) at t: piecewise linear through the keys, coasting after. */
  off(t: number) {
    const k = this.keys;
    if (t <= k[0]![0]) return k[0]![1] + (k[0]![0] - t) * 520;
    for (let i = 1; i < k.length; i++) {
      if (t <= k[i]![0]) {
        const [t0, o0] = k[i - 1]!, [t1, o1] = k[i]!;
        // smooth within each segment a little (the drum's inertia) without breaking the sync points
        const u = (t - t0) / (t1 - t0);
        return lerp(o0, o1, u * 0.85 + ease.inOutQuad(u) * 0.15);
      }
    }
    const [t0, o0] = k[k.length - 1]!, [t1, o1] = k[k.length - 2]!;
    const v = (o0 - o1) / (t0 - t1);
    const dt = t - t0, tau = 0.6;
    return o0 + v * tau * (1 - Math.exp(-dt / tau));
  }

  render(f: Frame, out: THREE.WebGLRenderTarget) {
    const t = f.t;
    if (t < this.tB) this.renderA(f, out);
    else this.renderB(f, out);
    return { bloom: 0.55, ca: 0.5, vignette: 0.4 };
  }

  // ------------------------------------------------------------------ A: seismograph
  renderA(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer, comp } = this.ctx;
    const t = f.t;
    clearRT(renderer, out, LIN.ink);
    const o = this.off(t);
    const lb = this.lb; lb.clear();
    const stepW = this.boxes[1]!;
    const uStep = stepW.x0 + 30; // paper x of the step's blip
    const u0 = PENX - this.off(this.ctx.start); // paper x the pen started at
    const uNow = PENX - o;
    // paper band + grid
    const top = 330, bot = 830;
    lb.seg2(0, top, W, top, 1, LIN.graphite, 0.9);
    lb.seg2(0, bot, W, bot, 1, LIN.graphite, 0.9);
    for (let y = top + 50; y < bot; y += 50) lb.seg2(0, y, W, y, 1, LIN.graphite, y === TRACE_Y ? 0.5 : 0.22);
    const g0 = Math.floor((-o) / 50) * 50;
    for (let u = g0; u < g0 + W + 100; u += 50) {
      const x = u + o;
      const major = Math.round(u / 50) % 5 === 0;
      lb.seg2(x, top, x, bot, 1, LIN.graphite, major ? 0.32 : 0.14);
    }
    // the trace: flat but for the instrument's hiss and one 2 px step
    const trace = (u: number) => {
      const hiss = (noise1(u * 0.21, 3) - 0.5) * 1.1 + (noise1(u * 1.7, 9) - 0.5) * 0.5;
      const du = u - uStep;
      const blip = du > 0 && du < 90 ? Math.sin(du * 0.42) * Math.exp(-du / 26) * 2.6 : 0;
      return TRACE_Y + hiss + blip;
    };
    let px = Math.max(u0, -o - 20), py = trace(px);
    for (let u = px + 3; u <= uNow; u += 3) {
      const y = trace(u);
      lb.seg2(px + o, py, u + o, y, 1.5, LIN.bone, 0.95);
      px = u; py = y;
    }
    // pen arm: pivot up and to the right, needle down to the trace
    const tipY = trace(uNow);
    const pvx = PENX + 340, pvy = 170;
    const a = Math.atan2(tipY - pvy, PENX - pvx);
    pivot(lb, pvx, pvy, 9, LIN.bone, 0.9);
    needle(lb, pvx, pvy, a, Math.hypot(PENX - pvx, tipY - pvy), t, { width: 1.6, tail: 40 });
    lb.render(renderer, out);

    // ----- type
    const L = this.text, c = L.ctx; L.clear();
    // the lyric, printed on the paper: written (left of the pen) bone, ahead of the pen dim
    c.save();
    c.font = font(LY.fam, LY.size); c.letterSpacing = `${LY.tr}px`; c.textBaseline = 'alphabetic';
    const lx = o;
    c.save(); c.beginPath(); c.rect(0, 0, PENX, H); c.clip();
    c.fillStyle = rgba('bone', 1); c.fillText(this.l0.text, lx, BASE_Y); c.restore();
    c.save(); c.beginPath(); c.rect(PENX, 0, W - PENX, H); c.clip();
    c.fillStyle = rgba('bone', 0.2); c.fillText(this.l0.text, lx, BASE_Y); c.restore();
    // the word under the pen glows warm for a moment
    for (const b of this.boxes) {
      const k = pulse(t, b.w.start, 0.25);
      if (k < 0.02 || t > b.w.end + 1) continue;
      c.save(); c.beginPath(); c.rect(lx + b.x0 - 8, BASE_Y - LY.size, Math.min(PENX - (lx + b.x0 - 8), b.x1 - b.x0 + 16), LY.size * 1.3); c.clip();
      c.globalAlpha = k; c.fillStyle = rgba('signal', 1); c.fillText(this.l0.text, lx, BASE_Y); c.restore();
    }
    c.restore();
    // paper labels
    c.save();
    c.font = font(F.mono(400), 12); c.letterSpacing = '2px'; c.fillStyle = rgba('ash', 0.6);
    for (let u = Math.floor(-o / 250) * 250; u < -o + W + 250; u += 250) {
      const x = u + o;
      c.fillText(`${(u / 100).toFixed(1)} s`, x + 6, bot - 10);
    }
    c.restore();
    // the step's annotation, on the paper
    const sx = uStep + o, ann = prog(t, stepW.w.start + 0.15, stepW.w.start + 0.5, ease.outCubic);
    if (ann > 0) {
      c.save(); c.globalAlpha = ann;
      c.strokeStyle = rgba('signal', 0.9); c.lineWidth = 1;
      c.beginPath(); c.moveTo(sx + 10, TRACE_Y + 8); c.lineTo(sx + 10, TRACE_Y + 80); c.lineTo(sx + 26, TRACE_Y + 80); c.stroke();
      mono(c, 'EVENT: ONE STEP', sx + 34, TRACE_Y + 76, { size: 13, color: rgba('bone', 0.9), track: 2 });
      mono(c, 'MAGNITUDE 0.0', sx + 34, TRACE_Y + 98, { size: 13, color: rgba('signal', 1), track: 2, weight: 500 });
      c.restore();
    }
    // instrument header
    mono(c, 'SEISMOGRAPH — STATION 01', 120, 150, { size: 13, color: rgba('ash', 0.85), track: 3 });
    mono(c, 'GROUND MOTION', 120, 176, { size: 12, color: rgba('ash', 0.6), track: 3 });
    const end = this.boxes[this.boxes.length - 1]!.w.end;
    mono(c, t > end ? 'Δ 0.000 mm — NOTHING TO REPORT' : 'Δ 0.000 mm', 120, 202, { size: 13, color: rgba(t > end ? 'signal' : 'bone', 0.9), track: 2 });
    comp.draw(renderer, L.upload(), out);
  }

  // ------------------------------------------------------------------ B: sound-level meter
  renderB(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer, comp } = this.ctx;
    const t = f.t;
    clearRT(renderer, out, LIN.ink);
    const lb = this.lb; lb.clear();
    const cx = W / 2, cy = 690, R = 500;
    const A0 = -152, A1 = -28; // scale arc (screen degrees)
    // dB -> angle (log-ish meter law)
    const marks: [string, number][] = [['−∞', 0], ['−40', 0.1], ['−30', 0.2], ['−20', 0.34], ['−10', 0.55], ['−7', 0.63], ['−5', 0.7], ['−3', 0.78], ['−1', 0.86], ['0', 0.9], ['+1', 0.94], ['+3', 1]];
    const ang = (u: number) => rad(lerp(A0, A1, u));
    const intro = prog(t, this.tB, this.tB + 0.5, ease.outCubic);
    // arcs
    const arcN = 120;
    for (let i = 0; i < arcN * intro; i++) {
      const a0 = ang(i / arcN), a1 = ang((i + 1) / arcN);
      const red = i / arcN >= 0.9;
      lb.seg2(cx + Math.cos(a0) * R, cy + Math.sin(a0) * R, cx + Math.cos(a1) * R, cy + Math.sin(a1) * R, red ? 3 : 1.3, red ? LIN.signal : LIN.bone, 0.9);
    }
    // minor ticks
    for (let i = 0; i <= 60; i++) {
      const u = i / 60;
      if (u > intro) break;
      const a = ang(u);
      const l = i % 5 === 0 ? 16 : 8;
      lb.seg2(cx + Math.cos(a) * R, cy + Math.sin(a) * R, cx + Math.cos(a) * (R + l), cy + Math.sin(a) * (R + l), 1, u >= 0.9 ? LIN.signal : LIN.bone, 0.6);
    }
    for (const [, u] of marks) {
      const a = ang(u);
      lb.seg2(cx + Math.cos(a) * (R - 22), cy + Math.sin(a) * (R - 22), cx + Math.cos(a) * (R + 26), cy + Math.sin(a) * (R + 26), 1.6, u >= 0.9 ? LIN.signal : LIN.bone, 0.95 * intro);
    }
    // face plate
    if (intro > 0) {
      const fx0 = cx - R - 120, fx1 = cx + R + 120, fy0 = cy - R - 110, fy1 = cy + 90;
      const al = 0.35 * intro;
      lb.seg2(fx0, fy0, fx1, fy0, 1, LIN.graphite, al); lb.seg2(fx0, fy1, fx1, fy1, 1, LIN.graphite, al);
      lb.seg2(fx0, fy0, fx0, fy1, 1, LIN.graphite, al); lb.seg2(fx1, fy0, fx1, fy1, 1, LIN.graphite, al);
      for (let i = 0; i < arcN * intro; i++) {
        const a0 = ang(i / arcN), a1 = ang((i + 1) / arcN);
        lb.seg2(cx + Math.cos(a0) * R * 0.72, cy + Math.sin(a0) * R * 0.72, cx + Math.cos(a1) * R * 0.72, cy + Math.sin(a1) * R * 0.72, 1, LIN.graphite, 0.8);
      }
    }
    // the needle: pinned at −∞; each word nudges it by one degree
    let nud = 0;
    for (const w of this.l1.words) {
      const k = t - w.start;
      if (k > 0 && k < 0.9) nud = Math.max(nud, Math.sin(Math.min(1, k / 0.12) * Math.PI / 2) * Math.exp(-Math.max(0, k - 0.12) / 0.18));
    }
    const na = rad(A0 - 2 + nud * 1);
    pivot(lb, cx, cy, 10, LIN.bone, 0.9);
    needle(lb, cx, cy, na, R + 10, t, { width: 1.8, tail: 50 });
    lb.render(renderer, out);

    const L = this.text, c = L.ctx; L.clear();
    // scale labels
    c.save();
    c.font = font(F.mono(400), 15); c.letterSpacing = '1px'; c.textAlign = 'center'; c.textBaseline = 'middle';
    for (const [lab, u] of marks) {
      const a = ang(u);
      c.fillStyle = u >= 0.9 ? rgba('signal', intro) : rgba('bone', 0.85 * intro);
      c.fillText(lab, cx + Math.cos(a) * (R + 52), cy + Math.sin(a) * (R + 52));
    }
    c.font = font(F.mono(500), 18); c.letterSpacing = '6px'; c.fillStyle = rgba('ash', 0.8 * intro);
    c.fillText('dB', cx, cy - R * 0.42);
    c.restore();
    // the lyric across the dial's face
    drawKaraoke(c, this.l1, cx, 905, t, { family: LY.fam, size: 84, tracking: -1, sung: rgba('bone', 1), unsung: rgba('bone', 0.18), active: rgba('signal', 1), align: 'center', lead: 0.6 });
    // readouts
    const sEnd = this.l1.words[this.l1.words.length - 1]!.start + 0.1;
    mono(c, 'SOUND LEVEL METER', 120, 150, { size: 13, color: rgba('ash', 0.85), track: 3 });
    mono(c, 'LEVEL', 120, 176, { size: 12, color: rgba('ash', 0.6), track: 3 });
    mono(c, '−∞ dB', 120, 206, { size: 22, color: rgba('signal', 1), track: 2, weight: 500 });
    if (t > sEnd) mono(c, 'NO SOUND DETECTED', 120, 234, { size: 13, color: rgba('bone', 0.85 * prog(t, sEnd, sEnd + 0.3)), track: 2 });
    // deadpan footnote under the pivot
    c.save(); c.globalAlpha = intro;
    mono(c, 'NEEDLE DEFLECTION PER WORD: 1°', cx, cy + 56, { size: 12, color: rgba('ash', 0.7), track: 3, align: 'center' });
    c.restore();
    comp.draw(renderer, L.upload(), out);
    void measure; void clamp;
  }
}
