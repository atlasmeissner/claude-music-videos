// CLIMB — the instrumental climb before the final chorus (organ, cello, snare, the "oh" vocalise).
// 1. The band as a triptych of plates: cello | snare | organ, each panel cutting on its own instrument
//    (the snare panel on the snare hits), labelled like an orchestral score.
// 2. The cathedral: engraved naves, the camera rising toward the vault.
// 3. Totality: the other side of light is an eclipse. A new corona on every vocal phrase, larger each
//    time; on the last beat the black sun prints as its own negative and the frame turns to white.
import type * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { Layer2D, clearRT } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { F, font, measure } from '../engine/type';
import { ease, prog, clamp, lerp, hash } from '../engine/util';
import { sparkHead, sparkParticles } from './_motifs';
import { PlateDrawer, loadImages, caption, LIN, rgba, W, H, kc, LOOK, kb, beatsIn, slot } from './_kit';

const CELLO = ['00919cb2', '7b8ee3f8'];
const SNARE = ['540c089f', '257b60b4', '7e0bc1c4'];
const ORGAN = ['e18c7f12', '2ca7d804', 'b68346b4', '10b6a2c4'];
const NAVE = ['cma160743', '585722b7', 'cma135116', '288bef9b', 'cma145450', 'd1d2a5ab', 'cma119725'];
const SUN = ['b4c9d3b0', '38685c27', '9892f864', 'de736aee'];

export default class Climb extends Scene {
  L = new Layer2D();
  plates = new PlateDrawer();
  lb = new LineBatch(3000, { blend: 'add' });
  d: number[] = [];
  snares: number[] = [];
  suns: number[] = [];
  override async init() {
    await loadImages([...CELLO, ...SNARE, ...ORGAN, ...NAVE, ...SUN]);
    const au = this.ctx.audio;
    this.d = au.downbeats.filter((x) => x >= this.ctx.start - 0.05 && x < this.ctx.end + 0.05);
    this.snares = au.events('snare', this.ctx.start, this.d[4] ?? this.ctx.end).filter(([, s]) => s > 0.35).map(([t]) => t);
    this.suns = [this.d[7]!, this.d[9]!, this.d[11]!, this.d[12]!].filter((x) => x !== undefined);
  }
  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const { renderer, comp, audio: au } = this.ctx;
    const t = f.t, d = this.d;
    clearRT(renderer, out, LIN.ink);
    const c = this.L.ctx; this.L.clear(); this.lb.clear();
    let flash = 0, exposure = 1, bloom = 0.8, invert = 0;
    const label = (s: string, x: number, y: number, a = 0.85, col = 'bone') => { c.font = font(F.mono(500), 15); c.letterSpacing = '3px'; c.fillStyle = rgba(col, a); c.fillText(s, x, y); c.letterSpacing = '0px'; };
    if (t < d[4]!) {
      const pw = W / 3;
      const beat = Math.floor(au.beatAt(t));
      const sk = Math.max(0, slot(this.snares, t));
      const panels = [
        { ids: CELLO, k: Math.floor(beat / 2), name: 'VC. — OSTINATO, ♩ = 160', hit: au.hit('kick', t) },
        { ids: SNARE, k: sk, name: 'SN. — MILITARY', hit: au.hit('snare', t) },
        { ids: ORGAN, k: Math.floor(beat / 4), name: 'ORG. — FULL, 32′', hit: 0 },
      ];
      panels.forEach((p, i) => {
        const id = p.ids[((p.k % p.ids.length) + p.ids.length) % p.ids.length]!;
        const z = 1.15 + p.hit * 0.08;
        this.plates.draw(renderer, out, id, { x: i * pw + 6, y: 120, w: pw - 12, h: H - 240, zoom: z, ...LOOK.photo, freq: 0.22, light: kc(0.7 + p.hit * 0.3, LIN.bone), redKey: 0, seed: i, border: 0.5 });
        label(p.name, i * pw + 10, 100, 0.85, i === 1 ? 'signal' : 'bone');
        caption(c, id, i * pw + 10, H - 92, { size: 10, short: true, maxW: pw - 20 });
      });
      label('SCORE · THE OTHER SIDE OF LIGHT · BARS 103–106', 96, H - 40, 0.5);
    } else if (t < d[7]!) {
      const k = Math.floor((t - d[4]!) / ((d[7]! - d[4]!) / 6));
      const id = NAVE[k % NAVE.length]!;
      const t0 = d[4]! + k * ((d[7]! - d[4]!) / 6), t1 = t0 + (d[7]! - d[4]!) / 6;
      this.plates.draw(renderer, out, id, { x: -40, y: -30, w: W + 80, h: H + 60, ...kb(t, t0, t1, 1.1, 1.35, 0, 0, 0.6, -0.6), ...(id.startsWith('cma') ? LOOK.tone : LOOK.photo), gamma: 1.2, light: kc(0.75, LIN.bone), glow: 0.7, glowAt: 0.88, seed: k });
      caption(c, id, 96, H - 64);
      label('NAVE · LOOKING UP · THE ORGAN ENTERS', 96, 96);
    } else {
      // totality
      const k = Math.max(0, slot(this.suns, t));
      const id = SUN[k % SUN.length]!;
      const t0 = this.suns[k]!;
      const grow = 0.45 + k * 0.1 + (t - t0) * 0.03;
      const S = H * grow * 2;
      const last = t >= f.end - 0.75;
      invert = last ? prog(t, f.end - 0.75, f.end - 0.4, ease.outCubic) : 0;
      this.plates.draw(renderer, out, id, { x: W / 2 - S * 0.75, y: H / 2 - S / 2, w: S * 1.5, h: S, ...LOOK.tone, invert, gamma: 1.1, light: LIN.bone, glow: 0.9, glowAt: 0.72, paper: 0.1, seed: k });
      caption(c, id, 96, H - 64);
      const tt = Math.max(0, t - d[7]!);
      label(`TOTALITY · T+${tt.toFixed(2)} s · THE OTHER SIDE OF LIGHT`, 96, 96, 0.85, 'signal');
      c.font = font(F.serif(400, true), 56); c.textAlign = 'center'; c.fillStyle = rgba('bone', 0.75 * clamp((t - d[7]!) / 1.5));
      c.fillText('Invert, always invert.', W / 2, H - 120); c.textAlign = 'left';
      bloom = 1.1;
      flash = prog(t, f.end - 0.35, f.end, ease.inCubic) * 1.4;
      // the lamp at the black sun's edge: the diamond ring
      const a = -0.8 + (t - t0) * 0.1;
      sparkHead(this.lb, W / 2 + Math.cos(a) * S * 0.16, H / 2 + Math.sin(a) * S * 0.16, t, 1.6, 1.4);
    }
    this.lb.render(renderer, out);
    comp.draw(renderer, this.L.upload(), out);
    return { bloom, vignette: 0.5, flash, exposure };
  }
}
