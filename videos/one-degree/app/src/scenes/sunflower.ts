// sunflower — the tag (instrumental, "whoa" backing). (Revision 2, replaces the corona.) A year of days as a
// sunflower: day n sits at the golden angle (137.5°) from day n−1, and each day's dot is 1% bigger than the last.
// Day one is a speck; day 365 is 37.8 times its size. The dots arrive faster and faster, breathing with the kick;
// in the last bars the flower closes back down into a single point.
import * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { Layer2D, clearRT, W, H } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { F, font } from '../engine/type';
import { LIN, rgba } from '../engine/palette';
import { clamp, ease, lerp, prog, pulse } from '../engine/util';
import { drawCompound, fmtGain, mono, needleTip, rollPost } from './_od';

const GOLD = (137.50776 * Math.PI) / 180;
const CX = W / 2 + 260, CY = H / 2;

export default class Sunflower extends Scene {
  lb = new LineBatch(1200);
  text = new Layer2D();

  render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer, comp, lyrics, audio } = this.ctx;
    const t = f.t;
    clearRT(renderer, out, LIN.ink);
    const lb = this.lb; lb.clear();
    const bar = (4 * 60) / audio.bpm;
    const close = prog(t, this.ctx.end - 1.5 * bar, this.ctx.end - 0.15, ease.inOutCubic);
    // days arrive accelerating (the curve again): all 365 by two bars before the end
    const u = prog(t, this.ctx.start + 0.1, this.ctx.end - 2 * bar, ease.linear);
    const n = Math.floor(365 * Math.pow(u, 1.8));
    const spin = t * 0.04;
    const C = 26; // spacing
    const s0 = 1.7; // day one's dot (px)
    const kick = f.a.kick;
    for (let i = 1; i <= n; i++) {
      const r = C * Math.sqrt(i) * (1 - close);
      const a = i * GOLD + spin;
      const x = CX + Math.cos(a) * r, y = CY + Math.sin(a) * r;
      const age = n - i;
      const size = s0 * Math.pow(1.01, i) * (1 - close * 0.9) * (1 + 0.06 * kick * clamp(i / 365));
      const fresh = clamp(1 - age / 24);
      const born = clamp((365 * Math.pow(u, 1.8) - i) / 3);
      const col: [number, number, number] = fresh > 0
        ? [lerp(LIN.bone[0], LIN.signal[0] * 1.5, fresh), lerp(LIN.bone[1], LIN.signal[1] * 1.5, fresh), lerp(LIN.bone[2], LIN.signal[2] * 1.5, fresh)]
        : i > 300 ? [LIN.ember[0] * 0.9, LIN.ember[1] * 0.9, LIN.ember[2] * 0.9] : LIN.bone;
      lb.seg2(x, y, x + 0.01, y, Math.max(1, size * born), col, i > 300 ? 0.9 : 0.55 + 0.35 * (i / 300));
    }
    if (close > 0.3) needleTip(lb, CX, CY, t, 0.8, (close - 0.3) / 0.7);
    lb.render(renderer, out);

    const T = this.text, c = T.ctx; T.clear();
    const a = 1 - close;
    c.save(); c.globalAlpha = a * prog(t, this.ctx.start, this.ctx.start + 0.8);
    c.font = font(F.archivo(100, 800), 64); c.letterSpacing = '-1px'; c.fillStyle = rgba('bone', 1);
    c.fillText('365 days,', 120, 300);
    c.fillText('each 1% bigger', 120, 372);
    c.fillText('than the last.', 120, 444);
    mono(c, 'DAY ONE', CX + 14, CY - 10, { size: 11, color: rgba('ash', 0.8), track: 3 });
    mono(c, `DAY ${n}`, 120, 540, { size: 14, color: rgba('ash', 0.9), track: 3 });
    mono(c, `SIZE ${fmtGain(Math.pow(1.01, n))} DAY ONE`, 120, 568, { size: 18, color: rgba('signal', 1), track: 2, weight: 500 });
    mono(c, 'ARRANGED AT THE GOLDEN ANGLE, 137.5°', 120, 600, { size: 11, color: rgba('ash', 0.7), track: 3 });
    c.restore();
    drawCompound(c, 120, 990, t, { ly: lyrics });
    comp.draw(renderer, T.upload(), out);
    void pulse;
    return { ...rollPost(lyrics, t), bloom: 0.65, ca: 0.5, vignette: 0.45 };
  }
}
