// vacuum — the tail after chorus 1: "Free fall, free fall", half-time. An engraved vacuum tube (the classroom
// guinea-and-feather apparatus): a feather and the spark hang from a release at the top; on "fall" both drop and
// fall alike, leaving stroboscopic copies side by side, and the word FALL falls with them at the same rate. On the
// second "free" the tube is turned over like an hourglass; on the second "fall" they drop again, and the pump's
// gauge — THE ODDS — ticks to 10 : 1. In vacuo, all bodies fall alike.
import type * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { Layer2D, clearRT, W, H } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { LIN, rgba } from '../engine/palette';
import { F, font } from '../engine/type';
import type { Line } from '../engine/lyrics';
import { clamp, ease, frameIdx, hash, lerp, prog, pulse } from '../engine/util';
import { drawOdds, mono, odds, sparkHead, sparkParticles, wordColor } from './_ff';

const CX = 960, CY = 560, TW = 330, TH = 860; // tube centre and size
const TOP = -TH / 2 + 90, BOT = TH / 2 - 70; // local y of the release and the floor of the tube

export default class Vacuum extends Scene {
  L = new Layer2D();
  lb = new LineBatch(2000);
  l!: Line;
  t1 = 0; t2 = 0; tFlip = 0;

  override init() {
    this.l = this.ctx.lyrics.lines[10]!;
    const w = this.l.words;
    this.t1 = w[1]!.start; this.tFlip = w[2]!.start; this.t2 = w[3]!.start;
  }

  /** Local y (tube coords, from the tube centre) of the falling bodies at tb. */
  bodyY(tb: number) {
    const g1 = (2 * (BOT - TOP)) / (this.tFlip - this.t1 - 0.25) ** 2;
    if (tb < this.t1) return TOP;
    if (tb < this.tFlip) return Math.min(BOT, TOP + 0.5 * g1 * (tb - this.t1) ** 2);
    // turned over: they rest at the old floor (local BOT, now on top) and fall back toward local TOP
    const g2 = (2 * (BOT - TOP)) / (this.ctx.end - this.t2 + 0.15) ** 2;
    if (tb < this.t2) return BOT;
    return Math.max(TOP, BOT - 0.5 * g2 * (tb - this.t2) ** 2);
  }
  rot(t: number) { return Math.PI * prog(t, this.tFlip, this.tFlip + 0.45, ease.inOutCubic); }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const { renderer, comp, lyrics } = this.ctx;
    const t = f.t;
    clearRT(renderer, out, LIN.ink);
    const L = this.L, c = L.ctx; L.clear();
    const lb = this.lb; lb.clear();
    const rot = this.rot(t);
    const flipping = t > this.tFlip && t < this.tFlip + 0.45;
    // in the flip, the bodies ride along at the old floor (local y = BOT, which turns into the top as y → −y)
    const local = (tb: number) => this.bodyY(tb);
    const toScreen = (lx: number, ly: number, r: number) => ({ x: CX + lx * Math.cos(r) - ly * Math.sin(r), y: CY + lx * Math.sin(r) + ly * Math.cos(r) });
    // ---- the tube (engraved glass), rotated
    c.save();
    c.translate(CX, CY); c.rotate(rot);
    // glass: two walls with highlight hatching
    c.strokeStyle = rgba('bone', 0.9); c.lineWidth = 2;
    c.beginPath(); c.roundRect(-TW / 2, -TH / 2, TW, TH, 26); c.stroke();
    c.strokeStyle = rgba('bone', 0.25); c.lineWidth = 1;
    for (let i = 0; i < 9; i++) { const x = -TW / 2 + 18 + i * 5; c.beginPath(); c.moveTo(x, -TH / 2 + 40 + i * 6); c.lineTo(x, TH / 2 - 60 - i * 9); c.stroke(); }
    for (let i = 0; i < 4; i++) { const x = TW / 2 - 22 - i * 6; c.beginPath(); c.moveTo(x, -TH / 2 + 80); c.lineTo(x, TH / 2 - 120); c.stroke(); }
    // brass caps (hatched)
    for (const s of [-1, 1]) {
      const y0 = s < 0 ? -TH / 2 - 44 : TH / 2;
      c.fillStyle = rgba('ink2', 1); c.fillRect(-TW / 2 - 24, y0, TW + 48, 44);
      c.strokeStyle = rgba('bone', 0.85); c.lineWidth = 1.6; c.strokeRect(-TW / 2 - 24, y0, TW + 48, 44);
      c.strokeStyle = rgba('graphite', 0.9); c.lineWidth = 1;
      for (let x = -TW / 2 - 20; x < TW / 2 + 24; x += 9) { c.beginPath(); c.moveTo(x, y0 + 4); c.lineTo(x + 6, y0 + 40); c.stroke(); }
    }
    // the release (a small clamp on the current top)
    const rel = t < this.t1 ? 0 : prog(t, this.t1, this.t1 + 0.12);
    const rel2 = t < this.t2 ? 0 : prog(t, this.t2, this.t2 + 0.12);
    const clampAt = (yy: number, open: number, flip: number) => {
      c.save(); c.scale(1, flip);
      c.strokeStyle = rgba('bone', 0.8); c.lineWidth = 2;
      c.beginPath(); c.moveTo(-90, yy - 46); c.lineTo(90, yy - 46); c.stroke();
      for (const x of [-60, 60]) { c.beginPath(); c.moveTo(x - 14 - open * 10, yy - 46); c.lineTo(x - 14 - open * 18, yy - 18); c.moveTo(x + 14 + open * 10, yy - 46); c.lineTo(x + 14 + open * 18, yy - 18); c.stroke(); }
      c.restore();
    };
    if (t < this.tFlip) clampAt(TOP, rel, 1); else clampAt(-BOT, rel2, -1);
    c.restore();
    // ---- the bodies: the feather (left) and the spark (right) + stroboscopic copies
    const fx = -60, sx = 60;
    const strobe = (t0: number, t1: number, r: number, a = 1) => {
      if (a <= 0) return;
      c.save(); c.globalAlpha *= a;
      for (let tb = t0 + 0.3; tb < Math.min(t, t1); tb += 0.3) {
        const ly = this.bodyY(tb);
        const pf = toScreen(fx, ly, r), ps = toScreen(sx, ly, r);
        this.feather(c, pf.x, pf.y, r, 0.22);
        c.fillStyle = rgba('signal', 0.45); c.beginPath(); c.arc(ps.x, ps.y, 6, 0, Math.PI * 2); c.fill();
        c.strokeStyle = rgba('graphite', 0.8); c.lineWidth = 1; c.beginPath(); c.moveTo(pf.x + 40, pf.y); c.lineTo(ps.x - 14, ps.y); c.stroke();
      }
      c.restore();
    };
    if (t > this.t1) strobe(this.t1, this.tFlip, 0, 1 - prog(t, this.tFlip, this.tFlip + 0.2));
    if (t > this.t2) strobe(this.t2, this.ctx.end, Math.PI);
    const ly = local(t);
    const pf = toScreen(fx, ly, rot), ps = toScreen(sx, ly, rot);
    this.feather(c, pf.x, pf.y, rot, 1);
    // ---- labels
    const wv = this.l.words;
    const sung = rgba('bone', 1), un = rgba('bone', 0.18);
    c.save();
    c.font = font(F.archivo(125, 900), 170); c.letterSpacing = '-4px'; c.textBaseline = 'alphabetic';
    // left: FREE fixed, FALL falls with the bodies (first drop); right: the second pair (after the flip)
    const fallY = (t0: number) => (t > t0 ? CY + this.bodyY(Math.min(t, this.tFlip - 0.01)) - TOP : 0);
    if (t < this.tFlip + 0.2) {
      const a = 1 - prog(t, this.tFlip, this.tFlip + 0.2);
      c.globalAlpha = a;
      c.textAlign = 'right';
      c.fillStyle = t < wv[0]!.start ? un : wordColor(wv[0]!, t, sung);
      c.fillText('FREE', CX - TW / 2 - 70, 320);
      c.fillStyle = t < wv[1]!.start ? un : wordColor(wv[1]!, t, sung);
      const dy = t > this.t1 ? this.bodyY(Math.min(t, this.tFlip - 0.001)) - TOP : 0;
      c.fillText('FALL', CX - TW / 2 - 70, 500 + dy);
    }
    if (t > this.tFlip - 0.4) {
      c.globalAlpha = prog(t, this.tFlip - 0.4, this.tFlip);
      c.textAlign = 'left';
      c.fillStyle = t < wv[2]!.start ? un : wordColor(wv[2]!, t, sung);
      c.fillText('FREE', CX + TW / 2 + 70, 320);
      c.fillStyle = t < wv[3]!.start ? un : wordColor(wv[3]!, t, sung);
      const dy = t > this.t2 ? BOT - this.bodyY(t) : 0;
      c.fillText('FALL', CX + TW / 2 + 70, 500 + dy);
    }
    c.restore();
    void fallY;
    mono(c, 'FIG. — TWO BODIES IN VACUO', 104, 96, { size: 13, color: rgba('ash', 0.75), track: 4 });
    mono(c, 'P = 10⁻⁶ Pa', 104, 124, { size: 13, color: rgba('ash', 0.75), track: 3 });
    const tt = t < this.tFlip ? Math.max(0, t - this.t1) : Math.max(0, t - this.t2);
    mono(c, `t = ${tt.toFixed(2)} s   Δh(feather) = Δh(spark)`, 104, 152, { size: 13, color: rgba('ash', 0.75), track: 3 });
    c.save();
    c.font = font(F.serif(400, true), 40); c.fillStyle = rgba('bone', 0.85 * prog(t, this.t1 + 0.8, this.t1 + 1.6)); c.textAlign = 'right';
    c.fillText('In vacuo, all bodies fall alike.', W - 104, H - 72);
    c.restore();
    // the pump gauge: THE ODDS
    drawOdds(c, 104, H - 92, odds(lyrics).value(t), { scale: 0.95, flash: odds(lyrics).flash(t) });
    comp.draw(renderer, L.upload(), out);
    // the spark
    sparkParticles(lb, t, (tb) => { const r = this.rot(tb); return toScreen(sx, local(tb), r); }, { rate: 60, speed: 150, gravity: 0, life: 0.5 });
    sparkHead(lb, ps.x, ps.y, t, 1.1, 1.2);
    lb.render(renderer, out);
    const hit = pulse(t, this.t1, 0.1) + pulse(t, this.t2, 0.1) + (flipping ? 0.2 : 0);
    const sh = hit * 6;
    void clamp; void lerp;
    return { bloom: 0.7, vignette: 0.45, shake: [(hash(frameIdx(t), 1) - 0.5) * sh, (hash(frameIdx(t), 2) - 0.5) * sh] as [number, number] };
  }

  /** An engraved feather: a curved rachis with barbs. */
  feather(c: CanvasRenderingContext2D, x: number, y: number, r: number, a: number) {
    c.save();
    c.translate(x, y); c.rotate(r - 0.25);
    c.globalAlpha *= a;
    c.strokeStyle = rgba('bone', 0.95); c.lineWidth = 2;
    const Lh = 120;
    c.beginPath(); c.moveTo(0, -Lh / 2 - 20); c.quadraticCurveTo(8, 0, 0, Lh / 2); c.stroke();
    c.lineWidth = 1;
    for (let i = 0; i < 26; i++) {
      const u = i / 25, yy = -Lh / 2 + u * Lh * 0.95;
      const wdt = 26 * Math.sin(Math.PI * Math.min(1, u * 1.1)) + 4;
      for (const s of [-1, 1]) { c.beginPath(); c.moveTo(4 * Math.sin(u * 3), yy); c.lineTo(s * wdt, yy - 16 - 6 * hash(i, s + 3)); c.stroke(); }
    }
    c.restore();
  }
}
