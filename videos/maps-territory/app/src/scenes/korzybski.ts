// korzybski — intro: the drum break, then the band.
// On the break, in the dark, the epigraph arrives a phrase per hit: "The map is not the territory." Then a cut to
// paper: the cartographer's full map of the lake country, contours and all, and a loupe that wanders over it.
// Inside the loupe is the territory itself, and it never quite agrees with the sheet. A deadpan legend lists what
// the sheet does not show, one item per two bars, and the loupe snaps to a new place on each.
import * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { Layer2D, clearRT, W } from '../engine/gl';
import { F, font, measure } from '../engine/type';
import { LIN, rgba } from '../engine/palette';
import { clamp, ease, lerp, prog, TAU } from '../engine/util';
import { mono, Terrain, type View } from './_mt';

const NOT_SHOWN = ['WEATHER', 'THE WIND OFF THE SEA', 'THE SOUND OF A HORN', 'WHO YOU WILL MEET', 'HOW IT FEELS UNDERFOOT'];
// loupe stops (screen px)
const STOPS: [number, number][] = [[760, 600], [1060, 430], [620, 380], [980, 700], [700, 560], [860, 520]];

export default class Korzybski extends Scene {
  terrain = new Terrain();
  text = new Layer2D();
  tCut = 0;
  tItems: number[] = [];

  override init() {
    const au = this.ctx.audio;
    // the band comes back on the downbeat after the break
    this.tCut = au.downbeats.find((d) => d > this.ctx.start + 1)!;
    const b0 = au.downbeats.indexOf(this.tCut);
    this.tItems = NOT_SHOWN.map((_, i) => au.downbeats[b0 + 1 + i * 2]!);
  }

  render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer, comp, audio } = this.ctx;
    const t = f.t, t0 = this.ctx.start;
    const T = this.text, c = T.ctx; T.clear();
    const words = [['The map'], ['is not'], ['the territory.']];
    if (t < this.tCut) {
      // ---- the break: the epigraph in the dark, a phrase per hit
      clearRT(renderer, out, LIN.ink);
      const hits = audio.events('snare', t0 - 0.05, this.tCut).concat(audio.events('kick', t0 - 0.05, this.tCut)).map((e) => e[0]).sort((a, b) => a - b);
      const span = this.tCut - t0;
      const times = [t0 + 0.02, hits.find((h) => h > t0 + span * 0.3) ?? t0 + span * 0.35, hits.find((h) => h > t0 + span * 0.6) ?? t0 + span * 0.65];
      const fam = F.serif(400, true), size = 92;
      const full = 'The map is not the territory.';
      const wt = measure(full, fam, size);
      let x = W / 2 - wt / 2;
      c.font = font(fam, size); c.textBaseline = 'alphabetic';
      words.forEach(([w], i) => {
        const k = prog(t, times[i]!, times[i]! + 0.25, ease.outCubic);
        c.fillStyle = rgba('bone', k);
        c.fillText(w!, x, 560 + (1 - k) * 12);
        x += measure(w! + ' ', fam, size);
      });
      comp.draw(renderer, T.upload(), out);
      return { bloom: 0.3, vignette: 0.6, ca: 0.4 };
    }
    // ---- the map and the loupe
    const lt = t - this.tCut;
    const v: View = { cx: 40.5 + lt * 0.06, cy: 43, s: 1920 / 19, rot: 0 };
    // which stop: snaps to the next on each item's downbeat
    let i = 0;
    for (let k = 0; k < this.tItems.length; k++) if (t >= this.tItems[k]! - 0.25) i = k + 1;
    const from = STOPS[Math.max(0, i - 1)]!, to = STOPS[i]!;
    const tk = i === 0 ? this.tCut : this.tItems[i - 1]!;
    const m = i === 0 ? 1 : prog(t, tk - 0.25, tk + 0.35, ease.inOutCubic);
    const drift = 14;
    const lx = lerp(from[0], to[0], m) + Math.sin(t * 0.7) * drift, ly = lerp(from[1], to[1], m) + Math.cos(t * 0.55) * drift;
    const open = prog(t, this.tCut, this.tCut + 0.6, ease.outBack);
    const R = 210 * open;
    this.terrain.draw(renderer, out, { view: v, mapMix: 1, lens: [lx, ly, R, 1], terrInk: 0.8, relief: 3.5, t, contour: 0.04 });

    // the loupe's rim and ticks
    c.save();
    c.strokeStyle = rgba('ink', 0.9); c.lineWidth = 2;
    c.beginPath(); c.arc(lx, ly, R, 0, TAU); c.stroke();
    c.lineWidth = 1;
    c.beginPath(); c.arc(lx, ly, R + 9, 0, TAU); c.stroke();
    for (let k = 0; k < 72; k++) {
      const a = (k / 72) * TAU, l = k % 6 === 0 ? 10 : 5;
      c.beginPath(); c.moveTo(lx + Math.cos(a) * (R + 9), ly + Math.sin(a) * (R + 9)); c.lineTo(lx + Math.cos(a) * (R + 9 + l), ly + Math.sin(a) * (R + 9 + l)); c.stroke();
    }
    c.restore();
    mono(c, '1 : 1', lx + R * 0.72 + 24, ly - R * 0.72 - 10, { size: 13, color: rgba('ink', 0.85), track: 2, weight: 500 });
    mono(c, 'THE TERRITORY', lx, ly + R + 44, { size: 11, color: rgba('ink', 0.7), track: 4, align: 'center' });

    // the epigraph, now a caption on the sheet
    c.font = font(F.serif(500, true), 46); c.fillStyle = rgba('ink', 1); c.textBaseline = 'alphabetic';
    c.fillText('The map is not the territory.', 120, 150);
    mono(c, 'ALFRED KORZYBSKI, 1931', 122, 184, { size: 12, color: rgba('ink', 0.7), track: 3 });

    // legend: what the sheet does not show
    const lxL = 1430, lyL = 690;
    c.fillStyle = rgba('bone', 0.92); c.fillRect(lxL - 24, lyL - 50, 400, 300);
    c.strokeStyle = rgba('ink', 0.8); c.lineWidth = 1; c.strokeRect(lxL - 24, lyL - 50, 400, 300);
    mono(c, 'NOT SHOWN ON THIS SHEET', lxL, lyL - 18, { size: 12, color: rgba('ink', 0.9), track: 3, weight: 600 });
    NOT_SHOWN.forEach((s, k) => {
      const a = prog(t, this.tItems[k]! - 0.05, this.tItems[k]! + 0.2, ease.outCubic);
      if (a <= 0) return;
      const y = lyL + 26 + k * 40;
      c.save(); c.globalAlpha = a;
      c.strokeStyle = rgba('ink', 0.85); c.strokeRect(lxL, y - 12, 13, 13);
      mono(c, s, lxL + 28, y, { size: 14, color: rgba('ink', 1), track: 2 });
      c.restore();
    });
    mono(c, 'SHEET 0 · THE LAKE COUNTRY · CONTOURS 40 M', 120, 1000, { size: 11, color: rgba('ink', 0.65), track: 3 });
    comp.draw(renderer, T.upload(), out);
    void clamp;
    return { bloom: 0.2, vignette: 0.22, ca: 0.3, halation: 0, paper: 1 };
  }
}
