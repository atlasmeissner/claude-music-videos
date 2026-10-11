// beyond — "But the life I found beyond the story / Oh, it's more beautiful than lines on paper could" (n = 1, end of
// the final chorus) and "…/ Is more beautiful than lines on paper could" (n = 2, `found`, the last chorus).
//  1  The sheet is paper and everything outside its neatline is the territory in gold light. The camera starts at
//     the sheet's western edge and pulls back until the plan is a small rectangle in a much larger lit country;
//     on "beautiful" the paper itself gives way, and only its frame is left.
//  2  The whole walked track over the gold country, with the plan laid over it as a strip of ruled tape; through
//     the second line the tape peels off from HOME to RETIREMENT and is gone.
import * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { Layer2D } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { F } from '../engine/type';
import { LIN, rgba } from '../engine/palette';
import type { Line } from '../engine/lyrics';
import { clamp, ease, lerp, prog } from '../engine/util';
import { PLAN, track, WORLD } from './_world';
import { drawKaraoke, drawTrack, lerpView, mono, neatline, sc, Terrain, w2s, type View } from './_mt';
import { lineProg } from './drew';

export default class Beyond extends Scene {
  terrain = new Terrain();
  lb = new LineBatch(4000);
  ink = new LineBatch(2000, { blend: 'normal' });
  text = new Layer2D();
  n = 1;
  la!: Line; lz!: Line;

  override init() {
    this.n = this.ctx.params.n ?? 1;
    const ly = this.ctx.lyrics;
    [this.la, this.lz] = this.n === 1 ? [ly.lines[25]!, ly.lines[26]!] : [ly.lines[29]!, ly.lines[30]!];
  }

  render(f: Frame, out: THREE.WebGLRenderTarget) {
    return this.n === 1 ? this.pull(f, out) : this.tape(f, out);
  }

  pull(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer, comp } = this.ctx;
    const t = f.t, t0 = this.ctx.start, t1 = this.ctx.end;
    const la = this.la, lz = this.lz;
    const beautiful = lz.words.find((w) => w.w.toLowerCase().startsWith('beautiful'))!;
    const k = prog(t, t0 + 0.3, lz.start + 2.6, ease.inOutSine);
    const v = lerpView({ cx: 2, cy: 58, s: 48, rot: 0.0 }, { cx: 48, cy: 50, s: 8.9, rot: 0 }, k);
    const paper = 1 - prog(t, beautiful.start - 0.1, beautiful.end + 0.6, ease.inOutSine);
    this.terrain.draw(renderer, out, { view: v, sheet: paper, warmth: 1, terrInk: 0.45, relief: 3.0, t, contourInk: 0.7, contour: 0.08, sun: [-0.8, -0.3, 0.42] });
    const lb = this.lb; lb.clear();
    drawTrack(lb, v, track().total, t, { width: 2.2, head: 1 });
    lb.render(renderer, out);
    const T = this.text, c = T.ctx; T.clear();
    neatline(c, v, rgba(paper > 0.5 ? 'ink' : 'bone', 0.8), { k: 1, step: 10, labels: false });
    // outside-the-sheet captions
    const a = prog(t, t0 + 0.6, t0 + 1.4);
    if (a > 0) {
      const e = w2s(v, 0, 62);
      c.globalAlpha = a * (1 - k * 0.7);
      mono(c, 'EDGE OF SHEET 1', e.x + 18, e.y - 14, { size: 12, color: rgba('ink', 0.85), track: 4 });
      mono(c, 'NOT SURVEYED', e.x - 18, e.y - 14, { size: 12, color: rgba('bone', 0.85), track: 4, align: 'right' });
      c.globalAlpha = 1;
    }
    // the words: ink where they sit on the paper, bone on the country (clipped at the sheet's edge)
    const stB = { family: F.archivo(100, 800), size: 76, tracking: -2, lead: 0.5, align: 'center' as const };
    const onBone = { sung: rgba('bone', 1), unsung: rgba('bone', 0.16), active: rgba('ember', 1) };
    const onPaper = { sung: rgba('ink', 1), unsung: rgba('ink', 0.14), active: rgba('blood', 1) };
    const r0 = w2s(v, 0, 0), r1 = w2s(v, WORLD, WORLD);
    const sw = prog(t, lz.start - 0.5, lz.start - 0.1, ease.inOutCubic);
    const both = (line: Line, alpha: number) => {
      if (alpha <= 0) return;
      c.save(); c.globalAlpha = alpha;
      if (paper > 0.5) {
        c.save(); c.beginPath(); c.rect(0, 0, 1920, 1080); c.rect(r0.x, r0.y, r1.x - r0.x, r1.y - r0.y); c.clip('evenodd'); drawKaraoke(c, line, 960, 940, t, { ...stB, ...onBone }); c.restore();
        c.save(); c.beginPath(); c.rect(r0.x, r0.y, r1.x - r0.x, r1.y - r0.y); c.clip(); drawKaraoke(c, line, 960, 940, t, { ...stB, ...onPaper }); c.restore();
      } else drawKaraoke(c, line, 960, 940, t, { ...stB, ...onBone });
      c.restore();
    };
    both(la, 1 - sw);
    both(lz, sw * (1 - prog(t, t1 - 0.8, t1 - 0.1)));
    const sk = prog(t, beautiful.end, beautiful.end + 0.6);
    if (sk > 0) {
      c.globalAlpha = sk;
      const p = w2s(v, WORLD, 0);
      mono(c, 'SHEET 1 OF 1', p.x - 8, p.y - 16, { size: 12, color: rgba('bone', 0.8), track: 4, align: 'right' });
      mono(c, `THE COUNTRY  ${(220 * 220).toLocaleString('en-US')} KM²  ·  THE PLAN  ${(100 * 100).toLocaleString('en-US')} KM²`, 960, 1010, { size: 12, color: rgba('bone', 0.75), track: 3, align: 'center' });
      c.globalAlpha = 1;
    }
    comp.draw(renderer, T.upload(), out);
    return { bloom: 0.6, vignette: 0.35, ca: 0.45, halation: 0.3, paper: paper * (1 - k) };
  }

  tape(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer, comp } = this.ctx;
    const t = f.t, t0 = this.ctx.start, t1 = this.ctx.end;
    const la = this.la, lz = this.lz;
    const v = lerpView({ cx: 42, cy: 42, s: 16.5, rot: 0.03 }, { cx: 40, cy: 42, s: 15, rot: 0 }, prog(t, t0, t1, ease.inOutSine));
    this.terrain.draw(renderer, out, { view: v, warmth: 1, terrInk: 0.45, relief: 3.0, t, sun: [-0.8, -0.3, 0.42] });
    const lb = this.lb; lb.clear();
    drawTrack(lb, v, track().total, t, { width: 2.6, head: 1, glow: 1.4 });
    // the tape: the plan's road as a bone strip, peeling from HOME during the second line
    const peel = lineProg(lz, t);
    const ink = this.ink; ink.clear();
    const P = PLAN.map((p) => w2s(v, p.x, p.y));
    const L = [0]; for (let i = 1; i < P.length; i++) L.push(L[i - 1]! + Math.hypot(P[i]!.x - P[i - 1]!.x, P[i]!.y - P[i - 1]!.y));
    const tot = L[L.length - 1]!, cut = peel * tot;
    for (let i = 1; i < P.length; i++) {
      const a = P[i - 1]!, b = P[i]!;
      for (let s = 0; s < 1; s += 0.05) {
        const d0 = L[i - 1]! + (L[i]! - L[i - 1]!) * s, d1 = L[i - 1]! + (L[i]! - L[i - 1]!) * (s + 0.05);
        const x0 = a.x + (b.x - a.x) * s, y0 = a.y + (b.y - a.y) * s, x1 = a.x + (b.x - a.x) * (s + 0.05), y1 = a.y + (b.y - a.y) * (s + 0.05);
        if (d1 > cut) {
          ink.seg2(x0 + 2, y0 + 3, x1 + 2, y1 + 3, 9, LIN.ink, 0.25); // its shadow
          ink.seg2(x0, y0, x1, y1, 8, LIN.bone, 0.92);
          ink.seg2(x0, y0, x1, y1, 1.2, LIN.ink, 0.8);
        } else {
          // the peeled part curls up and away, fading
          const lift = clamp((cut - d0) / 160);
          if (lift < 1) ink.seg2(x0, y0 - lift * 90, x1, y1 - lift * 90, 8 * (1 - lift * 0.5), LIN.bone, 0.85 * (1 - lift));
        }
      }
    }
    ink.render(renderer, out);
    lb.render(renderer, out);
    const T = this.text, c = T.ctx; T.clear();
    const st = { family: F.archivo(100, 800), size: 84, tracking: -2, sung: rgba('bone', 1), unsung: rgba('bone', 0.16), active: rgba('ember', 1), lead: 0.5 };
    drawKaraoke(c, la, 960, 860, t, { ...st, align: 'center' });
    drawKaraoke(c, lz, 960, 960, t, { ...st, align: 'center', size: 76, lead: 0.9 });
    const g = prog(t, lz.end - 0.3, lz.end + 0.5);
    if (g > 0) { c.globalAlpha = g; mono(c, 'PLAN REMOVED  ·  TRACK KEPT', 960, 1030, { size: 12, color: rgba('ember', 1), track: 4, align: 'center' }); c.globalAlpha = 1; }
    void lerp; void sc;
    comp.draw(renderer, T.upload(), out);
    return { bloom: 0.65, vignette: 0.35, ca: 0.45, halation: 0.3 };
  }
}
