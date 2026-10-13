// MAP — "I drew a map of every way to lose"
// The lamp writes "I drew a map" in a plotter's hand while the sheet behind it lights up only where
// the lamp has been. "of every way to" cuts through four old maps on the beat, a route on each, every
// route ending in a cross. On "lose" the last map turns out to be a labyrinth.
import type * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { Layer2D, clearRT } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { F, font, measure } from '../engine/type';
import { strokeText, drawStrokeText, writtenLength, type StrokeText } from '../engine/stroke';
import { Lyrics } from '../engine/lyrics';
import { ease, prog, clamp, lerp } from '../engine/util';
import { sparkHead, sparkParticles } from './_motifs';
import { PlateDrawer, loadImages, caption, charTimesWords, LIN, rgba, W, H, kc, LOOK, kb, wander, along, chaikin, routeLine, xMark, karaoke, beatsIn, slot, type Line } from './_kit';

const MAPS = ['33f4b2d9', 'ca21b201', 'c00ef074', '655e34ab'];
const IMG = { first: 'cma423518', laby: 'fef8f35c', monster: '6a8854a2' };

export default class MapScene extends Scene {
  L = new Layer2D();
  plates = new PlateDrawer();
  lb = new LineBatch(8000, { blend: 'add' });
  line!: Line;
  st!: StrokeText;
  times: [number, number][] = [];
  cuts: number[] = [];
  routes: { x: number; y: number }[][] = [];

  override async init() {
    await loadImages([...MAPS, ...Object.values(IMG)]);
    this.line = this.ctx.lyrics.get('I drew a map');
    const w = this.line.words;
    const ct = charTimesWords(w.slice(0, 4));
    this.st = strokeText(ct.text, 'hscript', 128, 0);
    this.times = ct.times;
    // the map cuts: one per beat-pair from "of" to "lose"
    const au = this.ctx.audio;
    this.cuts = beatsIn(au, w[4]!.start - 0.12, w[8]!.start - 0.05, 2);
    this.routes = MAPS.map((_, i) => chaikin(wander(11 + i, 260 + i * 60, 820 - i * 90, 1500 - i * 40, 260 + i * 120, 6, 0.32), 2));
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const { renderer, comp } = this.ctx;
    const t = f.t, w = this.line.words;
    clearRT(renderer, out, LIN.ink);
    const c = this.L.ctx; this.L.clear(); this.lb.clear();
    const tLose = w[8]!.start;
    let shake: [number, number] = [0, 0];

    // ---- part 1: the lamp writes "I drew a map" over Nolli's Rome, lit only around the lamp's trail
    const x0 = 150, y0 = 330;
    const len = writtenLength(this.st, this.times, t);
    let head = { x: x0, y: y0 };
    const p1 = t < this.cuts[0]!;
    if (p1) {
      this.plates.draw(renderer, out, IMG.first, { x: -60, y: -40, w: W + 120, h: H + 80, ...kb(t, f.start, this.cuts[0]!, 1.25, 1.4, -0.3, 0.1, 0, -0.2), ...LOOK.print,
        reveal: 'iris', rp: prog(t, f.start, this.cuts[0]!, ease.outCubic) * 0.9 + 0.05, rsoft: 0.5, rx: 0.3, ry: 0.35, alpha: 0.8, light: kc(0.55, LIN.bone) });
    }
    // ---- part 2: four maps, one per cut, a route walked on each
    const k = slot(this.cuts, t);
    if (!p1 && t < tLose) {
      const i = Math.min(k, MAPS.length - 1);
      const t0 = this.cuts[i]!, t1 = this.cuts[i + 1] ?? tLose;
      this.plates.draw(renderer, out, MAPS[i]!, { x: -40, y: -30, w: W + 80, h: H + 60, ...kb(t, t0, t1, 1.15, 1.32, (i % 2) * 0.6 - 0.3, 0.1, 0.2, -0.1), ...LOOK.print, light: kc(0.5, LIN.bone), seed: i });
      const fr = prog(t, t0, t1 - 0.06, ease.inOutCubic);
      const r = along(this.routes[i]!, fr);
      routeLine(this.lb, r.part, { w: 3, I: 1.8 });
      head = r.p;
      if (fr >= 1) xMark(this.lb, r.p.x, r.p.y, 16, 2.4, 3.5);
      // previous maps' routes as a faint record of the ways already found
      caption(c, MAPS[i]!, 96, H - 64, { color: rgba('bone', 0.55) });
      c.font = font(F.mono(500), 14); c.letterSpacing = '3px'; c.fillStyle = rgba('bone', 0.7);
      c.fillText(`WAY Nº ${String(i + 1).padStart(2, '0')}  ·  RESULT: LOSS`, 96, 96);
      c.letterSpacing = '0px';
    }
    // ---- part 3: "lose": the labyrinth, and a dead end pasted into the margin
    if (t >= tLose) {
      const kz = prog(t, tLose, f.end, ease.outCubic);
      this.plates.draw(renderer, out, IMG.laby, { x: -420, y: -420, w: W + 840, h: H + 840, rot: -kz * 0.25, zoom: 1.05 + kz * 0.5, panX: 0.4, panY: 0, ...LOOK.tone, gamma: 1.6, light: kc(0.42, LIN.bone), glow: 0.5, glowAt: 0.93 });
      const hit = prog(t, tLose + 0.12, tLose + 0.3, ease.outBack);
      if (hit > 0) {
        shake = [Math.sin(t * 90) * 6 * (1 - hit), Math.cos(t * 77) * 6 * (1 - hit)];
      }
      caption(c, IMG.laby, 96, H - 64, { color: rgba('bone', 0.55) });
      head = { x: W / 2 + Math.cos(t * 2.2) * 40 * (1 - kz), y: H / 2 + Math.sin(t * 2.2) * 40 * (1 - kz) };
    }

    // ---- the lyric: script line written by the lamp, then the rest in the grotesk
    const wrote = drawWriting(c, this.st, len, x0, y0, rgba('bone', 1), 4.2);
    if (wrote && len < this.st.total - 0.5) head = wrote;
    const rest = w.slice(4, 8);
    const fam = F.archivo(100, 900);
    if (t > rest[0]!.start - 0.4) {
      const by = 760;
      karaoke(c, rest, t, 150, by, fam, 120, { lit: rgba('bone', 1), dim: rgba('bone', 0.22), upper: true, gap: 0.26 });
      // LOSE: its own line, huge, in signal
      const wl = w[8]!;
      const p = Lyrics.wordProgress(wl, t);
      if (t > wl.start - 0.3) {
        const sz = 300 + 40 * prog(t, wl.start, wl.end, ease.outCubic);
        c.font = font(F.archivo(125, 900), sz);
        c.fillStyle = rgba('signal', 0.25 + 0.75 * Math.min(1, p * 3));
        c.fillText('LOSE', 140, by + sz * 0.82);
      }
    }
    sparkHead(this.lb, head.x, head.y, t, 1.1, 1);
    this.lb.render(renderer, out);
    comp.draw(renderer, this.L.upload(), out);
    return { bloom: 0.75, vignette: 0.45, shake };
  }
}

/** Draw the first `len` px of a stroke text at (x, y); returns the pen position in screen px. */
export function drawWriting(c: CanvasRenderingContext2D, st: StrokeText, len: number, x: number, y: number, col: string, lw = 2.6) {
  c.save(); c.translate(x, y);
  c.strokeStyle = col; c.lineWidth = lw; c.lineCap = 'round'; c.lineJoin = 'round';
  const h = drawStrokeText(c, st, len);
  c.restore();
  return h ? { x: x + h.x, y: y + h.y } : null;
}
