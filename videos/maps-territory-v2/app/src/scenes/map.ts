// map — the whole song on one map, one continuous shot (the camera moves, it never cuts).
//
//  intro    the sheet in the dark; the French horn's call rings out from HOME and lights it; the title; on the drum
//           break "The map is not the territory."; a plotter draws the empty sheet (frame, coast, lake, compass,
//           scale, a card with the title and the legend).
//  verse 1  THE PLAN, the universal milestones, drawn as they are sung: the ruled road HOME → RETIREMENT, a tick a
//           year, the places named, the districts coloured in; the verse written by a second pen on the card.
//  pre 1    the camera goes down to HOME; on "ground" the paper under the lamp opens onto the real ground; on
//           "page" HOME gets its real name: JOHANNESBURG.
//  then     THE TRAIL, Joburgalex's own life, walks away from the plan one event per cue (see _story.ts): it traces the
//           plan's road ("someone else's story"), leaves it across the lake (LEFT FOR EUROPE, off the shore), MUNICH,
//           rain where the plan forecast sun, MARRIED ("found a feast": a second trail joins, a table of lamps), TWO
//           CHILDREN ("the detour was the real road": two small lamps follow), RAN A COMPANY ("headed east"), WOUND
//           IT UP ("now I'm lost": the road washes out, the compass spins), loops, AN AI RED TEAM, MY OWN PLATFORM
//           ("arrive"), MAKING MUSIC ("beautiful": rings, like the horn's), and off the shore to the islet: HERE.
//           Wherever the trail has been, the paper is cut away and the territory shows through; by the last chorus
//           the whole sheet is territory, and the plan is peeled off like tape.
//  outro    night again; the horn rings out from HERE; the camera pulls back from the whole map; the title; silence.
//
// A strip along the bottom (the sheet's title block) carries the lyric, word-synced, and the current event.
import * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { Layer2D } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { F, font, measure } from '../engine/type';
import { LIN, rgba } from '../engine/palette';
import type { Line } from '../engine/lyrics';
import { clamp, ease, frameIdx, hash, lerp, prog, pulse, TAU } from '../engine/util';
import { strokeText, drawStrokeText, writtenLength, type StrokeText } from '../engine/stroke';
import { coastX, ISLET, PLAN, PLAN_PTS, track, trackAt, WAY, waySAt, wayIx, WORLD } from './_world';
import { charTimes, compassStar, drawKaraoke, lamp, lerpView, mixCss, mono, neatline, placeMark, sc, Terrain, w2s, type RGB, type View } from './_mt';
import { COL_X, drawFurniture, penCross, SHEET_VIEW } from './_sheet';
import { drawThePlan, lineProg, planAt, PLAN_LEN } from './_plan';
import { story, walked, type Story } from './_story';

const STRIP = 172; // height of the title-block strip (px)
const SY = 1080 - STRIP;
const C_HORN = 4.2; // km/s: the horn's call across the country (slowed, so it can be seen)

const sm = (x: number) => ease.inOutSine(clamp(x));

export default class MapScene extends Scene {
  terrain = new Terrain();
  ink = new LineBatch(6000, { blend: 'normal' });
  glow = new LineBatch(24000);
  text = new Layer2D();
  st!: Story;
  verse: Line[] = [];
  vSt: StrokeText[] = [];
  vCt: [number, number][][] = [];
  jhb!: StrokeText;
  beats: number[] = [];
  spouse: { x: number; y: number }[] = [];
  sLegs: Record<string, number> = {};

  override init() {
    const { lyrics, audio } = this.ctx;
    this.st = story(lyrics, audio);
    this.verse = [0, 1, 2, 3].map((i) => lyrics.lines[i]!);
    this.vSt = this.verse.map((l) => strokeText(l.text, 'script', 40, 0));
    this.vCt = this.verse.map((l) => charTimes(l, l.text));
    this.jhb = strokeText('Johannesburg', 'script', 34, 0);
    this.beats = audio.beats;
    // the second trail that joins at MARRIED: a soft curve in from the south-west
    const m = WAY[wayIx('MARRIED')]!;
    const a = { x: m.x - 9.5, y: m.y + 8.5 }, b = { x: m.x - 6, y: m.y + 1.5 };
    for (let i = 0; i <= 60; i++) {
      const u = i / 60, v = 1 - u;
      this.spouse.push({ x: v * v * a.x + 2 * u * v * b.x + u * u * m.x + 0.25 * Math.sin(u * 17), y: v * v * a.y + 2 * u * v * b.y + u * u * m.y + 0.2 * Math.cos(u * 13) });
    }
    for (const n of ['LEFT FOR EUROPE', 'MARRIED', 'TWO CHILDREN', 'RAN A COMPANY', 'WOUND IT UP', 'MAKING MUSIC', 'HERE']) this.sLegs[n] = waySAt(wayIx(n));
    this.sLegs['EAST SHORE'] = waySAt(wayIx('LEFT FOR EUROPE') + 1);
  }

  /** The head's position averaged over ±0.8 s (a steadicam on the walker). */
  steady(t: number) {
    let x = 0, y = 0, n = 0;
    for (let k = -4; k <= 4; k++) { const p = trackAt(walked(this.st, t + k * 0.2)); x += p.x; y += p.y; n++; }
    return { x: x / n, y: y / n };
  }
  follow(t: number, s: number, rot = 0): View {
    const p = this.steady(t);
    // the strip covers the bottom: keep the walker in the middle of what is left
    const dy = (540 - (SY / 2)) / s;
    return { cx: p.x, cy: p.y + dy, s, rot };
  }

  /** The camera: a list of shots blended into one move. */
  cam(t: number): View {
    const T = this.st.T as Record<string, number>;
    const WIDE: View = { cx: 46.5, cy: 52.5, s: 10.2, rot: 0 };
    const shots: [number, (t: number) => View, number][] = [
      // [start, view, blend into this shot (s)]
      [0, (t) => lerpView({ ...SHEET_VIEW, s: 7.6, cx: 30 }, SHEET_VIEW, sm(t / T.sheet!)), 0],
      [T.sheet!, (t) => lerpView(SHEET_VIEW, { cx: 23.6, cy: 48.5, s: 9.0, rot: 0 }, sm((t - T.sheet!) / (T.pre1! - T.sheet!))), 0.5],
      [T.pre1!, (t) => lerpView({ cx: 13, cy: 61.5 + (540 - SY / 2) / 34, s: 34, rot: 0 }, { cx: 14, cy: 60.5 + (540 - SY / 2) / 26, s: 26, rot: 0 }, sm((t - T.pre1!) / (T.tracing! - T.pre1!))), 3.0],
      [T.tracing!, (t) => this.follow(t, lerp(24, 20, sm((t - T.tracing!) / 12))), 1.6],
      [T.verse2! - 1.5, (t) => this.follow(t, 27), 2.0],
      [T.pre2!, () => WIDE, 2.2],
      [T.chorus2!, (t) => this.follow(t, 25), 2.4],
      [T.bridge!, (t) => this.follow(t, 36, 0.45 * Math.sin((t - T.bridge!) * 0.42)), 2.0],
      [T.arrive! - 3.5, (t) => this.follow(t, 17, 0), 3.0],
      [T.final! + 0.5, (t) => this.follow(t, 21), 2.0],
      [T.inst!, (t) => this.follow(t, 26), 1.5],
      [T.here! - 1, () => ({ cx: ISLET.x - 1.2, cy: ISLET.y + (540 - SY / 2) / 46, s: 46, rot: 0 }), 2.0],
      [T.build!, (t) => lerpView({ cx: ISLET.x - 1.2, cy: ISLET.y + (540 - SY / 2) / 46, s: 46, rot: 0 }, WIDE, sm((t - T.build!) / (T.final2! - T.build!))), 0.3],
      [T.final2!, (t) => lerpView(WIDE, { ...WIDE, s: 10.8, cx: 47 }, sm((t - T.final2!) / (T.outro! - T.final2!))), 0.5],
      [T.outro!, (t) => lerpView({ ...WIDE, s: 10.8, cx: 47 }, { cx: 64, cy: 58 + (540 - SY / 2) / 16, s: 16, rot: 0 }, sm((t - T.outro!) / (T.band! - T.outro!))), 1.5],
      [T.band!, (t) => lerpView({ cx: 64, cy: 58 + (540 - SY / 2) / 16, s: 16, rot: 0 }, { cx: 50, cy: 50, s: 6.4, rot: 0 }, sm((t - T.band!) / (T.horn! + 2 - T.band!))), 0.5],
    ];
    let i = 0;
    for (let k = 0; k < shots.length; k++) if (t >= shots[k]![0] - shots[k]![2] / 2) i = k;
    const [s0, f0, b0] = shots[i]!;
    const v = f0(t);
    if (i > 0 && b0 > 0 && t < s0 + b0 / 2) {
      const prev = shots[i - 1]![1](t);
      return lerpView(prev, v, sm((t - (s0 - b0 / 2)) / b0));
    }
    return v;
  }

  render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer, comp, audio, lyrics } = this.ctx;
    const t = f.t;
    const st = this.st, T = st.T as Record<string, number>;
    const v = this.cam(t);
    const s = walked(st, t);
    const head = trackAt(s);
    const evs = st.events;
    const fired = (name: string) => evs.find((e) => e.name === name)!.t;
    const after = (name: string, d = 0.35) => prog(t, fired(name), fired(name) + d, ease.outCubic);

    // ---------------------------------------------------------------- the world
    const warm = prog(t, T.final!, T.final! + 9, ease.inOutSine) * (1 - prog(t, T.outro!, T.outro! + 8, ease.inOutSine));
    // the cut-away corridor along the trail: narrow at first, wider as the life goes on, then (from the build in
    // the instrumental) it opens out until the whole sheet is territory; beyond the sheet the land appears at the end
    const R = t < T.ground! ? 0 : lerp(0, 2.2, prog(t, T.ground!, T.ground! + 0.8, ease.outCubic)) - 0.6 * prog(t, T.tracing! - 1, T.tracing! + 1) + 0.9 * prog(t, T.chorus1!, T.chorus2!) + 1.6 * prog(t, T.chorus2!, T.final! + 6)
      + 22 * Math.pow(prog(t, T.build!, T.final2!, ease.inOutSine), 1.6) + 60 * prog(t, T.final2!, T.outro!, ease.inOutSine);
    const G = prog(t, T.peel!, T.outro! - 1, ease.inOutSine); // the country beyond the sheet's edge
    const sea = Math.max(prog(t, T.now! + 1.5, T.shore!, ease.inOutSine) * (1 - prog(t, T.verse2!, T.verse2! + 3)) * 0.6, prog(t, T.here! - 1.5, T.here! + 1, ease.inOutSine) * (1 - prog(t, T.outro!, T.outro! + 6) * 0.7));
    const dark = 1 - 0.1 * prog(t, 0.2, T.title! + 4, ease.inOutSine) - 0.9 * prog(t, T.sheet! + 0.4, T.sheet! + 2.6, ease.inOutSine);
    const outroDark = prog(t, T.band! + 4, T.horn!, ease.inOutSine) * 0.55 + 0.4 * prog(t, T.end! - 5, T.end! - 0.5, ease.inOutSine);
    const coast = prog(t, T.sheet! + 1.72 * 1.5, T.sheet! + 1.72 * 4.5, ease.inOutCubic);
    this.terrain.draw(renderer, out, {
      view: v, mapMix: 1, contourInk: 0, paperInk: coast, reveal: [t > T.ground! ? (s >= track().total - 0.01 ? s + 5 : Math.max(s, 1.2)) : s, R, G], warmth: warm, seaAcid: sea,
      terrInk: 0.5, relief: 3.2, t, sun: warm > 0.01 ? [lerp(-0.5, -0.8, warm), lerp(-0.6, -0.3, warm), lerp(0.55, 0.42, warm)] : [-0.5, -0.6, 0.55],
      ghost: prog(t, T.band! + 2, T.horn!, ease.inOutSine) * 0.8, contour: 0.05, fadeOut: Math.max(dark * 0.988, outroDark),
    });

    const ink = this.ink; ink.clear();
    const gl = this.glow; gl.clear();
    const L = this.text, c = L.ctx; L.clear();

    // ---------------------------------------------------------------- the horn's call (intro) and the outro's
    const ringsFrom = (src: { x: number; y: number }, tFrom: number, tTo: number, gain: number, col: RGB) => {
      for (let tau = Math.ceil(Math.max(tFrom, t - 14) / 0.6) * 0.6; tau <= Math.min(t, tTo); tau += 0.6) {
        const e = Math.pow(clamp(audio.env('other', tau) * 1.5), 1.3) * gain;
        if (e < 0.02) continue;
        const r = (t - tau) * C_HORN;
        const a = e * Math.exp(-r * 0.035) * (1 - clamp((t - tau) / 14));
        if (a < 0.01) continue;
        const rp = r * v.s;
        const n = Math.min(160, Math.max(24, Math.ceil(rp / 9)));
        const p = w2s(v, src.x, src.y);
        for (let k = 0; k < n; k++) {
          const a0 = (k / n) * TAU, a1 = ((k + 1) / n) * TAU;
          gl.seg2(p.x + Math.cos(a0) * rp, p.y + Math.sin(a0) * rp, p.x + Math.cos(a1) * rp, p.y + Math.sin(a1) * rp, 1.2, col, a);
        }
      }
    };
    const home = PLAN[0]!;
    if (t < T.sheet! + 4) ringsFrom(home, 0, T.sheet!, 1.1 * (1 - prog(t, T.sheet!, T.sheet! + 3)), sc(LIN.ember, 1.3));
    if (t > T.outro! - 1) ringsFrom(WAY[WAY.length - 1]!, T.outro!, T.end!, 0.8, sc(LIN.ember, 0.9));

    // ---------------------------------------------------------------- the plan
    const verse = this.verse;
    const peel = prog(t, T.peel!, lyrics.lines[30]!.end - 0.3, ease.inOutSine);
    if (t > T.verse1! - 0.5) {
      const road = lineProg(verse[0]!, t);
      const ticks = prog(t, verse[1]!.start, verse[1]!.end);
      const places = PLAN.map((_, i) => (i === 0 ? 1 : prog(t, verse[2]!.words[i - 1]?.start ?? 1e9, (verse[2]!.words[i - 1]?.start ?? 1e9) + 0.3, ease.outCubic)));
      const fills = PLAN.map((_, i) => { const w = verse[3]!.words[Math.min(verse[3]!.words.length - 1, Math.floor((i * verse[3]!.words.length) / PLAN.length))]!; const s0 = w.start + (i % 2) * 0.25; return prog(t, s0, s0 + 1.1, ease.inOutSine); });
      const planA = 1 - peel;
      if (planA > 0.01) {
        // the districts fade once the trail has left the plan for good
        const fillA = 1 - prog(t, T.pre1!, T.pre1! + 2.5);
        drawThePlan(ink, c, v, { road: peel > 0 ? 1 : road, ticks, places, fill: fills.map((k) => k * fillA) }, LIN.ink, 'ink', planA);
        // HOME gets its real name
        const jk = prog(t, T.page!, T.page! + 1.4);
        if (jk > 0) {
          const q = w2s(v, home.x, home.y);
          c.save(); c.translate(q.x - 14 - this.jhb.width, q.y + 34);
          c.strokeStyle = rgba('blood', planA); c.lineWidth = 2; c.lineCap = 'round'; c.lineJoin = 'round';
          drawStrokeText(c, this.jhb, this.jhb.total * jk);
          c.restore();
        }
      }
      // the peeled tape: the plan's road lifts off from HOME to RETIREMENT
      if (peel > 0 && peel < 1) {
        const P = PLAN_PTS.map((p) => w2s(v, p.x, p.y));
        const Ls = [0]; for (let i = 1; i < P.length; i++) Ls.push(Ls[i - 1]! + Math.hypot(P[i]!.x - P[i - 1]!.x, P[i]!.y - P[i - 1]!.y));
        const cut = peel * Ls[Ls.length - 1]!;
        for (let i = 1; i < P.length; i++) for (let u = 0; u < 1; u += 0.05) {
          const d0 = Ls[i - 1]! + (Ls[i]! - Ls[i - 1]!) * u;
          const a = P[i - 1]!, b = P[i]!;
          const x0 = a.x + (b.x - a.x) * u, y0 = a.y + (b.y - a.y) * u, x1 = a.x + (b.x - a.x) * (u + 0.05), y1 = a.y + (b.y - a.y) * (u + 0.05);
          if (d0 > cut) { ink.seg2(x0 + 2, y0 + 3, x1 + 2, y1 + 3, 8, LIN.ink, 0.25); ink.seg2(x0, y0, x1, y1, 7, LIN.bone, 0.92); ink.seg2(x0, y0, x1, y1, 1.2, LIN.ink, 0.8); }
          else { const lift = clamp((cut - d0) / 140); if (lift < 1) ink.seg2(x0, y0 - lift * 80, x1, y1 - lift * 80, 7 * (1 - lift * 0.5), LIN.bone, 0.85 * (1 - lift)); }
        }
      }
    }

    // ---------------------------------------------------------------- the trail
    const TR = track();
    const sE = this.sLegs, sWash0 = sE['RAN A COMPANY']!, sWash1 = sE['WOUND IT UP']!;
    const washed = after('WOUND IT UP', 1.2);
    const married = sE['MARRIED']!;
    const glowK = 1 + 0.25 * warm;
    if (s > 0.001) {
      let prev: { x: number; y: number } | null = null, prevL = 0;
      for (let i = 0; i < TR.pts.length; i++) {
        const Li = TR.len[i]!;
        const p = Li > s ? head : TR.pts[i]!;
        const q = w2s(v, p.x, p.y);
        if (prev) {
          const mid = (prevL + Math.min(Li, s)) / 2;
          const onWater = (mid > sE['LEFT FOR EUROPE']! && mid < sE['EAST SHORE']!) || mid > sE['MAKING MUSIC']! + 1.2;
          const hot = clamp(1 - (s - mid) / 3.5);
          const dash = onWater && (i % 2 === 0);
          const inWash = mid > sWash0 && mid < sWash1;
          if (!dash) {
            if (inWash && washed > 0) {
              // the washed-out stretch: greyed and broken
              if (i % 3 !== 0) gl.seg2(prev.x, prev.y, q.x, q.y, 2, sc(LIN.ash, 0.55 + 0.45 * (1 - washed)), 0.8);
            } else {
              const col = sc(LIN.signal, (0.95 + 1.1 * hot) * glowK);
              gl.seg2(prev.x, prev.y, q.x, q.y, 2.6 + hot * 1.2, col, 0.95);
              if (mid > married) {
                // married: walked as two lines from here on
                const dx = q.x - prev.x, dy = q.y - prev.y, l = Math.hypot(dx, dy) || 1, nx = -dy / l * 4.2, ny = dx / l * 4.2;
                gl.seg2(prev.x + nx, prev.y + ny, q.x + nx, q.y + ny, 1.3, sc(LIN.ember, 0.9 * glowK), 0.8);
              }
            }
          }
        }
        prev = q; prevL = Li;
        if (Li > s) break;
      }
      const hp = w2s(v, head.x, head.y);
      const lampOn = prog(t, T.pre1! + 0.3, T.ground! - 0.4);
      lamp(gl, hp.x, hp.y, t, 1.05 + 0.2 * warm, lampOn);
      // two children: two small lamps that follow
      if (s > sE['TWO CHILDREN']! - 0.01) {
        const k = after('TWO CHILDREN', 0.8);
        for (const [ds, off] of [[0.75, 5], [1.35, -5]] as [number, number][]) {
          const p = trackAt(Math.max(0, s - ds * k)), q = w2s(v, p.x, p.y);
          lamp(gl, q.x + off * 0.4, q.y + off * 0.4, t + ds * 3, 0.5, k * 0.85);
        }
      }
    } else if (t > T.pre1!) {
      const hp = w2s(v, head.x, head.y);
      lamp(gl, hp.x, hp.y, t, 1.05, prog(t, T.pre1! + 0.3, T.ground! - 0.4));
    }
    // the second trail, joining at MARRIED during "Packed for war but found a feast"
    const l11 = lyrics.lines[11]!;
    const sp = prog(t, l11.words[0]!.start - 0.3, T.feast!, ease.inOutSine);
    if (sp > 0) {
      const n = Math.floor(this.spouse.length * sp);
      for (let i = 1; i < n; i++) { const a = w2s(v, this.spouse[i - 1]!.x, this.spouse[i - 1]!.y), b = w2s(v, this.spouse[i]!.x, this.spouse[i]!.y); gl.seg2(a.x, a.y, b.x, b.y, 1.8, sc(LIN.ember, 1.0 * glowK), 0.9); }
      if (sp < 1) { const p = this.spouse[Math.max(0, n - 1)]!, q = w2s(v, p.x, p.y); lamp(gl, q.x, q.y, t + 7, 0.75, 0.9); }
    }
    // the feast: a ring of small lamps around MARRIED
    const fk = after('MARRIED', 0.01);
    if (fk > 0) {
      const m = WAY[wayIx('MARRIED')]!, q = w2s(v, m.x, m.y);
      const fade = 1 - prog(t, fired('MARRIED') + 3.5, fired('MARRIED') + 6);
      for (let i = 0; i < 12; i++) {
        const on = prog(t, fired('MARRIED') + i * 0.04, fired('MARRIED') + i * 0.04 + 0.2) * fade;
        if (on <= 0) continue;
        const a = (i / 12) * TAU;
        lamp(gl, q.x + Math.cos(a) * 1.3 * v.s, q.y + Math.sin(a) * 0.75 * v.s, t + i, 0.32, on * 0.8);
      }
    }
    // making music: rings on every beat from where the music started
    if (t > fired('MAKING MUSIC')) {
      const m = WAY[wayIx('MAKING MUSIC')]!, q = w2s(v, m.x, m.y);
      const until = T.outro! + 4;
      for (const b of this.beats) {
        if (b < fired('MAKING MUSIC') || b > t || b > until) continue;
        const age = t - b;
        if (age > 2.4) continue;
        const rp = age * 1.6 * v.s, a = (1 - age / 2.4) * 0.5;
        const n = Math.min(120, Math.max(20, Math.ceil(rp / 8)));
        for (let k = 0; k < n; k++) { const a0 = (k / n) * TAU, a1 = ((k + 1) / n) * TAU; gl.seg2(q.x + Math.cos(a0) * rp, q.y + Math.sin(a0) * rp, q.x + Math.cos(a1) * rp, q.y + Math.sin(a1) * rp, 1.3, sc(LIN.ember, 1.1), a); }
      }
    }
    // rain, where the plan forecast sun
    const l10 = lyrics.lines[10]!;
    const rain = prog(t, l10.words[0]!.start - 0.4, l10.words[0]!.start + 0.4) * (1 - prog(t, l10.end + 0.2, l10.end + 1.2));
    if (rain > 0) {
      const fi = frameIdx(t) >> 1;
      for (let i = 0; i < 900 * rain; i++) {
        const x = hash(i, fi, 1) * 2100 - 90, y = hash(i, fi, 2) * 1100 - 50, Lr = 16 + 26 * hash(i, 3);
        ink.seg2(x, y, x - Lr * 0.28, y + Lr, 1, LIN.graphite, 0.35 + 0.3 * hash(i, 9));
      }
    }

    // ---------------------------------------------------------------- event glyphs and tags (on the map)
    for (const e of evs) {
      if (e.name === 'JOHANNESBURG') continue;
      const k = prog(t, e.t - 0.05, e.t + 0.35, ease.outBack);
      if (k <= 0) continue;
      const w = WAY[e.way]!, q = w2s(v, w.x, w.y);
      this.glyph(c, e.name, q.x, q.y, clamp(k), t, e);
      this.tag(c, q.x, q.y, e.name, clamp(k), e.way);
    }

    // ---------------------------------------------------------------- the sheet's furniture, the card, the intro type
    const onSheet = 1 - prog(t, T.pre1!, T.pre1! + 2.5, ease.inOutSine);
    const B = 1.72;
    const b = (n: number) => T.sheet! + n * B;
    const fk2 = {
      frame: prog(t, b(0.2), b(3.6), ease.inOutSine), star: prog(t, b(4.2), b(5.2), ease.outCubic),
      scale: prog(t, b(5.0), b(6.0), ease.inOutCubic), legend: prog(t, b(6.6), b(9.0)), title: prog(t, b(9.5), b(12.5), ease.inOutSine),
    };
    if (onSheet > 0.001) {
      c.save(); c.translate(-(1 - onSheet) * 700, 0);
      drawFurniture(c, v, { ...fk2, frame: 0 }, { alpha: onSheet });
      c.restore();
    }
    neatline(c, v, rgba('ink', 0.85 * (1 - G)), { k: fk2.frame, step: 10, labels: onSheet > 0.5 });
    // the verse, written by the second pen on the card
    if (onSheet > 0.001 && t > T.verse1! - 0.5) {
      c.save(); c.translate(-(1 - onSheet) * 700, 0); c.globalAlpha = onSheet;
      verse.forEach((l, i) => {
        const stt = this.vSt[i]!, len = writtenLength(stt, this.vCt[i]!, t);
        if (len <= 0) return;
        const y = 420 + i * 72;
        c.save(); c.translate(COL_X, y);
        c.strokeStyle = t > l.end + 0.2 ? rgba('ink', 0.92) : rgba('blood', 1);
        c.lineWidth = 2.1; c.lineCap = 'round'; c.lineJoin = 'round';
        const h = drawStrokeText(c, stt, len);
        c.restore();
        if (h && len < stt.total) { c.fillStyle = rgba('blood', 1); c.beginPath(); c.arc(COL_X + h.x, y + h.y, 3, 0, TAU); c.fill(); }
      });
      c.restore();
      // the plotter's pen while the plan is drawn
      const l0 = verse[0]!, l1 = verse[1]!;
      let pen: { x: number; y: number } | null = null;
      if (t < l1.start && t > l0.start - 0.3) { const p = planAt(PLAN_LEN * lineProg(l0, t)); pen = w2s(v, p.x, p.y); }
      else if (t < verse[2]!.start && t >= l1.start) { const p = planAt(PLAN_LEN * prog(t, l1.start, l1.end)); pen = w2s(v, p.x, p.y); }
      if (pen) penCross(c, pen.x, pen.y, 1);
    }
    // the compass in the corner: it turns with the camera, and spins free when the trail is lost
    const lostSpin = prog(t, T.lost!, T.bridge!, ease.inQuad);
    const settle = prog(t, T.arrive! - 1, T.arrive! + 1.5, ease.inOutCubic);
    const spin = lostSpin * (1 - settle) * (t - T.lost!) * 9;
    const cA = prog(t, T.pre1! + 1.5, T.pre1! + 3) * (1 - prog(t, T.band!, T.band! + 3));
    if (cA > 0) compassStar(c, 1790, 128, 46, { col: rgba(G > 0.5 ? 'bone' : 'ink', 0.8 * cA), fill: rgba('signal', cA), rot: v.rot + spin, lw: 1 });
    // title and epigraph (intro), title again at the very end
    this.titles(c, t);

    // ---------------------------------------------------------------- the strip: lyric and event
    this.strip(c, t, s);
    ink.render(renderer, out);
    gl.render(renderer, out);
    comp.draw(renderer, L.upload(), out);
    return { bloom: 0.5 + 0.2 * warm, vignette: 0.3, ca: 0.4, halation: 0.15 + 0.15 * warm, grain: 0.05, fade: prog(t, T.end! - 0.6, T.end! - 0.02) };
  }

  /** A tag on the map: a small paper label on a leader line (readable on paper and on terrain alike). */
  tag(c: CanvasRenderingContext2D, x: number, y: number, text: string, k: number, way: number) {
    // hand-placed leaders so the labels of the crowded middle years do not collide
    const OFF: Record<string, [number, number]> = {
      'LEFT FOR EUROPE': [-50, -40], 'MUNICH': [50, -42], 'WOUND IT UP': [92, -16], 'RAN A COMPANY': [84, 14],
      'MARRIED': [-72, -12], 'TWO CHILDREN': [-84, 22], 'AN AI RED TEAM': [-62, 58], 'MY OWN PLATFORM': [-26, 86],
      'MAKING MUSIC': [64, 58], 'HERE': [52, -34],
    };
    const [ox, oy] = OFF[text] ?? [34, -30];
    const side = ox > 0 ? 1 : -1;
    const lx = x + ox, ly = y + oy;
    void way;
    c.save();
    c.globalAlpha *= clamp(k * 1.4);
    c.strokeStyle = rgba('ink', 0.85); c.lineWidth = 1;
    c.beginPath(); c.moveTo(x, y); c.lineTo(lx, ly); c.stroke();
    const f = font(F.mono(600), 13);
    c.font = f; c.letterSpacing = '2.5px';
    const w = c.measureText(text).width + 16;
    const bx = side > 0 ? lx : lx - w, by = ly - 12;
    c.translate(lx, ly); c.scale(k, k); c.translate(-lx, -ly);
    c.fillStyle = rgba('bone', 0.97); c.fillRect(bx, by, w, 24);
    c.strokeStyle = rgba('ink', 0.9); c.strokeRect(bx, by, w, 24);
    c.fillStyle = rgba('blood', 1); c.fillRect(side > 0 ? bx : bx + w - 4, by, 4, 24);
    c.fillStyle = rgba('ink', 1); c.textBaseline = 'middle'; c.textAlign = 'left';
    c.fillText(text, bx + (side > 0 ? 10 : 6), by + 12.5);
    c.restore();
  }

  /** The event's own mark on the map. */
  glyph(c: CanvasRenderingContext2D, name: string, x: number, y: number, k: number, t: number, e: { t: number }) {
    c.save();
    c.globalAlpha *= clamp(k * 1.5);
    const r = 10 * k;
    c.strokeStyle = rgba('ink', 0.9); c.fillStyle = rgba('ink', 0.9); c.lineWidth = 1.6;
    switch (name) {
      case 'MUNICH': case 'LEFT FOR EUROPE':
        placeMark(c, x, y, 9, rgba('blood', 1), k);
        break;
      case 'RAN A COMPANY': {
        c.fillStyle = rgba('bone', 1); c.fillRect(x - r, y - r, 2 * r, 2 * r); c.strokeRect(x - r, y - r, 2 * r, 2 * r);
        c.save(); c.beginPath(); c.rect(x - r, y - r, 2 * r, 2 * r); c.clip();
        for (let i = -3; i <= 3; i++) { c.beginPath(); c.moveTo(x + i * 5 - r, y + r); c.lineTo(x + i * 5 + r, y - r); c.stroke(); }
        c.restore();
        // wound up: struck through
        const wk = prog(t, this.st.events.find((q) => q.name === 'WOUND IT UP')!.t, this.st.events.find((q) => q.name === 'WOUND IT UP')!.t + 0.4, ease.outCubic);
        if (wk > 0) {
          c.strokeStyle = rgba('blood', 1); c.lineWidth = 3;
          c.beginPath(); c.moveTo(x - r * 1.5, y - r * 1.5); c.lineTo(x - r * 1.5 + 3 * r * wk, y - r * 1.5 + 3 * r * wk); c.stroke();
          c.beginPath(); c.moveTo(x + r * 1.5, y - r * 1.5); c.lineTo(x + r * 1.5 - 3 * r * wk, y - r * 1.5 + 3 * r * wk); c.stroke();
        }
        break;
      }
      case 'WOUND IT UP':
        c.strokeStyle = rgba('blood', 1); c.lineWidth = 2.2;
        for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(x, y, 6 + i * 5, Math.PI * 0.15, Math.PI * 0.85); c.stroke(); }
        break;
      case 'AN AI RED TEAM':
        c.fillStyle = rgba('bone', 1);
        c.beginPath(); c.moveTo(x, y - r * 1.2); c.lineTo(x + r, y + r * 0.6); c.lineTo(x - r, y + r * 0.6); c.closePath(); c.fill(); c.stroke();
        c.beginPath(); c.arc(x, y, 2.2, 0, TAU); c.fillStyle = rgba('blood', 1); c.fill();
        break;
      case 'MY OWN PLATFORM':
        c.beginPath(); c.moveTo(x, y); c.lineTo(x, y - 30 * k); c.stroke();
        c.fillStyle = rgba('blood', 1);
        c.beginPath(); c.moveTo(x, y - 30 * k); c.lineTo(x + 20 * k, y - 24 * k); c.lineTo(x, y - 18 * k); c.closePath(); c.fill();
        break;
      case 'MAKING MUSIC':
        c.strokeStyle = rgba('blood', 1);
        for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(x, y, 4 + i * 5, -0.9, 0.9); c.stroke(); }
        break;
      case 'HERE':
        compassStar(c, x, y - 4, 22 + 8 * k, { col: rgba('ember', 0.95), fill: rgba('ember', 1), lw: 1, ring: false, minor: true });
        break;
      default:
        break;
    }
    void e;
    c.restore();
  }

  titles(c: CanvasRenderingContext2D, t: number) {
    const T = this.st.T as Record<string, number>;
    // the title over the dark sheet while the band swells
    const a = prog(t, T.title! + 0.2, T.title! + 2.2, ease.outCubic) * (1 - prog(t, T.epigraph! - 2.2, T.epigraph! - 0.3, ease.inOutCubic));
    if (a > 0) {
      const title = 'MAPS & TERRITORY';
      const fam = F.archivo(lerp(100, 125, prog(t, T.title!, T.epigraph!, ease.outCubic)), 300);
      const size = 92, tr = lerp(8, 22, prog(t, T.title!, T.epigraph!, ease.outCubic));
      c.save(); c.globalAlpha = a;
      c.font = font(fam, size); c.letterSpacing = `${tr}px`; c.textBaseline = 'alphabetic'; c.fillStyle = rgba('bone', 1);
      const wt = measure(title, fam, size, tr);
      c.fillText(title, 960 - wt / 2 + tr / 2, 500);
      const bk = prog(t, T.title! + 5, T.title! + 7, ease.outCubic);
      c.globalAlpha = a * bk;
      mono(c, 'JOBURGALEX', 960, 566, { size: 20, color: rgba('signal', 1), track: 14, align: 'center', weight: 500 });
      mono(c, 'A LIFE, AS PLANNED  ·  AND AS IT WENT', 960, 600, { size: 12, color: rgba('ash', 0.9), track: 4, align: 'center' });
      c.restore();
    }
    // the epigraph on the drum break, then it moves into the margin
    const e = prog(t, T.epigraph!, T.epigraph! + 0.6, ease.outCubic) * (1 - prog(t, T.sheet! + 0.2, T.sheet! + 1.4, ease.inOutCubic));
    if (e > 0) {
      c.save(); c.globalAlpha = e;
      c.font = font(F.serif(500, true), 76); c.fillStyle = rgba('bone', 1); c.textAlign = 'center'; c.textBaseline = 'alphabetic';
      c.fillText('The map is not the territory.', 960, 540);
      mono(c, 'ALFRED KORZYBSKI, 1931', 960, 590, { size: 13, color: rgba('ash', 0.9), track: 4, align: 'center' });
      c.restore();
    }
    // the end
    const z = prog(t, T.horn! + 0.8, T.horn! + 2.6, ease.outCubic) * (1 - prog(t, T.end! - 2.4, T.end! - 0.6));
    if (z > 0) {
      const title = 'MAPS & TERRITORY', fam = F.archivo(125, 300), size = 64, tr = 22;
      c.save(); c.globalAlpha = z;
      c.font = font(fam, size); c.letterSpacing = `${tr}px`; c.fillStyle = rgba('bone', 0.95); c.textBaseline = 'alphabetic';
      const w = measure(title, fam, size, tr);
      c.fillText(title, 960 - w / 2 + tr / 2, 250);
      mono(c, 'JOBURGALEX', 960, 300, { size: 16, color: rgba('signal', 1), track: 12, align: 'center', weight: 500 });
      c.restore();
    }
  }

  /** The title block along the bottom: the lyric (word-synced) on the left, the latest event on the right. */
  strip(c: CanvasRenderingContext2D, t: number, s: number) {
    const T = this.st.T as Record<string, number>;
    const ly = this.ctx.lyrics;
    const k = prog(t, T.pre1! - 0.6, T.pre1! + 0.4, ease.outCubic) * (1 - prog(t, T.band! + 6, T.band! + 9, ease.inOutCubic));
    if (k <= 0) return;
    const y0 = SY + (1 - k) * STRIP;
    c.save();
    c.fillStyle = rgba('bone', 0.98); c.fillRect(0, y0, 1920, STRIP);
    c.strokeStyle = rgba('ink', 0.85); c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(0, y0 + 0.5); c.lineTo(1920, y0 + 0.5); c.stroke();
    c.lineWidth = 0.8; c.beginPath(); c.moveTo(0, y0 + 7); c.lineTo(1920, y0 + 7); c.stroke();
    c.beginPath(); c.moveTo(1440, y0 + 26); c.lineTo(1440, y0 + STRIP - 22); c.stroke();
    // the lyric: the line being sung (lines 4..30), its successor anticipated
    let li = -1;
    for (let i = 4; i < ly.lines.length; i++) if (t >= ly.lines[i]!.start - 0.6) li = i;
    if (li >= 4) {
      const l = ly.lines[li]!;
      const next = ly.lines[li + 1];
      const out = Math.max(next ? prog(t, next.start - 0.75, next.start - 0.6) : 0, prog(t, l.end + 2.0, l.end + 3.0));
      const chorus = [6, 7, 16, 17, 23, 24, 27, 28].includes(li);
      const bridge = li >= 20 && li <= 22;
      const fam = bridge ? F.serif(500, true) : chorus ? F.archivo(112.5, 900) : F.archivo(100, 800);
      let size = bridge ? 70 : chorus ? 58 : 58;
      const wmax = 1440 - 120 - 60;
      const w = measure(l.text, fam, size, chorus ? -1.5 : -1);
      if (w > wmax) size *= wmax / w;
      c.globalAlpha = 1 - out;
      drawKaraoke(c, l, 120, y0 + 108, t, { family: fam, size, tracking: chorus ? -1.5 : -1, sung: rgba('ink', 1), unsung: rgba('ink', 0.16), active: rgba('blood', 1), lead: 0.6 });
      c.globalAlpha = 1;
    }
    // the latest event
    const evs = this.st.events.filter((e) => e.t <= t + 0.05);
    const e = evs[evs.length - 1];
    if (e) {
      const ek = prog(t, e.t, e.t + 0.35, ease.outCubic);
      const idx = this.st.events.indexOf(e) + 1;
      mono(c, `EVENT ${String(idx).padStart(2, '0')} / ${this.st.events.length}`, 1480, y0 + 52, { size: 12, color: rgba('ink', 0.7), track: 4 });
      c.globalAlpha = ek;
      mono(c, e.name, 1480, y0 + 88, { size: 24, color: rgba('blood', 1), track: 3, weight: 600 });
      mono(c, e.note, 1480, y0 + 116, { size: 12, color: rgba('ink', 0.75), track: 3 });
      c.globalAlpha = 1;
    } else {
      mono(c, 'THE PLAN', 1480, y0 + 52, { size: 12, color: rgba('ink', 0.7), track: 4 });
      mono(c, 'HOME → RETIREMENT', 1480, y0 + 88, { size: 20, color: rgba('ink', 0.9), track: 3, weight: 600 });
    }
    // off the plan: how far the walker is from the ruled road
    const p = trackAt(s);
    let d = 1e9;
    for (let i = 1; i < PLAN_PTS.length; i++) {
      const a = PLAN_PTS[i - 1]!, b = PLAN_PTS[i]!, vx = b.x - a.x, vy = b.y - a.y, u = clamp(((p.x - a.x) * vx + (p.y - a.y) * vy) / (vx * vx + vy * vy));
      d = Math.min(d, Math.hypot(a.x + vx * u - p.x, a.y + vy * u - p.y));
    }
    if (s > 0) mono(c, `WALKED ${s.toFixed(1)} KM  ·  OFF THE PLAN ${d.toFixed(1)} KM`, 1480, y0 + 146, { size: 11, color: rgba('ink', 0.6), track: 2 });
    // rain where the plan said sun
    const l10 = ly.lines[10]!;
    const rk = prog(t, l10.start, l10.start + 0.4) * (1 - prog(t, l10.end + 0.5, l10.end + 1));
    if (rk > 0) { c.globalAlpha = rk; mono(c, 'PLANNED: SUN  ·  ACTUAL: RAIN', 1800, y0 + 146, { size: 11, color: rgba('blood', 1), track: 2, align: 'right' }); c.globalAlpha = 1; }
    c.restore();
    void mixCss; void coastX; void WORLD;
  }
}
