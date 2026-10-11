// outro — after the last "Free fall, free fall" (hook 4, THE ODDS rounded up to ∞), the band plays on to the end.
// The spark falls one last time from the top of the frame and lands — a bounce and a stumble: OUTCOME −1, A
// STUMBLE. Then the end card, one line per downbeat, typeset like a numbered equation in a paper:
//   E[leap] = p · (−1) + (1 − p) · ∞   (1)      → = ∞
//   Free fall isn't reckless. / It's rational.
// then the title (FREE FALL · JOBURGALEX · MAPS & TERRITORY). In the last seconds the crop-mark frame closes back
// in and everything else goes, leaving the video's first frame: the end loops into the start.
import type * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { Layer2D, clearRT, W, H } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { LIN, rgba } from '../engine/palette';
import { F, font } from '../engine/type';
import { clamp, ease, frameIdx, hash, lerp, prog, pulse } from '../engine/util';
import { bigWord, mono, sparkHead, sparkParticles } from './_ff';
import { stamp } from './ledger-kit';

const GY = 860, LX = 1480;
type P2 = { x: number; y: number };

export default class Outro extends Scene {
  L = new Layer2D();
  lb = new LineBatch(2000);
  D: number[] = [];
  tLand = 0;

  override init() {
    const au = this.ctx.audio;
    this.D = au.downbeats.filter((d) => d >= this.ctx.start - 0.01);
    this.tLand = au.timeOfBeat(Math.round(au.beatAt(this.D[0]!)) + 2);
  }

  /** The spark: falls from above the frame, lands at tLand, bounces once, stumbles forward, rests. */
  spark(tb: number): P2 | null {
    const t0 = this.D[0]! - 0.2, tl = this.tLand;
    if (tb < t0) return null;
    if (tb < tl) { const u = (tb - t0) / (tl - t0); return { x: LX, y: lerp(-60, GY - 10, u * u) }; }
    const u = tb - tl;
    const bounce = u < 0.42 ? Math.sin(Math.PI * u / 0.42) * 70 : u < 0.62 ? Math.sin(Math.PI * (u - 0.42) / 0.2) * 14 : 0;
    const roll = 90 * ease.outCubic(clamp(u / 0.9));
    return { x: LX + roll, y: GY - 10 - bounce };
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const { renderer, comp, audio } = this.ctx;
    const t = f.t, end = this.ctx.end, D = this.D;
    clearRT(renderer, out, LIN.ink);
    const L = this.L, c = L.ctx; L.clear();
    const lb = this.lb; lb.clear();
    const gone = 1 - prog(t, end - 3.4, end - 1.3, ease.inOutCubic); // everything but the frame leaves
    const frame = prog(t, end - 3.4, end - 1.1, ease.inOutCubic);
    c.save(); c.globalAlpha = gone;
    // ---- the ground and the landing
    const gk = prog(t, D[0]! - 0.1, D[0]! + 0.5, ease.outCubic);
    c.strokeStyle = rgba('bone', 0.85); c.lineWidth = 2;
    c.beginPath(); c.moveTo(W - 104 - 700 * gk, GY); c.lineTo(W - 104, GY); c.stroke();
    c.save(); c.beginPath(); c.rect(W - 804, GY, 700, 60); c.clip();
    c.strokeStyle = rgba('graphite', 0.8); c.lineWidth = 1;
    for (let x = W - 900; x < W; x += 12) { c.beginPath(); c.moveTo(x, GY); c.lineTo(x - 60, GY + 60); c.stroke(); }
    c.restore();
    if (t > this.tLand) {
      mono(c, 'LANDING', W - 804, GY + 96, { size: 13, color: rgba('ash', 0.85), track: 5 });
      mono(c, `t = ${(this.tLand - D[0]! + 0.2).toFixed(2)} s · v = 4.4 m/s`, W - 804, GY + 122, { size: 13, color: rgba('ash', 0.85), track: 2 });
      // the skid of the stumble
      c.strokeStyle = rgba('signal', 0.7); c.lineWidth = 2;
      const sk = prog(t, this.tLand + 0.4, this.tLand + 1.1);
      c.beginPath(); c.moveTo(LX + 6, GY - 1); c.lineTo(LX + 6 + 84 * sk, GY - 1); c.stroke();
    }
    stamp(c, W - 420, GY - 190, ['OUTCOME: −1', 'A STUMBLE'], t, D[1]!, { size: 26, rot: -0.1 });
    // ---- the end card, one line per downbeat
    const X = 120;
    const ln = (i: number) => prog(t, D[i]! - 0.02, D[i]! + 0.25, ease.outCubic);
    // (1) the expected value
    const k2 = ln(2);
    if (k2 > 0) {
      c.save(); c.globalAlpha *= k2;
      c.font = font(F.serif(400, true), 96); c.fillStyle = rgba('bone', 1); c.textBaseline = 'alphabetic';
      const s = 'E[leap] = p · (−1) + (1 − p) · ∞';
      c.fillText(s, X, 300 - (1 - k2) * 20);
      c.font = font(F.serif(400, false), 40); c.fillStyle = rgba('ash', 0.9);
      c.fillText('(1)', W - 120 - c.measureText('(1)').width, 300);
      c.restore();
      mono(c, 'p = P(worst case)  ·  worst case = a stumble  ·  best case = something beautiful', X, 346, { size: 13, color: rgba('ash', 0.8 * k2), track: 2 });
    }
    const k3 = ln(3);
    if (k3 > 0) {
      c.save(); c.globalAlpha *= k3;
      c.font = font(F.serif(600, true), 120); c.fillStyle = rgba('signal', 1);
      const sc = 1 + 0.3 * (1 - ease.outBack(clamp((t - D[3]!) / 0.15), 2));
      c.translate(X + 40, 490); c.scale(sc, sc);
      c.fillText('= ∞', 0, 0);
      c.restore();
    }
    const k4 = ln(4), k5 = ln(5);
    if (k4 > 0) {
      c.save(); c.globalAlpha *= k4;
      c.font = font(F.serif(400, true), 84); c.fillStyle = rgba('bone', 1);
      c.fillText('Free fall isn’t reckless.', X, 660);
      c.restore();
    }
    if (k5 > 0) {
      c.save(); c.globalAlpha *= k5;
      c.font = font(F.serif(600, true), 84); c.fillStyle = rgba('signal', 1);
      c.fillText('It’s rational.', X, 760);
      c.restore();
    }
    // ---- the title: the end card gives way on D6
    c.restore();
    const kt = prog(t, D[6]! - 0.02, D[6]! + 0.2, ease.outCubic);
    if (kt > 0) {
      // the card above slides up and out
      L.clear();
      c.save(); c.globalAlpha = gone;
      c.strokeStyle = rgba('bone', 0.85); c.lineWidth = 2;
      c.beginPath(); c.moveTo(W - 804, GY); c.lineTo(W - 104, GY); c.stroke();
      const s1 = 1 + 0.25 * (1 - ease.outBack(clamp((t - D[6]!) / 0.14), 2));
      bigWord(c, 'FREE', X, 420, 250, { align: 'left', sx: s1, sy: s1, color: rgba('bone', 1) });
      if (t > D[6]! + 0.42) bigWord(c, 'FALL', X, 650, 250, { align: 'left', color: rgba('signal', 1), sx: 1 + 0.25 * (1 - ease.outBack(clamp((t - D[6]! - 0.42) / 0.14), 2)), sy: 1 + 0.25 * (1 - ease.outBack(clamp((t - D[6]! - 0.42) / 0.14), 2)) });
      const ka = prog(t, D[7]!, D[7]! + 0.5, ease.outCubic);
      if (ka > 0) {
        c.save(); c.globalAlpha *= ka;
        c.font = font(F.mono(500), 26); c.letterSpacing = '16px'; c.fillStyle = rgba('bone', 0.95);
        c.fillText('JOBURGALEX', X + 8, 740);
        c.restore();
      }
      const km = prog(t, D[8]!, D[8]! + 0.5, ease.outCubic);
      if (km > 0) mono(c, 'MAPS & TERRITORY', X + 8, 786, { size: 15, color: rgba('ash', 0.9 * km), track: 6 });
      const kc = prog(t, D[9]!, D[9]! + 0.5, ease.outCubic);
      if (kc > 0) {
        mono(c, 'THE ODDS · UPSIDE : DOWNSIDE  ∞ : 1', X + 8, 900, { size: 13, color: rgba('signal', kc), track: 4 });
        mono(c, 'VIDEO RENDERED IN CODE · AFTER MEXICAT/PDOOM-VIDEO', X + 8, 930, { size: 12, color: rgba('ash', 0.7 * kc), track: 4 });
      }
      c.restore();
    }
    comp.draw(renderer, L.upload(), out);
    // ---- the spark
    const sp = this.spark(t);
    if (sp && gone > 0.01) {
      const v = audio.env('vocal', t);
      sparkParticles(lb, t, (tb) => this.spark(tb), { rate: 70 + 60 * v, intensity: gone });
      sparkParticles(lb, t, (tb) => (tb >= this.tLand && tb < this.tLand + 0.1 ? { x: LX, y: GY - 10 } : null), { rate: 700, speed: 380, seed: 5, intensity: gone });
      sparkHead(lb, sp.x, sp.y, t, (1 + v * 0.4) * gone, gone * (1 + 0.5 * pulse(t, this.tLand, 0.15)));
    }
    lb.render(renderer, out);
    let hit = pulse(t, this.tLand, 0.08) * 1.2;
    for (let i = 1; i <= 9; i++) if (D[i]) hit = Math.max(hit, pulse(t, D[i]!, 0.07) * 0.7);
    const sh = hit * 7 * gone;
    void H; void hash;
    return { bloom: 0.6, vignette: 0.4, frame, shake: [(hash(frameIdx(t), 1) - 0.5) * sh, (hash(frameIdx(t), 2) - 0.5) * sh] as [number, number] };
  }
}
