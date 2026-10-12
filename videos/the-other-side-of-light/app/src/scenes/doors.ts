// DOORS — "Every door that leads to ruin"
// A typology of doors, Becher-style: six plates stamped into a row on the 8th notes of "Every door",
// each numbered and filed. The lamp walks to the dark one, the camera follows it through, and on
// "ruin" the other side is only ruins, a new one every two beats, while the word itself falls apart.
import type * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { Layer2D, clearRT } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { F, font, measure } from '../engine/type';
import { Lyrics } from '../engine/lyrics';
import { ease, prog, clamp, lerp, hash } from '../engine/util';
import { sparkHead } from './_motifs';
import { PlateDrawer, loadImages, caption, LIN, rgba, W, H, kc, LOOK, kb, karaoke, beatsIn, slot, Cam, routeLine, type Line } from './_kit';

const DOORS = ['1478fd3b', 'cma96320', '489800bb', '4e090678', '034991cc', 'b13825ae'];
const RUINS = ['b0150c56', 'b2360d37', 'e1edf255', 'cma107251', '040b24d6', 'cma106564', '7edee81d', 'cma118652'];
const CELL = { w: 262, h: 500, gap: 22, y: 170 };
const ENTER = 4;

export default class Doors extends Scene {
  L = new Layer2D();
  plates = new PlateDrawer();
  lb = new LineBatch(4000, { blend: 'add' });
  cam = new Cam();
  line!: Line;
  stamps: number[] = [];
  ruinCuts: number[] = [];

  override async init() {
    await loadImages([...DOORS, ...RUINS]);
    this.line = this.ctx.lyrics.get('Every door');
    const w = this.line.words, au = this.ctx.audio;
    // 6 stamps on the 8th notes from "Every"
    const b0 = au.beatAt(w[0]!.start - 0.05);
    this.stamps = DOORS.map((_, i) => au.timeOfBeat(Math.ceil(b0 * 2) / 2 + i * 0.5));
    this.ruinCuts = beatsIn(au, w[5]!.start - 0.1, this.ctx.end, 2);
    this.ruinCuts[0] = w[5]!.start - 0.03;
  }
  cellX(i: number) { const tot = DOORS.length * CELL.w + (DOORS.length - 1) * CELL.gap; return (W - tot) / 2 + i * (CELL.w + CELL.gap); }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const { renderer, comp } = this.ctx;
    const t = f.t, w = this.line.words;
    clearRT(renderer, out, LIN.ink);
    const c = this.L.ctx; this.L.clear(); this.lb.clear();
    const tRuin = w[5]!.start;
    const ex = this.cellX(ENTER) + CELL.w / 2, ey = CELL.y + CELL.h * 0.55;
    let shake: [number, number] = [0, 0];
    let flash = 0;
    if (t < tRuin) {
      // camera: still, then into the dark door from "leads"
      const kz = prog(t, w[3]!.start, tRuin, ease.inExpo);
      this.cam.set(lerp(W / 2, ex, Math.min(1, kz * 3)), lerp(H / 2, ey, Math.min(1, kz * 3)), lerp(1, 14, kz));
      DOORS.forEach((id, i) => {
        const ts = this.stamps[i]!;
        const k = prog(t, ts, ts + 0.12, ease.outCubic);
        if (k <= 0) return;
        const s = lerp(1.25, 1, k);
        const x = this.cellX(i), cw = CELL.w * s, ch = CELL.h * s;
        const r = this.cam.rect(x + CELL.w / 2 - cw / 2, CELL.y + CELL.h / 2 - ch / 2, cw, ch);
        const dark = i === ENTER;
        this.plates.draw(renderer, out, id, { ...r, ...(dark ? LOOK.tone : LOOK.photo), light: dark ? LIN.bone : kc(0.8, LIN.bone), glow: dark ? 0.8 : 0, glowAt: 0.8, alpha: k, seed: i, border: 0.6 });
        // filing labels under each door
        const lp = this.cam.pt(x, CELL.y + CELL.h + 30);
        if (this.cam.z < 1.5) {
          c.font = font(F.mono(500), 15); c.letterSpacing = '2px'; c.fillStyle = rgba(dark ? 'signal' : 'bone', 0.85 * k);
          c.fillText(`D-${String(i + 1).padStart(2, '0')}`, lp.x, lp.y);
          c.font = font(F.mono(400), 12); c.letterSpacing = '1px'; c.fillStyle = rgba('ash', 0.75 * k);
          c.fillText(dark ? 'LEADS TO: RUIN' : 'LEADS TO: RUIN', lp.x, lp.y + 20);
          c.letterSpacing = '0px';
          caption(c, id, lp.x, lp.y + 40, { size: 10, short: true, maxW: CELL.w, color: rgba('ash', 0.5 * k) });
        }
      });
      // the lamp walks along the row to the dark door
      const walk = prog(t, w[1]!.start, w[3]!.start + 0.2, ease.inOutCubic);
      const sx = this.cellX(0) - 40, sy = CELL.y + CELL.h + 6;
      const pts = [{ x: sx, y: sy }, { x: lerp(sx, ex, walk), y: sy }];
      if (walk >= 1) pts.push({ x: ex, y: lerp(sy, ey, prog(t, w[3]!.start + 0.2, w[4]!.start + 0.1, ease.inOutCubic)) });
      const sp = pts.map((p) => this.cam.pt(p.x, p.y));
      if (t > w[1]!.start) routeLine(this.lb, sp, { w: 2, dash: 8, I: 1.4 });
      const hp = sp[sp.length - 1]!;
      sparkHead(this.lb, hp.x, hp.y, t, 1 + kz * 3, 1);
      // lyric
      karaoke(c, w.slice(0, 5), t, W / 2, 900, F.archivo(100, 900), 96, { upper: true, align: 'center', dim: rgba('bone', 0.2) });
    } else {
      // the other side: ruins, a plate every two beats, and RUIN falling apart
      const k = slot(this.ruinCuts, t);
      const id = RUINS[k % RUINS.length]!;
      const t0 = this.ruinCuts[k]!, t1 = this.ruinCuts[k + 1] ?? f.end;
      const look = id.startsWith('cma') ? LOOK.print : LOOK.photo;
      this.plates.draw(renderer, out, id, { x: -60, y: -40, w: W + 120, h: H + 80, ...kb(t, t0, t1, 1.08, 1.2, (k % 2) - 0.5, 0, 0, 0.2), ...look, light: kc(0.7, LIN.bone), seed: k });
      caption(c, id, 96, H - 64);
      c.font = font(F.mono(500), 14); c.letterSpacing = '3px'; c.fillStyle = rgba('bone', 0.75);
      c.fillText(`THE OTHER SIDE OF D-05  ·  ${String(k + 1).padStart(2, '0')} / ∞`, 96, 96);
      c.letterSpacing = '0px';
      flash = Math.pow(0.5, (t - tRuin) / 0.06) * 0.12;
      shake = t - tRuin < 0.25 ? [Math.sin(t * 80) * 8, Math.cos(t * 70) * 8] : [0, 0];
      // RUIN: letters fall apart (gravity, spin) after the word is sung
      const fam = F.archivo(125, 900), size = 330;
      const word = 'RUIN';
      const tw = measure(word, fam, size);
      let x = (W - tw) / 2;
      const fall = Math.max(0, t - w[5]!.end - 0.2);
      c.font = font(fam, size);
      for (let i = 0; i < word.length; i++) {
        const ch = word[i]!, cw = measure(ch, fam, size);
        const dly = hash(i, 4) * 0.5, tt = Math.max(0, fall - dly);
        const dy = 0.5 * 1400 * tt * tt, rot = (hash(i, 9) - 0.5) * 2.4 * tt;
        c.save(); c.translate(x + cw / 2, 640 + dy); c.rotate(rot);
        const p = Lyrics.wordProgress(w[5]!, t);
        c.fillStyle = rgba('signal', 0.35 + 0.65 * Math.min(1, p * 2));
        c.fillText(ch, -cw / 2, 0);
        c.restore();
        x += cw;
      }
    }
    this.lb.render(renderer, out);
    comp.draw(renderer, this.L.upload(), out);
    return { bloom: 0.75, vignette: 0.45, shake, flash };
  }
}
