// edge — the intro (guitar strums, handclaps; the stomps come in at ~19.9 s). Crop-marked sheet (the bookend).
// Ink, in elevation: the spark draws a hairline ground out to a cliff edge whose drop leaves the frame, and waits
// there, sputtering, hopping on the beat. On every downbeat a safety sign slams onto the edge (CAUTION, MIND THE
// DROP, NO JUMPING, COUNT THE COST…) until the edge is a thicket of warnings. With the stomps the title slams in
// (FREE · FALL · JOBURGALEX) and the stomps knock the signs off, one per hit. THE ODDS read 1 : 1.
import * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { Layer2D, clearRT, W } from '../engine/gl';
import { F, font } from '../engine/type';
import { LIN, rgba } from '../engine/palette';
import { clamp, ease, hash, lerp, prog, pulse, TAU } from '../engine/util';
import { LineBatch } from '../engine/lines';
import { bigWord, drawFigure, drawNo, drawPanel, drawOdds, drawWarning, mono, POSES, sparkHead, sparkParticles } from './_ff';

const GROUND = 790, EDGE = 1130;

type SignKind = { k: 'warn' | 'bang' | 'panel' | 'no' | 'nojump'; text?: string[]; w?: number; h?: number; fill?: string; ink?: string };
const SIGNS: (SignKind & { x: number; y: number; s: number; rot: number })[] = [
  { k: 'warn', x: 1290, y: 470, s: 210, rot: -0.04 },
  { k: 'panel', text: ['CAUTION', 'CLIFF EDGE'], w: 360, h: 170, x: 1600, y: 360, s: 1, rot: 0.03 },
  { k: 'panel', text: ['MIND', 'THE DROP'], w: 330, h: 190, fill: 'signal', x: 1500, y: 640, s: 1, rot: -0.05 },
  { k: 'nojump', x: 1790, y: 640, s: 105, rot: 0.06 },
  { k: 'panel', text: ['COUNT', 'THE COST'], w: 300, h: 170, fill: 'ink', ink: 'bone', x: 1120, y: 250, s: 1, rot: 0.05 },
  { k: 'panel', text: ['MEASURE', 'TWICE'], w: 300, h: 160, x: 1420, y: 160, s: 1, rot: -0.03 },
  { k: 'panel', text: ['THINK IT', 'THROUGH'], w: 290, h: 160, fill: 'signal', x: 1760, y: 150, s: 1, rot: 0.04 },
  { k: 'bang', x: 860, y: 230, s: 170, rot: 0.08 },
  { k: 'panel', text: ['ARE YOU', 'SURE?'], w: 280, h: 160, x: 640, y: 460, s: 1, rot: -0.06 },
];

/** Which sign each stomp knocks off, in order (ARE YOU SURE? goes as the title lands). */
const KNOCK = [8, 7, 6, 5, 4, 3];

export default class Edge extends Scene {
  lb = new LineBatch(3000);
  text = new Layer2D();
  db: number[] = [];
  stomps: number[] = [];
  sparkAt: { x: number; y: number } | null = null;

  override init() {
    const au = this.ctx.audio;
    this.db = au.downbeats.filter((d) => d < this.ctx.end);
    // the half-time stomps from the groove's entry: every second beat from 19.85
    const kicks = au.events('kick', 19.6, this.ctx.end + 0.1).filter(([, s]) => s >= 0.8).map(([k]) => k);
    this.stomps = kicks;
  }

  signTime(i: number) { return this.db[2 + i] ?? 99; } // from the 3rd downbeat (≈4.4 s), one per bar

  render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer, comp } = this.ctx;
    const t = f.t, end = this.ctx.end;
    clearRT(renderer, out, LIN.ink);
    const L = this.text, c = L.ctx; L.clear();

    // ---- the ground in elevation: hairline top, engraved section below, the edge
    const draw = prog(t, this.db[0]! - 0.1, this.db[2]! - 0.15, ease.inOutCubic); // the spark is the pen
    c.save();
    c.beginPath(); c.rect(0, GROUND, EDGE * draw, 1080 - GROUND); c.clip();
    c.fillStyle = rgba('ink2', 1); c.fillRect(0, GROUND, EDGE, 400);
    c.strokeStyle = rgba('graphite', 0.55); c.lineWidth = 1;
    for (let x = -400; x < EDGE + 400; x += 14) { c.beginPath(); c.moveTo(x, GROUND); c.lineTo(x + 300, 1080); c.stroke(); }
    c.restore();
    c.strokeStyle = rgba('bone', 0.95); c.lineWidth = 2.2; c.lineCap = 'round';
    c.beginPath(); c.moveTo(0, GROUND); c.lineTo(EDGE * draw, GROUND); c.stroke();
    const drop = prog(t, this.db[2]! - 0.3, this.db[2]! + 0.4, ease.outCubic);
    if (drop > 0) { c.beginPath(); c.moveTo(EDGE, GROUND); c.lineTo(EDGE + 6, GROUND + (1080 - GROUND) * drop); c.stroke(); }
    // survey ticks along the ground on the strums (hats)
    const ticks = prog(t, 2.2, 4.6);
    for (let i = 0; i < 24 * ticks; i++) {
      const x = 40 + i * 46;
      if (x > EDGE - 10) break;
      c.strokeStyle = rgba('bone', i % 5 === 0 ? 0.7 : 0.35); c.lineWidth = 1;
      c.beginPath(); c.moveTo(x, GROUND + 8); c.lineTo(x, GROUND + (i % 5 === 0 ? 30 : 18)); c.stroke();
    }
    if (drop > 0.5) {
      mono(c, 'EDGE', EDGE + 18, GROUND + 26, { size: 12, color: rgba('ash', 0.8), track: 3 });
      mono(c, 'DROP  ? m', EDGE + 18, GROUND + 48, { size: 12, color: rgba('signal', 0.9), track: 3 });
    }
    mono(c, 'SITE 01 · ELEVATION · SCALE 1:20', 64, 1030, { size: 12, color: rgba('ash', 0.7 * draw), track: 3 });

    // ---- the spark: draws the ground, then waits at the edge, hopping on the beat (higher once the stomps come)
    const hopK = prog(t, this.db[2]!, this.db[2]! + 0.6) * (1 + prog(t, 19.4, 20) * 1.6);
    const hop = Math.sin(Math.PI * (f.beat % 1)) * 9 * hopK;
    const sx = draw < 1 ? EDGE * draw : EDGE - 26, sy = GROUND - 9 - hop;
    this.sparkAt = t > this.db[0]! - 0.1 ? { x: sx, y: sy } : null;

    // ---- signs, one per downbeat; knocked off by the stomps (last sign first)
    const knock = this.stomps;
    SIGNS.forEach((sg, i) => {
      const ts = this.signTime(i);
      if (t < ts - 0.02) return;
      const k = clamp((t - ts) / 0.16);
      const sc = 1 + 0.5 * (1 - ease.outBack(k, 2.2));
      const al = clamp(k * 4);
      // knock-off: the last sign falls on the first late stomp, and so on
      const ki = KNOCK.indexOf(i);
      const tk = ki >= 0 ? knock[ki] : undefined;
      let dy = 0, drot = 0;
      if (tk !== undefined && t > tk) {
        const u = t - tk;
        dy = 900 * u * u + 120 * u;
        drot = (hash(i, 5) - 0.5) * 2.4 * u;
      }
      const jitter = pulse(t, ts, 0.12) * 10;
      c.save();
      c.translate(sg.x + (hash(i, 9) - 0.5) * jitter, sg.y + dy);
      c.rotate(sg.rot + drot);
      c.scale(sc, sc);
      c.globalAlpha = al;
      // the post
      c.fillStyle = rgba('graphite', 0.9);
      if (dy === 0) c.fillRect(-4, 40, 8, GROUND - sg.y);
      if (sg.k === 'warn') drawWarning(c, 0, 0, sg.s, 'fall');
      else if (sg.k === 'bang') drawWarning(c, 0, 0, sg.s, 'bang');
      else if (sg.k === 'nojump') {
        drawNo(c, 0, 0, sg.s, 0);
        drawFigure(c, -6, 8, sg.s * 1.2, POSES.leap, { color: rgba('ink', 1) });
        drawNo(c, 0, 0, sg.s, 1, { disc: 'rgba(0,0,0,0)' });
      } else {
        const fill = sg.fill === 'signal' ? rgba('signal', 1) : sg.fill === 'ink' ? rgba('ink2', 1) : rgba('bone', 1);
        const ink = sg.ink === 'bone' ? rgba('bone', 1) : rgba('ink', 1);
        drawPanel(c, -sg.w! / 2, -sg.h! / 2, sg.w!, sg.h!, { fill, ink, text: sg.text, border: true, size: sg.h! * 0.26 });
      }
      c.restore();
    });

    // ---- the title on the stomps: FREE · FALL · artist
    const st = this.stomps;
    const tF = st[0] ?? 19.85, tF2 = st[1] ?? 20.69, tA = st[2] ?? 21.53;
    const slam = (t0: number) => clamp((t - t0) / 0.12);
    const out2 = 1;
    if (t > tF - 0.02) {
      const k = slam(tF);
      bigWord(c, 'FREE', 120, 330, 250, { color: rgba('bone', 1), align: 'left', sx: 1 + 0.25 * (1 - ease.outBack(k, 2)), sy: 1 + 0.25 * (1 - ease.outBack(k, 2)), alpha: clamp(k * 3) * out2 });
    }
    if (t > tF2 - 0.02) {
      const k = slam(tF2);
      bigWord(c, 'FALL', 120, 560, 250, { color: rgba('signal', 1), align: 'left', sx: 1 + 0.25 * (1 - ease.outBack(k, 2)), sy: 1 + 0.25 * (1 - ease.outBack(k, 2)), alpha: clamp(k * 3) * out2 });
    }
    if (t > tA - 0.02) {
      const k = prog(t, tA, tA + 0.5, ease.outCubic);
      c.save(); c.globalAlpha = k * out2;
      c.font = font(F.mono(500), 22); c.letterSpacing = '14px'; c.fillStyle = rgba('bone', 0.95);
      c.fillText('JOBURGALEX', 128, 640);
      c.font = font(F.mono(400), 13); c.letterSpacing = '5px'; c.fillStyle = rgba('ash', 0.8);
      c.fillText('MAPS & TERRITORY', 128, 676);
      c.restore();
    }
    // pre-title kicker on the first strums
    const kick = prog(t, 2.3, 3.0) * (1 - prog(t, this.signTime(0) - 0.3, this.signTime(0)));
    if (kick > 0) mono(c, 'A SHORT SAFETY BRIEFING', 64, 96, { size: 14, color: rgba('ash', 0.85 * kick), track: 6 });

    // THE ODDS, deadpan, bottom left: 1 : 1 (nothing has been leapt yet)
    const oa = prog(t, this.db[3]!, this.db[3]! + 0.5) * (1 - prog(t, 19.3, 19.8));
    if (oa > 0) { c.save(); c.globalAlpha = oa; drawOdds(c, 64, 960, 1, { scale: 0.9 }); c.restore(); }
    comp.draw(renderer, L.upload(), out);
    // the spark (additive, on top)
    const lb = this.lb; lb.clear();
    if (this.sparkAt) {
      const at = (tb: number) => {
        const d = prog(tb, this.db[0]! - 0.1, this.db[2]! - 0.15, ease.inOutCubic);
        const hk = prog(tb, this.db[2]!, this.db[2]! + 0.6) * (1 + prog(tb, 19.4, 20) * 1.6);
        const hp = Math.sin(Math.PI * (this.ctx.audio.beatAt(tb) % 1)) * 9 * hk;
        return tb < this.db[0]! - 0.1 ? null : { x: d < 1 ? EDGE * d : EDGE - 26, y: GROUND - 9 - hp };
      };
      let stompHot = 0;
      for (const s0 of this.stomps) stompHot = Math.max(stompHot, pulse(t, s0, 0.15));
      sparkParticles(lb, t, at, { rate: 70, speed: 200, intensity: 0.9 + stompHot });
      sparkHead(lb, this.sparkAt.x, this.sparkAt.y, t, 0.9 + stompHot * 0.6, 1 + stompHot);
    }
    lb.render(renderer, out);
    // hits: sign slams and stomps
    let hit = 0;
    for (let i = 0; i < SIGNS.length; i++) hit = Math.max(hit, pulse(t, this.signTime(i), 0.1));
    for (const s of st) hit = Math.max(hit, pulse(t, s, 0.12) * 1.3);
    void LIN; void TAU; void W;
    return { bloom: 0.6, vignette: 0.4, frame: 1, shake: [hit * 7, hit * 4] as [number, number], zoom: 1 + hit * 0.01 };
  }
}
