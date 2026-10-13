// GLORY — the bridge, whispered: "They said go find the path to glory / I just found every path to
// grief / And walked the other way."
// Almost nothing on a black sheet: the lamp and small type. Glory is hung
// like a museum wall of small framed plates (arches, laurels, a victory). On "every path to grief"
// each frame turns, one by one, into a grave, and the lamp's single path splits into a fan of
// routes, one to each. On "walked the other way" the footprints in the sand turn around and the
// lamp walks left out of the atlas, into the climb.
import type * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { Layer2D, clearRT } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { F, font, measure } from '../engine/type';
import { Lyrics } from '../engine/lyrics';
import { ease, prog, clamp, lerp, hash } from '../engine/util';
import { sparkHead, sparkParticles } from './_motifs';
import { PlateDrawer, loadImages, caption, LIN, rgba, W, H, kc, LOOK, kb, karaoke, beatsIn, routeLine, xMark, chaikin, along, type Line } from './_kit';

const GLORY = ['ea8bb3cb', '6b9d9cfc', '15a9a1ad', '2cb3e797', '00347f18', '5eed1c55'];
const GRIEF = ['50762a57', 'fba37fe8', '41f21dfc', 'eb0ca1c1', '05022270', 'cma145570'];
const WALK = ['dba2a6bb', '101aad9d', '84cabb10', 'e99f458e', '9b3132d0'];
const POST = { x: 470, y: 640 };

export default class Glory extends Scene {
  L = new Layer2D();
  plates = new PlateDrawer();
  lb = new LineBatch(6000, { blend: 'add' });
  l1!: Line; l2!: Line; l3!: Line;
  hang: number[] = []; swap: number[] = [];
  override async init() {
    await loadImages([...GLORY, ...GRIEF, ...WALK]);
    const ly = this.ctx.lyrics, au = this.ctx.audio;
    this.l1 = ly.get('They said go'); this.l2 = ly.get('every path to grief'); this.l3 = ly.get('walked the other way');
    this.hang = GLORY.map((_, i) => au.timeOfBeat(Math.ceil(au.beatAt(this.l1.words[2]!.start)) + i * 2));
    this.swap = GRIEF.map((_, i) => au.timeOfBeat(Math.ceil(au.beatAt(this.l2.words[3]!.start)) + i));
  }
  frame(i: number) { const cw = 300, ch = 210, gx = 34, gy = 64; return { x: 900 + (i % 3) * (cw + gx), y: 170 + Math.floor(i / 3) * (ch + gy), w: cw, h: ch }; }
  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const { renderer, comp } = this.ctx;
    const t = f.t, w1 = this.l1.words, w2 = this.l2.words, w3 = this.l3.words;
    clearRT(renderer, out, LIN.ink);
    const c = this.L.ctx; this.L.clear(); this.lb.clear();
    const tWalk = w3[0]!.start - 0.1;
    const tx = (s: string, x: number, y: number, a: number, sz = 15) => { c.font = font(F.mono(500), sz); c.letterSpacing = '3px'; c.fillStyle = rgba('bone', a); c.fillText(s, x, y); c.letterSpacing = '0px'; };
    let fade = 1 - prog(t, f.start, f.start + 1.2);
    if (t < tWalk) {
      const pk = prog(t, f.start + 0.5, f.start + 1.5, ease.outCubic);
      tx('GLORY', 900, 140, 0.85 * prog(t, this.hang[0]! - 0.2, this.hang[0]! + 0.2), 20);
      tx('SHEET XII · THE CROSSROADS', 96, 96, 0.6 * pk);
      // glory, hung in small frames, one per two beats from "find"
      let ends: { x: number; y: number }[] = [];
      GLORY.forEach((gid, i) => {
        const th = this.hang[i]!, k = prog(t, th, th + 0.2, ease.outCubic);
        if (k <= 0) return;
        const r = this.frame(i);
        const ts = this.swap[i]!, sw = prog(t, ts, ts + 0.25, ease.inOutCubic);
        const id = sw >= 0.5 ? GRIEF[i]! : gid;
        // the swap: the frame turns on its vertical axis
        const sx = Math.abs(Math.cos(sw * Math.PI));
        this.plates.draw(renderer, out, id, { x: r.x + r.w * (1 - sx) / 2, y: r.y, w: Math.max(1, r.w * sx), h: r.h, ...(id.startsWith('cma') ? LOOK.tone : LOOK.tone), gamma: 1.3, light: kc(sw >= 0.5 ? 0.55 : 0.75, LIN.bone), alpha: k, border: 1, seed: i });
        caption(c, id, r.x, r.y + r.h + 20, { size: 10, short: true, maxW: r.w, color: rgba('ash', 0.6 * k) });
        ends.push({ x: r.x - 8, y: r.y + r.h / 2 });
      });
      // routes: one dashed path to glory; then every path, each to its grave, each crossed
      const start = { x: POST.x + 20, y: POST.y + 120 };
      const tFan = w2[2]!.start;
      if (t < tFan) {
        const g = prog(t, w1[2]!.start, w1[w1.length - 1]!.end, ease.inOutQuad);
        const target = this.frame(1);
        const path = chaikin([start, { x: 700, y: 560 }, { x: target.x - 20, y: target.y + target.h + 40 }], 2);
        const r = along(path, g);
        if (g > 0) routeLine(this.lb, r.part, { w: 2, dash: 9, I: 1.2 });
        sparkHead(this.lb, g > 0 ? r.p.x : start.x, g > 0 ? r.p.y : start.y, t, 0.9, pk);
      } else {
        const g = prog(t, tFan, w2[w2.length - 1]!.end, ease.inOutQuad);
        ends.forEach((e, i) => {
          const gi = clamp(g * 1.4 - i * 0.08);
          const path = chaikin([start, { x: lerp(start.x, e.x, 0.5) + (hash(i, 3) - 0.5) * 120, y: lerp(start.y, e.y, 0.5) + 60 }, e], 2);
          const r = along(path, gi);
          if (gi > 0) routeLine(this.lb, r.part, { w: 2, dash: 9, I: 1.3 });
          if (gi >= 1) xMark(this.lb, e.x, e.y, 9, 2, 2.5);
          if (gi > 0 && gi < 1) sparkHead(this.lb, r.p.x, r.p.y, t, 0.6, 0.8);
        });
        sparkHead(this.lb, start.x, start.y, t, 0.9, 1);
      }
      // whispered type: small serif, karaoke
      const line = t < w2[0]!.start - 0.5 ? w1 : w2;
      karaoke(c, line, t, 120, 980, F.serif(400, true), 64, { dim: rgba('bone', 0.15), gap: 0.24 });
    } else {
      // walked the other way: footprints turn around, the lamp leaves to the left
      const k = Math.max(0, Math.floor((t - tWalk) / 1.12));
      const id = WALK[k % WALK.length]!;
      const flip = t > w3[1]!.start + 0.1;
      this.plates.draw(renderer, out, id, { x: -40, y: -30, w: W + 80, h: H + 60, ...kb(t, tWalk + k * 1.12, tWalk + (k + 1) * 1.12, 1.1, 1.2), ...LOOK.tone, gamma: 1.3, light: kc(0.68, LIN.bone), flipX: flip, seed: k });
      caption(c, id, 96, H - 64);
      tx(flip ? 'DIRECTION OF TRAVEL: REVERSED' : 'DIRECTION OF TRAVEL: GLORY', 96, 96, 0.8);
      const lk = prog(t, w3[1]!.start, f.end, ease.inQuad);
      const lx = lerp(1500, -200, lk), ly = 560 + Math.sin(t * 6) * 6;
      routeLine(this.lb, [{ x: 1500, y: 560 }, { x: lx, y: ly }], { w: 3, I: 1.6 });
      sparkHead(this.lb, lx, ly, t, 1.3, 1.3);
      sparkParticles(this.lb, t, (tb) => ({ x: lerp(1500, -200, prog(tb, w3[1]!.start, f.end, ease.inQuad)), y: 560 }), { rate: 90, speed: 180, life: 0.4 });
      karaoke(c, w3.slice(0, 2), t, W - 120, 820, F.serif(400, true), 84, { align: 'right', dim: rgba('bone', 0.15) });
      // THE OTHER WAY, set right-to-left (it arrives from the right and leaves to the left)
      const ow = w3.slice(2);
      karaoke(c, ow, t, W - 110 - prog(t, ow[0]!.start, f.end, ease.inQuad) * 400, 980, F.archivo(100, 900), 150, { upper: true, align: 'right', dim: rgba('bone', 0.15), lit: rgba('signal', 1) });
      fade = 0;
    }
    this.lb.render(renderer, out);
    comp.draw(renderer, this.L.upload(), out);
    return { bloom: 0.7, vignette: 0.55, fade: Math.max(0, fade) * 0.7 };
  }
}
