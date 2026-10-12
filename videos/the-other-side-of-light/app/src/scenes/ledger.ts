// LEDGER — "I wrote the list of all the ways to fail / All the poison dressed as medicine"
// The lamp writes the first line in a clerk's hand over a typewriter; then the list itself runs on
// the beat, numbered, deadpan, a ledger of failures. "All the poison dressed as medicine": apothecary
// plates on the beat, and a label pasted over each: POISON, then, on "medicine", a neat MEDICINE label
// slapped on top of it, slightly askew.
import type * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { Layer2D, clearRT } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { F, font, measure } from '../engine/type';
import { strokeText, writtenLength, type StrokeText } from '../engine/stroke';
import { Lyrics } from '../engine/lyrics';
import { ease, prog, clamp, lerp, hash } from '../engine/util';
import { sparkHead } from './_motifs';
import { drawWriting } from './map';
import { PlateDrawer, loadImages, caption, charTimesWords, LIN, rgba, W, H, kc, LOOK, kb, karaoke, beatsIn, slot, type Line } from './_kit';

const WRITE = ['2eb0c521', '662f586b', 'a741b0f4', '1df6a1cd'];
const INDEX = 'cma423526';
const POISON = ['368b5944', '0c4ba8a8', '5eee55ca', '4aa338b5', 'cma128834', '48f3abc0', 'cma105835', '8c66f376'];
const ITEMS = [
  'Ignore the map', 'Trust the shortcut', 'Believe the brochure', 'Burn the bridge (see PL. 2)', 'Lie to yourself, kindly',
  'Wait for a better moment', 'Mistake comfort for safety', 'Optimise the wrong thing', 'Avoid the hard conversation', 'Win the argument, lose the friend',
  'Do it the easy way twice', 'Never write it down',
];

export default class Ledger extends Scene {
  L = new Layer2D();
  plates = new PlateDrawer();
  lb = new LineBatch(2000, { blend: 'add' });
  l1!: Line; l2!: Line;
  st!: StrokeText; times: [number, number][] = [];
  st2!: StrokeText; times2: [number, number][] = [];
  rows: number[] = []; cuts: number[] = [];
  override async init() {
    await loadImages([...WRITE, INDEX, ...POISON]);
    const ly = this.ctx.lyrics, au = this.ctx.audio;
    this.l1 = ly.get('I wrote the list'); this.l2 = ly.get('All the poison');
    const ct = charTimesWords(this.l1.words.slice(0, 4)), ct2 = charTimesWords(this.l1.words.slice(4));
    this.st = strokeText(ct.text, 'hscript', 104, 0); this.times = ct.times;
    this.st2 = strokeText(ct2.text, 'hscript', 104, 0); this.times2 = ct2.times;
    this.rows = beatsIn(au, this.l1.words[0]!.start, this.l2.words[0]!.start - 0.2, 1);
    this.cuts = [this.l2.words[0]!.start - 0.05, ...beatsIn(au, this.l2.words[0]!.start + 0.2, this.ctx.end, 2)];
  }
  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const { renderer, comp } = this.ctx;
    const t = f.t, w1 = this.l1.words, w2 = this.l2.words;
    clearRT(renderer, out, LIN.ink);
    const c = this.L.ctx; this.L.clear(); this.lb.clear();
    const tPoison = w2[0]!.start;
    let shake: [number, number] = [0, 0];
    if (t < tPoison - 0.05) {
      // background: the writing tools, changing every bar; the ledger page on the right
      const bar = Math.max(0, Math.floor((t - f.start) / 1.496));
      const id = WRITE[bar % WRITE.length]!;
      this.plates.draw(renderer, out, id, { x: -40, y: -30, w: 1100, h: H + 60, ...kb(t, f.start + bar * 1.496, f.start + (bar + 1) * 1.496, 1.1, 1.2), ...LOOK.photo, light: kc(0.26, LIN.bone), seed: bar });
      caption(c, id, 96, H - 64);
      this.plates.draw(renderer, out, INDEX, { x: 1080, y: 0, w: 840, h: H, zoom: 2.4, panX: 0.4, panY: -0.6 + (t - f.start) * 0.04, ...LOOK.print, light: kc(0.1, LIN.bone) });
      // the list: one row per beat
      c.font = font(F.mono(400), 22);
      const x0 = 1130;
      let n = 0;
      this.rows.forEach((tr, i) => {
        if (t < tr) return;
        const age = t - tr;
        const k = clamp(age / 0.08);
        const y = 180 + (i % 12) * 62 - Math.max(0, (this.rows.filter((r) => r <= t).length - 12)) * 62;
        if (y < 120) return;
        c.fillStyle = rgba('bone', 0.9 * k);
        const num = String(i + 14).padStart(3, '0');
        const item = ITEMS[i % ITEMS.length]!;
        c.fillText(`${num}  ${item}`, x0, y);
        c.fillStyle = rgba('signal', 0.9 * k);
        c.fillText('FAIL', W - 160, y);
        c.fillStyle = rgba('bone', 0.15 * k); c.fillRect(x0, y + 18, W - 160 - x0 + 60, 1);
        n++;
      });
      c.font = font(F.mono(500), 15); c.letterSpacing = '3px'; c.fillStyle = rgba('bone', 0.75);
      c.fillText('LEDGER · WAYS TO FAIL · CONT’D FROM SHEET I', x0, 110); c.letterSpacing = '0px';
      // the lamp writes the lyric
      const len = writtenLength(this.st, this.times, t), len2 = writtenLength(this.st2, this.times2, t);
      const hd = drawWriting(c, this.st, len, 90, 470, rgba('bone', 1), 4.5);
      const hd2 = drawWriting(c, this.st2, len2, 90, 620, rgba('bone', 1), 4.5);
      const done = len2 >= this.st2.total - 0.5;
      const head = len2 > 0 ? hd2 : hd;
      sparkHead(this.lb, head && !done ? head.x : 90 + this.st2.width + 30, head && !done ? head.y : 600, t, 1, 1);
    } else {
      // poison dressed as medicine
      const k = Math.max(0, slot(this.cuts, t));
      const id = POISON[k % POISON.length]!;
      const t0 = this.cuts[k]!, t1 = this.cuts[k + 1] ?? f.end;
      this.plates.draw(renderer, out, id, { x: -40, y: -30, w: W + 80, h: H + 60, ...kb(t, t0, t1, 1.1, 1.22, (k % 2) - 0.5, 0), ...LOOK.tone, gamma: 1.3, light: kc(0.62, LIN.bone), glow: 0.4, glowAt: 0.9, seed: k });
      caption(c, id, 96, H - 64);
      // the labels
      const wMed = w2[w2.length - 1]!;
      const pk = prog(t, w2[2]!.start - 0.05, w2[2]!.start + 0.1, ease.outBack);
      const mk = prog(t, wMed.start, wMed.start + 0.12, ease.outBack);
      const label = (txt: string, col: string, ink: string, rot: number, s: number, dx: number, dy: number) => {
        c.save(); c.translate(W / 2 + dx, 470 + dy); c.rotate(rot); c.scale(s, s);
        c.fillStyle = col; c.fillRect(-380, -110, 760, 220);
        c.strokeStyle = ink; c.lineWidth = 3; c.strokeRect(-366, -96, 732, 192); c.lineWidth = 1; c.strokeRect(-356, -86, 712, 172);
        c.font = font(F.serif(600, false), 120); c.textAlign = 'center'; c.fillStyle = ink;
        c.fillText(txt, 0, 40); c.textAlign = 'left';
        c.font = font(F.mono(400), 14); c.textAlign = 'center'; c.fillText('Rx · TAKE AS DIRECTED · KEEP OUT OF REACH OF YOURSELF', 0, 80); c.textAlign = 'left';
        c.restore();
      };
      if (pk > 0) label('POISON', rgba('ink', 0.92), rgba('signal', 1), -0.03, lerp(1.3, 1, pk), 0, 0);
      if (mk > 0) { label('MEDICINE', rgba('bone', 0.97), rgba('ink', 1), 0.05, lerp(1.4, 1, mk), 18, -8); if (t - wMed.start < 0.2) shake = [Math.sin(t * 90) * 7, Math.cos(t * 80) * 5]; }
      karaoke(c, w2.slice(0, 3), t, 110, 820, F.archivo(75, 900), 120, { upper: true, dim: rgba('bone', 0.2) });
      karaoke(c, w2.slice(3), t, 110, 820 + 124, F.archivo(75, 900), 120, { upper: true, dim: rgba('bone', 0.2) });
    }
    this.lb.render(renderer, out);
    comp.draw(renderer, this.L.upload(), out);
    return { bloom: 0.7, vignette: 0.45, shake, fade: 1 - prog(t, f.start, f.start + 0.12) };
  }
}
