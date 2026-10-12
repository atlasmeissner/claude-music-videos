// LIGHTBOX — "I held the worst up to the light / And finally saw the way to fight"
// The worst plate in the atlas (a hell, engraved) is lifted into an empty lightbox. On "light" the box
// switches on and the print turns translucent: a negative, lit from behind, like an X-ray — and the
// X-ray itself, and Redon's "I saw a flash of light". The lamp draws the way through it; on "fight"
// the fight plates cut on the eighth notes, the drums build and the next chorus explodes out of white.
import type * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { Layer2D, clearRT } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { F, font, measure } from '../engine/type';
import { Lyrics } from '../engine/lyrics';
import { ease, prog, clamp, lerp, hash } from '../engine/util';
import { sparkHead, sparkParticles } from './_motifs';
import { PlateDrawer, loadImages, caption, LIN, rgba, W, H, kc, LOOK, kb, karaoke, beatsIn, slot, routeLine, along, chaikin, wander, type Line } from './_kit';

const WORST = 'cma106457';
const XRAY = 'a5cc0eb7';
const FLASH = 'cma142697';
const FIGHT = ['be25a8b0', 'cma143142', 'cma92937', '2be192a8', 'cma141637'];
const BOX = { x: 410, y: 150, w: 1100, h: 640 };

export default class Lightbox extends Scene {
  L = new Layer2D();
  plates = new PlateDrawer();
  lb = new LineBatch(4000, { blend: 'add' });
  sig = new LineBatch(2000, { blend: 'normal' });
  l1!: Line; l2!: Line;
  cuts: number[] = [];
  way: { x: number; y: number }[] = [];
  override async init() {
    await loadImages([WORST, XRAY, FLASH, ...FIGHT]);
    const ly = this.ctx.lyrics, au = this.ctx.audio;
    this.l1 = ly.get('I held the worst'); this.l2 = ly.get('finally saw');
    const wf = this.l2.words[this.l2.words.length - 1]!;
    this.cuts = [wf.start - 0.03, ...beatsIn(au, wf.start + 0.1, this.ctx.end, 0.5)];
    this.way = chaikin(wander(5, BOX.x + 40, BOX.y + BOX.h - 60, BOX.x + BOX.w - 40, BOX.y + 60, 8, 0.22), 2);
  }
  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const { renderer, comp } = this.ctx;
    const t = f.t, w1 = this.l1.words, w2 = this.l2.words;
    clearRT(renderer, out, LIN.ink);
    const c = this.L.ctx; this.L.clear(); this.lb.clear(); this.sig.clear();
    const tLight = w1[w1.length - 1]!.start, tFight = this.cuts[0]!;
    let shake: [number, number] = [0, 0], flash = 0, exposure = 1;
    if (t < tFight) {
      const on = prog(t, tLight, tLight + 0.15, ease.outCubic);
      // the box: an empty frame, glowing white once on
      const g = kc(0.06 + on * 1.4, LIN.bone);
      this.lb.seg2(BOX.x - 14, BOX.y - 14, BOX.x + BOX.w + 14, BOX.y - 14, 2, kc(0.5, LIN.bone));
      this.lb.seg2(BOX.x - 14, BOX.y + BOX.h + 14, BOX.x + BOX.w + 14, BOX.y + BOX.h + 14, 2, kc(0.5, LIN.bone));
      this.lb.seg2(BOX.x - 14, BOX.y - 14, BOX.x - 14, BOX.y + BOX.h + 14, 2, kc(0.5, LIN.bone));
      this.lb.seg2(BOX.x + BOX.w + 14, BOX.y - 14, BOX.x + BOX.w + 14, BOX.y + BOX.h + 14, 2, kc(0.5, LIN.bone));
      // the held plate rises into the box on "held"
      const lift = prog(t, w1[1]!.start - 0.1, w1[1]!.start + 0.5, ease.outCubic);
      const dy = (1 - lift) * 700;
      const t2 = w2[0]!.start;
      const id = t < t2 ? WORST : t < w2[2]!.start ? XRAY : FLASH;
      this.plates.draw(renderer, out, id, { x: BOX.x, y: BOX.y + dy, w: BOX.w, h: BOX.h, ...LOOK.tone, invert: on, gamma: lerp(1.2, 0.9, on), dark: kc(lerp(1, 0.6, on), LIN.ink), light: kc(lerp(0.6, 0.98, on), LIN.bone), glow: on * 0.3, glowAt: 0.93, zoom: 1.05 + (t - f.start) * 0.02, border: 1 });
      caption(c, id, BOX.x, BOX.y + BOX.h + 44);
      c.font = font(F.mono(500), 14); c.letterSpacing = '3px'; c.fillStyle = rgba(on > 0.5 ? 'signal' : 'ash', 0.9);
      c.fillText(on > 0.5 ? 'LIGHTBOX · ON · TRANSMITTED LIGHT' : 'LIGHTBOX · OFF', BOX.x, BOX.y - 34); c.letterSpacing = '0px';
      // the way, drawn by the lamp through the lit plate during the second line
      const fw = prog(t, t2, tFight - 0.1, ease.inOutQuad);
      if (fw > 0) {
        const r = along(this.way, fw);
        routeLine(this.sig, r.part, { w: 6, I: 1.0 });
        sparkHead(this.lb, r.p.x, r.p.y, t, 1.2, 1.3);
      } else sparkHead(this.lb, BOX.x + BOX.w / 2, BOX.y + dy - 30, t, 0.9 * lift, 1);
      exposure = 1;
      karaoke(c, t < t2 ? w1 : w2.slice(0, w2.length - 1), t, W / 2, 960, F.archivo(87.5, 900), 96, { upper: true, align: 'center', dim: rgba('bone', 0.2) });
    } else {
      // FIGHT: plates on the eighth notes, building to white
      const k = Math.max(0, slot(this.cuts, t));
      const id = FIGHT[k % FIGHT.length]!;
      this.plates.draw(renderer, out, id, { x: -40, y: -30, w: W + 80, h: H + 60, zoom: 1.1 + 0.05 * (k % 3), panX: (hash(k, 2) - 0.5), ...LOOK.tone, gamma: 1.2, light: kc(0.7, LIN.bone), redKey: 1, seed: k });
      caption(c, id, 96, H - 64);
      shake = [Math.sin(t * 95) * 8, Math.cos(t * 85) * 6];
      const wf = w2[w2.length - 1]!;
      c.font = font(F.archivo(125, 900), 330); c.textAlign = 'center';
      c.fillStyle = rgba('signal', Math.min(1, 0.3 + Lyrics.wordProgress(wf, t) * 3));
      c.fillText('FIGHT', W / 2, 660); c.textAlign = 'left';
      flash = prog(t, f.end - 0.5, f.end, ease.inCubic) * 1.5;
    }
    this.sig.render(renderer, out);
    this.lb.render(renderer, out);
    comp.draw(renderer, this.L.upload(), out);
    return { bloom: 0.8, vignette: 0.5, shake, flash, exposure };
  }
}
