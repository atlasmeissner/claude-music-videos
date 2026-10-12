// OUTRO — the climax ("oh" vocalise), then the last hit.
// 1. Rewind: every plate of the atlas comes back at us out of the vanishing point, one per beat, and is
//    crossed out as it passes. A counter keeps the deadpan tally.
// 2. The index: the whole atlas as one sheet, 188 plates, unfolding from the centre in sixteenth notes,
//    each one crossed; the camera pulls back to see them all. Then the lamp draws a single route across
//    the whole sheet: the one path left over when every way to lose is crossed out.
// 3. The sheet fades, the route stays; the title sets itself on it. On the last hit the paper goes
//    dark, the lamp is alone again, and goes out.
import type * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { Layer2D, clearRT } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { F, font, measure } from '../engine/type';
import { ease, prog, clamp, lerp, hash } from '../engine/util';
import { sparkHead, sparkParticles } from './_motifs';
import { PlateDrawer, loadImages, caption, LIN, rgba, W, H, kc, LOOK, routeLine, xMark, chaikin, along, mixC, Cam, type PlateOpts } from './_kit';

const HEROES = ['6ed5a954', 'c00ef074', 'fef8f35c', '034991cc', 'b0150c56', '00fa3566', 'cma103244', 'cma122351', '65d44a67', 'fcbb40f9', 'd5a72013', 'b3c52bf4',
  '66159111', 'cma110180', 'bc3176b9', '368b5944', '5953f9f0', 'be1c5d0b', 'fba082d7', 'a5cc0eb7', 'cma142697', 'be25a8b0', 'ea8bb3cb', '50762a57',
  'dba2a6bb', '00919cb2', '2ca7d804', '9892f864', 'cma141637', 'cma133655', '8f9db33c', '473e66d5'];
const ATLAS = '@atlas.jpg';
const COLS = 16, ROWS = 12, NCELL = 188;
const GRID = { x: 0, y: 60, w: 1920, h: 960 };
const NEG: Partial<PlateOpts> = { ...LOOK.negative, dark: mixC(LIN.bone, LIN.ink, 0.7), light: LIN.bone, paper: 0.6, redKey: 1 };

export default class Outro extends Scene {
  L = new Layer2D();
  plates = new PlateDrawer();
  lb = new LineBatch(8000, { blend: 'normal' });
  glow = new LineBatch(2000, { blend: 'add' });
  cam = new Cam();
  d: number[] = [];
  spawn: number[] = [];
  reveal: number[] = [];
  route: { x: number; y: number }[] = [];
  tEnd = 0;
  override async init() {
    await loadImages([...HEROES, ATLAS]);
    const au = this.ctx.audio;
    this.d = au.downbeats.filter((x) => x >= this.ctx.start - 0.05);
    const D = this.d;
    for (let i = 0; i < HEROES.length; i++) this.spawn.push(au.timeOfBeat(Math.round(au.beatAt(D[0]!)) + i));
    // the index unfolds from the centre on sixteenth notes over 2 bars
    const t0 = D[8]!, per = au.timeOfBeat(1) - au.timeOfBeat(0);
    const md = Math.hypot(COLS / 2, ROWS / 2);
    for (let i = 0; i < NCELL; i++) {
      const cx = (i % COLS) + 0.5 - COLS / 2, cy = Math.floor(i / COLS) + 0.5 - ROWS / 2;
      const k = Math.hypot(cx, cy * 1.3) / md + hash(i, 4) * 0.08;
      this.reveal.push(t0 + Math.round(k * 32) * (per / 4));
    }
    // the one route: a snake through the sheet, rows alternating
    const pts: { x: number; y: number }[] = [];
    for (let r = 0; r < 5; r++) {
      const y = GRID.y + 90 + r * ((GRID.h - 180) / 4);
      const xs = [60, 520, 980, 1440, 1860];
      const row = xs.map((x, j) => ({ x, y: y + (hash(r, j) - 0.5) * 70 }));
      pts.push(...(r % 2 ? row.reverse() : row));
    }
    this.route = chaikin(pts, 3);
    this.tEnd = this.ctx.end;
  }
  cellRect(i: number) { const cw = GRID.w / COLS, ch = GRID.h / ROWS; return { x: GRID.x + (i % COLS) * cw, y: GRID.y + Math.floor(i / COLS) * ch, w: cw, h: ch }; }
  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const { renderer, comp, audio: au } = this.ctx;
    const t = f.t, D = this.d;
    const hit = D[21] ?? f.end - 1.5; // the last hit (bar 152 of the song)
    const dark = t >= hit;
    clearRT(renderer, out, dark ? LIN.ink : LIN.bone);
    const c = this.L.ctx; this.L.clear(); this.lb.clear(); this.glow.clear();
    const ink = (a: number) => rgba('ink', a);
    const label = (s: string, x: number, y: number, a = 0.85) => { c.font = font(F.mono(500), 15); c.letterSpacing = '3px'; c.fillStyle = ink(a); c.fillText(s, x, y); c.letterSpacing = '0px'; };
    let flash = 0, bloom = 0.9, shake: [number, number] = [0, 0];
    if (t < D[8]!) {
      // ---- rewind: plates come at us out of the vanishing point
      const vx = W / 2, vy = H / 2;
      const live = this.spawn.map((ts, i) => ({ ts, i })).filter((p) => p.ts <= t && t - p.ts < 2.6).sort((a, b) => a.ts - b.ts);
      let n = 0;
      for (const p of live) {
        const age = t - p.ts;
        const s = 0.08 * Math.exp(age * 1.45);
        const ww = W * s, hh = H * s;
        const id = HEROES[p.i]!;
        const ang = (hash(p.i, 2) - 0.5) * 0.5;
        const ox = Math.cos(p.i * 2.4) * 260 * s, oy = Math.sin(p.i * 2.4) * 160 * s;
        this.plates.draw(renderer, out, id, { x: vx + ox - ww / 2, y: vy + oy - hh / 2, w: ww, h: hh, rot: ang * s, ...NEG, border: 1, alpha: clamp(3 - s * 1.2), seed: p.i });
        if (s > 0.35) xMark(this.lb, vx + ox, vy + oy, 60 * s, 1, 8 * Math.min(1.5, s));
        n = p.i + 1;
      }
      const latest = live[live.length - 1];
      if (latest) caption(c, HEROES[latest.i]!, 96, H - 52, { color: ink(0.7) });
      label(`REWIND · WAYS TO LOSE, REVISITED: ${String(n).padStart(3, '0')} / 188 · ALL AVOIDED`, 96, 96);
      sparkHead(this.glow, vx, vy, t, 1.3, 1.2);
    } else if (!dark) {
      // ---- the index sheet
      const pull = prog(t, D[8]!, D[12]!, ease.inOutCubic);
      this.cam.set(W / 2, H / 2 + 30 * (1 - pull), lerp(3.2, 0.94, pull), lerp(0.08, 0, pull));
      const fadeSheet = prog(t, D[16]!, D[18]!, ease.inOutQuad);
      const r = this.cam.rect(GRID.x, GRID.y, GRID.w, GRID.h);
      this.plates.draw(renderer, out, ATLAS, { ...r, ...NEG, alpha: 1 - fadeSheet * 0.92 });
      // hide the cells not yet unfolded, cross the ones that are
      this.cam.apply(c);
      c.fillStyle = rgba('bone', 1);
      for (let i = 0; i < NCELL; i++) {
        const cr = this.cellRect(i);
        if (t < this.reveal[i]!) { c.fillRect(cr.x - 0.5, cr.y - 0.5, cr.w + 1, cr.h + 1); continue; }
        const k = prog(t, this.reveal[i]!, this.reveal[i]! + 0.12, ease.outBack);
        const p = this.cam.pt(cr.x + cr.w / 2, cr.y + cr.h / 2);
        xMark(this.lb, p.x, p.y, 11 * this.cam.z * k, 0.95 * (1 - fadeSheet * 0.7), 2.4 * Math.max(1, this.cam.z * 0.6));
      }
      for (let i = NCELL; i < COLS * ROWS; i++) { const cr = this.cellRect(i); c.fillRect(cr.x - 0.5, cr.y - 0.5, cr.w + 1, cr.h + 1); }
      c.setTransform(1, 0, 0, 1, 0, 0);
      // the route across the whole sheet
      const fr = prog(t, D[12]!, D[17]!, ease.inOutQuad);
      if (fr > 0) {
        const part = along(this.route, fr);
        const sp = part.part.map((q) => this.cam.pt(q.x, q.y));
        routeLine(this.lb, sp, { w: 9, I: 1.0 });
        if (fr < 1) { sparkHead(this.glow, this.cam.pt(part.p.x, part.p.y).x, this.cam.pt(part.p.x, part.p.y).y, t, 1.5, 1.3); }
      }
      label(fr > 0 ? 'THE ONE ROUTE LEFT · DRAWN BY ELIMINATION' : `INDEX OF PLATES · 188 WAYS · ALL CROSSED`, 96, 50, 0.85 * (1 - fadeSheet));
      // title, set on the route once the sheet has faded
      const tk = prog(t, D[17]!, D[18]!, ease.outCubic);
      if (tk > 0) {
        c.fillStyle = rgba('bone', 0.75 * tk); c.fillRect(0, 400, W, 330);
        c.font = font(F.archivo(100, 900), 150); c.textAlign = 'center'; c.fillStyle = ink(tk);
        c.fillText('THE OTHER SIDE OF', W / 2, 560);
        c.font = font(F.archivo(125, 900), 150); c.fillStyle = rgba('signal', tk);
        c.fillText('LIGHT', W / 2, 700);
        c.font = font(F.mono(500), 22); c.letterSpacing = '10px'; c.fillStyle = ink(0.9 * prog(t, D[18]!, D[18]! + 0.5));
        c.fillText('JOBURGALEX', W / 2, 790);
        c.font = font(F.serif(400, true), 34); c.letterSpacing = '0px'; c.fillStyle = ink(0.75 * prog(t, D[19]!, D[19]! + 0.5));
        c.fillText('Maps & Territory', W / 2, 840);
        c.textAlign = 'left';
      }
      flash = prog(t, hit - 0.2, hit, ease.inCubic) * 0.6;
    } else {
      // ---- after the last hit: the lamp alone in the dark, then out
      const out_ = prog(t, hit + 0.6, f.end - 0.1, ease.inCubic);
      sparkHead(this.glow, W / 2, H / 2, t, 1.2, 1 - out_);
      c.font = font(F.serif(400, true), 40); c.textAlign = 'center'; c.fillStyle = rgba('bone', 0.6 * (1 - out_));
      c.fillText('Invert, always invert.', W / 2, H / 2 + 110); c.textAlign = 'left';
      shake = t - hit < 0.2 ? [Math.sin(t * 90) * 10, Math.cos(t * 70) * 8] : [0, 0];
      bloom = 0.8;
    }
    this.lb.render(renderer, out);
    this.glow.render(renderer, out);
    comp.draw(renderer, this.L.upload(), out);
    return { bloom, bloomThreshold: dark ? 0.85 : 1.0, vignette: dark ? 0.5 : 0.2, flash, shake, paper: dark ? 0 : 1 };
  }
}
