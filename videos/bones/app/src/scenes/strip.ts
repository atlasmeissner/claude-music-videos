// strip — chorus 1, "Take me down to the bones" / "Strip the gold and the stone". The drums come in.
// The façade, big. "Take me down": an X-ray scan line sweeps down the building, and everywhere it has passed
// the bones show through (the frame bright, the stone a ghost). "bones": they flare. "Strip the gold": the gold
// falls off in a cascade across the façade (and the word "gold" falls with it); "and the stone": the masonry
// drops course by course, top first (the word "stone" too), until only the frame stands.
import * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { Layer2D, clearRT } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { F } from '../engine/type';
import { LIN, rgba } from '../engine/palette';
import type { Line, Word } from '../engine/lyrics';
import { clamp, ease, lerp, prog, pulse } from '../engine/util';
import { drawFacade, drawLedger, drop, mono, point, scaleRGB, slamRows, titleBlock } from './_bones';
import { DOME } from './_facade';

const OX = 1235, OY = 925, S = 0.78;

export default class Strip extends Scene {
  lb = new LineBatch(45000);
  text = new Layer2D();
  l6!: Line; l7!: Line;
  tGold = 0; tStone = 0; tBones = 0;
  wGold!: Word; wStone!: Word;

  override init() {
    const { lyrics } = this.ctx;
    this.l6 = lyrics.lines[6]!; this.l7 = lyrics.lines[7]!;
    this.tGold = this.l7.words[0]!.start;
    this.wGold = this.l7.words[2]!; this.wStone = this.l7.words[5]!;
    this.tStone = this.l7.words[3]!.start;
    this.tBones = this.l6.words[5]!.start;
  }

  render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer, comp, lyrics, audio } = this.ctx;
    const t = f.t, s0 = this.ctx.start;
    clearRT(renderer, out, LIN.ink);
    const lb = this.lb; lb.clear();
    const T = this.text, c = T.ctx; T.clear();
    // the scan: from above the lantern down to the ground over "Take me down"
    const w6 = this.l6.words;
    const scanY = lerp(DOME.lantern - 40, 30, prog(t, w6[0]!.start, w6[2]!.end + 0.15, ease.inOutCubic));
    const flare = pulse(t, this.tBones, 0.5);
    const xr = (y: number) => (y < scanY ? 1 : 0); // above the scan line: x-rayed
    const kick = f.a.kick;
    const s = S * (1 + kick * 0.006) + (t - s0) * 0.004;
    drawFacade(lb, {
      ox: OX, oy: OY, s,
      alpha: { gold: 1, stone: 0.75, frame: 1, found: 0.8 },
      rgb: { frame: scaleRGB(LIN.bone, 1.05 + flare * 0.3) },
      wk: { frame: 1.1 },
      xf: (m) => {
        const x = xr(m.cy);
        if (m.layer === 'frame') return [0, 0, 0, x * (0.9 + 0.1 * flare)];
        if (m.layer === 'found') return [0, 0, 0, 1];
        // release times: gold sweeps across left to right over ~1.2 s; stone top first over ~1.4 s
        const tr = m.layer === 'gold'
          ? this.tGold + 0.05 + ((m.cx + 800) / 1600) * 1.1 + m.r * 0.25
          : this.tStone + ((m.cy - DOME.lantern) / (0 - DOME.lantern)) * 1.3 + m.r * 0.12;
        const [dy, rot, al] = drop(t, tr, m.r, 2200 / s, 1.1);
        const ghost = x ? (m.layer === 'gold' ? 0.35 : 0.28) : 1;
        return [0, dy, rot, al * ghost];
      },
    });
    // the scan line itself
    if (scanY > DOME.lantern - 30 && scanY < 25) {
      const yy = OY + scanY * s;
      lb.seg2(OX - 820 * s, yy, OX + 820 * s, yy, 1.4, scaleRGB(LIN.signal, 1.6), 0.9);
      lb.seg2(OX - 820 * s, yy, OX + 820 * s, yy, 9, scaleRGB(LIN.signal, 0.25), 0.4);
    }
    point(lb, OX, OY, t, 1);
    lb.render(renderer, out);

    // type: two lines, three rows each, stacked left
    const fam = F.archivo(62, 900), size = 168;
    const st = { family: fam, size, tracking: -2, upper: true };
    if (t < this.l7.words[0]!.start - 0.05) {
      const out6 = 0;
      slamRows(c, [{ words: w6.slice(0, 2), x: 110, y: 330 - out6 }, { words: w6.slice(2, 4), x: 110, y: 500 - out6 }, { words: w6.slice(4), x: 110, y: 670 - out6 }], t, st);
    } else {
      const w7 = this.l7.words;
      slamRows(c, [{ words: w7.slice(0, 2), x: 110, y: 330 }, { words: w7.slice(2, 4), x: 110, y: 500 }, { words: w7.slice(4), x: 110, y: 670 }], t, {
        ...st,
        xf: (w) => {
          if (w === this.wGold) { const [dy, rot, a] = drop(t, w.end + 0.35, 0.8, 2600, 1.2); return { dy, rot, alpha: a, color: t < w.end + 0.35 ? rgba('gold', 1) : rgba('gold', 1) }; }
          if (w === this.wStone) { const [dy, rot, a] = drop(t, w.end + 0.45, 0.25, 2600, 1.2); return { dy, rot, alpha: a }; }
          return {};
        },
      });
    }
    mono(c, 'X-RAY · SECTION AT THE BONES', 112, 740, { size: 12, color: rgba('ash', 0.85 * prog(t, w6[2]!.start, w6[2]!.start + 0.5)), track: 3 });
    const gone = prog(t, this.tGold, this.tGold + 1.6);
    mono(c, `GOLD  ${Math.round(100 * (1 - gone))}%`, 112, 770, { size: 12, color: rgba('gold', 0.95 * prog(t, this.tGold, this.tGold + 0.3)), track: 3 });
    const sg = prog(t, this.tStone, this.tStone + 1.6);
    mono(c, `STONE ${Math.round(100 * (1 - sg))}%`, 112, 792, { size: 12, color: rgba('bone', 0.85 * prog(t, this.tStone, this.tStone + 0.3)), track: 3 });
    drawLedger(c, lyrics, audio, 120, 1012, t);
    titleBlock(c, 'D-301', 'STRIP-OUT', [['SCALE', 'INHERITED'], ['INSTRUMENTS', '+ DRUMS']], {});
    comp.draw(renderer, T.upload(), out);
    void clamp;
    return { bloom: 0.75, ca: 0.6 + kick * 0.8, vignette: 0.45, shake: [kick * 5, kick * 3] as [number, number], flash: flare * 0.006 };
  }
}
