// globe — "But the whole world's bending" / "one degree, one degree, one degree" / instrumental.
// A graticule globe turning; the lyric rides an arc over it; on "bending" its meridians bend into S-curves.
// On each "degree" one more orange great circle is drawn, one degree on from the last, and the world clicks
// over (post roll). The instrumental lets the globe recede to a point.
import * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { Layer2D, clearRT, W, H } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { F } from '../engine/type';
import { LIN, rgba } from '../engine/palette';
import type { Line } from '../engine/lyrics';
import { clamp, ease, lerp, prog, pulse } from '../engine/util';
import { degreeTimes, drawArcKaraoke, drawHeading, drawKaraoke, heading, mono, rad, rollPost } from './_od';

export default class Globe extends Scene {
  lb = new LineBatch(20000);
  text = new Layer2D();
  l8!: Line; l9!: Line;
  degs: number[] = [];
  tBend = 0;

  override init() {
    const ly = this.ctx.lyrics;
    this.l8 = ly.lines[8]!; this.l9 = ly.lines[9]!;
    this.tBend = this.l8.words[this.l8.words.length - 1]!.start;
    this.degs = degreeTimes(ly).filter((d) => d >= this.ctx.start && d < this.ctx.end);
  }

  render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer, comp, lyrics } = this.ctx;
    const t = f.t;
    clearRT(renderer, out, LIN.ink);
    const lb = this.lb; lb.clear();
    const tEnd9 = this.l9.end;
    const recede = prog(t, tEnd9 + 0.4, this.ctx.end - 0.3, ease.inOutCubic);
    const cx = W / 2, cy = 560;
    const R = lerp(360, 26, recede) * (1 + 0.02 * f.a.kick);
    const spin = t * 0.12;
    const tilt = rad(18);
    const bend = 0.42 * prog(t, this.tBend, this.tBend + 0.8, ease.inOutCubic);
    // sphere point -> screen (orthographic), z>0 = front
    const P = (lat: number, lon: number) => {
      const lw = lon + bend * Math.sin(2 * lat) * Math.cos(lon * 0.5 + t * 0.3);
      const x = Math.cos(lat) * Math.sin(lw + spin), y = Math.sin(lat), z = Math.cos(lat) * Math.cos(lw + spin);
      const y2 = y * Math.cos(tilt) - z * Math.sin(tilt), z2 = y * Math.sin(tilt) + z * Math.cos(tilt);
      return { x: cx + x * R, y: cy - y2 * R, z: z2 };
    };
    const lineAlpha = 1 - recede * 0.6;
    const seg = (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }, w: number, col: [number, number, number], al: number) => {
      const front = (a.z + b.z) * 0.5;
      const k = front > 0 ? 1 : 0.16;
      lb.seg2(a.x, a.y, b.x, b.y, w, col, al * k * lineAlpha);
    };
    const intro = prog(t, this.ctx.start, this.ctx.start + 0.8, ease.outCubic);
    // meridians every 15°
    for (let m = 0; m < 24; m++) {
      const lon = rad(m * 15);
      let p = P(rad(-90), lon);
      for (let i = 1; i <= 48; i++) {
        const lat = rad(-90 + (180 * i) / 48);
        if (i / 48 > intro) break;
        const q = P(lat, lon);
        seg(p, q, 1, LIN.bone, 0.55);
        p = q;
      }
    }
    // parallels every 15°
    for (let pi = -5; pi <= 5; pi++) {
      const lat = rad(pi * 15);
      let p = P(lat, 0);
      for (let i = 1; i <= 72; i++) {
        if (i / 72 > intro) break;
        const q = P(lat, rad(i * 5));
        seg(p, q, pi === 0 ? 1.4 : 1, pi === 0 ? LIN.bone : LIN.bone, pi === 0 ? 0.8 : 0.45);
        p = q;
      }
    }
    // the limb
    for (let i = 0; i < 120; i++) {
      const a0 = (i / 120) * Math.PI * 2, a1 = ((i + 1) / 120) * Math.PI * 2;
      lb.seg2(cx + Math.cos(a0) * R, cy + Math.sin(a0) * R, cx + Math.cos(a1) * R, cy + Math.sin(a1) * R, 1.4, LIN.bone, 0.9 * intro);
    }
    // great circles: one per "degree" sung in this plate, each one degree on from the last (exaggerated ×6 so
    // that the eye can find them — the readout keeps the true count)
    this.degs.forEach((d, n) => {
      const on = prog(t, d - 0.05, d + 0.6, ease.outCubic);
      if (on <= 0) return;
      const inc = rad(30 + n * 6);
      const hot = 1 + 1.5 * pulse(t, d, 0.3);
      let p: ReturnType<typeof P> | null = null;
      for (let i = 0; i <= 96 * on; i++) {
        const a = (i / 96) * Math.PI * 2;
        // a great circle inclined by inc to the equator, through lon 0
        const lat = Math.asin(Math.sin(inc) * Math.sin(a));
        const lon = Math.atan2(Math.cos(inc) * Math.sin(a), Math.cos(a));
        const q = P(lat, lon);
        if (p) seg(p, q, 2, [LIN.signal[0] * hot, LIN.signal[1] * hot, LIN.signal[2] * hot], n === this.degs.length - 1 || t < (this.degs[n + 1] ?? 1e9) ? 1 : 0.55);
        p = q;
      }
    });
    lb.render(renderer, out);

    const L = this.text, c = L.ctx; L.clear();
    // line 8 on an arc over the globe
    const fade8 = 1 - prog(t, this.l9.start - 0.3, this.l9.start + 0.3);
    if (fade8 > 0) drawArcKaraoke(c, this.l8, cx, cy, R + 64, rad(-90), t, { family: F.archivo(100, 700), size: 76, tracking: 0, sung: rgba('bone', 1), unsung: rgba('bone', 0.18), active: rgba('signal', 1), lead: 0.5, alpha: fade8 });
    // line 9 under the globe
    const a9 = 1 - prog(t, tEnd9 + 0.3, tEnd9 + 1.2);
    if (a9 > 0) {
      c.save(); c.globalAlpha = a9;
      drawKaraoke(c, this.l9, cx, 1010, t, { family: F.archivo(100, 700), size: 72, tracking: -1, sung: rgba('bone', 1), unsung: rgba('bone', 0.16), active: rgba('signal', 1), align: 'center', lead: 0.6 });
      c.restore();
    }
    // labels
    c.save(); c.globalAlpha = intro * (1 - recede);
    mono(c, 'GRATICULE 15° — ORTHOGRAPHIC', 120, 150, { size: 12, color: rgba('ash', 0.75), track: 3 });
    mono(c, `GREAT CIRCLES DRAWN  ${this.degs.filter((d) => d <= t).length}`, 120, 176, { size: 12, color: rgba('bone', 0.8), track: 3 });
    c.restore();
    drawHeading(c, 120, 990, heading(lyrics, t));
    comp.draw(renderer, L.upload(), out);
    const shake = this.degs.reduce((m, d) => Math.max(m, pulse(t, d, 0.08)), 0);
    void clamp; void H;
    return { ...rollPost(lyrics, t), bloom: 0.6, ca: 0.6, vignette: 0.42, shake: [shake * 4, shake * 2] as [number, number], zoom: 1 + shake * 0.01 };
  }
}
