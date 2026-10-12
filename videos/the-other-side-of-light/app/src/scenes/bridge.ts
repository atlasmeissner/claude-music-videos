// BRIDGE — "Every bridge I'd set to burning"
// A stone bridge in fog, engraved. The lamp crosses it on the beat and the plate burns behind it,
// charring from the end it came from. "burning": Turner's parliament on fire, a figure against the
// flames, and the word itself burning down letter by letter to ash.
import type * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { Layer2D, clearRT } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { F, font, measure } from '../engine/type';
import { Lyrics } from '../engine/lyrics';
import { ease, prog, clamp, lerp, hash, noise1 } from '../engine/util';
import { sparkHead, sparkParticles } from './_motifs';
import { PlateDrawer, loadImages, caption, LIN, rgba, W, H, kc, LOOK, kb, karaoke, beatsIn, slot, routeLine, type Line } from './_kit';

const IMG = { bridge: '633bf87a', turner: 'cma122351', figure: '9f2efb79', wool: 'b104f970', hiro: 'cma103244', night: '3e61f6ff' };
const DECK = [{ x: 40, y: 610 }, { x: 700, y: 470 }, { x: 1300, y: 345 }, { x: 1880, y: 225 }];

export default class Bridge extends Scene {
  L = new Layer2D();
  plates = new PlateDrawer();
  lb = new LineBatch(8000, { blend: 'add' });
  line!: Line;
  cuts: number[] = [];
  override async init() {
    await loadImages(Object.values(IMG));
    this.line = this.ctx.lyrics.get('Every bridge');
    const w = this.line.words;
    this.cuts = [w[5]!.start - 0.05, ...beatsIn(this.ctx.audio, w[5]!.start + 0.3, this.ctx.end, 2)];
  }
  deckAt(u: number) {
    const n = DECK.length - 1, k = Math.min(n - 1, Math.floor(u * n)), f = u * n - k;
    return { x: lerp(DECK[k]!.x, DECK[k + 1]!.x, f), y: lerp(DECK[k]!.y, DECK[k + 1]!.y, f) };
  }
  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const { renderer, comp } = this.ctx;
    const t = f.t, w = this.line.words;
    clearRT(renderer, out, LIN.ink);
    const c = this.L.ctx; this.L.clear(); this.lb.clear();
    const tBurn = w[5]!.start;
    let shake: [number, number] = [0, 0];
    const cross = (tt: number) => prog(tt, w[0]!.start, tBurn, ease.inOutQuad);
    if (t < tBurn) {
      // the bridge, the lamp crossing it, the plate burning behind the lamp
      const u = cross(t);
      this.plates.draw(renderer, out, IMG.hiro, { x: -40, y: -30, w: W + 80, h: H + 60, zoom: 1.6, panX: 0, panY: 0.35 - u * 0.04, ...LOOK.print, light: kc(0.62, LIN.bone),
        reveal: 'burn', rp: Math.max(0, u - 0.3) * 0.9, rdir: -0.35, glow: 0.2, glowAt: 0.95 });
      caption(c, IMG.hiro, 96, H - 64);
      const pts: { x: number; y: number }[] = [];
      for (let i = 0; i <= 40; i++) pts.push(this.deckAt((i / 40) * u));
      routeLine(this.lb, pts, { w: 3, I: 2 });
      const hp = this.deckAt(u);
      sparkHead(this.lb, hp.x, hp.y, t, 1.3, 1.2);
      sparkParticles(this.lb, t, (tb) => (tb < w[0]!.start ? null : this.deckAt(cross(tb))), { rate: 140, speed: 260, life: 0.6, intensity: 1.3 });
      karaoke(c, w.slice(0, 5), t, 120, 260, F.archivo(100, 900), 104, { upper: true, dim: rgba('bone', 0.2) });
    } else {
      // burning: fire plates on the beat, the word burning down
      const k = Math.max(0, slot(this.cuts, t));
      const ids = [IMG.turner, IMG.figure, IMG.bridge, IMG.wool, IMG.night];
      const id = ids[k % ids.length]!;
      const t0 = this.cuts[k]!, t1 = this.cuts[k + 1] ?? f.end;
      this.plates.draw(renderer, out, id, { x: -40, y: -30, w: W + 80, h: H + 60, ...kb(t, t0, t1, 1.1, 1.25, 0.3, -0.2, 0, 0), ...LOOK.tone, gamma: 1.5, light: kc(0.5, LIN.bone), glow: 0.9, glowAt: 0.7 });
      caption(c, id, 96, H - 64);
      if (t - tBurn < 0.2) shake = [Math.sin(t * 90) * 8, Math.cos(t * 80) * 6];
      // BURNING: each letter heats from bone through signal and ember, then chars to ash and drifts
      const fam = F.archivo(112.5, 900), size = 220, word = 'BURNING';
      const tw = measure(word, fam, size);
      let x = (W - tw) / 2;
      const wb = w[5]!;
      c.font = font(fam, size);
      for (let i = 0; i < word.length; i++) {
        const ch = word[i]!, cw = measure(ch, fam, size);
        const tl = wb.start + (i / word.length) * (wb.end - wb.start);
        const age = t - tl;
        const heat = clamp(age / 0.35), ash = clamp((age - 0.6) / 0.9);
        const col = heat < 1 ? (heat < 0.5 ? rgba('bone', 1) : rgba('signal', 1)) : `rgba(${Math.round(lerp(255, 60, ash))},${Math.round(lerp(77, 52, ash))},${Math.round(lerp(18, 48, ash))},${1 - ash * 0.6})`;
        const dy = -ash * ash * 120 * (0.5 + hash(i, 2)), dx = noise1(t * 2 + i, 3) * 20 * ash;
        c.fillStyle = age < 0 ? rgba('bone', 0.2) : col;
        c.fillText(ch, x + dx, 640 + dy);
        x += cw;
      }
      karaoke(c, w.slice(0, 5), t, 120, 260, F.archivo(100, 900), 64, { upper: true, dim: rgba('bone', 0.2), lit: rgba('bone', 0.5) });
    }
    this.lb.render(renderer, out);
    comp.draw(renderer, this.L.upload(), out);
    return { bloom: 0.9, vignette: 0.45, shake, halation: 0.4 };
  }
}
