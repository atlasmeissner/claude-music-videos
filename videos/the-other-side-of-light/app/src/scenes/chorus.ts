// CHORUS ×3 — "So I'm running to the other side of light"
// The inversion. On the chorus downbeat the whole atlas prints as its own negative: bone paper, ink
// type, photographs as negatives (the light at the end of the tunnel turns black, the night road
// turns white). Only the signal orange stays itself: the lamp, the routes, and every red thing in
// every photograph. Four movements, one per line:
//  A "running … light": runners cut on the beat behind word slams; LIGHT blooms.
//  B "every wrong turn made the right one clear/bright": the lamp walks Nolli's Rome, every wrong turn
//    ends in a cross; the right path is what is left when they are all crossed out, and it lights up.
//  C "I'm not chasing (what I want) tonight": a signpost to WANT, struck out; the lamp turns its back.
//  D "I'm just leaving what I fear / I just left behind the fight": the frightening plates of the
//    verses recede into the distance while a deadpan meter counts the distance.
// n = 1, 2, 3 escalate: more cuts, more plates, and the third (the final chorus) breaks down to
// a whisper in B before the last two lines explode.
import type * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { Layer2D, clearRT } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { F, font, measure } from '../engine/type';
import { Lyrics, type Word } from '../engine/lyrics';
import { ease, prog, clamp, lerp, hash, frameIdx } from '../engine/util';
import { sparkHead, sparkParticles } from './_motifs';
import { PlateDrawer, loadImages, caption, LIN, rgba, W, H, kc, LOOK, kb, karaoke, beatsIn, slot, routeLine, xMark, chaikin, along, mixC, Cam, type Line, type PlateOpts } from './_kit';

// empty roads and tracks: the animated runner is the only runner in the shot
/** plates of the verses, flying past as we run */
const PAST = ['1478fd3b', '489800bb', 'b9d92c2a', '633bf87a', 'cma133655', '00fa3566', 'b0150c56', 'cma122351', '5953f9f0', '4e090678', 'cma149107', '65d44a67', 'cma96320', 'b13825ae', 'fcbb40f9'];
/** what we run through in the burst: the roads, and the verses' plates */
const BURST = ['6b6e739e', '1478fd3b', 'de5288b0', '633bf87a', 'f2f80676', 'b9d92c2a', '9b3132d0', 'cma133655', 'dba2a6bb', '00fa3566', '712c27e3', 'b0150c56', '6f07fcb2', 'cma122351', '101aad9d', '5953f9f0', '489800bb', 'cma149107', '4e090678', '65d44a67'];
const RUN = ['6b6e739e', 'de5288b0', 'f2f80676', '9b3132d0', 'dba2a6bb', '712c27e3', '6f07fcb2', '101aad9d'];
const LIGHT = ['b3c52bf4', '452abf93', '938a08c9', '2c314b82', '1beeaf74', 'c6e86ad1', '6f07fcb2', '8da33c9c', 'b089d6b4', '56aa2962'];
const MAPS = ['cma423521', 'cma423516', 'cma423523'];
const SIGNS = ['66159111', '92852d3d', '29335d30'];
const FORK = ['6d2ad4d3', 'c74d162c', '8f9db33c'];
const FEAR: Record<number, string[]> = {
  1: ['cma110180', 'cma133655', '034991cc', 'cma122351', '00fa3566', 'cma141637'],
  2: ['cma141637', 'b0150c56', '9f2efb79', 'cma149107', 'cma106564', 'cma110180'],
  3: ['be25a8b0', 'cma143142', 'cma92937', 'cma141637', '2be192a8', 'cma110180'],
};

/** Paper-world looks: negatives printed in ink on bone, softened so the type reads on top. */
const NEG = (soft = 0.5): Partial<PlateOpts> => ({ ...LOOK.negative, dark: mixC(LIN.bone, LIN.ink, 1 - soft * 0.55), light: LIN.bone, paper: 0.7, redKey: 1 });
const POS = (soft = 0.5): Partial<PlateOpts> => ({ ...LOOK.tone, dark: mixC(LIN.bone, LIN.ink, 1 - soft * 0.55), light: LIN.bone, paper: 0.7, redKey: 1 });

export default class Chorus extends Scene {
  n = 1;
  L = new Layer2D();
  plates = new PlateDrawer();
  lb = new LineBatch(12000, { blend: 'normal' }); // on paper an additive glow would vanish into the white
  ink = new LineBatch(4000, { blend: 'normal' });
  cam = new Cam();
  la!: Line; lb_!: Line; lc!: Line; ld!: Line;
  tB = 0; tC = 0; tD = 0;
  cutsA: number[] = []; cutsD: number[] = [];
  /** route on the map (world px): main path and wrong turns branching off it */
  path: { x: number; y: number }[] = [];
  wrong: { at: number; pts: { x: number; y: number }[] }[] = [];

  override async init() {
    const { lyrics: ly, audio: au, params, start, end } = this.ctx;
    this.n = Number(params.n ?? 1);
    const n = this.n;
    const lines = ly.linesIn(start + 0.01, end - 0.01);
    this.la = lines.find((l) => /running/i.test(l.text))!;
    this.lb_ = lines.find((l) => /wrong turn/i.test(l.text))!;
    this.lc = lines.find((l) => /chasing/i.test(l.text))!;
    this.ld = lines.find((l) => /leaving|left behind/i.test(l.text))!;
    const beatBefore = (t: number) => au.timeOfBeat(Math.floor(au.beatAt(t + 0.02)));
    this.tB = beatBefore(this.lb_.words[0]!.start);
    this.tC = beatBefore(this.lc.words[0]!.start);
    this.tD = beatBefore(this.ld.words[0]!.start);
    this.cutsA = [start, ...beatsIn(au, start + 0.1, this.tB, n === 1 ? 2 : 1)];
    this.cutsD = beatsIn(au, this.tD, end, 2);
    const ids = [...RUN, ...PAST, ...BURST, ...LIGHT, MAPS[n - 1]!, ...SIGNS, ...FORK, ...FEAR[n]!];
    await loadImages(ids);
    // the map route: a main path with wrong turns branching off and ending in crosses
    const main = [{ x: 140, y: 900 }, { x: 420, y: 760 }, { x: 600, y: 800 }, { x: 860, y: 600 }, { x: 1080, y: 640 }, { x: 1280, y: 430 }, { x: 1520, y: 380 }, { x: 1800, y: 180 }];
    this.path = chaikin(main, 2);
    this.wrong = [];
    for (let i = 1; i < main.length - 1; i++) {
      const p = main[i]!;
      const a = hash(i, n) * Math.PI * 2;
      const len = 160 + hash(i, n + 5) * 180;
      const q = { x: p.x + Math.cos(a) * len, y: p.y + Math.sin(a) * len * 0.8 };
      const mid = { x: (p.x + q.x) / 2 + (hash(i, 9) - 0.5) * 80, y: (p.y + q.y) / 2 + (hash(i, 8) - 0.5) * 80 };
      this.wrong.push({ at: i / (main.length - 1), pts: chaikin([p, mid, q], 2) });
    }
  }

  /** Huge word slams: draw words of a line at successive positions, each appearing on its start. */
  slam(c: CanvasRenderingContext2D, words: Word[], t: number, x: number, y: number, size: number, o: { lit?: string; dim?: string; width?: number; last?: string; lastSize?: number; lastY?: number } = {}) {
    karaoke(c, words, t, x, y, F.archivo(o.width ?? 75, 900), size, { upper: true, lit: o.lit ?? rgba('ink', 1), dim: o.dim ?? rgba('ink', 0.12), anticip: 0.12, gap: 0.24 });
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const { renderer, comp, audio: au } = this.ctx;
    const t = f.t, n = this.n;
    clearRT(renderer, out, LIN.bone);
    const c = this.L.ctx; this.L.clear(); this.lb.clear(); this.ink.clear();
    let shake: [number, number] = [0, 0], flash = 0, exposure = 1, bloom = 0.8, zoom = 1;
    const ink = (a: number) => rgba('ink', a);
    // the inversion itself: a white flash into the paper world on the first beat
    flash = Math.pow(0.5, Math.max(0, t - f.start) / 0.09) * 0.9;

    if (t < this.tB) {
      // ---------------- A: running to the other side of light
      const w = this.la.words;
      const k = Math.max(0, slot(this.cutsA, t));
      const tLight = w[w.length - 1]!.start;
      const t0 = this.cutsA[k]!, t1 = this.cutsA[k + 1] ?? this.tB;
      // the burst (as at the start of the outro): plates shoot out of the lamp at the centre, one per beat, and grow
      // toward the camera until they fill the frame and pass us: running forward through the atlas
      const VX = W / 2, VY = H / 2;
      const run = t < tLight - 0.05;
      if (run) {
        const b0 = Math.ceil(au.beatAt(f.start) - 0.01), b1 = Math.floor(au.beatAt(t));
        let latest = '';
        for (let j = Math.max(b0, b1 - 6); j <= b1; j++) {
          const age = t - au.timeOfBeat(j);
          if (age < 0) continue;
          const sc = 0.08 * Math.exp(age * 1.75);
          if (sc > 2.6) continue;
          const id = BURST[(j * 5 + n * 7) % BURST.length]!;
          const ww = W * sc, hh = H * sc;
          const ang = (hash(j, 2) - 0.5) * 0.5;
          const ox = Math.cos(j * 2.4) * 260 * sc, oy = Math.sin(j * 2.4) * 160 * sc;
          this.plates.draw(renderer, out, id, { x: VX + ox - ww / 2, y: VY + oy - hh / 2, w: ww, h: hh, rot: ang * sc, ...NEG(0.2), redKey: 0, border: 1, alpha: clamp(3 - sc * 1.2), seed: j });
          latest = id;
        }
        if (latest) caption(c, latest, 96, H - 52, { color: ink(0.6) });
        sparkHead(this.lb, VX, VY, t, 1.4, 1.4);
      } else {
        // LIGHT: the tunnel's light printed as its own negative (a black sun at the end of a white tunnel)
        const kk = Math.max(0, slot(this.cutsA, t) - slot(this.cutsA, tLight));
        const id = LIGHT[(kk + (n - 1) * 3) % LIGHT.length]!;
        const tl = t - tLight;
        this.plates.draw(renderer, out, id, { x: -60, y: -40, w: W + 120, h: H + 80, zoom: 1.05 + tl * 0.08, ...NEG(0.85), glow: 0, seed: kk });
        caption(c, id, 96, H - 52, { color: ink(0.6) });
        exposure = 1 + 0.15 * Math.pow(0.5, tl / 0.4);
      }
      // type: two lines of slams, then LIGHT
      const nW = w.length;
      const l1 = w.slice(0, 3), l2 = w.slice(3, nW - 1), wl = w[nW - 1]!;
      this.slam(c, l1, t, 110, 300, 150);
      this.slam(c, l2, t, 110, 460, 140);
      const p = Lyrics.wordProgress(wl, t);
      if (t > wl.start - 0.1) {
        const sz = 380 + 30 * prog(t, wl.start, wl.end + 1, ease.outCubic);
        c.font = font(F.archivo(112.5, 900), sz);
        c.fillStyle = rgba('signal', 0.25 + 0.75 * Math.min(1, p * 4));
        c.fillText('LIGHT', 96, 1000);
        bloom = 1.1;
      }
      if (t - f.start < 0.2) shake = [Math.sin(t * 90) * 10, Math.cos(t * 70) * 8];
    } else if (t < this.tC) {
      // ---------------- B: every wrong turn made the right one clear (bright)
      const w = this.lb_.words;
      const tRight = w.find((x) => /right/i.test(x.w))!.start;
      const tEnd = w[w.length - 1]!.start;
      const whisper = n === 3; // the final chorus' breakdown: smaller, slower, darker paper
      const zk = prog(t, this.tB, this.tC, ease.inOutQuad);
      this.cam.set(W / 2 + zk * 60, H / 2 - zk * 30, lerp(1.0, 1.12, zk), -0.03 + zk * 0.05);
      const r = this.cam.rect(-60, -40, W + 120, H + 80);
      this.plates.draw(renderer, out, MAPS[n - 1]!, { ...r, ...LOOK.printPaper, dark: mixC(LIN.bone, LIN.ink, 0.5), light: LIN.bone, gamma: 0.9 });
      caption(c, MAPS[n - 1]!, 96, H - 52, { color: ink(0.6) });
      // walking: the main path is walked from the first word to "right"; every wrong turn is tried and crossed out
      const fw = prog(t, w[0]!.start - 0.2, tRight, ease.linear);
      const reveal = prog(t, tRight, tEnd + 0.3, ease.outCubic);
      const S = (p: { x: number; y: number }) => this.cam.pt(p.x, p.y);
      const mainPart = along(this.path, fw);
      // wrong turns: drawn when the walk reaches their junction, crossed, then (on "clear") fade
      let lamp = S(mainPart.p);
      for (const wt of this.wrong) {
        const tw0 = lerp(w[0]!.start - 0.2, tRight, wt.at) - 0.05;
        const ff = prog(t, tw0, tw0 + 0.32, ease.outCubic);
        if (ff <= 0) continue;
        const part = along(wt.pts, ff);
        const sp = part.part.map(S);
        routeLine(this.ink, sp, { w: 3, I: 1, col: LIN.ink, alpha: 0.75 * (1 - reveal * 0.7), dash: 7 });
        if (ff < 1) lamp = S(part.p);
        else {
          const e = S(wt.pts[wt.pts.length - 1]!);
          xMark(this.lb, e.x, e.y, 14, 2.2 * (1 - reveal * 0.5), 3.5);
        }
      }
      // the right path: hairline while walked, then bright and thick on "right … clear"
      const mp = mainPart.part.map(S);
      routeLine(this.ink, mp, { w: 2, col: LIN.ink, alpha: 0.6, dash: 10 });
      if (reveal > 0) {
        const full = along(this.path, reveal).part.map(S);
        routeLine(this.lb, full, { w: 7 + (whisper ? 0 : 4) * reveal, I: 2.2 + reveal * (whisper ? 6 : 2.5) });
      }
      sparkHead(this.lb, lamp.x, lamp.y, t, 1.2, 1.2);
      // a WRONG WAY sign stamped on "wrong" (and on "turn" in the louder choruses)
      const ww = w.find((x) => /wrong/i.test(x.w))!, wtn = w.find((x) => /turn/i.test(x.w))!;
      [ww, wtn].forEach((word, i) => {
        if (whisper && i === 1) return;
        const k = prog(t, word.start, word.start + 0.14, ease.outBack) * (1 - reveal);
        if (k <= 0) return;
        const id = SIGNS[(i + n) % SIGNS.length]!;
        const R = { x: 1180 + i * 260, y: 120 + i * 210, w: 400, h: 280 };
        this.plates.draw(renderer, out, id, { ...R, rot: (i ? -0.08 : 0.06), ...POS(1), dark: LIN.ink, redKey: 1, border: 1, alpha: k, paper: 0.8 });
        caption(c, id, R.x, R.y + R.h + 22, { short: true, size: 11, color: ink(0.6 * k) });
      });
      // type
      const half = Math.ceil(w.length / 2.2);
      const size = whisper ? 96 : 128;
      karaoke(c, w.slice(0, 3), t, 110, 760, F.archivo(75, 900), size, { upper: true, lit: ink(1), dim: ink(0.12) });
      karaoke(c, w.slice(3), t, 110, 760 + size * 1.02, F.archivo(75, 900), size, { upper: true, lit: ink(1), dim: ink(0.12) });
      // strike through WRONG once the right one is clear
      if (reveal > 0) {
        const fam = F.archivo(75, 900);
        const x0 = 110 + measure('EVERY', fam, size) + size * 0.24, wW = measure('WRONG', fam, size);
        this.lb.seg2(x0 - 8, 760 - size * 0.33, x0 - 8 + (wW + 16) * reveal, 760 - size * 0.33, size * 0.09, kc(1.6, LIN.signal), 1);
      }
      if (whisper) { exposure = 0.92; bloom = 1.2; }
      void half;
    } else if (t < this.tD) {
      // ---------------- C: I'm not chasing (what I want) tonight
      const w = this.lc.words;
      const k = prog(t, this.tC, this.tD, ease.linear);
      const id = FORK[(n - 1) % FORK.length]!;
      this.plates.draw(renderer, out, id, { x: -40, y: -30, w: W + 80, h: H + 60, ...kb(t, this.tC, this.tD, 1.05, 1.25, 0, 0, 0.2, -0.1), ...NEG(0.55) });
      caption(c, id, 96, H - 52, { color: ink(0.6) });
      // the signpost: WANT → (to the right, up the road); the lamp walks the other way (left)
      const wantW = w.find((x) => /want|anymore/i.test(x.w))!;
      const sk = prog(t, this.tC + 0.1, this.tC + 0.35, ease.outBack);
      const px = 1240, py = 330;
      c.save(); c.translate(px, py); c.rotate(-0.04); c.globalAlpha = sk;
      c.fillStyle = ink(1);
      c.beginPath(); c.moveTo(0, 0); c.lineTo(440, 0); c.lineTo(520, 70); c.lineTo(440, 140); c.lineTo(0, 140); c.closePath(); c.fill();
      c.fillRect(30, 140, 14, 520);
      c.font = font(F.archivo(100, 900), 96); c.fillStyle = rgba('bone', 1);
      c.fillText(/anymore/i.test(wantW.w) ? 'MORE' : 'WANT', 40, 108);
      c.restore();
      const strike = prog(t, wantW.start, wantW.start + 0.25, ease.outCubic);
      if (strike > 0) this.lb.seg2(px - 20, py + 130, px - 20 + 560 * strike, py + 10 - 60 * strike, 14, kc(2, LIN.signal), 1);
      // the lamp walks left, away from the sign
      const lx = lerp(1100, 160, prog(t, this.tC, this.tD + 0.4, ease.inOutQuad)), ly = 640 + Math.sin(t * 9) * 4;
      routeLine(this.lb, [{ x: 1180, y: 640 }, { x: lx, y: ly }], { w: 3, I: 1.5, dash: 12 });
      sparkHead(this.lb, lx, ly, t, 1.2, 1.2);
      // type: "I'M NOT CHASING" big, the rest after
      const iN = w.findIndex((x) => /chasing/i.test(x.w));
      karaoke(c, w.slice(0, iN + 1), t, 110, 880, F.archivo(87.5, 900), 150, { upper: true, lit: ink(1), dim: ink(0.12) });
      karaoke(c, w.slice(iN + 1), t, 116, 980, F.serif(600, true), 84, { lit: ink(1), dim: ink(0.15) });
      if (n === 3) { bloom = 1.0; shake = [Math.sin(t * 60) * 3 * au.hit('kick', t), 0]; }
    } else {
      // ---------------- D: leaving what I fear / left behind the fight
      const w = this.ld.words;
      const fears = FEAR[n]!;
      // plates recede toward a vanishing point; one launched every two beats
      const vx = W * 0.62, vy = H * 0.42;
      const launched = this.cutsD.map((tc, i) => ({ tc, id: fears[i % fears.length]! })).filter((p) => p.tc <= t);
      for (let i = 0; i < launched.length; i++) {
        const p = launched[i]!;
        const age = t - p.tc;
        const z = 1 + age * 1.8 + age * age * 1.6;
        const s = 1 / z;
        const ww = (W + 80) * s, hh = (H + 60) * s;
        const cx = lerp(W / 2, vx, 1 - s), cy = lerp(H / 2, vy, 1 - s);
        this.plates.draw(renderer, out, p.id, { x: cx - ww / 2, y: cy - hh / 2, w: ww, h: hh, ...POS(0.15), redKey: 0.6, border: 1, alpha: Math.min(1, s * 3), seed: i });
        if (i === launched.length - 1) caption(c, p.id, 96, H - 52, { color: ink(0.6) });
      }
      // the meter
      const dist = Math.max(0, t - this.tD) * 31.7 * (1 + Math.max(0, t - this.tD) * 0.8);
      c.font = font(F.mono(500), 16); c.letterSpacing = '3px'; c.fillStyle = ink(0.85);
      const what = /fight/i.test(this.ld.text) ? 'THE FIGHT' : 'WHAT I FEAR';
      c.fillText(`DISTANCE FROM ${what}: ${dist.toFixed(1)} m`, 96, 96);
      c.letterSpacing = '0px';
      // the lamp comes toward us, getting bigger
      const lk = prog(t, this.tD, f.end, ease.inQuad);
      sparkHead(this.lb, lerp(vx, W * 0.3, lk), lerp(vy, H * 0.75, lk), t, 1 + lk * 3, 1.2);
      // type: the line, the last word shrinking into the distance
      const last = w[w.length - 1]!;
      karaoke(c, w.slice(0, w.length - 1), t, 110, 820, F.archivo(75, 900), 124, { upper: true, lit: ink(1), dim: ink(0.12) });
      if (t > last.start - 0.1) {
        const age = Math.max(0, t - last.end);
        const s = 1 / (1 + age * 1.5);
        const sz = 300 * s;
        c.font = font(F.archivo(125, 900), sz);
        const word = last.w.toUpperCase().replace(/[^A-Z]/g, '');
        c.fillStyle = rgba('signal', Math.min(1, Lyrics.wordProgress(last, t) * 3));
        c.fillText(word, lerp(110, vx - 60, 1 - s), lerp(1010, vy + 40, 1 - s));
      }
      // fade toward the dark plate that follows (chorus 1, 2) or the white climax (3)
      if (n < 3) exposure = 1 - prog(t, f.end - 0.6, f.end, ease.inCubic) * 0.9;
      else flash = Math.max(flash, prog(t, f.end - 0.4, f.end, ease.inCubic) * 1.2);
      if (n === 3) { bloom = 1.1; shake = [Math.sin(t * 70) * 5 * au.hit('kick', t), Math.cos(t * 60) * 4 * au.hit('snare', t)]; }
    }
    this.ink.render(renderer, out);
    this.lb.render(renderer, out);
    comp.draw(renderer, this.L.upload(), out);
    return { bloom, bloomThreshold: 1.0, vignette: 0.2, shake, flash, exposure, zoom, paper: 1, grain: 0.05 };
  }
}
