// MIRROR — "Every lie I'd tell myself"
// The frame is a mirror: its right half is the left half reflected. The lie is told on the left
// in plain type; "myself" answers from the glass, reversed. The mirror cracks on "lie", and when the
// line is over it breaks into strips that slide out of register, each one a slightly different story.
import type * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { Layer2D, clearRT } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { F, font, measure } from '../engine/type';
import { Lyrics } from '../engine/lyrics';
import { ease, prog, clamp, lerp, hash } from '../engine/util';
import { sparkHead } from './_motifs';
import { PlateDrawer, loadImages, caption, LIN, rgba, W, H, kc, LOOK, karaoke, type Line, type PlateOpts } from './_kit';

const IMG = { glass: 'b9d92c2a', crack: '00fa3566', shatter: 'a9cbd15a', shards: 'c3f76051', hand: 'cma151352', bronze: 'cma159102' };

export default class Mirror extends Scene {
  L = new Layer2D();
  plates = new PlateDrawer();
  lb = new LineBatch(2000, { blend: 'add' });
  line!: Line;
  override async init() {
    await loadImages(Object.values(IMG));
    this.line = this.ctx.lyrics.get('Every lie');
  }
  /** Draw `id` mirrored about the frame's vertical centre line. */
  mirrored(out: THREE.WebGLRenderTarget, id: string, o: Partial<PlateOpts>, split = 0) {
    const r = this.ctx.renderer;
    this.plates.draw(r, out, id, { x: -split, y: 0, w: W / 2, h: H, ...o, panX: (o.panX ?? 0) - 0.0 });
    this.plates.draw(r, out, id, { x: W / 2 + split, y: 0, w: W / 2, h: H, ...o, flipX: true });
  }
  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const { renderer, comp } = this.ctx;
    const t = f.t, w = this.line.words;
    clearRT(renderer, out, LIN.ink);
    const c = this.L.ctx; this.L.clear(); this.lb.clear();
    const tLie = w[1]!.start, tSelf = w[4]!.start, tBreak = w[4]!.end + 0.15;
    let shake: [number, number] = [0, 0];
    const zoom = 1 + (t - f.start) * 0.03;
    if (t < tLie) {
      this.mirrored(out, IMG.glass, { ...LOOK.tone, zoom, panX: -0.6, light: kc(0.55, LIN.bone) });
      caption(c, IMG.glass, 96, H - 64);
    } else if (t < tBreak) {
      this.mirrored(out, IMG.crack, { ...LOOK.tone, zoom: zoom * 1.2, panX: 0.2, gamma: 1.4, light: kc(0.6, LIN.bone), glow: 0.6, glowAt: 0.85 });
      caption(c, IMG.crack, 96, H - 64);
      if (t - tLie < 0.2) shake = [Math.sin(t * 90) * 7, 0];
    } else {
      // break: strips out of register, alternating sources
      const kb = prog(t, tBreak, tBreak + 0.5, ease.outExpo);
      const N = 9, sw = W / N;
      for (let i = 0; i < N; i++) {
        const id = i % 3 === 0 ? IMG.shards : i % 3 === 1 ? IMG.crack : IMG.shatter;
        const dy = (hash(i, 3) - 0.5) * 160 * kb + Math.sin(t * 0.7 + i) * 12 * kb;
        const rot = (hash(i, 5) - 0.5) * 0.07 * kb;
        this.plates.draw(renderer, out, id, { x: i * sw + 3 * kb, y: dy - 40, w: sw - 6 * kb, h: H + 80, rot, ...LOOK.tone, zoom: 1.6, panX: (i / N) * 2 - 1, light: kc(0.4 + 0.25 * hash(i, 8), LIN.bone), flipX: i >= N / 2, glow: 0.4, glowAt: 0.9, seed: i });
      }
      // a hand mirror plate, held up as evidence
      const hk = prog(t, tBreak + 0.6, tBreak + 0.9, ease.outBack);
      if (hk > 0) {
        this.plates.draw(renderer, out, IMG.hand, { x: 1380, y: 300, w: 300 * hk, h: 420 * hk, ...LOOK.tone, border: 1, light: LIN.bone });
        caption(c, IMG.hand, 1380, 760, { short: true, size: 11 });
        c.font = font(F.mono(500), 14); c.letterSpacing = '2px'; c.fillStyle = rgba('bone', 0.8 * hk);
        c.fillText('EXHIBIT 3 · REFLECTION ≠ EVIDENCE', 1380, 285); c.letterSpacing = '0px';
      }
      caption(c, IMG.shatter, 96, H - 64);
    }
    // mirror axis hairline
    this.lb.seg2(W / 2, 0, W / 2, H, 1.2, kc(0.6, LIN.bone), 0.5 * (t < tBreak ? 1 : 0));
    // the lie on the left; MYSELF reflected on the right
    const fam = F.archivo(75, 900), size = 100;
    c.save();
    const lieWords = w.slice(0, 4);
    karaoke(c, lieWords, t, W / 2 - 40, 560, fam, size, { upper: true, align: 'right', dim: rgba('bone', 0.2) });
    const ws = w[4]!;
    const p = Lyrics.wordProgress(ws, t);
    if (t > ws.start - 0.3) {
      c.translate(W / 2 + 40, 0); c.scale(-1, 1);
      const sz = 150;
      c.font = font(F.archivo(100, 900), sz);
      const tw = measure('MYSELF', fam, sz);
      c.fillStyle = rgba('signal', 0.3 + 0.7 * Math.min(1, p * 2));
      c.fillText('MYSELF', -tw, 720);
    }
    c.restore();
    // the lamp sits on the mirror line
    sparkHead(this.lb, W / 2, 560 - size * 0.35, t, 0.9, t < tBreak ? 1 : 0.6);
    this.lb.render(renderer, out);
    comp.draw(renderer, this.L.upload(), out);
    return { bloom: 0.7, vignette: 0.45, shake };
  }
}
