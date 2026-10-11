// bridge — "What if getting lost / What if getting lost / Was the only way to finally arrive".
// Quiet: the country barely lit. Close on the lamp, the walk loses itself: loop after loop around the track, the
// camera turning with it, no north. On the third line the camera pulls back and the loops turn out to have been a
// way across the whole country, closing in on the islet; on "arrive" the end of the line becomes the compass star
// of the album cover.
import * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { Layer2D } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { F } from '../engine/type';
import { LIN, rgba } from '../engine/palette';
import type { Line } from '../engine/lyrics';
import { clamp, ease, lerp, prog } from '../engine/util';
import { ISLET, track, trackAt } from './_world';
import { compassStar, drawKaraoke, lamp, lerpView, mono, sc, Terrain, w2s, type View } from './_mt';
import { lineProg } from './drew';

const N = 1400;
/** The lost walk: the track with loops wound around it, tightening to nothing at the end. */
function lostAt(u: number) {
  const T = track();
  const p = trackAt(u * T.total);
  const r = 1.6 * Math.pow(1 - u, 0.8) * (0.7 + 0.3 * Math.sin(u * 37));
  const ph = u * 64 * Math.PI + Math.sin(u * 9) * 2;
  return { x: p.x + Math.cos(ph) * r, y: p.y + Math.sin(ph) * r * 0.8 };
}

export default class Bridge extends Scene {
  terrain = new Terrain();
  lb = new LineBatch(N + 200);
  text = new Layer2D();
  ls: Line[] = [];
  pts: { x: number; y: number }[] = [];

  override init() {
    this.ls = [20, 21, 22].map((i) => this.ctx.lyrics.lines[i]!);
    for (let i = 0; i <= N; i++) this.pts.push(lostAt(i / N));
  }

  render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer, comp } = this.ctx;
    const t = f.t, t0 = this.ctx.start, t1 = this.ctx.end;
    const [a, b, c3] = this.ls as [Line, Line, Line];
    const arrive = c3.words[c3.words.length - 1]!;
    // progress of the walk: lost through the first two lines, then across to the islet by "arrive"
    const u = t < c3.start
      ? 0.06 + 0.5 * prog(t, t0, c3.start, ease.inOutSine)
      : 0.56 + 0.44 * prog(t, c3.start, arrive.start + 0.2, ease.inOutSine);
    const head = lostAt(u);
    const pull = prog(t, c3.start - 0.3, arrive.start, ease.inOutCubic);
    const close: View = { cx: head.x, cy: head.y, s: 70, rot: Math.sin(t * 0.37) * 0.6 + (t - t0) * 0.08 };
    const far: View = { cx: 46, cy: 52, s: 15.5, rot: 0 };
    const v = lerpView(close, far, pull);
    this.terrain.draw(renderer, out, { view: v, terrInk: 0.35, relief: 3.0, t, fadeOut: 0.62 - 0.22 * pull, ghost: 0.0, sun: [-0.5, -0.6, 0.5] });
    const lb = this.lb; lb.clear();
    const n = Math.floor(N * u);
    let prev = w2s(v, this.pts[0]!.x, this.pts[0]!.y);
    for (let i = 1; i <= n; i++) {
      const q = w2s(v, this.pts[i]!.x, this.pts[i]!.y);
      const hot = clamp(1 - (n - i) / 60);
      lb.seg2(prev.x, prev.y, q.x, q.y, 1.6 + hot * 1.2, sc(LIN.signal, 0.75 + 1.2 * hot), 0.85);
      prev = q;
    }
    const hp = w2s(v, head.x, head.y);
    const arr = prog(t, arrive.start, arrive.start + 0.8, ease.outCubic);
    lamp(lb, hp.x, hp.y, t, 1 + arr * 1.5, 1 + arr * 0.8);
    lb.render(renderer, out);

    const T = this.text, d = T.ctx; T.clear();
    // the compass star of the cover, rising out of the arrival
    if (arr > 0) {
      const isl = w2s(v, ISLET.x, ISLET.y);
      compassStar(d, isl.x, isl.y - 6, 30 + 70 * arr, { col: rgba('ember', 0.9 * arr), fill: rgba('ember', arr), lw: 1.2, rot: (1 - arr) * 0.8 });
      d.globalAlpha = prog(t, arrive.start + 0.5, arrive.start + 1.2);
      mono(d, 'ARRIVED', isl.x + 120, isl.y + 6, { size: 14, color: rgba('ember', 1), track: 6, weight: 600 });
      mono(d, 'BY GETTING LOST', isl.x + 120, isl.y + 28, { size: 11, color: rgba('bone', 0.7), track: 4 });
      d.globalAlpha = 1;
    }
    // the words: Cormorant italic, quiet, top centre
    const st = { family: F.serif(500, true), size: 78, tracking: 0, sung: rgba('bone', 1), unsung: rgba('bone', 0.18), active: rgba('ember', 1), lead: 0.6, align: 'center' as const };
    const sw1 = prog(t, b.start - 0.7, b.start - 0.2, ease.inOutCubic);
    const sw2 = prog(t, c3.start - 0.5, c3.start - 0.1, ease.inOutCubic);
    if (sw1 < 1) { d.save(); d.globalAlpha = 1 - sw1; drawKaraoke(d, a, 960, 200, t, st); d.restore(); }
    if (sw1 > 0 && sw2 < 1) { d.save(); d.globalAlpha = sw1 * (1 - sw2); drawKaraoke(d, b, 960, 200, t, { ...st, size: 92 }); d.restore(); }
    if (sw2 > 0) { d.save(); d.globalAlpha = sw2; drawKaraoke(d, c3, 960, 200, t, st); d.restore(); }
    // a lost readout while close: no north
    const lk = 1 - pull;
    if (lk > 0.02) {
      d.globalAlpha = lk * prog(t, t0, t0 + 1);
      mono(d, `HEADING  ${(((v.rot * 180) / Math.PI) % 360 + 360).toFixed(0).padStart(3, '0')}°?`, 120, 1000, { size: 12, color: rgba('bone', 0.6), track: 4 });
      mono(d, `LOOPS  ${Math.floor(u * 32)}`, 1800, 1000, { size: 12, color: rgba('bone', 0.6), track: 4, align: 'right' });
      d.globalAlpha = 1;
    }
    void lineProg; void lerp;
    comp.draw(renderer, T.upload(), out);
    return { bloom: 0.75, vignette: 0.55, ca: 0.5, halation: 0.35 };
  }
}
