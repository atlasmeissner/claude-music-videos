// outro — "Take me down", the last line, and the end. The nave in section, in bone lines on black, as it was
// built. Through the long held "Take" the farthest members begin to draw back toward the point it was set out
// from; on "me" the rest follow; on "down" everything is home: one point, ringing like the first piano note.
// Then the title, and black.
import * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { Layer2D, clearRT, W } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { F, font } from '../engine/type';
import { LIN, rgba } from '../engine/palette';
import type { Line } from '../engine/lyrics';
import { clamp, ease, lerp, prog } from '../engine/util';
import { drawFlow, mono, point, ring, scaleRGB } from './_bones';
import { NAVE, type Seg3 } from './_frame3d';

const OX = 1460, OY = 800, S = 19; // side section: x = OX + z*S (nave runs left), y = OY - y*S

export default class Outro extends Scene {
  lb = new LineBatch(4000);
  text = new Layer2D();
  l31!: Line;
  segs: { s: Seg3; ra: number; rb: number }[] = [];

  override init() {
    const { lyrics } = this.ctx;
    this.l31 = lyrics.lines[31]!;
    const side = NAVE.filter((s) => s.a[0] <= 0.4 && s.b[0] <= 0.4 && s.stage >= 0);
    const P = (p: [number, number, number]) => [OX + p[2] * S, OY - p[1] * S] as const;
    const d = (p: [number, number, number]) => { const [x, y] = P(p); return Math.hypot(x - OX, y - OY); };
    const dmax = Math.max(...side.map((s) => Math.max(d(s.a), d(s.b))));
    this.segs = side.map((s) => ({ s, ra: d(s.a) / dmax, rb: d(s.b) / dmax }));
  }

  render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer, comp } = this.ctx;
    const t = f.t, s0 = this.ctx.start, e = this.ctx.end;
    clearRT(renderer, out, LIN.ink);
    const w = this.l31.words;
    const tTake = w[0]!.start, tMe = w[1]!.start, tDown = w[2]!.start;
    // collapse progress: slow through the held "Take", faster from "me", home on "down"
    const K = 0.35 * prog(t, tTake, tMe, ease.inQuad) + 0.65 * prog(t, tMe, tDown + 0.15, ease.inCubic);
    const lb = this.lb; lb.clear();
    const intro = prog(t, s0, s0 + 0.6, ease.outCubic);
    for (const { s, ra, rb } of this.segs) {
      const ka = ease.inOutCubic(clamp(K * 1.6 - (1 - ra) * 0.6)), kb = ease.inOutCubic(clamp(K * 1.6 - (1 - rb) * 0.6));
      const ax = lerp(OX + s.a[2] * S, OX, ka), ay = lerp(OY - s.a[1] * S, OY, ka);
      const bx = lerp(OX + s.b[2] * S, OX, kb), by = lerp(OY - s.b[1] * S, OY, kb);
      const hot = Math.max(ka, kb);
      lb.seg2(ax, ay, bx, by, s.w * 0.8, hot > 0.02 && hot < 0.98 ? scaleRGB(LIN.signal, 1.4) : LIN.bone, 0.85 * intro * (1 - Math.max(0, (ka + kb) / 2 - 0.9) * 10));
    }
    // ground line retracts too
    const gl = 1 - K;
    lb.seg2(OX - 1050 * gl, OY, OX + 160 * gl, OY, 1.2, LIN.bone, 0.8 * intro * gl);
    // the point, and on "down" its ring, like the first note
    const home = prog(t, tDown + 0.1, tDown + 0.5, ease.outCubic);
    const px = lerp(OX, W / 2, ease.inOutCubic(prog(t, tDown + 0.3, tDown + 1.6))), py = lerp(OY, 560, ease.inOutCubic(prog(t, tDown + 0.3, tDown + 1.6)));
    const fade = 1 - prog(t, e - 1.2, e - 0.1, ease.inQuad);
    point(lb, px, py, t, 1 + home * 0.4, fade);
    ring(lb, px, py, t, tDown + 0.12, { rgb: LIN.signal, speed: 260, life: 2.4, alpha: 0.8 });
    ring(lb, px, py, t, tDown + 0.5, { rgb: LIN.bone, speed: 160, life: 3, alpha: 0.4 });
    lb.render(renderer, out);
    const T = this.text, c = T.ctx; T.clear();
    // the line, quiet, in the title's face
    const la = 1 - prog(t, tDown + 1.2, tDown + 2.0);
    if (la > 0) {
      c.save(); c.globalAlpha = la;
      drawFlow(c, this.l31, W / 2, 200, t, { family: F.archivo(125, 300), size: 96, tracking: 3, sung: rgba('bone', 1), unsung: rgba('bone', 0.14), active: rgba('signal', 1), lead: 0.8, align: 'center' });
      c.restore();
    }
    // title card
    const ta = prog(t, tDown + 1.6, tDown + 2.6, ease.outCubic) * fade;
    if (ta > 0) {
      c.save(); c.globalAlpha = ta;
      c.font = font(F.archivo(125, 300), 150); c.letterSpacing = '38px'; c.textAlign = 'center'; c.fillStyle = rgba('bone', 1);
      c.fillText('BONES', W / 2 + 19, 780);
      c.restore();
      mono(c, 'JOBURGALEX', W / 2, 846, { size: 15, weight: 500, color: rgba('bone', 0.85 * ta), track: 9, align: 'center' });
      mono(c, 'MAPS & TERRITORY · TRACK 01', W / 2, 874, { size: 11, color: rgba('ash', 0.75 * ta), track: 5, align: 'center' });
      mono(c, 'MUSIC MADE WITH SUNO · VIDEO RENDERED IN CODE', W / 2, 980, { size: 11, color: rgba('ash', 0.55 * ta), track: 4, align: 'center' });
    }
    comp.draw(renderer, T.upload(), out);
    return { bloom: 0.8, ca: 0.4, vignette: 0.5, fade: prog(t, e - 0.7, e, ease.inQuad) };
  }
}
