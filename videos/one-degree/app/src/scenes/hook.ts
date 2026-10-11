// hook — chorus 1, "One degree, one degree" / "Turn so slow you can't see".
// A: the hook slams in, a word per hit, over a giant 360-tick dial; on each "degree" the whole world clicks over
//    by one degree (post roll, see _od.heading) and the dial's one-degree wedge flares.
// B: the dial comes to centre as a clock with a hand that turns too slowly to see; a loupe at the tip, at 60×,
//    shows it moving. "slow" stretches for as long as it is held.
import * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { Layer2D, clearRT, W, H } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { F, font, measure } from '../engine/type';
import { LIN, rgba } from '../engine/palette';
import type { Line } from '../engine/lyrics';
import { Lyrics } from '../engine/lyrics';
import { clamp, ease, lerp, prog, pulse, TAU } from '../engine/util';
import { degreeTimes, drawCompound, drawKaraoke, heading, mono, needle, pivot, rad, rollPost } from './_od';

export default class Hook extends Scene {
  lb = new LineBatch(9000);
  text = new Layer2D();
  l6!: Line; l7!: Line;
  tB = 0;
  degs: number[] = [];

  override init() {
    const { lyrics, audio } = this.ctx;
    this.l6 = lyrics.lines[6]!; this.l7 = lyrics.lines[7]!;
    this.tB = audio.timeOfBeat(Math.floor(audio.beatAt(this.l7.words[0]!.start + 0.02)));
    this.degs = degreeTimes(lyrics).filter((d) => d >= this.ctx.start && d < this.ctx.end);
  }

  render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer, comp, lyrics } = this.ctx;
    const t = f.t;
    clearRT(renderer, out, LIN.ink);
    const k = prog(t, this.tB - 0.1, this.tB + 0.75, ease.inOutCubic); // A -> B
    // dial: huge and off to the right in A, centred in B
    const cx = lerp(1460, W / 2, k), cy = lerp(790, 600, k), R = lerp(820, 330, k);
    // the hand steps one degree on each "degree" (a ratchet), then creeps at one degree a minute
    let steps = 0;
    for (const d of this.degs) steps += prog(t, d, d + 0.45, (x) => ease.outBack(x, 2.2));
    const lb = this.lb; lb.clear();
    const flare = this.degs.reduce((m, d) => Math.max(m, pulse(t, d, 0.35)), 0);
    const intro = prog(t, this.ctx.start, this.ctx.start + 0.6, ease.outCubic);
    // ticks: one per degree; the needle's own degree (left, 180°) is the hot one
    for (let i = 0; i < 360; i++) {
      const a = rad(i);
      const vis = clamp(intro * 1.4 - Math.abs(((i + 180) % 360) - 180) / 360);
      if (vis <= 0) continue;
      const L = i % 30 === 0 ? 48 : i % 10 === 0 ? 30 : i % 5 === 0 ? 18 : 9;
      const hot = (i === 180 + Math.round(steps) || i === 179 + Math.round(steps)) ? 1 : 0;
      const col = hot ? LIN.signal : LIN.bone;
      lb.seg2(cx + Math.cos(a) * R, cy + Math.sin(a) * R, cx + Math.cos(a) * (R - L), cy + Math.sin(a) * (R - L), i % 10 === 0 ? 1.6 : 1, col, (hot ? 0.6 + flare : 0.62) * vis);
    }
    // circles
    const ring = (r: number, w: number, col: [number, number, number], al: number) => {
      const n = Math.ceil(r * TAU / 10);
      for (let i = 0; i < n; i++) {
        const a0 = (i / n) * TAU, a1 = ((i + 1) / n) * TAU;
        lb.seg2(cx + Math.cos(a0) * r, cy + Math.sin(a0) * r, cx + Math.cos(a1) * r, cy + Math.sin(a1) * r, w, col, al);
      }
    };
    ring(R, 1.3, LIN.bone, 0.8 * intro);
    ring(R * 0.84, 1, LIN.graphite, 0.9 * intro);
    ring(R * 0.18, 1, LIN.graphite, 0.9 * intro);
    // the one-degree wedge between 180° and 181°, flaring on each "degree"
    if (flare > 0.01) {
      for (let s = 0; s < 6; s++) {
        const a = rad(179 + Math.round(steps) + s / 5);
        lb.seg2(cx + Math.cos(a) * R * 0.18, cy + Math.sin(a) * R * 0.18, cx + Math.cos(a) * (R + 30), cy + Math.sin(a) * (R + 30), 1.2,
          [LIN.signal[0] * 2 * flare, LIN.signal[1] * 2 * flare, LIN.signal[2] * 2 * flare], 0.5 + 0.5 * flare);
      }
    }
    // the hand: in A it rests at 180°; in B it turns at one degree a minute (you can't see it)
    const vel = 1 / 60; // degrees per second
    const handA = rad(180 + steps + Math.max(0, t - this.tB) * vel);
    pivot(lb, cx, cy, 9, LIN.bone, intro);
    needle(lb, cx, cy, handA, R * lerp(0.4, 0.93, k), t, { width: 1.8, tail: R * 0.12, tip: intro });
    lb.render(renderer, out);

    const L = this.text, c = L.ctx; L.clear();
    // ---- A: the hook, stacked, a word per hit
    if (k < 1) {
      c.save();
      c.globalAlpha = 1 - k;
      c.translate(-k * 260, 0);
      const fam = F.archivo(112.5, 900);
      const size = 188;
      const rows: [number, number][] = [[0, 1], [2, 3]];
      const words = this.l6.words;
      rows.forEach(([a, b], r) => {
        const y = 430 + r * 210;
        let x = 120;
        for (const wi of [a, b]) {
          const w = words[wi]!;
          const txt = w.w.toUpperCase();
          const s = prog(t, w.start - 0.03, w.start + 0.12, ease.outCubic);
          if (s <= 0) { x += measure(txt + ' ', fam, size, -4); continue; }
          const hot = clamp(1 - (t - w.end - 0.1) / 0.35);
          c.font = font(fam, size); c.letterSpacing = '-4px'; c.textBaseline = 'alphabetic';
          c.fillStyle = hot > 0 ? `rgba(${(255 + (240 - 255) * (1 - hot)).toFixed(0)},${(106 + (235 - 106) * (1 - hot)).toFixed(0)},${(31 + (224 - 31) * (1 - hot)).toFixed(0)},1)` : rgba('bone', 1);
          const sc = 1 + (1 - s) * 0.12;
          c.save(); c.translate(x, y); c.scale(sc, sc); c.globalAlpha *= s; c.fillText(txt, 0, 0); c.restore();
          x += measure(txt + ' ', fam, size, -4);
        }
      });
      c.restore();
      // +1° callouts at the wedge
      for (const d of this.degs) {
        const a = prog(t, d, d + 0.2, ease.outCubic) * (1 - prog(t, d + 1.6, d + 2.2));
        if (a <= 0) continue;
        c.save(); c.globalAlpha = a * (1 - k);
        c.font = font(F.serif(600, true), 54); c.fillStyle = rgba('signal', 1); c.textAlign = 'right';
        c.fillText('+1°', cx - R * 0.42 - 40, cy - 30);
        c.restore();
      }
    }
    // ---- B: "Turn so slow you can't see", the loupe
    if (k > 0) {
      c.save();
      c.globalAlpha = k;
      // the lyric, top; "slow" stretches while it is held
      const fam = F.archivo(100, 700), size = 92;
      const words = this.l7.words;
      const slow = words[2]!;
      const stretch = prog(t, slow.start, slow.end, ease.inOutQuad);
      const famSlow = F.archivo(lerp(100, 125, stretch), lerp(700, 300, stretch));
      const trSlow = lerp(-1, 30, stretch);
      let x = 0;
      const parts = words.map((w) => {
        const fm = w === slow ? famSlow : fam, tr = w === slow ? trSlow : -1;
        const wd = measure(w.w, fm, size, tr);
        const p = { w, fm, tr, x, wd };
        x += wd + size * 0.26;
        return p;
      });
      const x0 = W / 2 - (x - size * 0.26) / 2;
      for (const p of parts) {
        const pr = Lyrics.wordProgress(p.w, t);
        c.font = font(p.fm, size); c.letterSpacing = `${p.tr}px`; c.textBaseline = 'alphabetic';
        const vis = t > this.l7.start - 0.5;
        if (!vis) continue;
        c.fillStyle = rgba('bone', 0.16); c.fillText(p.w.w, x0 + p.x, 170);
        if (pr > 0) {
          c.save(); c.beginPath(); c.rect(x0 + p.x - 10, 40, (p.wd + 20) * Math.min(1, pr * 1.1), 200); c.clip();
          const hot = clamp(1 - (t - p.w.end) / 0.3);
          c.fillStyle = hot > 0 && t > p.w.start ? `rgba(${(255 - 15 * (1 - hot)).toFixed(0)},${(106 + 129 * (1 - hot)).toFixed(0)},${(31 + 193 * (1 - hot)).toFixed(0)},1)` : rgba('bone', 1);
          c.fillText(p.w.w, x0 + p.x, 170);
          c.restore();
        }
      }
      // loupe: a circle at upper right, magnifying the hand's tip 60×
      const lx = cx + R * 0.93 * Math.cos(handA), ly = cy + R * 0.93 * Math.sin(handA);
      const Lx = 1500, Ly = 560, LR = 170;
      c.strokeStyle = rgba('bone', 0.8); c.lineWidth = 1.2;
      c.beginPath(); c.arc(Lx, Ly, LR, 0, TAU); c.stroke();
      c.strokeStyle = rgba('bone', 0.3); c.lineWidth = 1;
      c.beginPath(); c.moveTo(lx, ly); c.lineTo(Lx - LR * 0.97, Ly + 8); c.stroke();
      c.save();
      c.beginPath(); c.arc(Lx, Ly, LR - 2, 0, TAU); c.clip();
      // inside: the scale around 180° at 60x, sub-degree ticks every 0.01°, the hand's edge creeping across
      const deg = 180 + Math.max(0, t - this.tB) * vel;
      const sp = 9; // px per 0.01°
      for (let j = -22; j <= 22; j++) {
        const d = Math.round(deg * 100) / 100 + j * 0.01;
        const xx = Lx + ((d - deg) / 0.01) * sp;
        const major = Math.abs(Math.round(d * 100) % 10) === 0;
        c.strokeStyle = rgba('bone', major ? 0.85 : 0.4);
        c.beginPath(); c.moveTo(xx, Ly + 40); c.lineTo(xx, Ly + 40 + (major ? 34 : 16)); c.stroke();
        if (major) { c.font = font(F.mono(400), 11); c.fillStyle = rgba('ash', 0.9); c.textAlign = 'center'; c.fillText(d.toFixed(2) + '°', xx, Ly + 96); }
      }
      // the hand, magnified: a thick bar fixed in the loupe while the scale crawls under it
      c.fillStyle = rgba('signal', 1);
      c.fillRect(Lx - 2, Ly - LR, 4, LR + 40);
      c.restore();
      mono(c, '×60', Lx + LR - 6, Ly - LR + 18, { size: 12, color: rgba('ash', 0.9), track: 2, align: 'right' });
      mono(c, 'ANGULAR VELOCITY  0.0167°/s', Lx - LR, Ly + LR + 40, { size: 12, color: rgba('bone', 0.8), track: 2 });
      mono(c, 'VISIBLE TO THE EYE  NO', Lx - LR, Ly + LR + 62, { size: 12, color: rgba('signal', 1), track: 2 });
      c.restore();
    }
    drawCompound(c, 120, 990, t, { ly: lyrics });
    comp.draw(renderer, L.upload(), out);
    void drawKaraoke; void H;
    const shake = this.degs.reduce((m, d) => Math.max(m, pulse(t, d, 0.08)), 0);
    return { ...rollPost(lyrics, t), bloom: 0.6, ca: 0.6, vignette: 0.4, shake: [shake * 4, shake * 2] as [number, number], zoom: 1 + shake * 0.012 };
  }
}
