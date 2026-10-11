// fits — pre-chorus 2: "And the life I never planned / Fits better than the one I drew by hand".
// The cartographer's map, contours and all, with both lines on it: the plan, ruled straight across the contours,
// and the track, lying in the valleys between them. Two elevation profiles draw themselves on a card as the lines
// are sung: the plan's is a saw of climbs and drops, the track's a long gentle walk. On "Fits" the verdict.
import * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { Layer2D } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { F } from '../engine/type';
import { LIN, rgba } from '../engine/palette';
import type { Line } from '../engine/lyrics';
import { clamp, ease, lerp, prog } from '../engine/util';
import { hAt, track, trackAt } from './_world';
import { drawKaraoke, drawPlan, lerpView, mono, sc, Terrain, w2s } from './_mt';
import { lineProg, planAt, PLAN_LEN } from './drew';

const NP = 160;
export default class Fits extends Scene {
  terrain = new Terrain();
  ink = new LineBatch(4000, { blend: 'normal' });
  text = new Layer2D();
  l14!: Line; l15!: Line;
  profPlan: number[] = [];
  profTrack: number[] = [];

  override init() {
    this.l14 = this.ctx.lyrics.lines[14]!; this.l15 = this.ctx.lyrics.lines[15]!;
    for (let i = 0; i <= NP; i++) {
      const p = planAt((PLAN_LEN * i) / NP); this.profPlan.push(Math.max(0, hAt(p.x, p.y)));
      const q = trackAt((track().total * i) / NP); this.profTrack.push(Math.max(0, hAt(q.x, q.y)));
    }
  }

  render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer, comp } = this.ctx;
    const t = f.t, t0 = this.ctx.start, t1 = this.ctx.end;
    const l14 = this.l14, l15 = this.l15;
    const v = lerpView({ cx: 48, cy: 40, s: 19.4, rot: 0 }, { cx: 47.5, cy: 41, s: 20.5, rot: 0 }, prog(t, t0, t1, ease.inOutSine));
    this.terrain.draw(renderer, out, { view: v, mapMix: 1, contour: 0.1, t });
    const ink = this.ink; ink.clear();
    const kDraw = prog(t, t0, l15.start, ease.inOutSine);
    drawPlan(ink, v, 1, LIN.ink, { width: 2.2, alpha: 0.9 });
    // the track on paper: deep amber, drawn as "And the life I never planned" is sung
    const kT = clamp(lineProg(l14, t) * 1.05);
    const T0 = track();
    let prev: { x: number; y: number } | null = null;
    for (let i = 0; i < T0.pts.length; i++) {
      if (T0.len[i]! > T0.total * kT) break;
      const q = w2s(v, T0.pts[i]!.x, T0.pts[i]!.y);
      if (prev) ink.seg2(prev.x, prev.y, q.x, q.y, 3, LIN.blood, 0.95);
      prev = q;
    }
    ink.render(renderer, out);
    const T = this.text, c = T.ctx; T.clear();
    // the profiles card
    const cx = 1380, cy = 120, cw = 450, ch = 450;
    const ck = prog(t, t0, t0 + 0.5, ease.outCubic);
    c.save(); c.globalAlpha = ck;
    c.fillStyle = rgba('bone', 0.97); c.fillRect(cx, cy, cw, ch);
    c.strokeStyle = rgba('ink', 0.8); c.lineWidth = 1; c.strokeRect(cx + 8, cy + 8, cw - 16, ch - 16);
    const prof = (vals: number[], y0: number, label: string, col: string, k: number) => {
      mono(c, label, cx + 32, y0 - 118, { size: 12, color: rgba('ink', 0.85), track: 3, weight: 600 });
      c.strokeStyle = rgba('ink', 0.25); c.lineWidth = 1;
      c.beginPath(); c.moveTo(cx + 32, y0); c.lineTo(cx + cw - 32, y0); c.stroke();
      c.strokeStyle = col; c.lineWidth = 2; c.beginPath();
      const n = Math.floor(NP * k);
      for (let i = 0; i <= n; i++) { const x = cx + 32 + ((cw - 64) * i) / NP, y = y0 - vals[i]! * 55; if (i) c.lineTo(x, y); else c.moveTo(x, y); }
      c.stroke();
    };
    prof(this.profPlan, cy + 190, 'ELEVATION ALONG THE PLAN', rgba('ink', 0.95), kDraw);
    prof(this.profTrack, cy + 380, 'ELEVATION ALONG THE TRACK', rgba('blood', 1), kT);
    c.restore();
    // the verdict, on "Fits"
    const fitsW = l15.words[0]!;
    const vk = prog(t, fitsW.start - 0.05, fitsW.start + 0.3, ease.outCubic);
    if (vk > 0) {
      const climbP = this.profPlan.reduce((a, h, i, arr) => a + (i ? Math.max(0, h - arr[i - 1]!) : 0), 0) * 1000;
      const climbT = this.profTrack.reduce((a, h, i, arr) => a + (i ? Math.max(0, h - arr[i - 1]!) : 0), 0) * 1000;
      c.globalAlpha = vk;
      mono(c, `CLIMB ${Math.round(climbP).toLocaleString('en-US')} M   FIT 23%`, cx + 32, cy + 222, { size: 13, color: rgba('ink', 0.9), track: 2, weight: 600 });
      mono(c, `CLIMB ${Math.round(climbT).toLocaleString('en-US')} M   FIT 97%`, cx + 32, cy + 412, { size: 13, color: rgba('blood', 1), track: 2, weight: 600 });
      c.globalAlpha = 1;
    }
    const st = { family: F.archivo(100, 800), size: 80, tracking: -2, sung: rgba('ink', 1), unsung: rgba('ink', 0.13), active: rgba('blood', 1), lead: 0.5 };
    drawKaraoke(c, l14, 120, 880, t, st);
    drawKaraoke(c, l15, 120, 970, t, { ...st, lead: 0.8 });
    comp.draw(renderer, T.upload(), out);
    void lerp; void sc;
    return { bloom: 0.15, vignette: 0.22, ca: 0.25, halation: 0, paper: 1 };
  }
}
