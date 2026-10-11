// sunrise — final chorus: "One degree, one degree" ×2 / "Turned so slow I couldn't see" /
// "But the whole world's different now" / "One degree was all I need" / "One degree".
// A horizon at night; the sun climbs exactly one degree (on the ruler at the right) for every "degree", with one
// ray for each degree the world has turned so far. On "different" the world flips to day: bone paper, ink lines,
// and the pale dawn gold (the video's one accent) for the sun.
import * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { Layer2D, clearRT, W, H } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { F } from '../engine/type';
import { LIN, rgba } from '../engine/palette';
import type { Line } from '../engine/lyrics';
import { clamp, ease, lerp, noise1, prog, pulse, TAU } from '../engine/util';
import { degreeCount, degreeTimes, drawHeading, drawKaraoke, heading, mixCss, mono, rad, rollPost } from './_od';

const HZ = 720, SX = 1180, SR = 96, PXDEG = 46;
const mix3 = (a: [number, number, number], b: [number, number, number], k: number): [number, number, number] => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];

export default class Sunrise extends Scene {
  lb = new LineBatch(12000, { blend: 'normal' });
  glow = new LineBatch(400);
  text = new Layer2D();
  ls: Line[] = [];
  degs: number[] = [];
  tFlip = 0;

  override init() {
    const ly = this.ctx.lyrics;
    this.ls = [26, 27, 28, 29, 30, 31].map((i) => ly.lines[i]!);
    this.degs = degreeTimes(ly).filter((d) => d >= this.ctx.start && d < this.ctx.end);
    this.tFlip = this.ls[3]!.words[4]!.start; // "different"
  }

  render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer, comp, lyrics } = this.ctx;
    const t = f.t;
    const day = prog(t, this.tFlip - 0.02, this.tFlip + 0.3, ease.inOutCubic);
    const bg = mix3(LIN.ink, LIN.bone, day);
    const fg = mix3(LIN.bone, LIN.ink, day);
    clearRT(renderer, out, bg);
    const lb = this.lb; lb.clear();
    const gb = this.glow; gb.clear();
    const [l26, l27, l28, l29, l30, l31] = this.ls as [Line, Line, Line, Line, Line, Line];
    // the sun's altitude: -1.6° at the cut, +1° per "degree" (ratchet), creeping during "Turned so slow"
    let alt = -1.6;
    for (const d of this.degs) alt += prog(t, d, d + 0.5, (x) => ease.outBack(x, 1.8));
    alt += 0.6 * prog(t, l28.start, l28.end, ease.linear);
    const sy = HZ - alt * PXDEG;
    // rays: one per degree turned so far, every 15°: a corona that completes at 24
    const n = degreeCount(lyrics, t);
    const sunCol = mix3(LIN.signal, LIN.acid, day);
    const spin = t * 0.05;
    for (let i = 0; i < n; i++) {
      const born = degreeTimes(lyrics)[i]!;
      const k = prog(t, Math.max(born, this.ctx.start + i * 0.03), Math.max(born, this.ctx.start + i * 0.03) + 0.4, ease.outExpo);
      const a = spin + (i / 24) * TAU - Math.PI / 2;
      const r0 = SR + 26, r1 = SR + 26 + (150 + 40 * pulse(t, born, 0.4)) * k;
      lb.seg2(SX + Math.cos(a) * r0, sy + Math.sin(a) * r0, SX + Math.cos(a) * r1, sy + Math.sin(a) * r1, 2.2, day > 0.5 ? LIN.ink : sunCol, 0.9 * k);
    }
    // the sun
    lb.seg2(SX, sy, SX + 0.01, sy, SR * 2, sunCol, 1);
    // at night the disc is drawn hot as well, so the bloom gives it its glow
    if (day < 1) gb.seg2(SX, sy, SX + 0.01, sy, SR * 2, [LIN.signal[0] * 1.4 * (1 - day), LIN.signal[1] * 1.4 * (1 - day), LIN.signal[2] * 1.4 * (1 - day)], 1);
    if (day > 0) {
      // engraved rim + latitude hatching on the day sun
      for (let i = 0; i < 64; i++) {
        const a0 = (i / 64) * TAU, a1 = ((i + 1) / 64) * TAU;
        lb.seg2(SX + Math.cos(a0) * SR, sy + Math.sin(a0) * SR, SX + Math.cos(a1) * SR, sy + Math.sin(a1) * SR, 1.4, LIN.ink, day);
      }
      for (let y = -SR + 8; y < SR; y += 9) {
        const hw = Math.sqrt(SR * SR - y * y) * 0.96;
        lb.seg2(SX - hw, sy + y, SX + hw, sy + y, 0.8, LIN.ink, 0.25 * day);
      }
    }
    // (flush the sun and its hot core before the ground covers it)
    lb.render(renderer, out); lb.clear();
    gb.render(renderer, out);
    // ground: fill below the horizon (hides the sun), then engraved ridges
    for (let y = HZ; y < H + 30; y += 24) lb.seg2(-40, y + 12, W + 40, y + 12, 26, bg, 1);
    for (let r = 0; r < 7; r++) {
      const yb = HZ + 6 + r * r * 7;
      let px = -20, py = yb;
      for (let x = 0; x <= W + 20; x += 16) {
        const y = yb + (noise1(x * 0.003 + r * 3.3, r + 5) - 0.5) * (10 + r * 9);
        lb.seg2(px, py, x, Math.max(HZ + 1, y), r === 0 ? 1.4 : 1, fg, r === 0 ? 0.9 : 0.55 - r * 0.05);
        px = x; py = Math.max(HZ + 1, y);
      }
    }
    lb.seg2(0, HZ, W, HZ, 1.4, fg, 0.9);
    // the altitude ruler on the right
    const rx = W - 150;
    for (let d = -2; d <= 8; d++) {
      const y = HZ - d * PXDEG;
      lb.seg2(rx, y, rx + (d % 5 === 0 ? 30 : 18), y, 1.2, fg, 0.7);
    }
    lb.seg2(rx, HZ + 2 * PXDEG, rx, HZ - 8 * PXDEG, 1, fg, 0.5);
    // the sun's level on the ruler
    lb.seg2(rx - 14, sy, rx + 40, sy, 2.2, mix3(LIN.signal, LIN.ink, day * 0.4), 1);
    lb.render(renderer, out);

    // ----- type
    const T = this.text, c = T.ctx; T.clear();
    const sung = mixCss(rgba('bone', 1), rgba('ink', 1), day), un = mixCss(rgba('bone', 0.16), rgba('ink', 0.14), day);
    const st = { family: F.archivo(100, 800), size: 84, tracking: -1.5, sung, unsung: un, active: rgba('signal', 1), lead: 0.5 } as const;
    // the lyric stays level (counter-rotated against the world's roll); the world visibly does not
    const hh = heading(lyrics, t);
    c.save(); c.translate(W / 2, H / 2); c.rotate(-hh * Math.PI / 180); c.translate(-W / 2, -H / 2);
    const swA = prog(t, l28.start - 0.5, l28.start - 0.15, ease.inOutCubic);
    if (swA < 1) { c.save(); c.globalAlpha = 1 - swA; drawKaraoke(c, l26, 120, 210, t, st); drawKaraoke(c, l27, 120, 305, t, { ...st, lead: 1.2 }); c.restore(); }
    const swB = prog(t, l30.start - 0.4, l30.start - 0.1, ease.inOutCubic);
    if (swA > 0 && swB < 1) { c.save(); c.globalAlpha = swA * (1 - swB); drawKaraoke(c, l28, 120, 210, t, st); drawKaraoke(c, l29, 120, 305, t, { ...st, lead: 1.0 }); c.restore(); }
    if (swB > 0) {
      c.save(); c.globalAlpha = swB;
      drawKaraoke(c, l30, 120, 230, t, { ...st, family: F.archivo(100, 900), size: 100, tracking: -2.5, lead: 0.4 });
      drawKaraoke(c, l31, 120, 345, t, { ...st, family: F.archivo(100, 900), size: 100, tracking: -2.5, lead: 0.4 });
      c.restore();
    }
    c.restore();
    // ruler labels
    for (let d = -2; d <= 8; d += 1) {
      if (d % 2) continue;
      mono(c, `${d > 0 ? '+' : d < 0 ? '−' : ''}${Math.abs(d)}°`, rx + 40, HZ - d * PXDEG + 5, { size: 12, color: mixCss(rgba('bone', 0.7), rgba('ink', 0.7), day), track: 1 });
    }
    mono(c, 'SOLAR ALTITUDE', rx + 40, HZ - 8 * PXDEG - 24, { size: 11, color: mixCss(rgba('ash', 0.8), rgba('ink', 0.6), day), track: 3, align: 'right' });
    mono(c, `${alt >= 0 ? '+' : '−'}${Math.abs(alt).toFixed(1)}°`, rx - 24, sy + 6, { size: 16, color: rgba('signal', 1), track: 2, align: 'right', weight: 600 });
    mono(c, `RAYS ${n} / 24`, SX, HZ + 300, { size: 12, color: mixCss(rgba('ash', 0.8), rgba('ink', 0.7), day), track: 4, align: 'center' });
    drawHeading(c, 120, 990, heading(lyrics, t), { color: mixCss(rgba('bone', 0.75), rgba('ink', 0.75), day) });
    comp.draw(renderer, T.upload(), out);
    void clamp;
    return { ...rollPost(lyrics, t, bg), bloom: lerp(0.65, 0.25, day), halation: lerp(0.25, 0, day), ca: 0.5, vignette: lerp(0.45, 0.22, day), flash: 0.5 * pulse(t, this.tFlip, 0.12) };
  }
}
