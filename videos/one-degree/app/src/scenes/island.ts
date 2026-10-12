// island — the choruses and the ending (revision 4): the world is one small island balanced on the needle. It tips
// one degree on the first sung "degree" and stays there; every later "degree" sends a surge down the river it set
// running, and the land comes alive behind the water (see _island.ts). One module serves several timeline entries;
// `params.part` picks the shot list, the light and the lyric pages:
//   c1a  One degree, one degree / Turn so slow you can't see       the tip; the lake spills; the level
//   c1b  But the whole world's bending / one degree ×3 / break       the river bends its way across
//   c2   One degree ×4 / Turn so slow… / bending                     trees, the first houses
//   post One degree, whoa ×3 / break                                  fields, people; dusk, windows
//   fin  final chorus … different now / was all I need               the whole world alive; the river reaches the edge
//   tag  instrumental                                                 night: lights
//   coda One degree… was all I need                                   the last surges, quietly, into the morning
import * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { Layer2D, clearRT, W } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { F, font } from '../engine/type';
import { LIN, rgba } from '../engine/palette';
import { clamp, ease, lerp, prog, pulse } from '../engine/util';
import { degreeTimes, drawCompound, drawKaraoke, mono } from './_od';
import { ITEMS, PATH, RIVER_KM, View, WIDE, drawAxes, drawIsland, drawLevel, pathAt, spreadAt, tiltAt, type Cam } from './_island';

type Shot = { t0: number; cam: (S: number, u: number) => Cam };
type Page = { lines: number[]; style: 'big' | 'rows' | 'quiet' };

export default class Island extends Scene {
  lb = new LineBatch(90000, { blend: 'normal' });
  lbTop = new LineBatch(4000, { blend: 'add' });
  text = new Layer2D();
  view = new View();
  part = 'c1a';
  shots: Shot[] = [];
  pages: Page[] = [];
  degs: number[] = [];
  nightKeys: [number, number][] = [];
  closeK = 0;

  override init() {
    const { lyrics: ly, audio: au, start: s, end: e } = this.ctx;
    this.part = this.ctx.params.part ?? 'c1a';
    const all = degreeTimes(ly);
    this.degs = all.filter((d) => d >= s - 0.01 && d < e);
    const bf = (t: number) => au.timeOfBeat(Math.floor(au.beatAt(t) + 1e-3));
    const ba = (t: number) => au.timeOfBeat(Math.ceil(au.beatAt(t) - 1e-3));
    const L = (i: number) => ly.lines[i]!;
    const tmp = new View();
    const tilt = 1;
    // cameras
    const wide = (z0 = 1, z1 = 1.04, ax = WIDE.ax, ay = WIDE.ay, fx0 = 0, fx1 = 0) => (_S: number, u: number): Cam =>
      ({ ax, ay, fx: lerp(fx0, fx1, ease.inOutQuad(u)), fy: 0, zoom: lerp(z0, z1, ease.inOutQuad(u)) });
    const at = (x: number, z: number, h: number, z0: number, z1 = z0 * 1.05) => (_S: number, u: number): Cam => {
      tmp.set(tilt, WIDE); const f = tmp.focusOf(x, z, h);
      return { ax: W / 2 + 80, ay: 600, fx: f.x, fy: f.y, zoom: lerp(z0, z1, ease.inOutQuad(u)) };
    };
    const track = (zoom = 2.2, back = 0.06) => (S: number, u: number): Cam => {
      const p = pathAt(Math.max(0, Math.min(1, S) - back));
      tmp.set(tilt, WIDE); const f = tmp.focusOf(p.x, p.z, 10);
      return { ax: W / 2 + 120, ay: 620, fx: f.x, fy: f.y, zoom: zoom * (1 + 0.04 * u) };
    };
    const level = (z0 = 3.6, z1 = 3.9) => at(0, 0.86, 8, z0, z1);
    const village = (s0: number, zoom = 2.4) => { const p = pathAt(s0); return at(p.x, p.z - 0.06, 14, zoom, zoom * 1.08); };
    const end = PATH[PATH.length - 1]!;
    const sh: Shot[] = [];
    const S_ = (t0: number, cam: Shot['cam']) => sh.push({ t0, cam });
    const D = this.degs;
    switch (this.part) {
      case 'c1a': {
        S_(s, wide(1, 1.03));
        S_(ba(D[1]! + 0.4), at(-0.33, 0.06, 0, 2.6, 2.9)); // the lake spills
        S_(bf(L(7).words[0]!.start + 0.02), wide(1.03, 1.12));
        S_(bf(L(7).words[3]!.start + 0.02), level()); // "you can't see": the level can
        this.pages = [{ lines: [6], style: 'big' }, { lines: [7], style: 'big' }];
        this.nightKeys = [[s, 0]];
        break;
      }
      case 'c1b': {
        S_(s, wide(1.02, 1.05));
        S_(bf(L(8).words[3]!.start + 0.02), track(2.3)); // "bending": the river bends its way across
        S_(bf(D[0]! - 0.3), wide(1.0, 1.04));
        S_(ba(D[1]! + 0.4), track(2.5));
        S_(bf(D[2]! - 0.3), wide(1.0, 1.03));
        S_(ba(L(9).end + 0.3), at(0.05, 0.1, 0, 1.0, 1.4));
        this.pages = [{ lines: [8], style: 'big' }, { lines: [9], style: 'big' }];
        this.nightKeys = [[s, 0]];
        break;
      }
      case 'c2': {
        S_(s, wide(1, 1.03));
        D.forEach((d, i) => S_(i % 2 ? bf(d - 0.3) : ba(d + 0.45), i % 2 ? wide(1.0, 1.03) : track(2.3)));
        S_(bf(L(18).words[0]!.start + 0.02), village(0.12, 2.3));
        S_(bf(L(19).words[0]!.start + 0.02), wide(0.98, 1.06));
        this.pages = [{ lines: [16, 17], style: 'rows' }, { lines: [18, 19], style: 'rows' }];
        this.nightKeys = [[s, 0]];
        break;
      }
      case 'post': {
        S_(s, wide(1, 1.03));
        for (const d of D) { S_(bf(d - 0.3), wide(1.0, 1.03)); S_(ba(d + 1.0), track(2.2)); }
        S_(ba(L(22).end + 0.3), village(0.2, 2.2));
        S_(bf(e - 6.2), wide(1.15, 0.98));
        this.pages = [{ lines: [20, 21, 22], style: 'rows' }];
        this.nightKeys = [[s, 0], [L(22).end - 1, 0.05], [e - 1, 0.85]];
        break;
      }
      case 'fin': {
        S_(s, wide(1, 1.03));
        D.slice(0, 4).forEach((d, i) => S_(i % 2 ? bf(d - 0.3) : ba(d + 0.45), i % 2 ? wide(1.0, 1.03) : track(2.0)));
        S_(bf(L(28).words[0]!.start + 0.02), level(3.4, 3.7)); // "Turned so slow I couldn't see": still one degree
        S_(bf(L(29).words[0]!.start + 0.02), wide(1.3, 0.96)); // "the whole world's different now"
        S_(ba(D[4]! + 0.5), at(end.x - 0.35, end.z - 0.2, 0, 1.5, 1.62)); // the river reaches the edge
        S_(bf(D[5]! - 0.3), wide(0.96, 1.0));
        this.pages = [{ lines: [26, 27], style: 'rows' }, { lines: [28, 29], style: 'rows' }, { lines: [30, 31], style: 'rows' }];
        this.nightKeys = [[s, 0.6], [s + 3, 0]];
        break;
      }
      case 'tag': {
        S_(s, wide(0.97, 1.08, WIDE.ax, WIDE.ay, -40, 40));
        S_(bf(e - 5.6), village(0.3, 2.3));
        this.pages = [];
        this.nightKeys = [[s, 0], [s + 4, 1]];
        break;
      }
      case 'coda': {
        S_(s, wide(0.82, 0.74, W / 2, 470));
        this.pages = [32, 33, 34, 35, 36, 37].map((i) => ({ lines: [i], style: 'quiet' as const }));
        this.nightKeys = [[s, 1], [e - 6, 0.25]];
        break;
      }
    }
    this.shots = sh.sort((a, b) => a.t0 - b.t0);
  }

  nightAt(t: number) {
    const k = this.nightKeys;
    if (!k.length) return 0;
    if (t <= k[0]![0]) return k[0]![1];
    for (let i = 0; i + 1 < k.length; i++) if (t < k[i + 1]![0]) return lerp(k[i]![1], k[i + 1]![1], ease.inOutQuad(clamp((t - k[i]![0]) / (k[i + 1]![0] - k[i]![0]))));
    return k[k.length - 1]![1];
  }

  render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer, comp, lyrics } = this.ctx;
    const t = f.t;
    const tilt = tiltAt(lyrics, t);
    const S = spreadAt(lyrics, t);
    const night = this.nightAt(t);
    let i = 0;
    while (i + 1 < this.shots.length && this.shots[i + 1]!.t0 <= t) i++;
    const shot = this.shots[i]!;
    const t1 = this.shots[i + 1]?.t0 ?? this.ctx.end;
    const u = clamp((t - shot.t0) / Math.max(1e-3, t1 - shot.t0));
    const cam = shot.cam(S, u);
    this.closeK = clamp((cam.zoom - 1.3) / 0.3);
    const v = this.view; v.set(tilt, cam);
    const endFade = this.part === 'coda' ? 1 - prog(t, this.ctx.end - 1.6, this.ctx.end - 0.1, ease.inOutCubic) : 1;
    const all = degreeTimes(lyrics);
    const surge = all.slice(1).map((d) => (t - d - 0.15) / 2.4);
    clearRT(renderer, out, LIN.ink);
    const lb = this.lb; lb.clear();
    drawIsland(lb, v, { t, S, tilt, night, surge, alpha: endFade });
    drawLevel(lb, v, tilt, endFade);
    lb.render(renderer, out);
    const top = this.lbTop; top.clear();
    const ax = drawAxes(top, v, t, { alpha: endFade * (cam.zoom > 1.6 ? 0.6 : 1) });
    top.render(renderer, out);

    const T = this.text, c = T.ctx; T.clear();
    // the angle: "1°" between the plumb line and the world's axis (wide shots)
    const flare = pulse(t, all[0]!, 0.6);
    if (tilt > 0.05 && cam.zoom < 1.6) {
      c.save(); c.globalAlpha = clamp(tilt) * endFade;
      c.font = font(F.serif(600, true), 46 + 30 * flare); c.fillStyle = rgba('signal', 1); c.textAlign = 'left';
      c.fillText(`${tilt.toFixed(0)}°`, ax.tip.x + 14, ax.tip.y + 26);
      c.restore();
    }
    // readout, bottom right
    const xr = W - 120, yb = 868;
    const houses = ITEMS.reduce((m, it) => m + (it.kind === 'house' ? clamp((S - it.k - 0.06) / 0.1) : 0), 0);
    const people = 2 + Math.round(houses * 37);
    const km = Math.round(clamp(S) * RIVER_KM);
    c.save(); c.globalAlpha = endFade * (this.part === 'coda' ? 0.7 : 1);
    mono(c, 'TILT', xr, yb, { size: 12, color: rgba('ash', 0.85), track: 3, align: 'right' });
    mono(c, `${tilt.toFixed(1)}°`, xr, yb + 34, { size: 30, color: rgba('signal', 1), track: 2, align: 'right', weight: 500 });
    mono(c, km > 0 ? `THE RIVER ${km} KM` : 'THE LAKE IS STILL', xr, yb + 62, { size: 13, color: rgba('bone', 0.85), track: 3, align: 'right' });
    mono(c, `LIVING HERE ${people.toLocaleString('en-US')}`, xr, yb + 86, { size: 13, color: rgba('bone', 0.85), track: 3, align: 'right' });
    c.restore();
    this.drawLyrics(c, t, endFade);
    if (this.part === 'coda') {
      const last = this.degs[this.degs.length - 1] ?? this.ctx.end;
      const y1 = prog(t, last + 0.9, last + 1.9, ease.outCubic) * endFade;
      if (y1 > 0) {
        c.save(); c.globalAlpha = y1;
        c.font = font(F.serif(400, true), 40); c.textAlign = 'center'; c.fillStyle = rgba('bone', 0.92);
        c.fillText('one degree, once', W / 2, 1000);
        c.restore();
      }
    }
    if (this.part !== 'coda') drawCompound(c, 120, 1000, t, { ly: lyrics });
    comp.draw(renderer, T.upload(), out);
    return { bloom: 0.55, ca: 0.35, vignette: 0.4, roll: 0 };
  }

  drawLyrics(c: CanvasRenderingContext2D, t: number, alpha: number) {
    const ly = this.ctx.lyrics;
    this.pages.forEach((pg, k) => {
      const first = ly.lines[pg.lines[0]!]!;
      const nxt = this.pages[k + 1] ? ly.lines[this.pages[k + 1]!.lines[0]!]! : null;
      // pages hand over cleanly: the old one is gone before the new one fades in (no double exposure)
      const a = (k === 0 ? prog(t, first.start - 0.6, first.start - 0.25) : prog(t, first.start - 0.3, first.start - 0.08)) * (nxt ? 1 - prog(t, nxt.start - 0.55, nxt.start - 0.32) : 1) * alpha;
      if (a <= 0) return;
      c.save(); c.globalAlpha = a;
      if (pg.style === 'quiet') {
        const st = { family: F.serif(400, true), size: 80, tracking: 0, sung: rgba('bone', 0.96), unsung: rgba('bone', 0.14), active: rgba('signal', 1), lead: 0.6, align: 'center' as const };
        drawKaraoke(c, first, W / 2, 900, t, st);
      } else {
        const big = pg.style === 'big';
        const size = big ? 88 : 72;
        // a soft dark band behind the type, so it stays readable over the trees in close shots
        // (denser in close shots, where the island fills the frame behind the type)
        const close = this.closeK, bandH = 380 + 40 * close;
        const g = c.createLinearGradient(0, 0, 0, bandH);
        g.addColorStop(0, `rgba(10,11,13,${0.85 + 0.12 * close})`); g.addColorStop(0.7, `rgba(10,11,13,${0.6 + 0.3 * close})`); g.addColorStop(1, 'rgba(10,11,13,0)');
        c.fillStyle = g; c.fillRect(0, 0, W, bandH);
        const st = { family: F.archivo(100, 800), size, tracking: big ? -2 : -1.5, sung: rgba('bone', 1), unsung: rgba('bone', 0.16), active: rgba('signal', 1), lead: 0.6 };
        pg.lines.forEach((li, r) => drawKaraoke(c, ly.lines[li]!, 120, 200 + r * (size * 1.12), t, { ...st, lead: 0.6 + r * 0.8 }));
      }
      c.restore();
    });
  }
}
