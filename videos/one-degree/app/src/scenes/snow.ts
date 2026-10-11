// snow — "And the mountain doesn't know" / "It was built by falling snow".
// Flakes fall and settle; each eighth note lays down one more stratum, and the strata stack into an engraved
// mountain whose summit carries the warm tip. LAYERS / YEARS readouts.
import * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { Layer2D, clearRT, W, H } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { F } from '../engine/type';
import { LIN, rgba } from '../engine/palette';
import type { Line } from '../engine/lyrics';
import { clamp, ease, hash, noise1, prog } from '../engine/util';
import { drawHeading, drawKaraoke, heading, mono, needleTip, rollPost } from './_od';

const BASE = 1000;
const NFLAKE = 700;

export default class Snow extends Scene {
  lb = new LineBatch(30000);
  text = new Layer2D();
  l14!: Line; l15!: Line;

  override init() {
    const ly = this.ctx.lyrics;
    this.l14 = ly.lines[14]!; this.l15 = ly.lines[15]!;
  }

  /** The mountain's final shape (0..1 height) at x. */
  shape(x: number) {
    const g = (c: number, w: number, h: number) => h * Math.exp(-(((x - c) / w) ** 2));
    return Math.max(0, (g(1250, 300, 1) + g(1600, 240, 0.5) + g(880, 280, 0.38) + (noise1(x * 0.012, 4) - 0.5) * 0.06) / 1.08);
  }

  render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer, comp, lyrics, audio } = this.ctx;
    const t = f.t;
    clearRT(renderer, out, LIN.ink);
    const lb = this.lb; lb.clear();
    // growth: slow, accelerating through "built by falling snow"
    const g = 0.04 + 0.96 * Math.pow(prog(t, this.ctx.start, this.l15.end, ease.linear), 1.7);
    const Hmax = 580;
    const eighth = 30 / audio.bpm;
    const layers = Math.max(1, Math.floor((t - this.ctx.start) / eighth) + 1);
    const top = (x: number, k: number) => BASE - this.shape(x) * Hmax * g * k;
    // strata: contour lines at fractions of the current height, newest at the top
    const NL = Math.min(layers, 46);
    for (let j = 1; j <= NL; j++) {
      const k = j / NL;
      const newest = j === NL;
      let px = 0, py = top(0, k);
      for (let x = 10; x <= W + 10; x += 10) {
        const y = top(x, k) + (noise1(x * 0.03 + j * 7.1, j) - 0.5) * 3 * (1 - k);
        if (BASE - y > 2 || BASE - py > 2) lb.seg2(px, py, x, y, newest ? 1.6 : 1, newest ? LIN.bone : LIN.bone, newest ? 0.95 : 0.22 + 0.4 * k);
        px = x; py = y;
      }
    }
    lb.seg2(0, BASE, W, BASE, 1.2, LIN.bone, 0.7);
    // summit tip
    let sx = 0, sy = BASE;
    for (let x = 900; x < 1600; x += 4) { const y = top(x, 1); if (y < sy) { sy = y; sx = x; } }
    needleTip(lb, sx, sy - 4, t, 0.8, 0.5 + 0.5 * g);
    // flakes: falling, swaying; settled once they reach the surface
    for (let i = 0; i < NFLAKE; i++) {
      const sp = 60 + hash(i, 1) * 90;
      const ph = hash(i, 2) * 30;
      const y = ((t + ph) * sp) % (H + 40) - 20;
      const x = (hash(i, 3) * (W + 200) - 100) + Math.sin(t * (0.6 + hash(i, 4)) + i) * 18;
      if (y > top(x, 1) - 1) continue;
      const s = 1 + hash(i, 5) * 2.2;
      lb.seg2(x, y, x + 0.01, y + 0.5, s, LIN.bone, 0.35 + hash(i, 6) * 0.5);
    }
    lb.render(renderer, out);

    const L = this.text, c = L.ctx; L.clear();
    const st = { family: F.archivo(100, 700), size: 84, tracking: -1, sung: rgba('bone', 1), unsung: rgba('bone', 0.16), active: rgba('signal', 1), lead: 0.5 } as const;
    drawKaraoke(c, this.l14, 120, 250, t, st);
    drawKaraoke(c, this.l15, 120, 350, t, { ...st, lead: 1.0 });
    const yrs = Math.round(layers * 137);
    mono(c, `LAYERS  ${layers}`, W - 120, 150, { size: 14, color: rgba('bone', 0.85), track: 3, align: 'right', weight: 500 });
    mono(c, `${yrs.toLocaleString('en-US')} WINTERS`, W - 120, 176, { size: 12, color: rgba('ash', 0.8), track: 3, align: 'right' });
    mono(c, `SUMMIT ${Math.round((BASE - sy) * 6.9).toLocaleString('en-US')} m`, sx + 18, sy - 22, { size: 12, color: rgba('signal', clamp(g * 3)), track: 2 });
    drawHeading(c, 120, 990 - 50, heading(lyrics, t));
    comp.draw(renderer, L.upload(), out);
    return { ...rollPost(lyrics, t), bloom: 0.55, ca: 0.5, vignette: 0.45 };
  }
}
