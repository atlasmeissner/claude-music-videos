// NAMES — "I learned the dark by name / Every shadow, every flame"
// A specimen sheet of darkness: eight plates of night, each pinned and given a deadpan Latin name as
// the lamp passes over it. "Every shadow": silhouettes, cut on the beat. "every flame": one flame, then
// the backing vocals echo it and the flames multiply on every bar (1, 2, 4, 8, 16) until the sheet is
// white-hot — and the chorus turns everything inside out.
import type * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { Layer2D, clearRT } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { F, font, measure } from '../engine/type';
import { Lyrics } from '../engine/lyrics';
import { ease, prog, clamp, lerp, hash } from '../engine/util';
import { sparkHead } from './_motifs';
import { PlateDrawer, loadImages, caption, LIN, rgba, W, H, kc, LOOK, kb, karaoke, beatsIn, slot, type Line } from './_kit';

const DARK = ['cma133655', 'cma149107', 'cma171329', '259f07b1', 'cma133653', 'cma166783', 'cma160085', 'cma128842'];
const NAMES = ['Tenebrae domesticae', 'Nox perpetua', 'Umbra vulgaris', 'Spelunca muta', 'Somnus rationis', 'Obscuritas minor', 'Caligo nocturna', 'Lux ultima'];
const SHADOW = ['65d44a67', '8e88db11', 'c328d75c', '9ba4c00f'];
const FLAME = ['fcbb40f9', 'a62d9d4f', '8e245a54', '0bf6489d', '9f2efb79', 'b104f970'];

export default class Names extends Scene {
  L = new Layer2D();
  plates = new PlateDrawer();
  lb = new LineBatch(3000, { blend: 'add' });
  l1!: Line; l2!: Line;
  pins: number[] = [];
  shadowCuts: number[] = [];
  bars: number[] = [];
  override async init() {
    await loadImages([...DARK, ...SHADOW, ...FLAME]);
    const ly = this.ctx.lyrics, au = this.ctx.audio;
    this.l1 = ly.get('I learned the dark'); this.l2 = ly.get('Every shadow');
    this.pins = DARK.map((_, i) => au.timeOfBeat(Math.ceil(au.beatAt(this.l1.words[0]!.start - 0.1)) + i));
    const w2 = this.l2.words;
    this.shadowCuts = [w2[0]!.start - 0.04, ...beatsIn(au, w2[0]!.start + 0.2, w2[2]!.start - 0.1, 1)];
    this.bars = au.downbeats.filter((d) => d >= w2[2]!.start - 0.4 && d < this.ctx.end);
  }
  cell(i: number) { const cw = 400, ch = 290, gx = 24, gy = 70; const x0 = (W - (4 * cw + 3 * gx)) / 2, y0 = 250; return { x: x0 + (i % 4) * (cw + gx), y: y0 + Math.floor(i / 4) * (ch + gy), w: cw, h: ch }; }
  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const { renderer, comp } = this.ctx;
    const t = f.t, w1 = this.l1.words, w2 = this.l2.words;
    clearRT(renderer, out, LIN.ink);
    const c = this.L.ctx; this.L.clear(); this.lb.clear();
    const tShadow = w2[0]!.start, tFlame = w2[2]!.start;
    let exposure = 1, flash = 0;
    if (t < tShadow - 0.05) {
      // the specimen sheet
      let lamp = { x: W / 2, y: 180 };
      DARK.forEach((id, i) => {
        const tp = this.pins[i]!, k = prog(t, tp, tp + 0.1, ease.outCubic);
        if (k <= 0) return;
        const r = this.cell(i);
        const lit = Math.pow(0.5, Math.max(0, t - tp) / 0.25);
        this.plates.draw(renderer, out, id, { ...r, ...(id.startsWith('cma') ? LOOK.tone : LOOK.photo), gamma: id.startsWith('cma') ? 1.4 : 1.05, light: kc(0.55 + 0.4 * lit, LIN.bone), alpha: k, border: 0.5, seed: i, glow: 0.4 * lit, glowAt: 0.8 });
        c.font = font(F.mono(500), 13); c.letterSpacing = '2px'; c.fillStyle = rgba('bone', 0.8 * k);
        c.fillText(`FIG. ${i + 1}`, r.x, r.y + r.h + 22);
        c.font = font(F.serif(400, true), 24); c.letterSpacing = '0px'; c.fillStyle = rgba(lit > 0.5 ? 'signal' : 'bone', 0.9 * k);
        c.fillText(NAMES[i]!, r.x + 70, r.y + r.h + 24);
        caption(c, id, r.x, r.y + r.h + 44, { size: 10, short: true, maxW: r.w, color: rgba('ash', 0.5 * k) });
        if (t >= tp) lamp = { x: r.x + r.w - 16, y: r.y + 16 };
      });
      sparkHead(this.lb, lamp.x, lamp.y, t, 0.9, 1);
      karaoke(c, w1, t, W / 2, 170, F.serif(400, true), 92, { align: 'center', dim: rgba('bone', 0.22), gap: 0.24 });
    } else if (t < tFlame - 0.05) {
      const k = Math.max(0, slot(this.shadowCuts, t));
      const id = SHADOW[k % SHADOW.length]!;
      const t0 = this.shadowCuts[k]!, t1 = this.shadowCuts[k + 1] ?? tFlame;
      this.plates.draw(renderer, out, id, { x: -40, y: -30, w: W + 80, h: H + 60, ...kb(t, t0, t1, 1.05, 1.15), ...LOOK.tone, gamma: 1.6, light: kc(0.7, LIN.bone) });
      caption(c, id, 96, H - 64);
      karaoke(c, w2.slice(0, 2), t, W / 2, 620, F.archivo(100, 900), 170, { upper: true, align: 'center', dim: rgba('bone', 0.15) });
    } else {
      // flames multiply on every bar
      const b = Math.max(0, slot(this.bars, t));
      const n = Math.min(16, Math.pow(2, b));
      const cols = n <= 1 ? 1 : n <= 2 ? 2 : n <= 4 ? 2 : n <= 8 ? 4 : 4;
      const rows = Math.ceil(n / cols);
      const cw = W / cols, ch = H / rows;
      const heat = prog(t, tFlame, f.end, ease.inQuad);
      for (let i = 0; i < n; i++) {
        const id = FLAME[(i + b) % FLAME.length]!;
        const x = (i % cols) * cw, y = Math.floor(i / cols) * ch;
        this.plates.draw(renderer, out, id, { x: x + 2, y: y + 2, w: cw - 4, h: ch - 4, zoom: 1.1 + hash(i, b) * 0.4, panX: hash(i, 7) - 0.5, panY: id === 'fcbb40f9' || id === 'a62d9d4f' ? -0.7 : 0, ...LOOK.tone, gamma: 1.8 - heat * 0.8, light: kc(0.55 + heat * 0.5, LIN.bone), glow: 0.8 + heat * 2.5, glowAt: 0.75 - heat * 0.3, seed: i });
      }
      if (n === 1) caption(c, FLAME[b % FLAME.length]!, 96, H - 64);
      else { c.font = font(F.mono(500), 14); c.letterSpacing = '3px'; c.fillStyle = rgba('bone', 0.8); c.fillText(`FLAMES: ${n}  ·  PL. ${FLAME.length > 0 ? 'SEE INDEX' : ''}`, 96, H - 64); c.letterSpacing = '0px'; }
      // EVERY FLAME, with echoes that grow with the flames
      const fam = F.archivo(100, 900);
      karaoke(c, w2.slice(2, 4), t, W / 2, 620, fam, 170, { upper: true, align: 'center', dim: rgba('bone', 0.15), lit: rgba('bone', 1) });
      for (let e = 1; e < Math.min(5, b + 1); e++) {
        c.font = font(fam, 170 - e * 26); c.textAlign = 'center';
        c.fillStyle = rgba('signal', 0.45 / e);
        c.fillText('EVERY FLAME', W / 2, 620 + e * (150 - e * 10));
        c.fillText('EVERY FLAME', W / 2, 620 - e * (150 - e * 10));
        c.textAlign = 'left';
      }
      exposure = 1 + heat * 0.6;
      flash = prog(t, f.end - 0.35, f.end, ease.inCubic) * 1.4;
    }
    this.lb.render(renderer, out);
    comp.draw(renderer, this.L.upload(), out);
    return { bloom: 0.8, vignette: 0.45, exposure, flash };
  }
}
