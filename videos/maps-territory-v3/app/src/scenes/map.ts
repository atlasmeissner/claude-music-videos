// map — Mara's whole life (1952–2034) on one map, one continuous shot (the camera moves, it never cuts).
//
//  intro    the sheet in the dark; the French horn's call rings out from HOME and lights it; the title (one font,
//           fading in); "The map is not the territory."; a plotter draws the empty sheet and a card: FOR MARA ·
//           DRAWN BY HER FATHER, 1952.
//  verse 1  THE PLAN, her father's: HOME 1952 → SCHOOL → MEDICAL SCHOOL → THE CLINIC → MARRIED → THE HOUSE →
//           RETIREMENT 2017, a ruled road with a tick a year, drawn as it is sung.
//  pre 1    down to HOME; on "ground" the paper opens onto the real ground; on "page" she is born.
//  then     her childhood at HOME (a postcard of the sea, a dance), then she walks. A pale ghost of her walks the
//           plan on schedule and fades a step each time she leaves it. Fifteen engraved plates unfold from the map
//           at the events of her life (see _story.ts and _vignettes.ts); her father's lamp at HOME goes out (the
//           camera pulls back to show it); Jonah's trail joins hers; Ida's and later Noa's lamps follow.
//  inst     across the water to the islet she bought: HERE. She lights the lighthouse; its beam sweeps the country
//           and every turn cuts the paper away a little further out, while the years run on.
//  final    Noa; RETIREMENT stamped UNVISITED; Jonah's lamp goes out; the plan is peeled off like tape.
//  outro    night; Mara's lamp goes out on the islet; the coda: Noa draws Mara's real road onto the old plan; the horn
//           rings out from the lighthouse; the title.
//
// The lyric is set large along the bottom, word-synced.
import * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { Layer2D } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { F, font, measure } from '../engine/type';
import { LIN, rgba } from '../engine/palette';
import type { Line } from '../engine/lyrics';
import { clamp, ease, frameIdx, hash, lerp, prog, TAU } from '../engine/util';
import { strokeText, drawStrokeText, writtenLength, type StrokeText } from '../engine/stroke';
import { ISLET, LIGHT, PLAN, PLAN_PTS, track, trackAt, WAY, waySAt, wayIx } from './_world';
import { charTimes, compassStar, drawKaraoke, lamp, lerpView, mixRGB, mono, neatline, placeMark, sc, Terrain, w2s, type RGB, type View } from './_mt';
import { COL_X, drawFurniture, penCross, SHEET_VIEW } from './_sheet';
import { drawThePlan, lineProg, planAt, PLAN_LEN, PLACE_S } from './_plan';
import { ghostA, ghostS, story, walked, yearAt, type PlateCue, type Story } from './_story';
import { CH, CW, drawPlate, PLATES, plateToScreen, PS, type PlateState } from './_vignettes';

const WY = 470; // the walker's screen height (the lyric owns the bottom of the frame)
const OY = 540 - WY;
const C_HORN = 4.2; // km/s: the horn's call across the country (slowed, so it can be seen)
const OMEGA = TAU / 3.438; // the lighthouse: one turn every two bars
const PLATE_TOP = 132;

const HEX_INK = '#0A1013';
const sm = (x: number) => ease.inOutSine(clamp(x));
/** Where a plate unfolds from. */
const anchorOf = (cue: PlateCue) => (cue.anchor === 'light' ? LIGHT : cue.anchor === 'home' ? PLAN[0]! : WAY[cue.anchor]!);

export default class MapScene extends Scene {
  terrain = new Terrain();
  ink = new LineBatch(6000, { blend: 'normal' });
  glow = new LineBatch(24000);
  top = new LineBatch(12000);
  text = new Layer2D();
  st!: Story;
  verse: Line[] = [];
  vSt: StrokeText[] = [];
  vCt: [number, number][][] = [];
  mara!: StrokeText;
  spouse: { x: number; y: number }[] = [];
  sLegs: Record<string, number> = {};
  rows = new Map<number, { lines: Line[]; fam: string; size: number; tr: number }>();
  /** The new plan she makes after each station: drawn from where she is, struck when the next station proves it wrong. */
  plans: { a: { x: number; y: number }; b: { x: number; y: number }; label: string; t0: number; strike: number; side: number }[] = [];

  override init() {
    const { lyrics, audio } = this.ctx;
    this.st = story(lyrics, audio);
    this.verse = [0, 1, 2, 3].map((i) => lyrics.lines[i]!);
    this.vSt = this.verse.map((l) => strokeText(l.text, 'script', 40, 0));
    this.vCt = this.verse.map((l) => charTimes(l, l.text));
    this.mara = strokeText('Mara', 'script', 40, 0);
    // Jonah's trail, which joins hers at THE FEAST: a soft curve in from the south-west
    const m = WAY[wayIx('THE FEAST')]!;
    const a = { x: m.x - 9.5, y: m.y + 8.5 }, b = { x: m.x - 6, y: m.y + 1.5 };
    for (let i = 0; i <= 60; i++) {
      const u = i / 60, v = 1 - u;
      this.spouse.push({ x: v * v * a.x + 2 * u * v * b.x + u * u * m.x + 0.25 * Math.sin(u * 17), y: v * v * a.y + 2 * u * v * b.y + u * u * m.y + 0.2 * Math.cos(u * 13) });
    }
    for (const w of WAY) if (w.name) this.sLegs[w.name] = waySAt(WAY.indexOf(w));
    this.sLegs['EAST SHORE'] = waySAt(wayIx('THE FERRY') + 1);
    // after every station a new plan, from the ferry on (the father's plan before that), each one a ruled road to
    // somewhere she never goes; it is struck through when the next plate shows what happened instead
    const P = this.st.plates, TR = track();
    const dd = (c: PlateCue) => Math.min(PLATES[c.id]!.draw ?? 2.2, (c.t1 - c.t0) * 0.5);
    const strikeAt = (c: PlateCue) => c.t0 + 0.45 + dd(c) * 0.8;
    const i0 = P.findIndex((c) => c.id === 'ferry'), i1 = P.findIndex((c) => c.id === 'chair');
    for (let i = i0; i < i1; i++) {
      const c = P[i]!, n = P[i + 1]!;
      const tS = strikeAt(n);
      const t0 = Math.max(c.t0 + 0.9, Math.min(strikeAt(c) + 1.3, tS - 1.6));
      const sNow = walked(this.st, t0), atIslet = sNow >= TR.total - 0.01;
      const here = trackAt(sNow), ahead = trackAt(Math.min(TR.total, sNow + 2));
      const h = Math.atan2(ahead.y - here.y, ahead.x - here.x);
      const base = atIslet ? -Math.PI / 2 : Math.sin(h) > 0 ? -Math.PI / 2 : Math.PI / 2;
      const ang = base + (i % 2 ? 0.55 : -0.55) + (atIslet ? (i % 3) * 0.35 : 0);
      const L = atIslet ? 6 : 7;
      const b = { x: Math.min(96, Math.max(4, here.x + Math.cos(ang) * L)), y: Math.min(96, Math.max(4, here.y + Math.sin(ang) * L)) };
      // (its name goes on the side away from the plate that is open while it is drawn)
      this.plans.push({ a: { x: here.x, y: here.y }, b, label: PLATES[n.id]!.planned, t0, strike: tS, side: -c.side });
    }
  }

  /** The head's position averaged over ±0.8 s (a steadicam on the walker). */
  steady(t: number) {
    let x = 0, y = 0, n = 0;
    for (let k = -4; k <= 4; k++) { const p = trackAt(walked(this.st, t + k * 0.2)); x += p.x; y += p.y; n++; }
    return { x: x / n, y: y / n };
  }
  follow(t: number, s: number, rot = 0): View {
    const p = this.steady(t);
    return { cx: p.x, cy: p.y + OY / s, s, rot };
  }

  /** The camera: a list of shots blended into one move. */
  cam(t: number): View {
    const T = this.st.T as Record<string, number>;
    const WIDE: View = { cx: 46.5, cy: 50.5, s: 10.2, rot: 0 };
    const isle = (s: number): View => ({ cx: ISLET.x - 1.0, cy: ISLET.y + OY / s, s, rot: 0 });
    const shots: [number, (t: number) => View, number][] = [
      // [start, view, blend into this shot (s)]
      [0, (t) => lerpView({ ...SHEET_VIEW, s: 7.6, cx: 30 }, SHEET_VIEW, sm(t / T.sheet!)), 0],
      [T.sheet!, (t) => lerpView(SHEET_VIEW, { cx: 23.6, cy: 48.5, s: 9.0, rot: 0 }, sm((t - T.sheet!) / (T.pre1! - T.sheet!))), 0.5],
      [T.pre1!, (t) => lerpView({ cx: 13, cy: 61.5 + OY / 34, s: 34, rot: 0 }, { cx: 13.5, cy: 61 + OY / 28, s: 28, rot: 0 }, sm((t - T.pre1!) / (T.tracing! - T.pre1!))), 3.0],
      [T.tracing!, (t) => this.follow(t, lerp(26, 21, sm((t - T.tracing!) / 12))), 1.6],
      [T.verse2! - 1.5, (t) => this.follow(t, 27), 2.0],
      [T.pre2!, () => WIDE, 2.2],
      [T.chorus2!, (t) => this.follow(t, 25), 2.4],
      // her father: pull back to the whole sheet, so his lamp at HOME is in the frame when it goes out
      [this.fatherCue().t0 - 0.4, (t) => lerpView({ cx: 44, cy: 50.5, s: 11.6, rot: 0 }, { cx: 43.5, cy: 50.5, s: 10.9, rot: 0 }, sm((t - this.fatherCue().t0) / 8)), 2.6],
      [T.bridge! + 1.2, (t) => this.follow(t, 34, 0.4 * Math.sin((t - T.bridge!) * 0.42)), 2.4],
      [T.arrive! - 3.5, (t) => this.follow(t, 15, 0), 3.0],
      [T.final! + 0.5, (t) => this.follow(t, 21), 2.0],
      [T.inst!, (t) => this.follow(t, 26), 1.5],
      [T.here! - 1, () => isle(46), 2.0],
      [T.build!, (t) => lerpView(isle(46), WIDE, sm((t - T.build!) / (T.final2! - T.build!))), 0.3],
      [T.final2!, (t) => lerpView(WIDE, { ...WIDE, s: 10.8, cx: 47 }, sm((t - T.final2!) / (T.outro! - T.final2!))), 0.5],
      [T.outro!, (t) => lerpView({ ...WIDE, s: 10.8, cx: 47 }, isle(24), sm((t - T.outro!) / (T.band! - T.outro!))), 1.5],
      [T.band!, (t) => lerpView(isle(24), { cx: 52, cy: 50, s: 6.4, rot: 0 }, sm((t - T.band!) / (T.horn! + 2 - T.band!))), 0.5],
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

  fatherCue() { return this.st.plates.find((p) => p.id === 'father')!; }
  /** When her father's light goes out: with the candle in his plate. */
  dadOut() { const f = this.fatherCue(); return f.t0 + 0.62 * (f.t1 - f.t0); }

  /** The lighthouse: swept angle since it was lit. */
  beamA(t: number) { return Math.max(0, t - this.st.T.here!) * OMEGA; }

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
    const TR = track();
    const atEnd = s >= TR.total - 0.01;

    // ---------------------------------------------------------------- the world
    const warm = prog(t, T.final!, T.final! + 9, ease.inOutSine) * (1 - prog(t, T.outro!, T.outro! + 8, ease.inOutSine));
    // the cut-away corridor along the trail: narrow at first, wider as the life goes on; then the lighthouse
    const R = t < T.ground! ? 0 : lerp(0, 2.2, prog(t, T.ground!, T.ground! + 0.8, ease.outCubic)) - 0.6 * prog(t, T.tracing! - 1, T.tracing! + 1) + 0.9 * prog(t, T.chorus1!, T.chorus2!) + 1.6 * prog(t, T.chorus2!, T.final! + 6)
      + 60 * prog(t, T.final2!, T.outro!, ease.inOutSine);
    const G = prog(t, T.peel!, T.outro! - 1, ease.inOutSine); // the country beyond the sheet's edge
    const sea = Math.max(prog(t, T.now! + 1.5, T.shore!, ease.inOutSine) * (1 - prog(t, T.verse2!, T.verse2! + 3)) * 0.6, prog(t, T.here! - 1.5, T.here! + 1, ease.inOutSine) * (1 - prog(t, T.outro!, T.outro! + 6) * 0.7));
    const dark = 1 - 0.1 * prog(t, 0.2, T.title! + 4, ease.inOutSine) - 0.9 * prog(t, T.sheet! + 0.4, T.sheet! + 2.6, ease.inOutSine);
    const outroDark = prog(t, T.band! + 4, T.horn!, ease.inOutSine) * 0.55 + 0.4 * prog(t, T.end! - 5, T.end! - 0.5, ease.inOutSine);
    const coast = prog(t, T.sheet! + 1.72 * 1.5, T.sheet! + 1.72 * 4.5, ease.inOutCubic);
    // the beam: lit at HERE; from the build each turn cuts the paper further out (radius 105 km by the last chorus)
    const A = this.beamA(t), Abuild = (T.build! - T.here!) * OMEGA;
    const growth = 105 / ((T.final2! - T.build!) * OMEGA);
    const beamI = prog(t, T.here!, T.here! + 1.6, ease.outCubic) * (1 - prog(t, T.end! - 3.5, T.end! - 0.8)) * (0.75 + 0.35 * prog(t, T.outro!, T.band!));
    this.terrain.draw(renderer, out, {
      view: v, mapMix: 1, contourInk: 0, paperInk: coast, reveal: [t > T.ground! ? (atEnd ? s + 5 : Math.max(s, 1.2)) : s, R, G], warmth: warm, seaAcid: sea,
      terrInk: 0.5, relief: 3.2, t, sun: warm > 0.01 ? [lerp(-0.5, -0.8, warm), lerp(-0.6, -0.3, warm), lerp(0.55, 0.42, warm)] : [-0.5, -0.6, 0.55],
      ghost: prog(t, T.band! + 2, T.horn!, ease.inOutSine) * 0.8, contour: 0.05, fadeOut: Math.max(dark * 0.988, outroDark),
      beam: [LIGHT.x, LIGHT.y, A, beamI], beamR: [growth, -Abuild * growth, 140, t > T.here! ? 1 : 0],
    });

    const ink = this.ink; ink.clear();
    const gl = this.glow; gl.clear();
    const top = this.top; top.clear();
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
    if (t > T.outro! - 1) ringsFrom(LIGHT, T.outro!, T.end!, 0.8, sc(LIN.ember, 0.9));

    // ---------------------------------------------------------------- the plan
    const verse = this.verse;
    const peel = prog(t, T.peel!, lyrics.lines[30]!.end - 0.3, ease.inOutSine);
    const onTerr = prog(t, T.build! + 4, T.final2!, ease.inOutSine); // the plan is drawn light once the sheet is territory
    if (t > T.verse1! - 0.5) {
      const road = lineProg(verse[0]!, t);
      const ticks = prog(t, verse[1]!.start, verse[1]!.end);
      const places = PLAN.map((_, i) => (i === 0 ? 1 : prog(t, verse[2]!.words[i - 1]?.start ?? 1e9, (verse[2]!.words[i - 1]?.start ?? 1e9) + 0.3, ease.outCubic)));
      const fills = PLAN.map((_, i) => { const w = verse[3]!.words[Math.min(verse[3]!.words.length - 1, Math.floor((i * verse[3]!.words.length) / PLAN.length))]!; const s0 = w.start + (i % 2) * 0.25; return prog(t, s0, s0 + 1.1, ease.inOutSine); });
      const planA = 1 - peel;
      if (planA > 0.01) {
        const fillA = 1 - prog(t, T.pre1!, T.pre1! + 2.5);
        const k = { road: peel > 0 ? 1 : road, ticks, places, fill: fills.map((q) => q * fillA) };
        if (onTerr < 1) drawThePlan(ink, c, v, k, LIN.ink, 'ink', planA * (1 - onTerr));
        if (onTerr > 0) drawThePlan(ink, c, v, k, LIN.bone, 'bone', planA * onTerr * 0.85);
        // she is born: her name at HOME
        const jk = prog(t, T.page!, T.page! + 1.2);
        if (jk > 0) {
          const q = w2s(v, home.x, home.y);
          c.save(); c.translate(q.x - 16 - this.mara.width, q.y + 36);
          c.strokeStyle = rgba('blood', planA); c.lineWidth = 2.2; c.lineCap = 'round'; c.lineJoin = 'round';
          drawStrokeText(c, this.mara, this.mara.total * jk);
          c.restore();
          c.save(); c.globalAlpha = planA * prog(t, T.page! + 1, T.page! + 1.6);
          mono(c, 'b. 1952', q.x - 16 - this.mara.width + 4, q.y + 60, { size: 12, color: rgba('blood', 1), track: 2, weight: 600 });
          c.restore();
        }
        // RETIREMENT, never reached: stamped UNVISITED
        const sk = prog(t, T.stamp!, T.stamp! + 0.32);
        if (sk > 0) {
          const r = PLAN[PLAN.length - 1]!, q = w2s(v, r.x, r.y);
          const thump = 1 + 0.6 * (1 - ease.outBack(sk));
          c.save(); c.globalAlpha = planA * clamp(sk * 3) * (1 - prog(peel, 0.85, 1));
          c.translate(q.x + 10, q.y + 38); c.rotate(-0.16); c.scale(thump, thump);
          c.strokeStyle = rgba('bone', 0.92); c.lineWidth = 3; c.strokeRect(-92, -24, 184, 48);
          c.lineWidth = 1.2; c.strokeRect(-86, -18, 172, 36);
          c.font = font(F.mono(700), 24); c.letterSpacing = '6px'; c.fillStyle = rgba('bone', 0.92); c.textAlign = 'center'; c.textBaseline = 'middle';
          c.fillText('UNVISITED', 3, 1);
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

    // ---------------------------------------------------------------- the ghost: the life as planned, walked on schedule
    this.ghost(c, v, t);

    // ---------------------------------------------------------------- the trail
    const sE = this.sLegs;
    const sLost0 = sE['HER FATHER']!, sLost1 = sE['WANDERING']!;
    const warmBack = prog(t, T.arrive! - 1, T.final! + 5, ease.inOutSine);
    const together = sE['THE FEAST']!;
    const glowK = 1 + 0.25 * warm;
    if (s > 0.001) {
      let prev: { x: number; y: number } | null = null, prevL = 0;
      for (let i = 0; i < TR.pts.length; i++) {
        const Li = TR.len[i]!;
        const p = Li > s ? head : TR.pts[i]!;
        const q = w2s(v, p.x, p.y);
        if (prev) {
          const mid = (prevL + Math.min(Li, s)) / 2;
          const onWater = (mid > sE['THE FERRY']! && mid < sE['EAST SHORE']!) || mid > sE['THE JETTY']! + 1.2;
          const hot = clamp(1 - (s - mid) / 3.5);
          const dash = onWater && (i % 2 === 0);
          if (!dash) {
            // lost: after her father, the trail goes grey; the warmth comes back after she arrives
            const lost = mid > sLost0 && mid < sLost1 ? 1 - warmBack : 0;
            const col = mixRGB(sc(LIN.signal, (0.95 + 1.1 * hot) * glowK), sc(LIN.ash, 0.5 + 0.4 * hot), lost);
            gl.seg2(prev.x, prev.y, q.x, q.y, (2.6 + hot * 1.2) * (1 - 0.35 * lost), col, 0.95);
            if (mid > together) {
              // Jonah: walked as two lines from here on
              const dx = q.x - prev.x, dy = q.y - prev.y, l = Math.hypot(dx, dy) || 1, nx = -dy / l * 4.2, ny = dx / l * 4.2;
              gl.seg2(prev.x + nx, prev.y + ny, q.x + nx, q.y + ny, 1.3, mixRGB(sc(LIN.ember, 0.9 * glowK), sc(LIN.ash, 0.45), lost), 0.8);
            }
          }
        }
        prev = q; prevL = Li;
        if (Li > s) break;
      }
    }
    // the lamps: Mara (a child's small light that grows), Jonah, Ida, and her father's at HOME
    const lampOn = prog(t, T.pre1! + 0.2, T.pre1! + 1.0);
    const grown = lerp(0.55, 1.05, prog(t, T.page!, lyrics.lines[8]!.end, ease.inOutSine));
    const hp = w2s(v, head.x, head.y);
    const maraOn = 1 - prog(t, T.maraOut!, T.maraOut! + 2.6, ease.inOutSine);
    if (t > T.pre1! && maraOn > 0) lamp(gl, hp.x, hp.y, t, grown + 0.2 * warm, lampOn * maraOn);
    this.smoke(c, hp.x, hp.y, t, T.maraOut!);
    const here = WAY[WAY.length - 1]!;
    const settle = prog(t, T.here!, T.here! + 2.5, ease.inOutSine);
    const fam = (ds: number, off: number, home2: { x: number; y: number }, k: number) => {
      const p = trackAt(Math.max(0, s - ds * k));
      const q0 = w2s(v, p.x, p.y), q1 = w2s(v, home2.x, home2.y);
      const nrm = { x: -Math.sin(p.angle + v.rot), y: Math.cos(p.angle + v.rot) };
      return { x: lerp(q0.x + nrm.x * off, q1.x, settle), y: lerp(q0.y + nrm.y * off, q1.y, settle) };
    };
    const who: [string, number, number, number][] = [['MARA', hp.x, hp.y, -1e9]];
    if (s > together - 0.01) {
      const k = after('THE FEAST', 0.8);
      const q = fam(0.55, 5, { x: here.x + 0.5, y: here.y + 0.25 }, k);
      const on = 1 - prog(t, T.jonahOut!, T.jonahOut! + 2.4, ease.inOutSine);
      if (on > 0) { lamp(gl, q.x, q.y, t + 3, 0.78 + 0.1 * warm, k * 0.95 * on); who.push(['JONAH', q.x, q.y, fired('THE FEAST')]); }
      this.smoke(c, q.x, q.y, t, T.jonahOut!);
    }
    if (s > sE['IDA']! - 0.01) {
      const k = after('IDA', 0.8);
      const q = fam(1.05, -5, { x: here.x - 0.4, y: here.y + 0.45 }, k);
      lamp(gl, q.x, q.y, t + 7, lerp(0.34, 0.62, prog(t, T.road!, T.final2!)), k * 0.9);
      who.push(['IDA', q.x, q.y, fired('IDA')]);
    }
    if (t > T.noaIn!) {
      // Noa, Ida's girl, on the islet
      const k = prog(t, T.noaIn!, T.noaIn! + 0.8, ease.outCubic), q = w2s(v, here.x - 0.1, here.y + 0.85);
      lamp(gl, q.x, q.y, t + 13, lerp(0.3, 0.5, prog(t, T.noaIn!, T.end!)), k * 0.9);
      who.push(['NOA', q.x, q.y, T.noaIn!]);
    }
    const fc = this.fatherCue(), dOut = this.dadOut();
    const dad = prog(t, T.page!, T.page! + 1.5) * (1 - prog(t, dOut, dOut + 1.3, ease.inOutSine));
    const dadBig = prog(t, fc.t0 - 1, fc.t0 + 0.5) * (1 - prog(t, fc.t1, fc.t1 + 1));
    if (dad > 0) { const q = w2s(v, home.x, home.y); lamp(gl, q.x + 8, q.y - 6, t + 11, 0.7 + 0.8 * dadBig, dad * 0.9); }
    if (t > dOut && t < dOut + 4.5) {
      // a thread of smoke where his light was
      const q = w2s(v, home.x, home.y), ph = clamp((t - dOut) / 4.5);
      c.save(); c.globalAlpha = Math.sin(ph * Math.PI) * 0.8; c.strokeStyle = rgba('graphite', 0.9); c.lineWidth = 1.2; c.beginPath();
      for (let j = 0; j <= 24; j++) c.lineTo(q.x + 8 + 5 * Math.sin(j * 0.5 + t * 1.4) * (j / 24), q.y - 6 - j * 2.4 * (0.4 + ph));
      c.stroke(); c.restore();
    }
    // Jonah's trail, joining hers during "Packed for war but found a feast"
    const l11 = lyrics.lines[11]!;
    const sp = prog(t, l11.words[0]!.start - 0.3, T.feast!, ease.inOutSine);
    if (sp > 0) {
      const n = Math.floor(this.spouse.length * sp);
      for (let i = 1; i < n; i++) { const a = w2s(v, this.spouse[i - 1]!.x, this.spouse[i - 1]!.y), b = w2s(v, this.spouse[i]!.x, this.spouse[i]!.y); gl.seg2(a.x, a.y, b.x, b.y, 1.8, sc(LIN.ember, 1.0 * glowK), 0.9); }
      if (sp < 1) { const p = this.spouse[Math.max(0, n - 1)]!, q = w2s(v, p.x, p.y); lamp(gl, q.x, q.y, t + 3, 0.78, 0.9); }
    }
    // the feast: a ring of small lanterns
    const fk = after('THE FEAST', 0.01);
    if (fk > 0) {
      const m = WAY[wayIx('THE FEAST')]!, q = w2s(v, m.x, m.y);
      const fade = 1 - prog(t, fired('THE FEAST') + 3.5, fired('THE FEAST') + 6);
      for (let i = 0; i < 12; i++) {
        const on = prog(t, fired('THE FEAST') + i * 0.04, fired('THE FEAST') + i * 0.04 + 0.2) * fade;
        if (on <= 0) continue;
        const a = (i / 12) * TAU;
        lamp(gl, q.x + Math.cos(a) * 1.3 * v.s, q.y + Math.sin(a) * 0.75 * v.s, t + i, 0.32, on * 0.8);
      }
    }
    // rain, where the plan forecast sun
    const l10 = lyrics.lines[10]!;
    const rain = prog(t, l10.words[0]!.start - 0.4, l10.words[0]!.start + 0.4) * (1 - prog(t, l10.end + 0.2, l10.end + 1.2));
    if (rain > 0) {
      const fi = frameIdx(t) >> 1;
      for (let i = 0; i < 500 * rain; i++) {
        const x = hash(i, fi, 1) * 2100 - 90, y = hash(i, fi, 2) * 1100 - 50, Lr = 16 + 26 * hash(i, 3);
        ink.seg2(x, y, x - Lr * 0.28, y + Lr, 1, LIN.graphite, 0.3 + 0.25 * hash(i, 9));
      }
    }
    // the lighthouse on the islet: seen from the plate on, a flash every two bars; lit for good at HERE
    const seaCue = st.plates.find((p) => p.id === 'sea')!;
    const lhK = prog(t, seaCue.t0 + 0.4, seaCue.t0 + 1.2);
    if (lhK > 0) {
      const q = w2s(v, LIGHT.x, LIGHT.y);
      this.tower(c, q.x, q.y, clamp(v.s / 26, 0.55, 1.6), lhK);
      const sz = clamp(v.s / 26, 0.55, 1.6);
      // dark until she buys it and lights it
      if (beamI > 0) lamp(gl, q.x, q.y - 26 * sz, t + 5, 0.5 + 0.9 * beamI, lhK * beamI);
      // its sign: FOR SALE from the seaside on, SOLD on "beautiful", gone once she is there
      const sk = prog(t, seaCue.t1 + 0.4, seaCue.t1 + 0.8, ease.outCubic) * (1 - prog(t, T.here! + 1, T.here! + 2));
      if (sk > 0) this.saleSign(c, q.x + 14 * sz, q.y - 14 * sz, t, sk);
      if (beamI > 0) {
        // the beams' bright cores, out from the lamp
        for (const off of [0, Math.PI]) {
          const a = A + off, len = 2200;
          for (let j = -3; j <= 3; j++) {
            const aa = a + j * 0.006;
            gl.seg2(q.x, q.y - 26 * sz, q.x + Math.cos(aa + v.rot) * len, q.y - 26 * sz + Math.sin(aa + v.rot) * len, 3, sc(LIN.ember, 0.35), 0.18 * beamI * (1 - Math.abs(j) / 4));
          }
        }
      }
    }

    // ---------------------------------------------------------------- the new plans, made and abandoned
    this.drawPlans(c, v, t, peel);

    // ---------------------------------------------------------------- events: glyphs and tags (on the map)
    for (const e of evs) {
      if (!e.label) continue;
      const cue = st.plates.find((p) => p.anchor === e.way);
      const t0 = cue ? cue.t1 + 0.4 : e.t;
      const k = prog(t, t0 - 0.05, t0 + 0.35, ease.outBack);
      if (k <= 1e-3) continue;
      const w = WAY[e.way]!, q = w2s(v, w.x, w.y);
      this.glyph(c, e.name, q.x, q.y, clamp(k));
      const tagA = 1 - prog(t, T.band!, T.band! + 5, ease.inOutSine);
      if (tagA > 0) { c.save(); c.globalAlpha = tagA; this.tag(c, q.x, q.y, e.label, clamp(k), G); c.restore(); }
    }

    // her father, at HOME, once his light has gone out
    {
      const k = prog(t, this.dadOut() + 0.4, this.dadOut() + 0.8, ease.outBack) * (1 - prog(t, T.band!, T.band! + 5, ease.inOutSine));
      if (k > 1e-3) { const q = w2s(v, home.x, home.y); this.tag(c, q.x, q.y, 'HER FATHER · d. 1994', clamp(k), G); }
    }
    // on the islet: Jonah's and Mara's years
    for (const [txt, at, ox, oy] of [['JONAH · 1949–2019', T.jonahOut!, -150, 46], ['MARA · 1952–2034', T.maraOut!, 60, 44]] as [string, number, number, number][]) {
      const k = prog(t, at + 1.2, at + 1.6, ease.outBack) * (1 - prog(t, T.horn!, T.horn! + 2, ease.inOutSine));
      if (k > 1e-3) { const q = w2s(v, here.x, here.y); this.tag(c, q.x, q.y, txt, clamp(k), G, [ox, oy]); }
    }
    // who walks with her: names by the lamps when they join, while her father's plate is open, and on the islet
    {
      const fc = this.fatherCue();
      const shown = (since: number) => Math.max(
        prog(t, since + 0.4, since + 0.8) * (1 - prog(t, since + 4.5, since + 5.2)),
        prog(t, fc.t0 + 0.8, fc.t0 + 1.4) * (1 - prog(t, fc.t1, fc.t1 + 0.6)),
        prog(t, T.here! + 1.8, T.here! + 2.4) * (1 - prog(t, T.here! + 7, T.here! + 7.8)));
      for (const [name, x, y, since] of who) {
        const k = name === 'MARA' ? Math.max(prog(t, fc.t0 + 0.8, fc.t0 + 1.4) * (1 - prog(t, fc.t1, fc.t1 + 0.6)), prog(t, T.here! + 1.8, T.here! + 2.4) * (1 - prog(t, T.here! + 7, T.here! + 7.8))) : shown(since);
        const wide = prog(t, fc.t0 - 1, fc.t0) * (1 - prog(t, fc.t1, fc.t1 + 0.6)) > 0.5;
        if (k > 0) this.nameTag(c, name, x, y, k, name === 'NOA' ? 6 : (name === 'MARA' ? 0 : name === 'JONAH' ? 1 : 2) + (wide ? 3 : 0));
      }
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
    neatline(c, v, rgba('ink', 0.85 * (1 - G) * (1 - onTerr * 0.6)), { k: fk2.frame, step: 10, labels: onSheet > 0.5 });
    // the verse, written by the second pen on the card
    if (onSheet > 0.001 && t > T.verse1! - 0.5) {
      c.save(); c.translate(-(1 - onSheet) * 700, 0); c.globalAlpha = onSheet;
      verse.forEach((l, i) => {
        const stt = this.vSt[i]!, len = writtenLength(stt, this.vCt[i]!, t);
        if (len <= 0) return;
        const y = 440 + i * 72;
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

    // ---------------------------------------------------------------- the plates
    for (const cue of st.plates) {
      const ps = this.plateState(cue, t, v);
      if (!ps) continue;
      this.leader(c, cue, ps, v);
      drawPlate(c, cue.id, ps, { mono: (w) => F.mono(w), serif: (w, it) => F.serif(w, it) });
      const def = PLATES[cue.id]!;
      if (def.glow && ps.sx > 0.6 && ps.sy > 0.3) {
        const gk = ps.alpha * clamp((ps.sy - 0.3) / 0.5) * ease.inOutSine(clamp((ps.a.k - 0.8) / 0.2));
        const sxy = Math.min(ps.sx, ps.sy) * PS;
        def.glow({
          lamp: (x, y, scale, I) => { const q = plateToScreen(ps, x, y); lamp(top, q.x, q.y, t + x * 0.01, scale * sxy, I * gk); },
          seg: (x0, y0, x1, y1, w, col, I) => { const a = plateToScreen(ps, x0, y0), q = plateToScreen(ps, x1, y1); top.seg2(a.x, a.y, q.x, q.y, w * sxy, col, I * gk); },
        }, ps.a);
      }
    }

    // ---------------------------------------------------------------- the corner: the year, the compass
    this.year(c, t);
    const lostSpin = prog(t, T.lost!, T.bridge!, ease.inQuad);
    const settle2 = prog(t, T.arrive! - 1, T.arrive! + 1.5, ease.inOutCubic);
    const spin = lostSpin * (1 - settle2) * (t - T.lost!) * 9;
    const cA = prog(t, T.pre1! + 1.5, T.pre1! + 3) * (1 - prog(t, T.band!, T.band! + 3));
    if (cA > 0) {
      c.save(); c.globalAlpha = cA * 0.85;
      c.fillStyle = rgba('ink2', 0.82); c.beginPath(); c.arc(1846, 74, 40, 0, TAU); c.fill();
      c.restore();
      compassStar(c, 1846, 74, 30, { col: rgba('bone', 0.85 * cA), fill: rgba('signal', cA), rot: v.rot + spin, lw: 1 });
    }
    // title and epigraph (intro), title again at the very end
    this.titles(c, t);
    // ---------------------------------------------------------------- the lyric
    this.lyric(c, t);

    ink.render(renderer, out);
    gl.render(renderer, out);
    comp.draw(renderer, L.upload(), out);
    top.render(renderer, out);
    return { bloom: 0.5 + 0.2 * warm + 0.15 * beamI, vignette: 0.3, ca: 0, halation: 0, grain: 0.05, fade: prog(t, T.end! - 0.6, T.end! - 0.02) };
  }

  /** Where a plate is (and how far open) at time t. */
  plateState(cue: PlateCue, t: number, v: View): PlateState | null {
    if (t < cue.t0 || t > cue.t1 + 0.7) return null;
    const life = cue.t1 - cue.t0, age = t - cue.t0;
    const open = ease.outCubic(prog(age, 0, 0.85));
    const close = ease.inOutCubic(prog(t, cue.t1, cue.t1 + 0.65));
    const e = open * (1 - close);
    const aw = anchorOf(cue);
    const A = w2s(v, aw.x, aw.y);
    const slot = { x: cue.side < 0 ? 64 + (CW * PS) / 2 : 1856 - (CW * PS) / 2, y: PLATE_TOP + (CH * PS) / 2 };
    const m = ease.inOutSine(e);
    const def = PLATES[cue.id]!;
    const dd = Math.min(def.draw ?? 2.2, life * 0.5);
    const sk0 = 0.45 + dd * 0.8;
    return {
      x: lerp(A.x, slot.x, m), y: lerp(A.y, slot.y, m),
      sx: lerp(0.03, 1, ease.outCubic(clamp(e * 1.7))), sy: lerp(0.012, 1, ease.inOutSine(clamp((e - 0.35) / 0.65))),
      alpha: clamp(e * 5),
      a: { t, age, k: ease.inOutSine(prog(age, 0.45, 0.45 + dd)), life: clamp(age / life), T: this.st.T },
      planK: prog(age, 0.55, 0.95), strikeK: prog(age, sk0, sk0 + 0.45), happenK: prog(age, sk0 + 0.35, sk0 + 1.3),
    };
  }

  /** The leader from the place on the map to its plate. */
  leader(c: CanvasRenderingContext2D, cue: PlateCue, ps: PlateState, v: View) {
    const aw = anchorOf(cue);
    const A = w2s(v, aw.x, aw.y);
    const k = clamp((ps.sy - 0.2) / 0.5) * ps.alpha;
    if (k <= 0) return;
    const hw = (CW * PS * ps.sx) / 2, hh = (CH * PS * ps.sy) / 2;
    const ex = clamp(A.x, ps.x - hw, ps.x + hw), ey = clamp(A.y, ps.y - hh, ps.y + hh);
    if (Math.abs(ex - A.x) < 2 && Math.abs(ey - A.y) < 2) return;
    c.save(); c.globalAlpha = k;
    c.lineCap = 'round';
    c.strokeStyle = rgba('ink', 0.7); c.lineWidth = 3.4;
    c.beginPath(); c.moveTo(A.x, A.y); c.lineTo(ex, ey); c.stroke();
    c.strokeStyle = rgba('ember', 0.95); c.lineWidth = 1.2;
    c.setLineDash([2, 5]);
    c.beginPath(); c.moveTo(A.x, A.y); c.lineTo(ex, ey); c.stroke();
    c.setLineDash([]);
    c.lineWidth = 1.6;
    c.beginPath(); c.arc(A.x, A.y, 9 + 2 * Math.sin(ps.a.t * 4), 0, TAU); c.stroke();
    c.restore();
  }

  /** The ghost: a pale, pencilled double of her lamp, walking the ruled road on schedule. */
  ghost(c: CanvasRenderingContext2D, v: View, t: number) {
    const st = this.st, T = st.T as Record<string, number>;
    const vis = prog(t, T.tracing! - 0.4, T.tracing! + 0.6) * ghostA(st, t);
    if (vis <= 0.005) return;
    const gs = ghostS(st, t);
    // its footsteps: a dotted line along the plan behind it
    c.save();
    c.globalAlpha = vis;
    c.fillStyle = rgba('graphite', 0.85);
    for (let d = 0; d < gs; d += 0.6) {
      const p = planAt(d), q = w2s(v, p.x, p.y);
      if (q.x < -20 || q.x > 1940 || q.y < -20 || q.y > 1100) continue;
      c.beginPath(); c.arc(q.x + p.nx * 5, q.y + p.ny * 5, 1.5, 0, TAU); c.fill();
    }
    // the places it reaches pulse
    const arrivals = st.gKeys.slice(4, 7); // THE CLINIC, MARRIED, THE HOUSE
    arrivals.forEach(([ta], i) => {
      const age = t - ta;
      if (age < 0 || age > 2.2) return;
      const pl = PLAN[i + 3]!, q = w2s(v, pl.x, pl.y);
      c.strokeStyle = rgba('graphite', (1 - age / 2.2) * 0.9); c.lineWidth = 1.4;
      c.beginPath(); c.arc(q.x, q.y, 10 + age * 30, 0, TAU); c.stroke();
    });
    const p = planAt(gs), q = w2s(v, p.x, p.y);
    const gr = c.createRadialGradient(q.x, q.y, 2, q.x, q.y, 30);
    gr.addColorStop(0, rgba('bone', 0.9)); gr.addColorStop(0.35, rgba('ash', 0.45)); gr.addColorStop(1, rgba('graphite', 0));
    c.fillStyle = gr; c.beginPath(); c.arc(q.x, q.y, 30, 0, TAU); c.fill();
    c.strokeStyle = rgba('graphite', 0.95); c.lineWidth = 1.3;
    c.beginPath(); c.arc(q.x, q.y, 6.5, 0, TAU); c.stroke();
    c.fillStyle = rgba('bone', 0.95); c.beginPath(); c.arc(q.x, q.y, 5, 0, TAU); c.fill();
    // its label, once it walks alone
    const alone = prog(t, T.ferry!, T.ferry! + 1);
    if (alone > 0) {
      let pi = 0;
      for (let i = 0; i < PLACE_S.length; i++) if (PLACE_S[i]! <= gs + 0.05) pi = i;
      const pl = PLAN[pi]!;
      c.globalAlpha = vis * alone;
      c.font = font(F.mono(600), 11); c.letterSpacing = '2.5px';
      const t1 = 'AS PLANNED', t2 = `${pl.name}, ${pl.year}`;
      const w = Math.max(c.measureText(t1).width, c.measureText(t2).width) + 14;
      const lx = q.x - 18 - w + 7, ly = q.y + 26;
      c.fillStyle = rgba('bone', 0.88); c.fillRect(lx - 7, ly - 13, w, 34);
      c.strokeStyle = rgba('graphite', 0.8); c.lineWidth = 0.8; c.setLineDash([3, 3]); c.strokeRect(lx - 7, ly - 13, w, 34); c.setLineDash([]);
      c.fillStyle = rgba('graphite', 1); c.textBaseline = 'alphabetic';
      c.fillText(t1, lx, ly);
      c.fillStyle = rgba('ink', 0.75);
      c.fillText(t2, lx, ly + 14);
    }
    c.restore();
  }

  /** The year, counting with her, top left. */
  year(c: CanvasRenderingContext2D, t: number) {
    const T = this.st.T as Record<string, number>;
    const k = prog(t, T.page! - 0.3, T.page! + 0.6, ease.outCubic) * (1 - prog(t, T.horn! - 0.6, T.horn! + 1));
    if (k <= 0) return;
    const yf = yearAt(this.st, t), y = Math.floor(yf + 1e-6);
    const age = y - 1952;
    c.save();
    c.globalAlpha = k;
    c.fillStyle = rgba('ink2', 0.96); c.fillRect(56, 34, 236, 88);
    c.strokeStyle = rgba('bone', 0.5); c.lineWidth = 0.8; c.strokeRect(60, 38, 228, 80);
    mono(c, 'MARA', 76, 62, { size: 11, color: rgba('signal', 1), track: 4, weight: 600 });
    mono(c, t > T.maraOut! + 1 ? '1952–2034' : age === 0 ? 'BORN' : `AGE ${age}`, 270, 62, { size: 11, color: rgba('ash', 0.95), track: 3, align: 'right' });
    // the digits roll over like a counter
    const fr = yf - y, roll = ease.inOutCubic(clamp((fr - 0.75) / 0.25));
    const fam = F.archivo(112.5, 300);
    c.font = font(fam, 44); c.letterSpacing = '6px'; c.textBaseline = 'alphabetic';
    c.save(); c.beginPath(); c.rect(64, 66, 220, 50); c.clip();
    c.fillStyle = rgba('bone', 1);
    c.fillText(String(y), 74, 108 - roll * 44);
    if (roll > 0) c.fillText(String(y + 1), 74, 152 - roll * 44);
    c.restore();
    c.restore();
  }

  drawPlans(c: CanvasRenderingContext2D, v: View, t: number, peel: number) {
    const T = this.st.T as Record<string, number>;
    const all = (1 - peel) * (1 - prog(t, T.band!, T.band! + 4));
    if (all <= 0) return;
    for (const pl of this.plans) {
      if (t < pl.t0) continue;
      const dk = ease.inOutSine(prog(t, pl.t0, pl.t0 + 1.1));
      const struck = prog(t, pl.strike, pl.strike + 0.45);
      const lineA = all * (1 - 0.72 * prog(t, pl.strike + 0.5, pl.strike + 1.8));
      const tagA = all * (1 - prog(t, pl.strike + 2.6, pl.strike + 4.2));
      const A = w2s(v, pl.a.x, pl.a.y), B0 = w2s(v, pl.b.x, pl.b.y);
      const B = { x: A.x + (B0.x - A.x) * dk, y: A.y + (B0.y - A.y) * dk };
      const len = Math.hypot(B.x - A.x, B.y - A.y) || 1, nx = -(B.y - A.y) / len, ny = (B.x - A.x) / len;
      c.save();
      c.globalAlpha = lineA; c.lineCap = 'round';
      c.strokeStyle = rgba('ink', 0.75); c.lineWidth = 3.4;
      c.beginPath(); c.moveTo(A.x, A.y); c.lineTo(B.x, B.y); c.stroke();
      c.strokeStyle = rgba('bone', 0.95); c.lineWidth = 1.3;
      c.beginPath(); c.moveTo(A.x, A.y); c.lineTo(B.x, B.y); c.stroke();
      // a tick a year, like her father's
      c.lineWidth = 1;
      for (let d = 14; d < len; d += 14) { const x = A.x + ((B.x - A.x) * d) / len, y = A.y + ((B.y - A.y) * d) / len; c.beginPath(); c.moveTo(x - nx * 4, y - ny * 4); c.lineTo(x + nx * 4, y + ny * 4); c.stroke(); }
      c.restore();
      if (dk < 1) { penCross(c, B.x, B.y, all); continue; }
      // where it was going: a place mark and its name
      c.save();
      c.globalAlpha = Math.max(lineA, tagA);
      c.fillStyle = rgba('bone', 0.95); c.strokeStyle = rgba('ink', 0.9); c.lineWidth = 1.4;
      c.beginPath(); c.arc(B.x, B.y, 6, 0, TAU); c.fill(); c.stroke();
      if (struck > 0) {
        const r = 9 * struck;
        c.strokeStyle = rgba('ink', 0.95); c.lineWidth = 2;
        c.beginPath(); c.moveTo(B.x - r, B.y - r); c.lineTo(B.x + r, B.y + r); c.moveTo(B.x + r, B.y - r); c.lineTo(B.x - r, B.y + r); c.stroke();
      }
      c.restore();
      if (tagA <= 0) continue;
      const pop = ease.outBack(prog(t, pl.t0 + 1.1, pl.t0 + 1.45));
      if (pop <= 0) continue;
      c.save();
      c.globalAlpha = tagA * clamp(pop * 1.5);
      const text = `NEW PLAN · ${pl.label}`;
      c.font = font(F.mono(600), 12); c.letterSpacing = '2px';
      const w = c.measureText(text).width + 16, right = pl.side > 0;
      const bx = right ? B.x + 12 : B.x - 12 - w, by = B.y - 11;
      c.translate(B.x, B.y); c.scale(pop, pop); c.translate(-B.x, -B.y);
      c.fillStyle = rgba('bone', 0.96); c.fillRect(bx, by, w, 22);
      c.strokeStyle = rgba('ink', 0.85); c.lineWidth = 1; c.setLineDash([4, 3]); c.strokeRect(bx, by, w, 22); c.setLineDash([]);
      c.fillStyle = rgba('ink', 0.95); c.textBaseline = 'middle'; c.textAlign = 'left';
      c.fillText(text, bx + 8, by + 11.5);
      if (struck > 0) { c.strokeStyle = rgba('ink', 0.95); c.lineWidth = 2; c.beginPath(); c.moveTo(bx + 4, by + 11); c.lineTo(bx + 4 + (w - 8) * struck, by + 11); c.stroke(); }
      c.restore();
    }
  }

  /** A thread of smoke where a lamp went out (for 4.5 s from `at`). */
  smoke(c: CanvasRenderingContext2D, x: number, y: number, t: number, at: number) {
    if (t < at || t > at + 4.5) return;
    const ph = clamp((t - at) / 4.5);
    c.save(); c.globalAlpha = Math.sin(ph * Math.PI) * 0.8; c.strokeStyle = rgba('ash', 0.9); c.lineWidth = 1.2; c.beginPath();
    for (let j = 0; j <= 24; j++) c.lineTo(x + 5 * Math.sin(j * 0.5 + t * 1.4) * (j / 24), y - j * 2.4 * (0.4 + ph));
    c.stroke(); c.restore();
  }

  /** A name by a lamp: a small dark pill, ember type. `slot` spreads the three apart when they stand together. */
  nameTag(c: CanvasRenderingContext2D, name: string, x: number, y: number, k: number, slot: number) {
    // (slots 3..5: fanned out to the left, clear of a plate on the right)
    const [dx, dy] = [[0, -30], [24, 26], [-26, 28], [-36, -34], [-84, -6], [-58, 28], [-40, 40]][slot]!;
    c.save();
    c.globalAlpha *= k;
    c.font = font(F.mono(600), 11); c.letterSpacing = '3px';
    const w = c.measureText(name).width + 14;
    const bx = x + dx - w / 2, by = y + dy - 9;
    c.strokeStyle = rgba('ember', 0.6); c.lineWidth = 0.8;
    c.beginPath(); c.moveTo(x, y); c.lineTo(x + dx, y + dy + (dy < 0 ? 9 : -9)); c.stroke();
    c.fillStyle = rgba('ink2', 0.92); c.fillRect(bx, by, w, 18);
    c.strokeStyle = rgba('ember', 0.8); c.strokeRect(bx, by, w, 18);
    c.fillStyle = rgba('ember', 1); c.textBaseline = 'middle'; c.textAlign = 'left';
    c.fillText(name, bx + 8, by + 9.5);
    c.restore();
  }

  /** The lighthouse's sign on the map: FOR SALE, then SOLD. */
  saleSign(c: CanvasRenderingContext2D, x: number, y: number, t: number, k: number) {
    const T = this.st.T as Record<string, number>;
    const sold = prog(t, T.sold!, T.sold! + 0.3);
    const lx = x + 26, ly = y - 20;
    c.save();
    c.globalAlpha *= k;
    c.strokeStyle = rgba('ink', 0.85); c.lineWidth = 1;
    c.beginPath(); c.moveTo(x, y); c.lineTo(lx, ly + 10); c.stroke();
    const text = sold > 0.5 ? 'SOLD' : 'FOR SALE';
    c.font = font(F.mono(700), 12); c.letterSpacing = '2.5px';
    const w = c.measureText(text).width + 14;
    const thump = sold > 0.5 ? 1 + 0.5 * (1 - ease.outBack(clamp((sold - 0.5) * 2))) : 1;
    c.translate(lx + w / 2, ly); c.scale(thump, thump); c.rotate(sold > 0.5 ? -0.08 : 0); c.translate(-(lx + w / 2), -ly);
    c.fillStyle = rgba('bone', 0.97); c.fillRect(lx, ly - 10, w, 20);
    const col = HEX_INK;
    c.strokeStyle = sold > 0.5 ? rgba('signal', 1) : col; c.lineWidth = sold > 0.5 ? 2.2 : 1; c.strokeRect(lx, ly - 10, w, 20);
    c.fillStyle = col; c.textBaseline = 'middle'; c.textAlign = 'left';
    c.fillText(text, lx + 7, ly + 0.5);
    c.restore();
  }

  /** The lighthouse glyph on the map. */
  tower(c: CanvasRenderingContext2D, x: number, y: number, sz: number, k: number) {
    c.save();
    c.globalAlpha *= k;
    c.translate(x, y); c.scale(sz, sz);
    c.fillStyle = rgba('bone', 0.97); c.strokeStyle = rgba('ink', 0.95); c.lineWidth = 1.4;
    c.beginPath(); c.moveTo(-7, 0); c.lineTo(7, 0); c.lineTo(4.5, -22); c.lineTo(-4.5, -22); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = rgba('ink', 0.9);
    c.fillRect(-6.3, -7, 12.6, 3.5); c.fillRect(-5.3, -15, 10.6, 3.5);
    c.fillStyle = rgba('bone', 0.97);
    c.beginPath(); c.rect(-4, -30, 8, 8); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(-5.5, -30); c.lineTo(0, -36); c.lineTo(5.5, -30); c.closePath(); c.fill(); c.stroke();
    c.restore();
  }

  /** A tag on the map: a small paper label on a leader line (readable on paper and on terrain alike). */
  tag(c: CanvasRenderingContext2D, x: number, y: number, text: string, k: number, G: number, off?: [number, number]) {
    // hand-placed leaders so the labels of the crowded middle years do not collide
    const OFF: Record<string, [number, number]> = {
      'THE FERRY · 1973': [-60, -42], 'A BAKERY IN THE RAIN · 1974': [56, -46], 'THE FEAST · JONAH · 1976': [-74, -14],
      'IDA · 1978': [-80, 30], "MARA'S · 1981 · REBUILT 1989": [70, 18], 'THE SEASIDE · 1997': [-30, 84], 'HERE · 1999': [50, -40],
    };
    const [ox, oy] = off ?? OFF[text] ?? [34, -30];
    const side = ox > 0 ? 1 : -1;
    const lx = x + ox, ly = y + oy;
    c.save();
    c.globalAlpha *= clamp(k * 1.4);
    c.strokeStyle = rgba(G > 0.5 ? 'bone' : 'ink', 0.85); c.lineWidth = 1;
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

  /** The event's own mark on the map: a small dark badge with an icon. */
  glyph(c: CanvasRenderingContext2D, name: string, x: number, y: number, k: number) {
    if (name === 'HERE') return; // the lighthouse is its mark
    if (name === 'THE COAST') { placeMark(c, x, y, 9, rgba('ember', 1), k); return; }
    c.save();
    c.globalAlpha *= clamp(k * 1.5);
    c.translate(x, y); c.scale(ease.outBack(k), ease.outBack(k));
    c.fillStyle = rgba('ink2', 0.95); c.beginPath(); c.arc(0, 0, 12, 0, TAU); c.fill();
    c.strokeStyle = rgba('bone', 0.9); c.lineWidth = 1.2; c.beginPath(); c.arc(0, 0, 12, 0, TAU); c.stroke();
    c.strokeStyle = rgba('ember', 1); c.fillStyle = rgba('ember', 1); c.lineWidth = 1.3; c.lineCap = 'round';
    c.beginPath();
    switch (name) {
      case 'THE FERRY': c.moveTo(-7, 1); c.lineTo(7, 1); c.lineTo(5, 5); c.lineTo(-5, 5); c.closePath(); c.moveTo(-3, 1); c.lineTo(-3, -4); c.lineTo(2, -4); c.lineTo(2, 1); break;
      case 'THE BAKERY': c.ellipse(0, 2, 7, 4.5, 0, Math.PI, TAU); c.closePath(); c.moveTo(-3, -1); c.lineTo(-1, -3); c.moveTo(1, -1); c.lineTo(3, -3); break;
      case 'THE FEAST': c.ellipse(0, 0, 4, 5.5, 0, 0, TAU); c.moveTo(0, -5.5); c.lineTo(0, -8); c.moveTo(0, 5.5); c.lineTo(0, 8); break;
      case 'IDA': for (let j = 0; j <= 10; j++) { const r = j % 2 ? 3 : 7, a = -Math.PI / 2 + (j / 10) * TAU; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); } break;
      case "MARA'S": c.moveTo(-7, 5); c.lineTo(-7, 0); c.ellipse(0, 0, 7, 6, 0, Math.PI, TAU); c.lineTo(7, 5); c.closePath(); c.moveTo(-3, 5); c.ellipse(0, 5, 3, 3, 0, Math.PI, TAU); break;
      case 'HER FATHER': c.moveTo(-2, 6); c.lineTo(-2, -2); c.lineTo(2, -2); c.lineTo(2, 6); c.moveTo(0, -4); c.ellipse(0, -5.5, 1.6, 2.6, 0, 0, TAU); break;
      default: c.arc(0, 0, 3, 0, TAU);
    }
    c.stroke();
    c.restore();
  }

  titles(c: CanvasRenderingContext2D, t: number) {
    const T = this.st.T as Record<string, number>;
    // the title over the dark sheet while the band swells
    const a = prog(t, T.title! + 0.2, T.title! + 2.2, ease.outCubic) * (1 - prog(t, T.epigraph! - 2.2, T.epigraph! - 0.3, ease.inOutCubic));
    if (a > 0) {
      const title = 'MAPS & TERRITORY';
      // one font, one size, one tracking: it only fades in (and the same at the end)
      const fam = F.archivo(125, 300);
      const size = 84, tr = 22;
      c.save(); c.globalAlpha = a;
      c.font = font(fam, size); c.letterSpacing = `${tr}px`; c.textBaseline = 'alphabetic'; c.fillStyle = rgba('bone', 1);
      const wt = measure(title, fam, size, tr);
      c.fillText(title, 960 - wt / 2 + tr / 2, 500);
      const bk = prog(t, T.title! + 5, T.title! + 7, ease.outCubic);
      c.globalAlpha = a * bk;
      mono(c, 'JOBURGALEX', 960, 566, { size: 20, color: rgba('signal', 1), track: 14, align: 'center', weight: 500 });
      mono(c, 'MARA, 1952–2034  ·  A LIFE AS PLANNED, AND AS IT WENT', 960, 600, { size: 12, color: rgba('ash', 0.9), track: 4, align: 'center' });
      c.restore();
    }
    // the epigraph on the drum break
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

  /** The line split into rows that fit (big type), with its style. */
  layoutLine(i: number) {
    const got = this.rows.get(i);
    if (got) return got;
    const l = this.ctx.lyrics.lines[i]!;
    const chorus = [6, 7, 8, 9, 16, 17, 18, 19, 23, 24, 25, 26, 27, 28, 29, 30].includes(i);
    const bridge = i >= 20 && i <= 22;
    const fam = bridge ? F.serif(500, true) : chorus ? F.archivo(112.5, 800) : F.archivo(100, 700);
    let size = bridge ? 108 : chorus ? 84 : 80;
    const tr = bridge ? 0 : chorus ? -1.5 : -1;
    const MAXW = 1640;
    // char offsets of each word in the line's text (in order, like wordBoxes)
    const at: [number, number][] = [];
    { let from = 0; for (const w of l.words) { const a = l.text.indexOf(w.w, from); at.push([a, a + w.w.length]); from = a + w.w.length; } }
    const sub = (j0: number, j1: number): Line => ({ i: l.i, text: l.text.slice(at[j0]![0], at[j1 - 1]![1]), start: l.words[j0]!.start, end: l.words[j1 - 1]!.end, words: l.words.slice(j0, j1) });
    let lines: Line[] = [l];
    if (measure(l.text, fam, size, tr) > MAXW && l.words.length >= 4) {
      let best = 1, bw = Infinity;
      for (let k = 1; k < l.words.length; k++) {
        const w = Math.max(measure(sub(0, k).text, fam, size, tr), measure(sub(k, l.words.length).text, fam, size, tr));
        if (w < bw) { bw = w; best = k; }
      }
      lines = [sub(0, best), sub(best, l.words.length)];
    }
    const wmax = Math.max(...lines.map((q) => measure(q.text, fam, size, tr)));
    if (wmax > MAXW) size *= MAXW / wmax;
    const r = { lines, fam, size, tr };
    this.rows.set(i, r);
    return r;
  }

  /** The lyric: big, word-synced, along the bottom of the frame. */
  lyric(c: CanvasRenderingContext2D, t: number) {
    const ly = this.ctx.lyrics;
    // a soft dark band for the type to sit on
    let scrim = 0;
    for (let i = 4; i < ly.lines.length; i++) { const l = ly.lines[i]!; scrim = Math.max(scrim, prog(t, l.start - 1.2, l.start - 0.4) * (1 - prog(t, l.end + 1.6, l.end + 3))); }
    if (scrim > 0) {
      const g = c.createLinearGradient(0, 760, 0, 1080);
      g.addColorStop(0, rgba('ink', 0)); g.addColorStop(0.5, rgba('ink', 0.42 * scrim)); g.addColorStop(1, rgba('ink', 0.7 * scrim));
      c.fillStyle = g; c.fillRect(0, 760, 1920, 320);
    }
    for (let i = 4; i < ly.lines.length; i++) {
      const l = ly.lines[i]!, next = ly.lines[i + 1];
      if (t < l.start - 0.6 || t > l.end + 2.4) continue;
      const fin = prog(t, l.start - 0.55, l.start - 0.2, ease.outCubic);
      const fout = Math.max(next ? prog(t, next.start - 0.55, next.start - 0.25) : 0, prog(t, l.end + 1.5, l.end + 2.3));
      const a = fin * (1 - fout);
      if (a <= 0) continue;
      const r = this.layoutLine(i);
      const lh = r.size * 1.06;
      const y0 = 1000 - (r.lines.length - 1) * lh - fout * 26 + (1 - fin) * 14;
      c.save();
      c.globalAlpha = a;
      c.shadowColor = rgba('ink', 0.9); c.shadowBlur = 22; c.shadowOffsetY = 2;
      r.lines.forEach((q, j) => {
        drawKaraoke(c, q, 960, y0 + j * lh, t, { family: r.fam, size: r.size, tracking: r.tr, sung: rgba('bone', 1), unsung: rgba('bone', 0.24), active: rgba('ember', 1), lead: 0.55 + (q.start - l.start), mode: 'reveal', align: 'center' });
      });
      c.restore();
    }
  }
}
