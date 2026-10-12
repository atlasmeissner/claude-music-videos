// world — the choruses and the ending (revision 3). One small planet whose axis tilts by one degree on every sung
// "degree" (_od.heading: 0° → 24°), and the village at 50°N that lives on it. Shots cut on the beat between the
// planet (the turn) and the village (what one degree does to the people there). One module serves several timeline
// entries; `params.part` picks the shot list and the lyric pages:
//   c1a  chorus 1: One degree, one degree / Turn so slow you can't see          (0° → 2°)
//   c1b  chorus 1: But the whole world's bending / one degree ×3 / break         (2° → 5°)
//   c2   chorus 2: One degree ×4 / Turn so slow… / But the whole world's bending (5° → 9°)
//   post One degree, whoa ×3 / break (dusk, lights)                              (9° → 12°)
//   fin  final chorus: … the ice line passes the village; "different now": summer (12° → 18°)
//   tag  instrumental: the night side filling with lights                       (18°)
//   coda One degree… was all I need: the last six degrees, quietly               (18° → 24°)
import * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { Layer2D, clearRT, W, H } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { F, font } from '../engine/type';
import { LIN, rgba } from '../engine/palette';
import type { Line } from '../engine/lyrics';
import { clamp, ease, lerp, prog, pulse } from '../engine/util';
import { degreeTimes, drawCompound, drawKaraoke, heading, mono, rad } from './_od';
import { EVENTS, Planet, drawAxis, drawVillage, iceLat, noonSun, season, VILLAGE_LAT, warmth } from './_world';

type PlanetShot = { t0: number; kind: 'planet'; cx: number; cy: number; R0: number; R1: number; spin0: number; spinRate: number; night?: boolean; label?: string };
type VillageShot = { t0: number; kind: 'village'; sc0: number; sc1: number; ox0: number; ox1: number; night0?: number; night1?: number };
type Shot = PlanetShot | VillageShot;
type Page = { lines: number[]; style: 'big' | 'rows' | 'quiet' };

const VILLAGE_LON = 30;
const SPIN0 = 0.75; // the village (lon 30°) drifts across the near side

export default class World extends Scene {
  planet = new Planet();
  lb = new LineBatch(30000);
  text = new Layer2D();
  part = 'c1a';
  shots: Shot[] = [];
  pages: Page[] = [];
  degs: number[] = [];

  override init() {
    const { lyrics: ly, audio: au, start: s, end: e } = this.ctx;
    this.part = this.ctx.params.part ?? 'c1a';
    this.degs = degreeTimes(ly).filter((d) => d >= s - 0.01 && d < e);
    const bf = (t: number) => au.timeOfBeat(Math.floor(au.beatAt(t) + 1e-3));
    const ba = (t: number) => au.timeOfBeat(Math.ceil(au.beatAt(t) - 1e-3));
    const L = (i: number) => ly.lines[i]!;
    const P = (t0: number, o: Partial<PlanetShot> = {}): PlanetShot => ({ t0, kind: 'planet', cx: 1180, cy: 580, R0: 340, R1: 360, spin0: SPIN0, spinRate: 0.04, ...o });
    const V = (t0: number, o: Partial<VillageShot> = {}): VillageShot => ({ t0, kind: 'village', sc0: 1.3, sc1: 1.36, ox0: 960, ox1: 920, ...o });
    // each degree: the planet from just before the word to a beat after it, then the village
    const turns = (ds: number[], o: Partial<PlanetShot> = {}, v: Partial<VillageShot> = {}) => ds.flatMap((d) => [P(bf(d - 0.35), o), V(ba(d + 0.9), v)]);
    const sh: Shot[] = [];
    switch (this.part) {
      case 'c1a': {
        sh.push(P(s, { R0: 330, R1: 350 }));
        const [d1, d2] = this.degs as [number, number];
        sh.push(V(ba(d1 + 1.2)), P(bf(d2 - 0.35)), V(ba(d2 + 1.0)));
        sh.push(P(bf(L(7).words[0]!.start + 0.02), { cx: W / 2 + 160, cy: 720, R0: 300, R1: 520, spinRate: 0.015 }));
        sh.push(V(ba(L(7).words[3]!.start), { sc0: 1.5, sc1: 1.6, ox0: 1000, ox1: 900 }));
        this.pages = [{ lines: [6], style: 'big' }, { lines: [7], style: 'big' }];
        break;
      }
      case 'c1b': {
        sh.push(P(s, { R0: 360, R1: 380 }));
        sh.push(...turns(this.degs));
        sh.push(V(ba(L(9).end + 0.2), { sc0: 1.2, sc1: 1.45, ox0: 1050, ox1: 880, night0: 0, night1: 0.35 }));
        this.pages = [{ lines: [8], style: 'big' }, { lines: [9], style: 'big' }];
        break;
      }
      case 'c2': {
        sh.push(P(s, { R0: 380, R1: 380 }));
        // four degrees in six seconds: turn / village / turn / village
        for (const d of this.degs.slice(0, 4)) sh.push(P(bf(d - 0.3), { R0: 380, R1: 395 }), V(ba(d + 0.45)));
        sh.push(P(bf(L(18).words[0]!.start + 0.02), { cx: W / 2 + 160, cy: 720, R0: 320, R1: 540, spinRate: 0.02 }));
        sh.push(V(ba(L(18).words[3]!.start), { sc0: 1.15, sc1: 1.25 }));
        sh.push(P(bf(L(19).words[0]!.start + 0.02), { R0: 400, R1: 420, label: 'bending' }));
        this.pages = [{ lines: [16, 17], style: 'rows' }, { lines: [18, 19], style: 'rows' }];
        break;
      }
      case 'post': {
        sh.push(P(s, { R0: 380, R1: 390 }));
        sh.push(...turns(this.degs, {}, { sc0: 1.3, sc1: 1.4 }));
        const last = L(22);
        sh.push(P(ba(last.words[2]!.start + 2.0), { cx: W / 2 + 120, cy: 600, R0: 420, R1: 470, spinRate: 0.03 }));
        sh.push(V(bf(e - 9.6), { sc0: 1.2, sc1: 1.38, ox0: 1060, ox1: 860, night0: 0.1, night1: 1 }));
        this.pages = [{ lines: [20, 21, 22], style: 'rows' }];
        break;
      }
      case 'fin': {
        sh.push(P(s, { R0: 380, R1: 390 }));
        for (const d of this.degs.slice(0, 4)) sh.push(P(bf(d - 0.35), { R0: 380, R1: 400 }), V(ba(d + 0.8)));
        sh.push(V(bf(L(28).words[0]!.start + 0.02), { sc0: 1.2, sc1: 1.45, ox0: 1080, ox1: 860 }));
        sh.push(P(bf(L(29).words[0]!.start + 0.02), { R0: 420, R1: 440 }));
        sh.push(V(L(29).words[4]!.start - 0.02, { sc0: 1.45, sc1: 1.55, ox0: 980, ox1: 930 }));
        sh.push(P(bf(L(31).words[0]!.start + 0.02), { cx: W / 2 + 120, cy: 600, R0: 360, R1: 380 }));
        this.pages = [{ lines: [26, 27], style: 'rows' }, { lines: [28, 29], style: 'rows' }, { lines: [30, 31], style: 'rows' }];
        break;
      }
      case 'tag': {
        sh.push(P(s, { cx: W / 2, cy: H / 2, R0: 380, R1: 470, spinRate: 0.06, night: true }));
        sh.push(V(bf(e - 5.6), { sc0: 1.25, sc1: 1.35, night0: 1, night1: 1 }));
        this.pages = [];
        break;
      }
      case 'coda': {
        sh.push(P(s, { cx: W / 2, cy: 470, R0: 250, R1: 270, spinRate: 0.02 }));
        this.pages = [32, 33, 34, 35, 36, 37].map((i) => ({ lines: [i], style: 'quiet' as const }));
        break;
      }
    }
    this.shots = sh.sort((a, b) => a.t0 - b.t0);
  }

  shotAt(t: number): { shot: Shot; u: number } {
    let i = 0;
    while (i + 1 < this.shots.length && this.shots[i + 1]!.t0 <= t) i++;
    const shot = this.shots[i]!;
    const t1 = this.shots[i + 1]?.t0 ?? this.ctx.end;
    return { shot, u: clamp((t - shot.t0) / Math.max(1e-3, t1 - shot.t0)) };
  }

  render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer, comp, lyrics } = this.ctx;
    const t = f.t;
    const tilt = heading(lyrics, t);
    const flare = this.degs.reduce((m, d) => Math.max(m, pulse(t, d, 0.4)), 0);
    const { shot, u } = this.shotAt(t);
    const lb = this.lb; lb.clear();
    const T = this.text, c = T.ctx; T.clear();
    const endFade = this.part === 'coda' ? 1 - prog(t, this.ctx.end - 1.6, this.ctx.end - 0.1, ease.inOutCubic) : 1;
    let planetBox: { cx: number; cy: number; R: number } | null = null;

    if (shot.kind === 'planet') {
      const R = lerp(shot.R0, shot.R1, ease.inOutQuad(u));
      const o = { cx: shot.cx, cy: shot.cy, R, tilt, spin: shot.spin0 + (t - shot.t0) * shot.spinRate, t, fade: endFade,
        light: (shot.night ? [-1, 0.25, -0.35] : [1, 0.16, 0.32]) as [number, number, number] };
      this.planet.render(renderer, out, o);
      drawAxis(lb, o, endFade);
      planetBox = o;
      // the angle between the axis and the vertical, as an arc above the planet
      const ar = R * 1.2, a0 = rad(-90), a1 = rad(-90 + tilt);
      for (let k = 0; k < 16; k++) {
        const x0 = o.cx + Math.cos(lerp(a0, a1, k / 16)) * ar, y0 = o.cy + Math.sin(lerp(a0, a1, k / 16)) * ar;
        const x1 = o.cx + Math.cos(lerp(a0, a1, (k + 1) / 16)) * ar, y1 = o.cy + Math.sin(lerp(a0, a1, (k + 1) / 16)) * ar;
        lb.seg2(x0, y0, x1, y1, 2, [LIN.signal[0] * (1 + flare), LIN.signal[1] * (1 + flare), LIN.signal[2] * (1 + flare)], endFade);
      }
      // the village on the globe
      const v = Planet.project(o, VILLAGE_LAT, VILLAGE_LON);
      if (v.front && !shot.night) {
        lb.seg2(v.x, v.y, v.x + 0.01, v.y, 9, [LIN.signal[0] * 1.5, LIN.signal[1] * 1.5, LIN.signal[2] * 1.5], endFade);
        mono(c, 'THE VILLAGE', v.x + 14, v.y - 10, { size: 12, color: rgba('bone', 0.9 * endFade), track: 3 });
      }
      lb.render(renderer, out);
      // angle label at the arc's end
      c.save(); c.globalAlpha = endFade;
      c.font = font(F.serif(600, true), 40 + 12 * flare); c.fillStyle = rgba('signal', 1); c.textAlign = 'left';
      c.fillText(`${Math.round(tilt)}°`, o.cx + Math.cos(a1) * ar + 16, o.cy + Math.sin(a1) * ar - 10);
      c.restore();
      if (flare > 0.05) {
        c.save(); c.globalAlpha = flare * endFade;
        c.font = font(F.serif(600, true), 64); c.fillStyle = rgba('signal', 1); c.textAlign = 'right';
        c.fillText('+1°', o.cx - R * 1.05, o.cy - R * 0.7);
        c.restore();
      }
      // readout, bottom right (clear of the lyrics)
      const xr = W - 120, yb = 850;
      c.save(); c.globalAlpha = endFade;
      mono(c, 'AXIAL TILT', xr, yb, { size: 12, color: rgba('ash', 0.85), track: 3, align: 'right' });
      mono(c, `${tilt.toFixed(1).padStart(4, '0')}°`, xr, yb + 36, { size: 30, color: rgba('signal', 1), track: 2, align: 'right', weight: 500 });
      mono(c, `ICE LINE ${iceLat(tilt).toFixed(1)}°`, xr, yb + 64, { size: 13, color: rgba('bone', 0.85), track: 3, align: 'right' });
      const km = Math.round((VILLAGE_LAT - iceLat(tilt)) * 111);
      mono(c, shot.night ? 'THE NIGHT SIDE' : km > 0 ? `ICE ${km.toLocaleString('en-US')} KM FROM THE VILLAGE` : 'THE ICE HAS PASSED THE VILLAGE', xr, yb + 88, { size: 12, color: shot.night ? rgba('ember', 0.9) : km > 0 ? rgba('ash', 0.85) : rgba('signal', 1), track: 3, align: 'right' });
      if (this.part === 'coda' && tilt > 23.2) mono(c, 'EARTH: 23.4°', xr, yb - 30, { size: 12, color: rgba('bone', 0.8), track: 3, align: 'right' });
      c.restore();
    } else {
      clearRT(renderer, out, LIN.ink);
      const sc = lerp(shot.sc0, shot.sc1, ease.inOutQuad(u)), ox = lerp(shot.ox0, shot.ox1, ease.inOutQuad(u));
      const night = lerp(shot.night0 ?? 0, shot.night1 ?? 0, ease.inOutQuad(u));
      drawVillage(lb, { tilt, t, scale: sc, ox, groundY: 880, night });
      lb.render(renderer, out);
      // left column under the lyric (the sun has the right of the sky)
      const xl = 124, y0 = 470;
      const w = warmth(tilt);
      mono(c, 'THE VILLAGE · 50°N', xl, y0, { size: 12, color: rgba('ash', 0.85), track: 3 });
      mono(c, `NOON SUN ${noonSun(tilt).toFixed(0)}°`, xl, y0 + 34, { size: 24, color: rgba('signal', 1), track: 2, weight: 500 });
      mono(c, `SNOW ${((1 - w) * 1.8).toFixed(1)} m · SEASON ${season(tilt)} DAYS`, xl, y0 + 60, { size: 12, color: rgba('bone', 0.8), track: 3 });
    }
    // what each degree did to the village: the ledger (village shots), newest first, hot
    if (shot.kind === 'village') {
      const n = Math.floor(tilt + 0.02);
      const xr = 124, y0 = 576;
      for (let k = 0; k < Math.min(4, n); k++) {
        const deg = n - k, ev = EVENTS[deg - 1];
        if (!ev) continue;
        const born = degreeTimes(this.ctx.lyrics)[deg - 1] ?? 0;
        const a = k === 0 ? prog(t, born + 0.15, born + 0.45, ease.outCubic) : 1 - k * 0.22;
        mono(c, `+${deg}°  ${ev}`, xr, y0 + k * 26, { size: k === 0 ? 15 : 12, color: k === 0 ? rgba('signal', a) : rgba('bone', 0.7 * a), track: 2, weight: k === 0 ? 600 : 400 });
      }
    }
    // lyric pages, on a soft dark band when the planet reaches up behind them
    if (planetBox && planetBox.cy - planetBox.R < 340 && this.part !== 'coda') {
      const g = c.createLinearGradient(0, 0, 0, 380);
      g.addColorStop(0, 'rgba(10,11,13,0.9)'); g.addColorStop(0.7, 'rgba(10,11,13,0.75)'); g.addColorStop(1, 'rgba(10,11,13,0)');
      c.fillStyle = g; c.fillRect(0, 0, W, 380);
    }
    this.drawLyrics(c, t, planetBox, endFade);
    // the coda's last word: the year, and Earth
    if (this.part === 'coda') {
      const last = this.degs[this.degs.length - 1] ?? this.ctx.end;
      const y1 = prog(t, last + 0.9, last + 2, ease.outCubic) * endFade;
      if (y1 > 0) {
        c.save(); c.globalAlpha = y1;
        c.font = font(F.serif(400, true), 40); c.textAlign = 'center'; c.fillStyle = rgba('bone', 0.92);
        c.fillText('twenty-four degrees: a world with seasons', W / 2, 1000);
        c.restore();
      }
    }
    drawCompound(c, 120, 1000, t, { ly: lyrics });
    comp.draw(renderer, T.upload(), out);
    return { bloom: 0.62, ca: 0.4, vignette: 0.42, roll: 0, flash: 0.18 * pulse(t, this.degs[2] ?? -9, 0.1) * (this.part === 'fin' ? 1 : 0) };
  }

  drawLyrics(c: CanvasRenderingContext2D, t: number, planet: { cx: number; R: number } | null, alpha: number) {
    const ly = this.ctx.lyrics;
    this.pages.forEach((pg, k) => {
      const first = ly.lines[pg.lines[0]!]!;
      const nxt = this.pages[k + 1] ? ly.lines[this.pages[k + 1]!.lines[0]!]! : null;
      const a = prog(t, first.start - 0.6, first.start - 0.25) * (nxt ? 1 - prog(t, nxt.start - 0.45, nxt.start - 0.15) : 1) * alpha;
      if (a <= 0) return;
      c.save(); c.globalAlpha = a;
      if (pg.style === 'quiet') {
        const st = { family: F.serif(400, true), size: 80, tracking: 0, sung: rgba('bone', 0.96), unsung: rgba('bone', 0.14), active: rgba('signal', 1), lead: 0.6, align: 'center' as const };
        drawKaraoke(c, first, W / 2, 900, t, st);
      } else {
        const big = pg.style === 'big';
        const size = big ? 88 : 72;
        const st = { family: F.archivo(100, 800), size, tracking: big ? -2 : -1.5, sung: rgba('bone', 1), unsung: rgba('bone', 0.16), active: rgba('signal', 1), lead: 0.6 };
        // keep the type clear of the planet: stop short of its left edge
        void planet;
        pg.lines.forEach((li, r) => drawKaraoke(c, ly.lines[li]!, 120, 200 + r * (size * 1.12), t, { ...st, lead: 0.6 + r * 0.8 }));
      }
      c.restore();
    });
  }
}
