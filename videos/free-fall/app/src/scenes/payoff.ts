// payoff — pre-chorus 1: "The worst that happens is a stumble / The best is something beautiful".
// The payoff chart (the hockey stick), larger than the frame. The spark is the pen: it draws the floor while the
// first line is set along it (the spark reaches each word as it is sung), trips on "stumble" (a notch: −1), turns
// up at the kink on "The best", and climbs the steep line with the second line set along the slope, accelerating;
// the camera follows it up and it leaves the chart (UPSIDE: ∞) on the cut to the chorus.
import type * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { Layer2D, clearRT, W, H } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { LIN, rgba } from '../engine/palette';
import { F, font, measure } from '../engine/type';
import type { Line } from '../engine/lyrics';
import { clamp, ease, frameIdx, hash, lerp, prog, pulse } from '../engine/util';
import { drawOdds, drawPayoff, FLOOR, KINK, mono, odds, payoffXY, payoffY, SLOPE, sparkHead, sparkParticles, wordColor, type PayoffStyle } from './_ff';

const CH: PayoffStyle = { x: 120, y: 0, w: 2600, h: 1150 };
const XMAX = Math.min(1, KINK + (1 - FLOOR) / SLOPE);
const FAM = F.archivo(112.5, 900), SIZE = 64;

type P2 = { x: number; y: number };

export default class Payoff extends Scene {
  L = new Layer2D();
  lb = new LineBatch(4000);
  l4!: Line; l5!: Line;
  floorXs: number[] = []; // chart-x (0..1) of each word of line 4 (its left edge)
  slopeXs: number[] = []; // chart-x of each word of line 5
  tKink = 0; tEnd = 0;
  ang = 0;

  override init() {
    const ly = this.ctx.lyrics;
    this.l4 = ly.lines[4]!; this.l5 = ly.lines[5]!;
    this.tKink = this.l5.words[0]!.start - 0.12;
    this.tEnd = this.ctx.end;
    // lay line 4 along the floor, from chart-x 0.03, with natural word spacing
    let x = 0.03;
    for (const w of this.l4.words) { this.floorXs.push(x); x += (measure(w.w, FAM, SIZE, -1) + SIZE * 0.32) / CH.w; }
    // line 5 along the slope: distance along the line → chart-x
    const sx = CH.w, sy = (CH.h / 1.3) * SLOPE; // px per unit chart-x along the slope
    const perX = Math.hypot(sx, sy);
    this.ang = Math.atan2(-sy, sx);
    let d = 0.012;
    for (const w of this.l5.words) { this.slopeXs.push(KINK + d); d += (measure(w.w, FAM, SIZE, -1) + SIZE * 0.32) / perX; }
  }

  /** chart-x of the spark at time tb: piecewise through the words (it reaches each word as it is sung). */
  sparkX(tb: number): number {
    const w4 = this.l4.words, w5 = this.l5.words;
    const s0 = this.ctx.start;
    const keys: [number, number][] = [[s0 - 0.05, 0.0]];
    w4.forEach((w, i) => keys.push([w.start, this.floorXs[i]!]));
    keys.push([this.tKink, KINK]);
    w5.forEach((w, i) => keys.push([w.start, this.slopeXs[i]!]));
    const last = keys[keys.length - 1]!;
    if (tb >= last[0]) {
      // accelerate off the chart
      const u = tb - last[0];
      return last[1] + u * 0.12 + u * u * 0.5;
    }
    for (let i = 1; i < keys.length; i++) {
      const [ta, xa] = keys[i - 1]!, [tb2, xb] = keys[i]!;
      if (tb < tb2) return lerp(xa, xb, ease.inOutQuad(clamp((tb - ta) / (tb2 - ta))));
    }
    return last[1];
  }
  /** World (chart px) point of the spark; the stumble notch dips the floor. */
  sparkP(tb: number): P2 {
    const x = this.sparkX(tb);
    const p = payoffXY(CH, x, payoffY(Math.min(x, 2)));
    const st = this.l4.words[this.l4.words.length - 1]!.start;
    p.y += 26 * Math.exp(-(((tb - st - 0.12) / 0.09) ** 2)); // the trip
    return p;
  }

  cam(t: number) {
    const p = this.sparkP(t);
    // keep the spark at ~(760, 760) on the floor, rising toward (900, 560) on the slope
    const k = prog(t, this.tKink - 0.2, this.tKink + 0.6, ease.inOutCubic);
    return { x: p.x - lerp(700, 900, k), y: p.y - lerp(760, 560, k) };
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const { renderer, comp, lyrics } = this.ctx;
    const t = f.t;
    clearRT(renderer, out, LIN.ink);
    const L = this.L, c = L.ctx; L.clear();
    const lb = this.lb; lb.clear();
    const cam = this.cam(t);
    c.save();
    c.translate(-cam.x, -cam.y);
    // the chart, drawn up to the spark
    const sx = this.sparkX(t);
    drawPayoff(c, { ...CH, draw: clamp(sx / XMAX), lineWidth: 5, overshoot: 0, labels: false, dim: rgba('graphite', 1) });
    // floor annotations
    const fy = payoffXY(CH, 0, FLOOR).y;
    const kx = payoffXY(CH, KINK, FLOOR).x;
    mono(c, 'OUTCOME ↑', CH.x + 14, payoffXY(CH, 0, 0.95).y, { size: 16, color: rgba('ash', 0.8), track: 4 });
    mono(c, 'HOW IT GOES →', CH.x + 14, payoffXY(CH, 0, 0).y - 14, { size: 16, color: rgba('ash', 0.8), track: 4 });
    const st = this.l4.words[this.l4.words.length - 1]!;
    if (t > st.start + 0.15) {
      const p = this.sparkP(st.start + 0.12);
      mono(c, '−1 · A STUMBLE (WORST CASE)', p.x, fy + 66, { size: 18, color: rgba('bone', 0.9), track: 3, weight: 500 });
      c.strokeStyle = rgba('bone', 0.6); c.lineWidth = 1; c.beginPath(); c.moveTo(p.x, fy + 14); c.lineTo(p.x, fy + 40); c.stroke();
    }
    if (t > this.tKink) mono(c, 'KINK', kx + 16, fy + 32, { size: 14, color: rgba('ash', 0.8), track: 4 });
    // line 4 along the floor
    c.font = font(FAM, SIZE); c.letterSpacing = '-1px'; c.textBaseline = 'alphabetic'; c.textAlign = 'left';
    this.l4.words.forEach((w, i) => {
      if (t < this.l4.start - 0.5) return;
      const p = payoffXY(CH, this.floorXs[i]!, FLOOR);
      const k = clamp((t - w.start + 0.03) / 0.12);
      c.fillStyle = t < w.start ? rgba('bone', 0.18) : wordColor(w, t);
      const lift = t < w.start ? 0 : (1 - ease.outBack(k, 2)) * 14;
      c.fillText(w.w, p.x, p.y - 26 - lift);
    });
    // line 5 along the slope
    c.save();
    this.l5.words.forEach((w, i) => {
      if (t < this.l5.start - 0.5) return;
      const x = this.slopeXs[i]!;
      const p = payoffXY(CH, x, payoffY(x));
      c.save();
      c.translate(p.x, p.y); c.rotate(this.ang); c.translate(0, -26);
      c.fillStyle = t < w.start ? rgba('bone', 0.18) : wordColor(w, t);
      c.fillText(w.w, 0, 0);
      c.restore();
    });
    c.restore();
    // the upside label once the line approaches the chart's top
    if (sx > 0.7) {
      const p = payoffXY(CH, 0.7, payoffY(0.7));
      mono(c, 'UPSIDE: UNBOUNDED', p.x + 70, p.y + 40, { size: 20, color: rgba('signal', 1), track: 4, weight: 500 });
    }
    c.restore();
    // fixed readouts
    mono(c, 'FIG. — THE BET (PAYOFF)', 104, 96, { size: 13, color: rgba('ash', 0.75), track: 4 });
    const xv = this.sparkX(t);
    mono(c, `outcome = ${xv < KINK ? '−1.00' : (payoffY(xv) / -FLOOR).toFixed(2)}`, 104, 124, { size: 13, color: rgba('ash', 0.75), track: 3 });
    drawOdds(c, 104, 1000, odds(lyrics).value(t), { scale: 0.85 });
    comp.draw(renderer, L.upload(), out);
    // the spark
    const map = (q: P2) => { const cc = this.cam(t); return { x: q.x - cc.x, y: q.y - cc.y }; };
    sparkParticles(lb, t, (tb) => (tb < this.ctx.start - 0.05 ? null : map(this.sparkP(tb))), { rate: 90 + 160 * prog(t, this.tKink, this.tEnd), speed: 240 });
    const sp = map(this.sparkP(t));
    const hot = prog(t, this.tKink, this.tEnd);
    sparkHead(lb, sp.x, sp.y, t, 1 + hot * 0.6, 1 + hot);
    lb.render(renderer, out);
    const hit = pulse(t, st.start + 0.12, 0.08) + pulse(t, this.tKink + 0.12, 0.1) * 0.6;
    const sh = hit * 8;
    void W; void H; void hash;
    return { bloom: 0.7, vignette: 0.4, shake: [(hash(frameIdx(t), 1) - 0.5) * sh, (hash(frameIdx(t), 2) - 0.5) * sh] as [number, number], zoom: 1 + hot * 0.04 };
  }
}
