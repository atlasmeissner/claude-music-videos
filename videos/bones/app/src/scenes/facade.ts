// facade — verse 1, "They built these walls before I got here" / "Told me this is just the shape of things".
// A: from the point left by the intro the camera pulls back and back: the point is a speck at the foot of an
//    enormous gilded façade, already standing. The line arrives a word at a time in the sky above it.
// B: hard cut to the plan, the drawing that says what shape things are: grid, walls, columns, the dome
//    overhead. On "shape" the perimeter is traced in signal. Deadpan existing-conditions notes.
import * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { Layer2D, clearRT, W } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { F } from '../engine/type';
import { LIN, rgba } from '../engine/palette';
import type { Line } from '../engine/lyrics';
import { clamp, ease, lerp, prog } from '../engine/util';
import { drawFacade, drawKaraoke, drawLedger, drawPlan, mono, point, POINT0, ring, titleBlock } from './_bones';
import { PLAN_WALLS } from './_facade';

export default class Facade extends Scene {
  lb = new LineBatch(30000);
  text = new Layer2D();
  l0!: Line; l1!: Line;
  tB = 0;

  override init() {
    const { lyrics, audio } = this.ctx;
    this.l0 = lyrics.lines[0]!; this.l1 = lyrics.lines[1]!;
    this.tB = audio.timeOfBeat(Math.floor(audio.beatAt(this.l1.words[0]!.start + 0.02)) - 1);
  }

  render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer, comp, lyrics, audio } = this.ctx;
    const t = f.t, s0 = this.ctx.start;
    clearRT(renderer, out, LIN.ink);
    const lb = this.lb; lb.clear();
    const T = this.text, c = T.ctx; T.clear();
    const B = t >= this.tB;

    if (!B) {
      // ---- A: the pull-back
      const k = prog(t, s0, s0 + 2.4, ease.outExpo);
      const s = Math.exp(lerp(Math.log(4.2), Math.log(0.64), k));
      const m = ease.inOutCubic(prog(t, s0 + 0.1, s0 + 1.9));
      const ox = lerp(W / 2, 1220, m), oy = lerp(POINT0.y, 925, m);
      const drift = (t - s0) * 3; // a slow settle after the pull
      drawFacade(lb, { ox, oy: oy + drift * 0.4, s: s * (1 + (t - s0) * 0.004), alpha: { gold: 0.95, stone: 0.72, found: 0.8 } });
      point(lb, ox, oy + drift * 0.4, t, 0.9);
      ring(lb, ox, oy + drift * 0.4, t, s0, { r0: 10, speed: 160, life: 1.6, rgb: LIN.signal, alpha: 0.6 });
      lb.render(renderer, out);
      const fam = F.archivo(100, 700);
      const words = this.l0.words;
      // two rows: "They built these walls" / "before I got here"
      const split = 4;
      const r1 = { ...this.l0, text: words.slice(0, split).map((w) => w.w).join(' '), words: words.slice(0, split) } as Line;
      const r2 = { ...this.l0, text: words.slice(split).map((w) => w.w).join(' '), words: words.slice(split), start: words[split]!.start } as Line;
      const st = { family: fam, size: 92, tracking: -2, sung: rgba('bone', 1), unsung: '', active: rgba('signal', 1), mode: 'reveal' as const, lead: 0.3 };
      drawKaraoke(c, r1, 120, 190, t, st);
      drawKaraoke(c, r2, 120, 300, t, st);
      const n = prog(t, s0 + 1.2, s0 + 2.0, ease.outCubic);
      mono(c, 'EXISTING CONDITIONS · NORTH ELEVATION', 122, 352, { size: 12, color: rgba('ash', 0.85 * n), track: 3 });
      mono(c, 'BUILT  BEFORE YOU', 1800, 160, { size: 11, color: rgba('ash', 0.8 * n), track: 3, align: 'right' });
      mono(c, 'ARCHITECT  UNKNOWN', 1800, 182, { size: 11, color: rgba('ash', 0.8 * n), track: 3, align: 'right' });
      mono(c, 'FINISH  GOLD LEAF ON STONE', 1800, 204, { size: 11, color: rgba('gold', 0.95 * n), track: 3, align: 'right' });
      // "you are here"
      const yh = prog(t, s0 + 2.6, s0 + 3.2, ease.outCubic) * (1 - prog(t, this.tB - 0.4, this.tB));
      if (yh > 0) {
        c.save(); c.globalAlpha = yh;
        c.strokeStyle = rgba('signal', 0.9); c.lineWidth = 1;
        c.beginPath(); c.moveTo(ox + 14, oy + drift * 0.4 - 10); c.lineTo(ox + 90, oy + drift * 0.4 - 46); c.lineTo(ox + 160, oy + drift * 0.4 - 46); c.stroke();
        mono(c, 'YOU', ox + 96, oy + drift * 0.4 - 54, { size: 12, color: rgba('signal', 1), track: 3, weight: 500 });
        c.restore();
      }
    } else {
      // ---- B: the plan
      const k = prog(t, this.tB, this.tB + 1.6, ease.outCubic);
      const s = lerp(0.62, 0.66, prog(t, this.tB, this.ctx.end));
      const ox = W / 2 + 60, oy = 470 - 240 * s;
      drawPlan(c, { ox, oy, s, p: k, ink: rgba('bone', 0.88), gridInk: rgba('ash', 0.55) });
      // "shape": the perimeter traced in signal
      const shape = this.l1.words.find((w) => w.w.toLowerCase() === 'shape')!;
      const sp = prog(t, shape.start, shape.start + 1.1, ease.inOutCubic);
      if (sp > 0) {
        const per: [number, number][] = [[-770, 0], [-440, 0], [-440, 120], [440, 120], [440, 0], [770, 0], [770, 520], [440, 520], [440, 600], [-440, 600], [-440, 520], [-770, 520], [-770, 0]];
        let L = 0; const seg: number[] = [];
        for (let i = 1; i < per.length; i++) { const d = Math.hypot(per[i]![0] - per[i - 1]![0], per[i]![1] - per[i - 1]![1]); seg.push(d); L += d; }
        let left = L * sp;
        c.save(); c.strokeStyle = rgba('signal', 1); c.lineWidth = 2.2; c.beginPath();
        c.moveTo(ox + per[0]![0] * s, oy + per[0]![1] * s);
        let hx = 0, hy = 0;
        for (let i = 1; i < per.length && left > 0; i++) {
          const u = Math.min(1, left / seg[i - 1]!);
          hx = per[i - 1]![0] + (per[i]![0] - per[i - 1]![0]) * u; hy = per[i - 1]![1] + (per[i]![1] - per[i - 1]![1]) * u;
          c.lineTo(ox + hx * s, oy + hy * s);
          left -= seg[i - 1]!;
        }
        c.stroke(); c.restore();
        if (sp < 1) point(lb, ox + hx * s, oy + hy * s, t, 0.8);
      }
      // the point: at the door
      point(lb, ox, oy - 40 * s, t, 0.8, k);
      lb.render(renderer, out);
      // the lyric: the plan's caption
      drawKaraoke(c, this.l1, 120, 920, t, { family: F.archivo(100, 700), size: 78, tracking: -1.5, sung: rgba('bone', 1), unsung: rgba('bone', 0.16), active: rgba('signal', 1), lead: 0.5 });
      const n = prog(t, this.tB + 0.6, this.tB + 1.4, ease.outCubic);
      mono(c, 'GROUND FLOOR PLAN · AS INHERITED', 122, 968, { size: 12, color: rgba('ash', 0.85 * n), track: 3 });
      mono(c, `WALLS  ${PLAN_WALLS.length}`, 1800, 160, { size: 11, color: rgba('ash', 0.8 * n), track: 3, align: 'right' });
      mono(c, 'LOAD-BEARING  ASSUMED', 1800, 182, { size: 11, color: rgba('ash', 0.8 * n), track: 3, align: 'right' });
      mono(c, 'REASON  “THAT’S JUST HOW IT IS”', 1800, 204, { size: 11, color: rgba('ash', 0.8 * n), track: 3, align: 'right' });
    }
    const la = prog(t, s0 + 1.6, s0 + 2.4);
    drawLedger(c, lyrics, audio, 120, 1012, t, { alpha: la });
    titleBlock(c, B ? 'D-102' : 'D-101', B ? 'PLAN' : 'ELEVATION', [['SCALE', 'INHERITED'], ['STATUS', 'EXISTING']], { alpha: la });
    comp.draw(renderer, T.upload(), out);
    void clamp;
    return { bloom: 0.7, ca: 0.5, vignette: 0.45 };
  }
}
