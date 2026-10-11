// journey — the instrumental after the final chorus, full band.
// A low flight along the whole walked track over the country in gold light, track-up: the lamp leads, the line
// draws itself behind it, the land turns under the camera at every bend. The waypoints are called out as they
// pass (A WRONG TURN, A DETOUR, A FEAST, EAST, HERE) and the lamp flares on the downbeats. Readouts: distance
// walked, and how far from the plan.
import * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { Layer2D } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { LIN, rgba } from '../engine/palette';
import { clamp, ease, prog, pulse } from '../engine/util';
import { PLAN_PTS, track, trackAt, WAY, waySAt } from './_world';
import { drawTrack, lamp, mono, sc, Terrain, w2s, type View } from './_mt';

/** Distance (km) from p to the plan's polyline. */
function toPlan(x: number, y: number) {
  let d = 1e9;
  for (let i = 1; i < PLAN_PTS.length; i++) {
    const a = PLAN_PTS[i - 1]!, b = PLAN_PTS[i]!;
    const vx = b.x - a.x, vy = b.y - a.y, u = clamp(((x - a.x) * vx + (y - a.y) * vy) / (vx * vx + vy * vy));
    d = Math.min(d, Math.hypot(a.x + vx * u - x, a.y + vy * u - y));
  }
  return d;
}

export default class Journey extends Scene {
  terrain = new Terrain();
  lb = new LineBatch(6000);
  plan = new LineBatch(800, { blend: 'normal' });
  text = new Layer2D();
  bars: number[] = [];

  override init() { this.bars = this.ctx.audio.downbeats.filter((d) => d >= this.ctx.start - 0.01 && d < this.ctx.end); }

  /** Smoothed heading of the track around arc length s (radians). */
  heading(s: number) {
    let x = 0, y = 0;
    for (let k = -6; k <= 6; k++) { const p = trackAt(s + k * 0.5); x += Math.cos(p.angle); y += Math.sin(p.angle); }
    return Math.atan2(y, x);
  }

  render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer, comp } = this.ctx;
    const t = f.t, t0 = this.ctx.start, t1 = this.ctx.end;
    const T = track();
    const s = T.total * prog(t, t0 - 0.4, t1 - 0.5, ease.inOutSine);
    const head = trackAt(s);
    const hd = this.heading(s);
    // track-up: the heading points to the top of the frame; the camera looks a little ahead of the lamp
    const rot = -hd - Math.PI / 2;
    const ahead = trackAt(s + 2.4);
    const v: View = { cx: (head.x * 2 + ahead.x) / 3, cy: (head.y * 2 + ahead.y) / 3, s: 32 - 6 * Math.sin(prog(t, t0, t1) * Math.PI), rot };
    this.terrain.draw(renderer, out, { view: v, warmth: 1, terrInk: 0.4, relief: 3.2, t, sun: [-0.8, -0.3, 0.42] });
    // the plan, faint dashed, wherever it crosses the frame
    const pl = this.plan; pl.clear();
    for (let i = 1; i < PLAN_PTS.length; i++) {
      const a = w2s(v, PLAN_PTS[i - 1]!.x, PLAN_PTS[i - 1]!.y), b = w2s(v, PLAN_PTS[i]!.x, PLAN_PTS[i]!.y);
      const L = Math.hypot(b.x - a.x, b.y - a.y), n = Math.floor(L / 12);
      for (let d = 0; d < n; d += 2) pl.seg2(a.x + (b.x - a.x) * d / n, a.y + (b.y - a.y) * d / n, a.x + (b.x - a.x) * (d + 1) / n, a.y + (b.y - a.y) * (d + 1) / n, 1.6, LIN.bone, 0.5);
    }
    pl.render(renderer, out);
    const lb = this.lb; lb.clear();
    const flare = this.bars.reduce((m, b) => Math.max(m, pulse(t, b, 0.18)), 0);
    const hp = drawTrack(lb, v, s, t, { width: 3, head: 0, glow: 1.3 });
    lamp(lb, hp.x, hp.y, t, 1.1 + flare * 0.8, 1 + flare * 0.6);
    lb.render(renderer, out);

    const L = this.text, c = L.ctx; L.clear();
    // waypoint callouts as they pass
    WAY.forEach((w, i) => {
      if (!w.name || i === 0) return;
      const ws = waySAt(i);
      const a = prog(s, ws - 0.6, ws, ease.outCubic) * (1 - prog(s, ws + 5, ws + 8));
      if (a <= 0) return;
      const q = w2s(v, w.x, w.y);
      c.save(); c.globalAlpha = a;
      c.strokeStyle = rgba('bone', 0.8); c.lineWidth = 1;
      c.beginPath(); c.moveTo(q.x, q.y); c.lineTo(q.x + 46, q.y - 46); c.lineTo(q.x + 70, q.y - 46); c.stroke();
      mono(c, w.name, q.x + 78, q.y - 41, { size: 14, color: rgba('ember', 1), track: 4, weight: 600 });
      c.restore();
    });
    // readouts
    const dev = toPlan(head.x, head.y);
    c.globalAlpha = prog(t, t0, t0 + 0.6) * (1 - prog(t, t1 - 0.4, t1));
    mono(c, 'DISTANCE WALKED', 120, 140, { size: 12, color: rgba('bone', 0.75), track: 4 });
    mono(c, `${s.toFixed(1).padStart(5, '0')} KM`, 120, 168, { size: 22, color: rgba('ember', 1), track: 2, weight: 500 });
    mono(c, 'DEVIATION FROM PLAN', 1800, 140, { size: 12, color: rgba('bone', 0.75), track: 4, align: 'right' });
    mono(c, `${dev.toFixed(2)} KM`, 1800, 168, { size: 22, color: rgba('ember', 1), track: 2, align: 'right', weight: 500 });
    mono(c, `HEADING ${(((hd + Math.PI / 2) * 180 / Math.PI + 360) % 360).toFixed(0).padStart(3, '0')}°  ·  TRACK-UP`, 120, 1000, { size: 12, color: rgba('bone', 0.6), track: 3 });
    c.globalAlpha = 1;
    comp.draw(renderer, L.upload(), out);
    void sc;
    return { bloom: 0.6, vignette: 0.4, ca: 0.5, halation: 0.3, zoom: 1 + flare * 0.006 };
  }
}
