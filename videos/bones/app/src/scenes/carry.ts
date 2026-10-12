// carry — pre-chorus 1, "What if everything I'm carrying" / "Was never mine to hold". Bone paper.
// A load take-down: the point is the one bearing at the bottom; inherited loads drop onto it one per beat, each a
// labelled block with an OWNER field, and the load readout climbs. On "Was never mine to hold" the owner of each
// block is stamped NOT MINE, sweeping up the stack word by word; on "hold" the stack lifts off the bearing.
import * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { Layer2D, clearRT } from '../engine/gl';
import { F, font } from '../engine/type';
import { LIN, rgba } from '../engine/palette';
import type { Line } from '../engine/lyrics';
import { clamp, ease, lerp, prog, springStep } from '../engine/util';
import { drawFlow, drawLedger, mono, pointPaper, titleBlock } from './_bones';

const LOADS: [string, string, number][] = [
  ['THE WALLS', 'THEM', 520], ['THE SHAPE OF THINGS', 'THEM', 470], ['“BECAUSE”', 'NOBODY', 400],
  ['HOW IT’S ALWAYS BEEN', 'TRADITION', 500], ['THE GOLD', 'THEM', 380], ['THEIR MAP', 'BORROWED', 430],
  ['A STRAIGHT FACE', 'FAMILY', 410], ['THE PLAN', 'THEM', 360], ['SOMEONE ELSE’S GUESS', 'UNKNOWN', 480],
  ['FIVE-YEAR PLAN', 'A FORM', 390],
];
const BX = 1330, BY = 900, BH = 54;

export default class Carry extends Scene {
  text = new Layer2D();
  l4!: Line; l5!: Line;
  drops: number[] = [];

  override init() {
    const { lyrics, audio } = this.ctx;
    this.l4 = lyrics.lines[4]!; this.l5 = lyrics.lines[5]!;
    // one load per beat (and per half beat near the end of the line, as it piles up)
    const b0 = Math.ceil(audio.beatAt(this.l4.start - 0.05));
    const bEnd = audio.beatAt(this.l5.start - 0.1);
    for (let b = b0; b < bEnd && this.drops.length < LOADS.length; b += 0.5) this.drops.push(audio.timeOfBeat(b));
  }

  render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer, comp, lyrics, audio } = this.ctx;
    const t = f.t, s0 = this.ctx.start, end = this.ctx.end;
    clearRT(renderer, out, LIN.bone);
    const T = this.text, c = T.ctx; T.clear();
    // faint drafting grid on the paper
    c.save(); c.strokeStyle = rgba('ink', 0.05); c.lineWidth = 1;
    for (let x = 0; x < 1920; x += 40) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, 1080); c.stroke(); }
    for (let y = 0; y < 1080; y += 40) { c.beginPath(); c.moveTo(0, y); c.lineTo(1920, y); c.stroke(); }
    c.restore();

    const hold = this.l5.words[this.l5.words.length - 1]!;
    const lift = springStep(t - hold.start, 1.4, 0.4) * 46;
    // the bearing: a small plate on a hatched ground, the point on it
    c.save();
    c.strokeStyle = rgba('ink', 0.85); c.lineWidth = 1.4;
    c.beginPath(); c.moveTo(BX - 260, BY + 16); c.lineTo(BX + 260, BY + 16); c.stroke();
    c.lineWidth = 0.8;
    for (let x = BX - 250; x < BX + 260; x += 12) { c.beginPath(); c.moveTo(x, BY + 16); c.lineTo(x - 12, BY + 30); c.stroke(); }
    c.beginPath(); c.moveTo(BX - 18, BY + 16); c.lineTo(BX, BY); c.lineTo(BX + 18, BY + 16); c.closePath(); c.stroke();
    c.restore();
    let n = 0;
    let top = BY - 6 - lift;
    let load = 0;
    LOADS.forEach(([item, owner, w], i) => {
      const td = this.drops[i];
      if (td === undefined || t < td - 0.25) return;
      n++;
      // falls in from above over 0.25 s, lands on the beat with a small squash
      const fall = prog(t, td - 0.25, td, ease.inQuad);
      const sq = Math.max(0, 1 - (t - td) / 0.18) * (t >= td ? 1 : 0);
      const y1 = top, y0 = y1 - BH * (1 - sq * 0.12);
      const yy = lerp(-120 - i * 20, y0, fall);
      const x0 = BX - w / 2 + Math.sin(i * 2.3) * 14;
      c.save();
      c.fillStyle = rgba('bone', 1); c.fillRect(x0, yy, w, BH * (1 - sq * 0.12));
      c.strokeStyle = rgba('ink', 0.9); c.lineWidth = 1.3; c.strokeRect(x0, yy, w, BH * (1 - sq * 0.12));
      // divider and fields
      c.beginPath(); c.moveTo(x0 + w - 150, yy); c.lineTo(x0 + w - 150, yy + BH); c.stroke();
      mono(c, item, x0 + 14, yy + 33, { size: 15, color: rgba('ink', 0.92), track: 2, weight: 500 });
      mono(c, 'OWNER', x0 + w - 140, yy + 19, { size: 9, color: rgba('graphite', 1), track: 2 });
      // the stamp: sweeps up the stack word by word through "Was never mine to hold"
      const ws = this.l5.words;
      const ts = lerp(ws[0]!.start, hold.start, i / (LOADS.length - 1));
      const st = prog(t, ts, ts + 0.12, ease.outCubic);
      if (st < 1) mono(c, owner, x0 + w - 140, yy + 40, { size: 13, color: rgba('ink', 0.8 * (1 - st)), track: 2 });
      if (st > 0) {
        c.save();
        c.translate(x0 + w - 75, yy + 33); c.rotate(-0.08 + Math.sin(i * 1.7) * 0.05); c.scale(1 + (1 - st) * 0.6, 1 + (1 - st) * 0.6);
        c.globalAlpha *= st;
        c.strokeStyle = rgba('signal', 1); c.lineWidth = 2; c.strokeRect(-62, -18, 124, 28);
        c.font = font(F.mono(700), 15); c.letterSpacing = '2px'; c.fillStyle = rgba('signal', 1); c.textAlign = 'center';
        c.fillText('NOT MINE', 0, 2);
        c.restore();
      }
      c.restore();
      // load arrows on the left of each block
      if (fall >= 1) {
        c.save(); c.strokeStyle = rgba('ink', 0.5); c.lineWidth = 1;
        const ax = x0 - 26;
        c.beginPath(); c.moveTo(ax, yy + 8); c.lineTo(ax, yy + BH - 6); c.lineTo(ax - 5, yy + BH - 14); c.moveTo(ax, yy + BH - 6); c.lineTo(ax + 5, yy + BH - 14); c.stroke();
        c.restore();
        load += 121;
      }
      top = y0 - 2;
    });
    // the gap under the lifted stack
    if (lift > 2) {
      c.save(); c.setLineDash([5, 4]); c.strokeStyle = rgba('signal', 0.8); c.lineWidth = 1;
      c.beginPath(); c.moveTo(BX - 200, BY - 6 - lift); c.lineTo(BX + 200, BY - 6 - lift); c.stroke(); c.restore();
      mono(c, 'CLEARANCE', BX - 214, BY - lift / 2, { size: 11, color: rgba('signal', 1), track: 3, align: 'right' });
    }
    pointPaper(c, BX, BY - 4, t, 1);
    // readout
    const shown = lift > 2 ? Math.round(load * (1 - clamp(lift / 46))) : load;
    mono(c, 'LOAD ON BEARING', BX + 290, BY - 40, { size: 11, color: rgba('graphite', 1), track: 3 });
    mono(c, `${shown.toLocaleString('en-US')} kN`, BX + 290, BY - 14, { size: 22, color: rgba(lift > 2 ? 'signal' : 'ink', 1), track: 2, weight: 600 });
    mono(c, `ITEMS  ${n}`, BX + 290, BY + 12, { size: 11, color: rgba('graphite', 1), track: 3 });

    // the lyric, four rows on the left
    const st = { family: F.archivo(100, 800), size: 96, tracking: -2.5, sung: rgba('ink', 1), unsung: rgba('ink', 0.12), active: rgba('signal', 1), lead: 0.6 };
    const row = (l: Line, a: number, b: number, y: number) => drawFlow(c, { ...l, words: l.words.slice(a, b), start: l.words[a]!.start } as Line, 120, y, t, st);
    row(this.l4, 0, 3, 250); row(this.l4, 3, 5, 360);
    const neverMine = this.l5;
    row(neverMine, 0, 3, 540); row(neverMine, 3, 5, 650);
    mono(c, 'LOAD TAKE-DOWN · WHAT IS CARRIED, AND BY WHOM', 122, 720, { size: 12, color: rgba('graphite', prog(t, s0 + 0.4, s0 + 1)), track: 3 });
    drawLedger(c, lyrics, audio, 120, 1012, t, { paper: true });
    titleBlock(c, 'D-201', 'LOADS', [['SCALE', 'INHERITED'], ['BEARING', '1 (YOU)']], { paper: true });
    comp.draw(renderer, T.upload(), out);
    void end;
    return { bloom: 0.4, ca: 0.3, vignette: 0.25, paper: 1, grain: 0.04 };
  }
}
