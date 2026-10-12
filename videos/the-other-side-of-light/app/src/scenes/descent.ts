// DESCENT — "Every shortcut to the bottom / Every comfortable sin"
// Straight down: spiral staircases seen from above, one dissolving into the next as the camera turns
// and falls; the lamp spirals to the bottom and the word follows it. Then the comfortable sin: a row
// of red armchairs (the only red in the frame prints in the signal colour), Doré's damned, and
// Bruegel's Sloth on "sin".
import type * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { Layer2D, clearRT } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { F, font, measure } from '../engine/type';
import { Lyrics } from '../engine/lyrics';
import { ease, prog, clamp, lerp, hash } from '../engine/util';
import { sparkHead, sparkParticles } from './_motifs';
import { PlateDrawer, loadImages, caption, LIN, rgba, W, H, kc, LOOK, kb, karaoke, beatsIn, slot, type Line } from './_kit';

const SPIRAL = ['5953f9f0', 'dddb9cf6', '60f10c51', 'd95e51a2'];
const SIN = ['53d9e256', 'be1c5d0b', 'ee726e64', 'cma123964', 'fba082d7'];

export default class Descent extends Scene {
  L = new Layer2D();
  plates = new PlateDrawer();
  lb = new LineBatch(4000, { blend: 'add' });
  l1!: Line; l2!: Line;
  cuts: number[] = [];
  override async init() {
    await loadImages([...SPIRAL, ...SIN]);
    const ly = this.ctx.lyrics;
    this.l1 = ly.get('Every shortcut'); this.l2 = ly.get('Every comfortable');
    const w2 = this.l2.words;
    this.cuts = [this.l1.words[4]!.end + 0.05, w2[0]!.start - 0.05, w2[1]!.start - 0.03, w2[2]!.start - 0.03];
  }
  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const { renderer, comp } = this.ctx;
    const t = f.t, w1 = this.l1.words, w2 = this.l2.words;
    clearRT(renderer, out, LIN.ink);
    const c = this.L.ctx; this.L.clear(); this.lb.clear();
    let shake: [number, number] = [0, 0];
    if (t < this.cuts[0]!) {
      // falling down the stairwells: a continuous zoom, each well handing over to the next one
      const fall = (t - f.start) / (this.cuts[0]! - f.start); // 0..1
      const N = SPIRAL.length;
      const ph = fall * (N - 1);
      for (let j = 0; j < N; j++) {
        const d = ph - j; // how far past this image's turn (0 = it fills the frame)
        if (d < -1 || d > 1.6) continue;
        const z = Math.pow(3.2, d);
        const s = 1 / Math.max(0.05, Math.pow(3.2, -d)); // grows as we pass
        const size = (W + 400) * s;
        const alpha = clamp(1 - Math.max(0, d - 0.6) / 1) * clamp(d + 1);
        this.plates.draw(renderer, out, SPIRAL[j]!, { x: W / 2 - size / 2, y: H / 2 - (size * H) / W / 2, w: size, h: (size * H) / W, rot: t * 1.3 + j, zoom: 1.2, ...LOOK.tone, gamma: 1.4, light: kc(0.7, LIN.bone), alpha, reveal: 'iris', rp: 0.48, rsoft: 0.25, seed: j });
        void z;
      }
      caption(c, SPIRAL[Math.min(N - 1, Math.round(ph))]!, 96, H - 64);
      // the lamp spirals in toward the bottom (the centre)
      const sp = (tt: number) => { const u = clamp((tt - f.start) / (this.cuts[0]! - f.start)); const r = 520 * (1 - u) * (1 - u); const a = tt * 7; return { x: W / 2 + Math.cos(a) * r * 1.4, y: H / 2 + Math.sin(a) * r }; };
      const hp = sp(t);
      sparkHead(this.lb, hp.x, hp.y, t, 1.2, 1.2);
      sparkParticles(this.lb, t, (tb) => (tb < f.start ? null : sp(tb)), { rate: 120, speed: 160, life: 0.4 });
      karaoke(c, w1.slice(0, 4), t, 110, 200, F.archivo(87.5, 900), 110, { upper: true, dim: rgba('bone', 0.2) });
      const wb = w1[4]!;
      if (t > wb.start - 0.2) {
        const age = Math.max(0, t - wb.start);
        const s = 1 / (1 + age * 2.2);
        c.save(); c.translate(W / 2, H / 2); c.rotate(age * 1.5); c.scale(s, s);
        c.font = font(F.archivo(125, 900), 260); c.textAlign = 'center';
        c.fillStyle = rgba('signal', Math.min(1, Lyrics.wordProgress(wb, t) * 3));
        c.fillText('BOTTOM', 0, 90); c.textAlign = 'left';
        c.restore();
      }
    } else {
      const k = Math.max(0, slot(this.cuts, t));
      const ids = [SIN[0]!, SIN[2]!, SIN[1]!, SIN[4]!];
      const id = ids[Math.min(ids.length - 1, k)]!;
      const t0 = this.cuts[k]!, t1 = this.cuts[k + 1] ?? f.end;
      const print = id.startsWith('cma') || id === 'fba082d7' || id === 'ee726e64' || id === '53d9e256';
      this.plates.draw(renderer, out, id, { x: -40, y: -30, w: W + 80, h: H + 60, ...kb(t, t0, t1, 1.08, 1.2, 0, 0.2, 0, 0.1), ...(print ? LOOK.tone : LOOK.tone), gamma: print ? 1.1 : 1.3, light: kc(0.6, LIN.bone), redKey: 1, seed: k });
      caption(c, id, 96, H - 64);
      if (t - t0 < 0.12) shake = [Math.sin(t * 90) * 5, 0];
      karaoke(c, w2.slice(0, 2), t, 110, 860, F.archivo(87.5, 900), 130, { upper: true, dim: rgba('bone', 0.2) });
      const ws = w2[2]!;
      if (t > ws.start - 0.1) {
        c.font = font(F.serif(600, true), 300); c.fillStyle = rgba('signal', Math.min(1, Lyrics.wordProgress(ws, t) * 3));
        c.fillText('sin.', 1380, 640);
      }
    }
    this.lb.render(renderer, out);
    comp.draw(renderer, this.L.upload(), out);
    return { bloom: 0.75, vignette: 0.5, shake };
  }
}
