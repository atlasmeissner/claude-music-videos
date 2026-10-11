// course — chorus 2: "One degree, one degree" ×2 / "Turn so slow you can't see" / "But the whole world's bending".
// A bone nautical chart. From one port, the true course (090°) and the course actually steered, which opens by one
// degree on each "degree". The chart pulls back from tens to thousands of nautical miles: at the port the two
// lines can't be told apart; out at sea they end on different coasts. On "bending" the chart's straight lines bend.
import * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { Layer2D, clearRT, W, H } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { F, font } from '../engine/type';
import { LIN, rgba } from '../engine/palette';
import type { Line } from '../engine/lyrics';
import { clamp, ease, lerp, noise1, prog, pulse, TAU } from '../engine/util';
import { degreeTimes, drawHeading, drawKaraoke, heading, mono, rad, rollPost } from './_od';

const PX = 230, PY = 640; // the port on screen

export default class Course extends Scene {
  ink = new LineBatch(20000, { blend: 'normal' });
  hot = new LineBatch(400);
  text = new Layer2D();
  ls: Line[] = [];
  degs: number[] = [];

  override init() {
    const ly = this.ctx.lyrics;
    this.ls = [16, 17, 18, 19].map((i) => ly.lines[i]!);
    this.degs = degreeTimes(ly).filter((d) => d >= this.ctx.start && d < this.ctx.end);
  }

  render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer, comp, lyrics } = this.ctx;
    const t = f.t;
    clearRT(renderer, out, LIN.bone);
    const lb = this.ink; lb.clear();
    const hb = this.hot; hb.clear();
    const [l16, l17, l18, l19] = this.ls as [Line, Line, Line, Line];
    // the off-course angle: one degree per "degree" in this plate (ratchet)
    let ang = 0;
    for (const d of this.degs) ang += prog(t, d, d + 0.45, (x) => ease.outBack(x, 2));
    // zoom: px per nautical mile, from 18 down to 0.42 over "Turn so slow you can't see"
    const u = prog(t, l18.start - 0.3, l18.end + 0.4, ease.inOutCubic);
    const scale = 18 * Math.pow(0.42 / 18, u);
    const bend = prog(t, l19.words[4]!.start - 0.1, l19.words[4]!.start + 0.9, ease.inOutCubic);
    const S = (x: number, y: number) => {
      let sx = PX + x * scale, sy = PY + y * scale;
      const xn = (sx - PX) / W;
      sy -= bend * 260 * xn * xn; // the world bends
      sx += bend * 40 * Math.sin(((sy - PY) / H) * 3);
      return { x: sx, y: sy };
    };
    const ink = LIN.ink;
    // adaptive grid: spacing in NM with at least ~110 px between lines
    const nice = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];
    const sp = nice.find((n) => n * scale >= 110) ?? 1000;
    const xMin = (0 - PX) / scale, xMax = (W - PX) / scale, yMin = (0 - PY) / scale, yMax = (H - PY) / scale;
    const poly = (pts: { x: number; y: number }[], w: number, col: [number, number, number], al: number, batch = lb) => {
      for (let i = 1; i < pts.length; i++) batch.seg2(pts[i - 1]!.x, pts[i - 1]!.y, pts[i]!.x, pts[i]!.y, w, col, al);
    };
    for (let gx = Math.floor(xMin / sp) * sp; gx <= xMax + sp; gx += sp) {
      const pts = []; for (let k = 0; k <= 20; k++) pts.push(S(gx, yMin + ((yMax - yMin) * k) / 20));
      poly(pts, 1, ink, gx === 0 ? 0.3 : 0.2);
    }
    for (let gy = Math.floor(yMin / sp) * sp; gy <= yMax + sp; gy += sp) {
      const pts = []; for (let k = 0; k <= 30; k++) pts.push(S(xMin + ((xMax - xMin) * k) / 30, gy));
      poly(pts, 1, ink, 0.2);
    }
    // coasts: the home coast around the port, and two far shores (on the true course, and where you end up)
    const coast = (cx: number, cy: number, r: number, seed: number, al: number) => {
      const pts = [];
      for (let k = 0; k <= 90; k++) {
        const a = (k / 90) * TAU;
        const rr = r * (1 + 0.35 * (noise1(Math.cos(a) * 2 + seed, seed) - 0.5) + 0.15 * (noise1(a * 6 + seed, seed + 1) - 0.5));
        pts.push(S(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr));
      }
      poly(pts, 1.4, ink, al);
    };
    coast(-40, 0, 38, 3, 0.7);
    const far = 3000;
    coast(far + 130, -40, 90, 7, 0.7 * clamp(u * 2));
    const off = far * Math.tan(rad(4));
    coast(far + 100, off + 60, 90, 11, 0.7 * clamp(u * 2));
    // the true course (dashed ink) and the steered course (orange)
    const L0 = far + 120;
    for (let d = 0; d < L0; d += Math.max(0.6, 9 / scale)) {
      const a = S(d, 0), b = S(Math.min(L0, d + Math.max(0.3, 4.5 / scale)), 0);
      lb.seg2(a.x, a.y, b.x, b.y, 1.4, ink, 0.8);
    }
    const th = rad(ang);
    const steer = [];
    for (let k = 0; k <= 60; k++) { const d = (L0 * k) / 60; steer.push(S(d * Math.cos(th), d * Math.sin(th))); }
    poly(steer, 2.2, LIN.signal, 0.95);
    // the ship: a warm point moving out along the steered course
    const shipD = Math.min(L0, (W - PX - 160) / scale * 0.92);
    const sh = S(shipD * Math.cos(th), shipD * Math.sin(th));
    hb.seg2(sh.x, sh.y, sh.x + 0.01, sh.y, 14, [LIN.signal[0] * 1.5, LIN.signal[1] * 1.5, LIN.signal[2] * 1.5], 0.9);
    // angle arc at the port
    if (ang > 0.02) {
      const r = 150;
      const pts = []; for (let k = 0; k <= 16; k++) { const a = (th * k) / 16; pts.push({ x: PX + Math.cos(a) * r, y: PY + Math.sin(a) * r }); }
      poly(pts, 1.6, LIN.signal, 0.95);
    }
    // the compass rose at the port
    for (let i = 0; i < 32; i++) {
      const a = (i / 32) * TAU, l = i % 8 === 0 ? 34 : i % 4 === 0 ? 22 : 12;
      lb.seg2(PX + Math.cos(a) * 60, PY + Math.sin(a) * 60, PX + Math.cos(a) * (60 + l), PY + Math.sin(a) * (60 + l), 1, ink, 0.6);
    }
    lb.render(renderer, out);
    hb.render(renderer, out);

    // ----- type
    const T = this.text, c = T.ctx; T.clear();
    const st = { family: F.archivo(100, 800), size: 80, tracking: -1.5, sung: rgba('ink', 1), unsung: rgba('ink', 0.12), active: rgba('signal', 1), lead: 0.5 } as const;
    const sw = prog(t, l18.start - 0.5, l18.start - 0.15, ease.inOutCubic);
    if (sw < 1) {
      c.save(); c.globalAlpha = 1 - sw;
      drawKaraoke(c, l16, 120, 210, t, st);
      drawKaraoke(c, l17, 120, 300, t, { ...st, lead: 1.2 });
      c.restore();
    }
    if (sw > 0) {
      c.save(); c.globalAlpha = sw;
      drawKaraoke(c, l18, 120, 210, t, st);
      drawKaraoke(c, l19, 120, 300, t, { ...st, lead: 1.0 });
      c.restore();
    }
    // the angle label
    if (ang > 0.02) {
      const flare = this.degs.reduce((m, d) => Math.max(m, pulse(t, d, 0.4)), 0);
      c.save();
      c.font = font(F.serif(600, true), 44 + flare * 10); c.fillStyle = rgba('signal', 1);
      c.fillText(`${Math.round(ang)}°`, PX + 170, PY + 24 + th * 150);
      c.restore();
    }
    // chart furniture
    mono(c, 'CHART 1 — TRUE COURSE 090°', W - 120, 150, { size: 12, color: rgba('ink', 0.7), track: 3, align: 'right' });
    mono(c, `STEERED  ${(90 + ang).toFixed(1).padStart(5, '0')}°`, W - 120, 178, { size: 16, color: rgba('signal', 1), track: 2, align: 'right', weight: 600 });
    const offNM = shipD * Math.sin(th);
    mono(c, `RUN ${Math.round(shipD).toLocaleString('en-US')} NM   OFF COURSE ${offNM < 10 ? offNM.toFixed(2) : Math.round(offNM).toLocaleString('en-US')} NM`, W - 120, 204, { size: 12, color: rgba('ink', 0.8), track: 2, align: 'right' });
    mono(c, `GRID ${sp} NM`, W - 120, H - 96, { size: 11, color: rgba('ink', 0.55), track: 3, align: 'right' });
    mono(c, 'PORT', PX - 20, PY + 110, { size: 11, color: rgba('ink', 0.7), track: 3, align: 'right' });
    if (u > 0.6) {
      const a = clamp((u - 0.6) * 3);
      const p1 = S(far + 130, -190), p2 = S(far + 100, off + 210);
      mono(c, 'WHERE YOU MEANT TO GO', p1.x, p1.y, { size: 11, color: rgba('ink', 0.75 * a), track: 2, align: 'center' });
      mono(c, 'WHERE YOU ARRIVE', p2.x, p2.y, { size: 11, color: rgba('signal', a), track: 2, align: 'center' });
    }
    drawHeading(c, 120, 990, heading(lyrics, t), { color: rgba('ink', 0.75) });
    comp.draw(renderer, T.upload(), out);
    void lerp;
    return { ...rollPost(lyrics, t, LIN.bone), bloom: 0.25, ca: 0.4, vignette: 0.2, halation: 0 };
  }
}
