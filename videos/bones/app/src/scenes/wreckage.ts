// wreckage — the bridge, whispered. "I stood in the wreckage and I finally saw" / "The only foundation was
// never the wall". Quiet: the old façade's stone and gold lie in a heap on the ground line, the point standing
// in it. On "saw" the drawing becomes a section: the ghost of the wall above, and below the ground the strata
// down to bedrock — under the wall, nothing (FOUNDATION: NONE); under the point, the rock. ASSUMED reaches 0.
// "foundation": the bedrock line lights; "wall": the ghost of the wall goes out.
import * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { Layer2D, clearRT } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { F } from '../engine/type';
import { LIN, rgba } from '../engine/palette';
import type { Line } from '../engine/lyrics';
import { clamp, ease, hash, lerp, prog, pulse } from '../engine/util';
import { drawFacade, drawFlow, drawLedger, mono, point, ring, scaleRGB, titleBlock } from './_bones';

const OX = 1180, GY = 600;
const STRATA = [70, 150, 250, 340];

export default class Wreckage extends Scene {
  lb = new LineBatch(40000);
  text = new Layer2D();
  l24!: Line; l25!: Line;

  override init() {
    const { lyrics } = this.ctx;
    this.l24 = lyrics.lines[24]!; this.l25 = lyrics.lines[25]!;
  }

  render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer, comp, lyrics, audio } = this.ctx;
    const t = f.t, s0 = this.ctx.start;
    clearRT(renderer, out, LIN.ink);
    const lb = this.lb; lb.clear();
    const saw = this.l24.words[this.l24.words.length - 1]!;
    const fnd = this.l25.words.find((w) => w.w.toLowerCase() === 'foundation')!;
    const wall = this.l25.words[this.l25.words.length - 1]!;
    const sec = prog(t, saw.start, saw.start + 0.8, ease.inOutCubic);
    const s = lerp(0.5, 0.54, prog(t, s0, this.ctx.end));
    const gone = prog(t, wall.start, wall.end + 0.6, ease.inCubic);
    // the ghost of the wall (only in section)
    if (sec > 0 && gone < 1) {
      const fl = 1 - gone * (0.6 + 0.4 * Math.sin(t * 40));
      drawFacade(lb, { ox: OX, oy: GY, s, alpha: { gold: 0, stone: 0.16 * sec * fl, frame: 0, found: 0 } });
      // under the wall: nothing
      for (const x of [-770, -440, 440, 770]) lb.seg2(OX + x * s, GY, OX + x * s, GY + 22, 1, LIN.signal, 0.5 * sec * (1 - gone));
    }
    // the rubble heap: every stone and gold piece lying where it fell
    drawFacade(lb, {
      ox: OX, oy: GY, s,
      alpha: { gold: 0.55 * (1 - sec * 0.5), stone: 0.4 * (1 - sec * 0.5), frame: 0, found: 0.9 },
      xf: (m) => {
        if (m.layer === 'found') return [0, 0, 0, 1];
        const r1 = hash(m.g, 11), r2 = hash(m.g, 12), r3 = hash(m.g, 13);
        const tx = m.cx * 0.8 + (r1 - 0.5) * 900, ty = -6 - Math.pow(r2, 4) * 90 * (1 - Math.abs(m.cx) / 1600);
        const rot = r3 < 0.3 ? (r3 < 0.15 ? 1.5708 : -1.5708) + (r2 - 0.5) * 0.3 : (r3 - 0.65) * 0.5;
        return [tx - m.cx, ty - m.cy, rot, 1];
      },
    });
    // the section below ground
    if (sec > 0) {
      for (let i = 0; i < STRATA.length; i++) {
        const y = GY + STRATA[i]! * sec;
        const bed = i === STRATA.length - 1;
        const hot = bed ? prog(t, fnd.start, fnd.end, ease.outCubic) : 0;
        const n = 60;
        for (let k = 0; k < n; k++) {
          const x0 = lerp(260, 1820, k / n), x1 = lerp(260, 1820, (k + 1) / n);
          const yy0 = y + 6 * Math.sin(x0 * 0.01 + i * 2), yy1 = y + 6 * Math.sin(x1 * 0.01 + i * 2);
          const lit = hot > 0 ? clamp(hot * 1.6 - Math.abs((x0 - OX) / 900)) : 0;
          lb.seg2(x0, yy0, x1, yy1, bed ? 1.6 : 0.9, lit > 0 ? scaleRGB(LIN.signal, 1 + lit) : LIN.ash, (bed ? 0.8 : 0.35) * sec + lit * 0.5);
        }
        // bedrock hatching
        if (bed) for (let x = 270; x < 1820; x += 14) lb.seg2(x, y + 12, x - 18, y + 40, 0.8, LIN.graphite, 0.6 * sec);
      }
      // the bore from the point to bedrock: the real foundation
      const by = GY + STRATA[STRATA.length - 1]! * sec;
      lb.seg2(OX, GY, OX, by, 1.2, LIN.signal, 0.7 * sec);
      point(lb, OX, by, t, 0.8, sec);
    }
    point(lb, OX, GY - 4, t, 1);
    ring(lb, OX, GY - 4, t, saw.start, { rgb: LIN.signal, speed: 340, life: 1.6, alpha: 0.6 });
    lb.render(renderer, out);

    const T = this.text, c = T.ctx; T.clear();
    const st = { family: F.serif(400, true), size: 74, tracking: 0, sung: rgba('bone', 1), unsung: rgba('bone', 0.15), active: rgba('signal', 1), lead: 0.6 };
    const row = (l: Line, a: number, b: number, y: number) => drawFlow(c, { ...l, words: l.words.slice(a, b), start: l.words[a]!.start } as Line, 110, y, t, st);
    row(this.l24, 0, 5, 170); row(this.l24, 5, 9, 254);
    row(this.l25, 0, 3, 380); row(this.l25, 3, 7, 464);
    if (sec > 0) {
      mono(c, 'FOUNDATION: NONE', OX - 770 * s, GY + 46, { size: 11, color: rgba('signal', 0.9 * sec * (1 - gone)), track: 3, align: 'center' });
      mono(c, 'FOUNDATION: NONE', OX + 770 * s, GY + 46, { size: 11, color: rgba('signal', 0.9 * sec * (1 - gone)), track: 3, align: 'center' });
      mono(c, 'BEDROCK · THE ONLY FOUNDATION', OX + 24, GY + STRATA[3]! * sec - 14, { size: 12, color: rgba('bone', 0.9 * prog(t, fnd.start, fnd.start + 0.4)), track: 3, weight: 500 });
      mono(c, 'SECTION A–A', 262, GY - 16, { size: 11, color: rgba('ash', 0.8 * sec), track: 3 });
    }
    mono(c, 'RUBBLE · WHAT WAS SHOWN', 262, GY + 30 - sec * 60, { size: 11, color: rgba('ash', 0.7 * (1 - sec)), track: 3 });
    const z = pulse(t, saw.start, 0.8);
    drawLedger(c, lyrics, audio, 120, 1012, t);
    titleBlock(c, sec > 0.5 ? 'S-000' : 'D-999', sec > 0.5 ? 'SECTION: WHAT HOLDS' : 'WRECKAGE', [['SCALE', '1:1'], ['ASSUMED', sec > 0.5 ? 'NOTHING' : 'STILL SOME']]);
    comp.draw(renderer, T.upload(), out);
    return { bloom: 0.7, ca: 0.4, vignette: 0.55, flash: 0 };
    void z;
  }
}
