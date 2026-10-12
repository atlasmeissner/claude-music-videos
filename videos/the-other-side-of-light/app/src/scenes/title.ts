// TITLE — "Invert, always invert."
// The lamp (the one orange point of light that walks every route in this atlas) ignites in the dark
// and writes Jacobi's maxim over the plate of his grave; on the bar where the band drops out the
// epigraph turns upside down (umkehren). The atlas opens: Ortelius' world, engraved in bone on ink,
// a compass rose that flips north to south. The lamp draws the routes to every way to lose, each one
// ending in a cross and a deadpan label; the title stamps in word by word, and on the drop the whole
// sheet prints as its own negative. Collapse to the lamp: "I drew a map…"
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { Layer2D, clearRT } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { F, font, measure } from '../engine/type';
import { strokeText, drawStrokeText, writtenLength, type StrokeText } from '../engine/stroke';
import { ease, prog, hash, lerp, clamp, smoothstep } from '../engine/util';
import { sparkHead, sparkParticles } from './_motifs';
import { PlateDrawer, loadImages, caption, charTimesLinear, Cam, LIN, rgba, W, H, mixC, kc } from './_kit';

const IMG = { grave: 'b7a82383', world: '6ed5a954', rose: '80a40402' };
const MAP = { x: 110, y: 90, w: 1700, h: 1050 }; // world rect of the Ortelius sheet (its own aspect ~1.6)
/** Routes on the map, in map-uv (0..1), with the label at their cross. */
const ROUTES: { pts: [number, number][]; label: string }[] = [
  { pts: [[0.5, 0.52], [0.44, 0.47], [0.38, 0.5], [0.3, 0.42]], label: 'RUIN' },
  { pts: [[0.3, 0.42], [0.36, 0.62], [0.33, 0.74]], label: 'A LIE, TOLD TWICE' },
  { pts: [[0.33, 0.74], [0.52, 0.66], [0.6, 0.72]], label: 'A BURNT BRIDGE' },
  { pts: [[0.6, 0.72], [0.66, 0.5], [0.72, 0.38]], label: 'THE BOTTOM' },
  { pts: [[0.72, 0.38], [0.8, 0.46], [0.86, 0.6]], label: 'COMFORT' },
  { pts: [[0.86, 0.6], [0.7, 0.28], [0.58, 0.24]], label: 'GLORY (UNVERIFIED)' },
  { pts: [[0.58, 0.24], [0.5, 0.36], [0.5, 0.5]], label: 'FEAR' },
];

export default class Title extends Scene {
  L = new Layer2D();
  plates = new PlateDrawer();
  lb = new LineBatch(6000, { blend: 'add' });
  ink = new LineBatch(4000, { blend: 'normal' });
  cam = new Cam();
  d: number[] = [];
  maxim!: StrokeText;

  override async init() {
    await loadImages(Object.values(IMG));
    const au = this.ctx.audio;
    this.d = au.downbeats.filter((x) => x < this.ctx.end + 0.1);
    this.maxim = strokeText('Man muss immer umkehren.', 'hscript', 118, 0);
  }

  /** Downbeat i (bar), with fraction. */
  D(i: number) { const d = this.d; const k = Math.floor(i); const a = d[k] ?? 0, b = d[k + 1] ?? a + 1.496; return a + (b - a) * (i - k); }

  mapPt(u: number, v: number) { return this.cam.pt(MAP.x + u * MAP.w, MAP.y + v * MAP.h); }

  /** Lamp position along the routes at time t (routes start at bar 9, one every 2 beats... per bar). */
  routeState(t: number) {
    const t0 = this.D(9), per = (this.D(16) - this.D(9)) / ROUTES.length;
    const k = clamp(Math.floor((t - t0) / per), -1, ROUTES.length - 1);
    const f = k < 0 ? 0 : clamp((t - t0 - k * per) / (per * 0.7));
    return { k, f: ease.inOutCubic(f), per, t0 };
  }
  polyAt(pts: [number, number][], f: number) {
    const seg: number[] = [];
    let tot = 0;
    for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i]![0] - pts[i - 1]![0], (pts[i]![1] - pts[i - 1]![1]) * 0.62); seg.push(l); tot += l; }
    let s = f * tot;
    for (let i = 1; i < pts.length; i++) {
      if (s <= seg[i - 1]! || i === pts.length - 1) { const u = clamp(s / seg[i - 1]!); return { u: lerp(pts[i - 1]![0], pts[i]![0], u), v: lerp(pts[i - 1]![1], pts[i]![1], u), i }; }
      s -= seg[i - 1]!;
    }
    return { u: pts[0]![0], v: pts[0]![1], i: 1 };
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const { renderer, comp } = this.ctx;
    const t = f.t;
    const D = (i: number) => this.D(i);
    // inversion: the drop (bar 16) prints the sheet as its own negative, until bar 17
    const inv = t >= D(16) && t < D(17) ? 1 - prog(t, D(17) - 0.25, D(17), ease.inCubic) : 0;
    const bg = mixC(LIN.ink, LIN.bone, inv);
    clearRT(renderer, out, bg);
    const c = this.L.ctx; this.L.clear();
    this.lb.clear(); this.ink.clear();
    const fg = (a: number) => (inv > 0.5 ? rgba('ink', a) : rgba('bone', a));

    // ---------------- phase A: the epigraph over Jacobi's grave (0 .. bar 6.6)
    const lampA = { x: W / 2, y: 470 };
    if (t < D(7)) {
      const irisR = prog(t, D(1), D(5), ease.outCubic) * 1.2;
      const turn = prog(t, D(6), D(6) + 0.7, ease.inOutCubic);
      const fade = 1 - prog(t, D(6) + 0.3, D(7), ease.inCubic);
      // the grave plate: the sign fills the frame, engraved, very dim
      this.plates.draw(renderer, out, IMG.grave, {
        x: -40, y: -40, w: W + 80, h: H + 80, zoom: 2.25 + t * 0.012, panX: 0.0, panY: -0.27, treat: 'engrave', freq: 0.2, angle: 0.5,
        dark: LIN.ink, light: kc(0.16 + 0.1 * turn, LIN.bone), invert: turn, lo: 0.1, hi: 0.9, reveal: 'iris', rp: irisR, rsoft: 0.5, rx: 0.5, ry: 0.44, alpha: fade, paper: 0.3,
      });
      c.save();
      c.translate(W / 2, 560); c.rotate(Math.PI * turn); c.translate(-W / 2, -560);
      c.globalAlpha = fade;
      // the maxim, written by the lamp
      const st = this.maxim;
      const x0 = W / 2 - st.width / 2, y0 = 470;
      const len = writtenLength(st, charTimesLinear('Man muss immer umkehren.', D(1) + 0.4, D(4) - 0.2), t);
      c.save(); c.translate(x0, y0);
      c.strokeStyle = rgba('bone', 0.95); c.lineWidth = 2.4; c.lineCap = 'round'; c.lineJoin = 'round';
      const head = drawStrokeText(c, st, len);
      c.restore();
      if (head && len < st.total - 0.5) { lampA.x = x0 + head.x; lampA.y = y0 + head.y; }
      else if (len >= st.total - 0.5) { lampA.x = x0 + st.width + 30; lampA.y = y0 - 10; }
      // translation + attribution
      const k1 = prog(t, D(4), D(4) + 0.6, ease.outCubic), k2 = prog(t, D(5), D(5) + 0.6, ease.outCubic);
      c.textAlign = 'center';
      c.font = font(F.serif(400, true), 64); c.fillStyle = rgba('bone', 0.92 * k1);
      c.fillText('Invert, always invert.', W / 2, 620 + (1 - k1) * 14);
      c.font = font(F.mono(400), 17); c.letterSpacing = '3px'; c.fillStyle = rgba('ash', 0.9 * k2);
      c.fillText('— CARL GUSTAV JACOB JACOBI, MATHEMATICIAN, 1804–1851', W / 2, 686);
      c.letterSpacing = '0px'; c.textAlign = 'left';
      c.restore();
      if (t > D(1) - 0.2 && t < D(7)) {
        const ig = prog(t, D(1) - 0.2, D(1) + 0.3, ease.outCubic) * fade;
        // the lamp follows the rotation
        const a = Math.PI * turn, dx = lampA.x - W / 2, dy = lampA.y - 560;
        const lx = W / 2 + Math.cos(a) * dx - Math.sin(a) * dy, ly = 560 + Math.sin(a) * dx + Math.cos(a) * dy;
        sparkHead(this.lb, lx, ly, t, 0.9, ig);
      }
      if (t > D(2)) caption(c, IMG.grave, 96, H - 64, { color: rgba('ash', 0.55 * fade) });
    }

    // ---------------- phase B: the atlas (bar 6.4 .. 25.6)
    if (t >= D(6) + 0.4 && t < D(17) + 0.6) {
      const push = prog(t, D(6), D(17), ease.inOutQuad);
      const collapse = prog(t, D(17), D(17) + 1.2, ease.inExpo);
      const z = lerp(0.92, 1.12, push) * lerp(1, 0.02, collapse);
      this.cam.set(W / 2 + push * 40, H / 2 + 30, z, -0.02 + push * 0.03);
      const rs = this.routeState(t);
      const lampW = rs.k < 0 ? { u: 0.5, v: 0.52 } : this.polyAt(ROUTES[rs.k]!.pts, rs.f);
      const lp = this.mapPt(lampW.u, lampW.v);
      const iris = prog(t, D(6) + 0.4, D(8.5), ease.outCubic) * 1.4;
      const r = this.cam.rect(MAP.x, MAP.y, MAP.w, MAP.h);
      this.plates.draw(renderer, out, IMG.world, {
        ...r, treat: 'tone', invert: 1 - inv, lo: 0.38, hi: 0.97, gamma: 1.25,
        dark: inv > 0.5 ? LIN.bone : LIN.ink, light: inv > 0.5 ? LIN.ink : kc(0.7, LIN.bone),
        reveal: 'iris', rp: iris, rsoft: 0.35, rx: (lp.x - r.x) / r.w, ry: (lp.y - r.y) / r.h, paper: 0.6, seed: 3,
      });
      // compass rose, flips north to south when the band comes in (bar 9)
      const flip = prog(t, D(9) - 0.08, D(9) + 0.35, ease.outBack);
      const rk = prog(t, D(7), D(8), ease.outCubic) * (1 - collapse);
      if (rk > 0) {
        const R = 250;
        this.plates.draw(renderer, out, IMG.rose, {
          x: W - 96 - R, y: H - 120 - R, w: R, h: R, rot: Math.PI * flip + t * 0.05, treat: 'tone', invert: 1 - inv, lo: 0.3, hi: 0.95, gamma: 1.2,
          dark: inv > 0.5 ? LIN.bone : LIN.ink, light: inv > 0.5 ? LIN.ink : LIN.bone, reveal: 'iris', rp: 0.5 * rk, rsoft: 0.02,
        });
      }
      // routes: dashed hairline behind, signal line drawn by the lamp, a cross and a label at the end
      for (let k = 0; k <= rs.k; k++) {
        const R = ROUTES[k]!;
        const fk = k < rs.k ? 1 : rs.f;
        const pts: { x: number; y: number }[] = [];
        const N = 40;
        for (let i = 0; i <= N; i++) { const q = this.polyAt(R.pts, (i / N) * fk); pts.push(this.mapPt(q.u, q.v)); }
        for (let i = 1; i < pts.length; i++) if (i % 2 === 1 || k === rs.k) this.lb.seg2(pts[i - 1]!.x, pts[i - 1]!.y, pts[i]!.x, pts[i]!.y, 2.2 * Math.max(0.5, z), kc(1.4, LIN.signal), 0.9);
        if (fk >= 1) {
          const e = pts[pts.length - 1]!, s = 11 * z;
          const hit = prog(t, rs.t0 + k * rs.per + rs.per * 0.7, rs.t0 + k * rs.per + rs.per * 0.7 + 0.25, ease.outBack);
          const ss = s * (0.4 + 0.6 * hit) * (1 + 0.6 * (1 - hit));
          this.lb.seg2(e.x - ss, e.y - ss, e.x + ss, e.y + ss, 3.2, kc(2.2, LIN.signal), 1);
          this.lb.seg2(e.x - ss, e.y + ss, e.x + ss, e.y - ss, 3.2, kc(2.2, LIN.signal), 1);
          c.font = font(F.mono(500), 15); c.letterSpacing = '2px';
          c.fillStyle = inv > 0.5 ? rgba('ink', 0.9 * hit) : rgba('bone', 0.9 * hit);
          c.fillText(R.label, e.x + 18, e.y - 12); c.letterSpacing = '0px';
        }
      }
      if (t >= D(6) + 0.4) {
        sparkHead(this.lb, lp.x, lp.y, t, 1.0, 1);
        if (rs.k >= 0 && rs.f < 1) sparkParticles(this.lb, t, (tb) => { const s = this.routeState(tb); if (s.k < 0) return null; const q = this.polyAt(ROUTES[s.k]!.pts, s.f); return this.mapPt(q.u, q.v); }, { rate: 60, speed: 160, life: 0.35 });
      }
      // sheet annotations
      const ak = prog(t, D(7), D(7) + 0.5) * (1 - collapse);
      c.font = font(F.mono(500), 15); c.letterSpacing = '4px'; c.fillStyle = fg(0.85 * ak);
      c.fillText('AN ATLAS OF EVERY WAY TO LOSE', 96, 96);
      c.font = font(F.mono(400), 13); c.letterSpacing = '2px'; c.fillStyle = fg(0.55 * ak);
      c.fillText('SHEET I · THE KNOWN WORLD · SCALE 1 : ∞', 96, 120);
      c.letterSpacing = '0px';
      if (ak > 0) caption(c, IMG.world, 96, H - 64, { color: fg(0.5 * ak) });
      if (rk > 0) caption(c, IMG.rose, W - 96, H - 64, { color: fg(0.45 * ak), align: 'right', short: true });

      // the title, a word per beat from bar 14
      const words = ['THE', 'OTHER', 'SIDE', 'OF', 'LIGHT'];
      const tb = (i: number) => this.ctx.audio.timeOfBeat(Math.round(this.ctx.audio.beatAt(D(14))) + i * 2);
      const titleK = 1 - collapse;
      c.save();
      const fam = F.archivo(100, 900), size = 168;
      const lines = [[0, 1], [2, 3, 4]];
      let y = 560;
      for (const ln of lines) {
        let x = 120;
        for (const wi of ln) {
          const ts = tb(wi);
          const k = prog(t, ts, ts + 0.18, ease.outExpo);
          if (k > 0) {
            c.font = font(fam, size);
            const lit = wi === 4;
            c.fillStyle = lit ? rgba('signal', titleK) : fg(titleK);
            c.save(); c.translate(x, y); c.scale(1, 0.6 + 0.4 * k); c.globalAlpha = k; c.fillText(words[wi]!, 0, 0); c.restore();
          }
          x += measure(words[wi]!, fam, size) + size * 0.24;
        }
        y += size * 0.98;
      }
      const ak2 = prog(t, tb(0) - 0.4, tb(0)) * titleK;
      c.font = font(F.mono(500), 22); c.letterSpacing = '9px'; c.fillStyle = fg(0.9 * ak2);
      c.fillText('JOBURGALEX', 124, 380);
      c.font = font(F.serif(400, true), 34); c.letterSpacing = '0px'; c.fillStyle = fg(0.75 * ak2);
      c.fillText('from Maps & Territory', 124, 420);
      c.restore();
    }
    // phase C: the lamp alone, waiting for "I drew a map"
    if (t >= D(17) + 0.6) sparkHead(this.lb, W / 2, H / 2, t, 1.0, 1);

    this.lb.render(renderer, out);
    comp.draw(renderer, this.L.upload(), out);
    return { bloom: 0.7, vignette: 0.45, grain: 0.06, paper: inv };
  }
}
