// bridge — stripped to handclaps, stomps and voice: "Every great thing started with a jump / Every love began
// with just a name / Every single life worth telling / Started when somebody risked the shame".
// Black. The sung line is stamped word by word across the top (each word punches in on its start). Below, a
// register of firsts fills up, one entry stamped on the last word of each line: № 1 A JUMP · № 2 A NAME · № 3 A LIFE
// WORTH TELLING · № 4 THE SHAME — each with a small diagram (the spark's first parabola, a name tag, a lifeline with
// one mark, and RISKED stamped over the last). Every handclap adds a tally mark along the bottom; the stomps thump
// the ground line. The last line builds: everything shakes harder until the final chorus.
import type * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { Layer2D, clearRT, W, H } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { LIN, rgba } from '../engine/palette';
import { F, font } from '../engine/type';
import type { Line } from '../engine/lyrics';
import { clamp, ease, frameIdx, hash, lerp, prog, pulse, TAU } from '../engine/util';
import { drawKaraoke, mono, sparkHead } from './_ff';
import { stamp } from './ledger-kit';

const ENTRIES = ['A JUMP', 'A NAME', 'A LIFE WORTH TELLING', 'THE SHAME'];

export default class Bridge extends Scene {
  L = new Layer2D();
  lb = new LineBatch(500);
  lines: Line[] = [];
  claps: number[] = [];
  stomps: number[] = [];

  override init() {
    const { lyrics, audio } = this.ctx;
    this.lines = [22, 23, 24, 25].map((i) => lyrics.lines[i]!);
    this.claps = audio.events('snare', this.ctx.start, this.ctx.end).filter(([, s]) => s >= 0.45).map(([t]) => t);
    this.stomps = audio.events('kick', this.ctx.start, this.ctx.end).filter(([, s]) => s >= 0.5).map(([t]) => t);
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const { renderer, comp } = this.ctx;
    const t = f.t, end = this.ctx.end;
    clearRT(renderer, out, LIN.ink);
    const L = this.L, c = L.ctx; L.clear();
    const lb = this.lb; lb.clear();
    const build = prog(t, this.lines[3]!.start, end, ease.inQuad);
    // ---- the current line, stamped word by word
    let cur = 0;
    this.lines.forEach((l, i) => { if (t >= l.start - 0.04) cur = i; });
    const l = this.lines[cur]!;
    drawKaraoke(c, l, 104, 230, t, { family: F.archivo(112.5, 900), size: 78, tracking: -2, sung: rgba('bone', 1), unsung: '', active: rgba('signal', 1), mode: 'slam' });
    mono(c, `${cur + 1} / 4`, W - 104, 96, { size: 13, color: rgba('ash', 0.75), track: 4, align: 'right' });
    mono(c, 'REGISTER OF FIRSTS', 104, 96, { size: 13, color: rgba('ash', 0.75), track: 6 });
    // ---- the register
    this.lines.forEach((ln, i) => {
      const last = ln.words[ln.words.length - 1]!;
      const ts = last.start;
      if (t < ts - 0.02) return;
      const k = clamp((t - ts) / 0.1);
      const y = 400 + i * 120;
      const jitter = (hash(i, 3) - 0.5) * 0.03;
      const sc = 1 + 0.35 * (1 - ease.outBack(k, 2.2));
      c.save();
      c.globalAlpha = clamp(k * 3);
      mono(c, `№ ${i + 1}`, 104, y, { size: 26, color: rgba('ash', 0.9), track: 2, weight: 500 });
      c.translate(240, y); c.rotate(jitter); c.scale(sc, sc);
      c.font = font(F.archivo(112.5, 900), 74); c.letterSpacing = '-1px'; c.textBaseline = 'alphabetic';
      c.fillStyle = i === 3 ? rgba('signal', 1) : rgba('bone', 1);
      c.fillText(ENTRIES[i]!, 0, 0);
      const tw = c.measureText(ENTRIES[i]!).width;
      c.restore();
      // the diagram beside each entry
      const dx = 240 + tw + 70, dk = prog(t, ts + 0.1, ts + 0.7, ease.outCubic);
      c.save(); c.globalAlpha = dk;
      c.strokeStyle = rgba('bone', 0.8); c.lineWidth = 1.6;
      if (i === 0) { // the first parabola
        c.beginPath(); c.moveTo(dx, y); c.lineTo(dx + 40, y);
        for (let u = 0; u <= 1; u += 0.05) c.lineTo(dx + 40 + u * 160 * dk, y - 120 * u * (1 - u) * 2.2 + 30 * u);
        c.stroke();
        c.beginPath(); c.moveTo(dx + 40, y); c.lineTo(dx + 40, y + 30); c.lineTo(dx + 220, y + 30); c.stroke();
      } else if (i === 1) { // a name tag
        c.strokeRect(dx, y - 62, 230, 78);
        c.fillStyle = rgba('signal', 1); c.fillRect(dx, y - 62, 230, 24);
        mono(c, 'HELLO MY NAME IS', dx + 115, y - 45, { size: 11, color: rgba('ink', 1), track: 2, align: 'center', weight: 600 });
        c.font = font(F.serif(600, true), 34); c.fillStyle = rgba('bone', 1); c.textAlign = 'center';
        c.fillText('…', dx + 115, y + 6);
      } else if (i === 2) { // a lifeline with one mark
        c.beginPath(); c.moveTo(dx, y - 20); c.lineTo(dx + 300 * dk, y - 20); c.stroke();
        for (let j = 0; j <= 10; j++) { c.beginPath(); c.moveTo(dx + j * 30, y - 26); c.lineTo(dx + j * 30, y - 14); c.stroke(); }
        c.fillStyle = rgba('signal', 1); c.beginPath(); c.arc(dx + 96, y - 20, 7, 0, TAU); c.fill();
        mono(c, 'HERE', dx + 82, y + 10, { size: 11, color: rgba('signal', 1), track: 3 });
      }
      c.restore();
    });
    // RISKED, stamped over the last entry (on "risked")
    const wR = this.lines[3]!.words[3]!;
    stamp(c, 1320, 790, ['RISKED'], t, wR.start, { size: 40, rot: -0.14 });
    // ---- handclap tally along the bottom, stomp-thumped ground line
    let thump = 0;
    for (const s of this.stomps) thump = Math.max(thump, pulse(t, s, 0.08));
    const gy = 960 + thump * 10;
    c.strokeStyle = rgba('bone', 0.7); c.lineWidth = 1.6;
    c.beginPath(); c.moveTo(104, gy); c.lineTo(W - 104, gy); c.stroke();
    const n = this.claps.filter((x) => x <= t).length;
    for (let i = 0; i < n; i++) {
      const grp = Math.floor(i / 5), j = i % 5;
      const x = 120 + grp * 70 + j * 11;
      if (x > W - 140) break;
      const hot = pulse(t, this.claps[i]!, 0.1);
      c.strokeStyle = hot > 0.1 ? rgba('signal', 1) : rgba('bone', 0.8); c.lineWidth = 2;
      c.beginPath();
      if (j < 4) { c.moveTo(x, gy - 54); c.lineTo(x, gy - 18); } else { c.moveTo(x - 50, gy - 24); c.lineTo(x + 4, gy - 50); }
      c.stroke();
    }
    mono(c, `HANDCLAPS ${n}`, W - 104, gy + 34, { size: 13, color: rgba('ash', 0.85), track: 4, align: 'right' });
    comp.draw(renderer, L.upload(), out);
    // the spark rests on the ground line, hopping on the stomps; it rises with the build
    const sx = lerp(W - 200, W / 2, build), sy = gy - 10 - thump * 26 - build * 380;
    sparkHead(lb, sx, sy, t, 0.8 + build, 0.8 + build);
    lb.render(renderer, out);
    let hit = 0;
    for (const s of this.claps) hit = Math.max(hit, pulse(t, s, 0.05));
    for (const ln of this.lines) hit = Math.max(hit, pulse(t, ln.words[ln.words.length - 1]!.start, 0.09) * 1.4);
    const sh = hit * 6 + build * 10 * (0.5 + 0.5 * Math.sin(t * 60));
    void H;
    return { bloom: 0.6, vignette: 0.5, shake: [(hash(frameIdx(t), 1) - 0.5) * sh, (hash(frameIdx(t), 2) - 0.5) * sh] as [number, number], zoom: 1 + build * 0.05, flash: prog(t, end - 0.07, end) * 0.25 };
  }
}
