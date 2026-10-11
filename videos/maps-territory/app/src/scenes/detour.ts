// detour — verse 2, four sub-plates cut on the beat before each line:
//  A "I planned for sun but it was raining": a forecast card pinned over the night country, five drawn suns; on
//    "raining" the rain comes down across the relief and the suns are struck out.
//  B "Packed for war but found a feast": a packing list (helmet, rations, flares…) ticked off as sung; on "feast"
//    it is struck through, and at A FEAST on the track a ring of small lamps: a long table.
//  C "Every detour was the real road": the plan (dashed) and the track (gold); DETOUR signs at the bends of the
//    track turn into ROAD on "real road".
//  D "Every wrong turn headed east": a compass card over the coast; at every wrong turn of the track an arrow, and
//    every arrow points east. HEADING 090°.
import * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { Layer2D } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { F, font } from '../engine/type';
import { LIN, rgba } from '../engine/palette';
import type { Line } from '../engine/lyrics';
import { clamp, ease, frameIdx, hash, lerp, prog, TAU } from '../engine/util';
import { PLAN_PTS, track, trackAt, WAY, waySAt } from './_world';
import { compassStar, drawKaraoke, drawTrack, lamp, lerpView, mono, sc, Terrain, w2s, type View } from './_mt';

export default class Detour extends Scene {
  terrain = new Terrain();
  lb = new LineBatch(12000);
  ink = new LineBatch(3000, { blend: 'normal' });
  text = new Layer2D();
  ls: Line[] = [];
  cuts: number[] = [];

  override init() {
    const { lyrics, audio } = this.ctx;
    this.ls = [10, 11, 12, 13].map((i) => lyrics.lines[i]!);
    this.cuts = this.ls.map((l, i) => (i === 0 ? this.ctx.start : audio.timeOfBeat(Math.floor(audio.beatAt(l.words[0]!.start + 0.02)))));
  }

  render(f: Frame, out: THREE.WebGLRenderTarget) {
    const t = f.t;
    let k = 0;
    for (let i = 0; i < 4; i++) if (t >= this.cuts[i]!) k = i;
    const end = k < 3 ? this.cuts[k + 1]! : this.ctx.end;
    const { renderer, comp } = this.ctx;
    this.lb.clear(); this.ink.clear();
    this.outRT = out;
    const T = this.text, c = T.ctx; T.clear();
    const post = [this.rain, this.feast, this.road, this.east][k]!.call(this, t, this.cuts[k]!, end, c);
    this.ink.render(renderer, out);
    this.lb.render(renderer, out);
    const l = this.ls[k]!;
    const st = { family: F.archivo(100, 800), size: 84, tracking: -2, sung: rgba('bone', 1), unsung: rgba('bone', 0.16), active: rgba('signal', 1), lead: 0.5 };
    drawKaraoke(c, l, 120, 960, t, st);
    comp.draw(renderer, T.upload(), out);
    return post;
  }

  /** A paper card (Canvas2D). */
  card(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, rot: number, k: number) {
    c.translate(x + w / 2, y + h / 2 + (1 - k) * 40); c.rotate(rot); c.translate(-w / 2, -h / 2);
    c.globalAlpha = k;
    c.fillStyle = rgba('bone', 0.97); c.fillRect(0, 0, w, h);
    c.strokeStyle = rgba('ink', 0.75); c.lineWidth = 1; c.strokeRect(8, 8, w - 16, h - 16);
  }

  // ---------------------------------------------------------------- A: the forecast
  rain(t: number, t0: number, t1: number, c: CanvasRenderingContext2D) {
    const { renderer } = this.ctx;
    const l = this.ls[0]!;
    const raining = l.words[l.words.length - 1]!;
    const r = prog(t, raining.start - 0.1, raining.start + 0.5, ease.outCubic);
    const v = lerpView({ cx: 34, cy: 70, s: 18, rot: 0.06 }, { cx: 36, cy: 69, s: 21, rot: 0.03 }, prog(t, t0, t1));
    this.terrain.draw(this.ctx.renderer, this.outRT!, { view: v, terrInk: 0.5, relief: 3.2, t, sun: [-0.5, -0.6, 0.5] });
    void renderer;
    // rain: slanted streaks, re-seeded every few frames
    if (r > 0) {
      const fi = frameIdx(t) >> 1;
      for (let i = 0; i < 900 * r; i++) {
        const x = hash(i, fi, 1) * 2100 - 90, y = hash(i, fi, 2) * 1180 - 50, L = 18 + 30 * hash(i, 3);
        this.lb.seg2(x, y, x - L * 0.28, y + L, 1, sc(LIN.ash, 0.5), 0.35 + 0.3 * hash(i, 9));
      }
    }
    const k = prog(t, t0, t0 + 0.4, ease.outCubic);
    c.save();
    this.card(c, 1250, 150, 520, 380, 0.03, k);
    mono(c, 'FORECAST  ·  AS PLANNED', 32, 50, { size: 13, color: rgba('ink', 0.9), track: 3, weight: 600 });
    const days = ['MON', 'TUE', 'WED', 'THU', 'FRI'];
    days.forEach((d, i) => {
      const x = 62 + i * 98, y = 170;
      const struck = prog(t, raining.start + i * 0.12, raining.start + i * 0.12 + 0.2);
      c.strokeStyle = rgba('ink', 0.85); c.lineWidth = 1.4;
      c.beginPath(); c.arc(x, y, 18, 0, TAU); c.stroke();
      for (let j = 0; j < 8; j++) { const a = (j / 8) * TAU; c.beginPath(); c.moveTo(x + Math.cos(a) * 25, y + Math.sin(a) * 25); c.lineTo(x + Math.cos(a) * 33, y + Math.sin(a) * 33); c.stroke(); }
      mono(c, d, x, y + 74, { size: 12, color: rgba('ink', 0.8), track: 2, align: 'center' });
      mono(c, '24°', x, y + 98, { size: 13, color: rgba('ink', 0.9), track: 1, align: 'center' });
      if (struck > 0) {
        c.strokeStyle = rgba('blood', 1); c.lineWidth = 2.4;
        c.beginPath(); c.moveTo(x - 36, y + 36); c.lineTo(x - 36 + 72 * struck, y + 36 - 72 * struck); c.stroke();
        // rain marks under the struck sun
        c.lineWidth = 1.4;
        for (let j = 0; j < 4; j++) { c.beginPath(); c.moveTo(x - 18 + j * 12, y + 128); c.lineTo(x - 24 + j * 12, y + 148); c.stroke(); }
      }
    });
    mono(c, r > 0.5 ? 'ACTUAL: RAIN, ALL WEEK' : 'CHANCE OF RAIN  0%', 32, 345, { size: 13, color: rgba(r > 0.5 ? 'blood' : 'ink', 0.95), track: 2, weight: r > 0.5 ? 600 : 400 });
    c.restore();
    return { bloom: 0.4, vignette: 0.45, ca: 0.45, halation: 0.15 };
  }

  // ---------------------------------------------------------------- B: packed for war, found a feast
  feast(t: number, t0: number, t1: number, c: CanvasRenderingContext2D) {
    const l = this.ls[1]!;
    const feast = l.words[l.words.length - 1]!, found = l.words[4]!;
    const W5 = WAY[5]!;
    const v = lerpView({ cx: W5.x - 2.5, cy: W5.y - 0.5, s: 42, rot: -0.05 }, { cx: W5.x - 1.6, cy: W5.y - 0.2, s: 60, rot: 0 }, prog(t, t0, t1, ease.inOutSine));
    const warm = prog(t, found.start, feast.end + 0.4, ease.inOutSine) * 0.55;
    this.terrain.draw(this.ctx.renderer, this.outRT!, { view: v, terrInk: 0.5, relief: 3.2, warmth: warm, t, sun: [-0.6, -0.4, 0.5] });
    drawTrack(this.lb, v, waySAt(5), t, { width: 2.4 });
    // the table: a ring of small lamps around the waypoint
    const q = w2s(v, W5.x, W5.y);
    const n = 14;
    for (let i = 0; i < n; i++) {
      const on = prog(t, feast.start + i * 0.05, feast.start + i * 0.05 + 0.25, ease.outCubic);
      if (on <= 0) continue;
      const a = (i / n) * TAU;
      lamp(this.lb, q.x + Math.cos(a) * 70 + 34 * Math.cos(a) * (i % 2), q.y + Math.sin(a) * 34, t + i, 0.42, on * 0.8);
    }
    const k = prog(t, t0, t0 + 0.4, ease.outCubic);
    c.save();
    this.card(c, 1250, 140, 520, 470, -0.025, k);
    mono(c, 'PACKING LIST', 32, 50, { size: 13, color: rgba('ink', 0.9), track: 4, weight: 600 });
    const items = ['HELMET  ×1', 'RATIONS  ×30', 'FLARES  ×6', 'BOOTS, STEEL-CAPPED  ×1', 'SPARE MAP  ×2', 'ARMOUR  (OPTIONAL)'];
    const warWord = l.words[2]!; // "war"
    items.forEach((s, i) => {
      const y = 104 + i * 46;
      const tick = prog(t, l.words[0]!.start + i * ((warWord.end - l.words[0]!.start) / items.length), l.words[0]!.start + i * ((warWord.end - l.words[0]!.start) / items.length) + 0.15);
      c.strokeStyle = rgba('ink', 0.85); c.lineWidth = 1.2; c.strokeRect(32, y - 14, 15, 15);
      if (tick > 0) { c.beginPath(); c.moveTo(34, y - 6); c.lineTo(39, y - 1); c.lineTo(46, y - 13); c.stroke(); }
      mono(c, s, 64, y, { size: 14, color: rgba('ink', 0.92), track: 2 });
      const strike = prog(t, found.start + i * 0.08, found.start + i * 0.08 + 0.25);
      if (strike > 0) { c.strokeStyle = rgba('blood', 1); c.lineWidth = 2; c.beginPath(); c.moveTo(60, y - 5); c.lineTo(60 + 380 * strike, y - 5); c.stroke(); }
    });
    const stamp = prog(t, feast.start, feast.start + 0.18, ease.outBack);
    if (stamp > 0) {
      c.save(); c.translate(330, 400); c.rotate(-0.18); c.scale(1 + (1 - stamp) * 0.6, 1 + (1 - stamp) * 0.6);
      c.globalAlpha = clamp(stamp);
      c.strokeStyle = rgba('blood', 1); c.lineWidth = 3; c.strokeRect(-110, -38, 220, 70);
      c.font = font(F.archivo(125, 900), 48); c.fillStyle = rgba('blood', 1); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('FEAST', 0, 0);
      c.restore();
    }
    c.restore();
    const lk = prog(t, feast.end, feast.end + 0.4);
    if (lk > 0) { c.globalAlpha = lk; mono(c, 'A FEAST  ·  14 AT THE TABLE', q.x, q.y + 92, { size: 12, color: rgba('ember', 1), track: 3, align: 'center' }); c.globalAlpha = 1; }
    return { bloom: 0.65, vignette: 0.45, ca: 0.45, halation: 0.3 };
  }

  // ---------------------------------------------------------------- C: every detour was the real road
  road(t: number, t0: number, t1: number, c: CanvasRenderingContext2D) {
    const l = this.ls[2]!;
    const real = l.words[4]!;
    const v = lerpView({ cx: 38, cy: 60, s: 14.5, rot: 0 }, { cx: 40, cy: 59, s: 16, rot: 0.02 }, prog(t, t0, t1, ease.inOutSine));
    this.terrain.draw(this.ctx.renderer, this.outRT!, { view: v, terrInk: 0.5, relief: 3.2, t, sun: [-0.5, -0.6, 0.5] });
    // the plan, dashed bone
    const P = PLAN_PTS.map((p) => w2s(v, p.x, p.y));
    for (let i = 1; i < P.length; i++) {
      const a = P[i - 1]!, b = P[i]!, L = Math.hypot(b.x - a.x, b.y - a.y), n = Math.floor(L / 9);
      for (let d = 0; d < n; d += 2) this.lb.seg2(a.x + (b.x - a.x) * d / n, a.y + (b.y - a.y) * d / n, a.x + (b.x - a.x) * (d + 1) / n, a.y + (b.y - a.y) * (d + 1) / n, 1.4, sc(LIN.bone, 0.6), 0.7);
    }
    const draw = prog(t, t0, l.end, ease.inOutSine);
    drawTrack(this.lb, v, lerp(0, waySAt(6), draw), t, { width: 2.4 });
    // signs at the waypoints (the detours), flipping on "real"
    const flip = prog(t, real.start - 0.05, real.start + 0.3, ease.inOutCubic);
    for (let w = 1; w <= 6; w++) {
      const s = waySAt(w);
      if (s > lerp(0, waySAt(6), draw) + 0.01) continue;
      const p = trackAt(s), q = w2s(v, p.x, p.y);
      const label = flip > 0.5 ? 'ROAD' : 'DETOUR';
      const sy = Math.abs(Math.cos(flip * Math.PI));
      c.save(); c.translate(q.x, q.y - 34); c.scale(1, Math.max(0.05, sy));
      c.fillStyle = flip > 0.5 ? rgba('signal', 1) : rgba('bone', 0.95);
      c.fillRect(-46, -14, 92, 26);
      c.font = font(F.mono(600), 13); c.letterSpacing = '2px'; c.fillStyle = rgba('ink', 1); c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(label, 0, 0);
      c.restore();
      c.strokeStyle = rgba('bone', 0.7); c.lineWidth = 1; c.beginPath(); c.moveTo(q.x, q.y - 20); c.lineTo(q.x, q.y - 4); c.stroke();
    }
    mono(c, 'PLANNED ROAD', 120, 150, { size: 12, color: rgba('bone', 0.7), track: 4 });
    mono(c, 'THE ROAD', 120, 174, { size: 12, color: rgba('signal', 1), track: 4, weight: 600 });
    c.strokeStyle = rgba('bone', 0.6); c.setLineDash([5, 5]); c.beginPath(); c.moveTo(300, 145); c.lineTo(360, 145); c.stroke(); c.setLineDash([]);
    c.strokeStyle = rgba('signal', 1); c.lineWidth = 2.4; c.beginPath(); c.moveTo(300, 169); c.lineTo(360, 169); c.stroke();
    return { bloom: 0.5, vignette: 0.4, ca: 0.45, halation: 0.2 };
  }

  // ---------------------------------------------------------------- D: every wrong turn headed east
  east(t: number, t0: number, t1: number, c: CanvasRenderingContext2D) {
    const l = this.ls[3]!;
    const v = lerpView({ cx: 52, cy: 62, s: 17, rot: 0 }, { cx: 58, cy: 60, s: 19, rot: 0 }, prog(t, t0, t1, ease.inOutSine));
    this.terrain.draw(this.ctx.renderer, this.outRT!, { view: v, terrInk: 0.5, relief: 3.2, t, sun: [-0.5, -0.6, 0.5], seaAcid: 0.15 });
    const s1 = lerp(waySAt(3), waySAt(7), prog(t, t0, l.end, ease.inOutSine));
    drawTrack(this.lb, v, s1, t, { width: 2.4 });
    // arrows at each wrong turn (the waypoints), all pointing east, landing one per word
    for (let w = 1; w <= 7; w++) {
      const s = waySAt(w);
      if (s > s1) continue;
      const wi = Math.min(l.words.length - 1, Math.max(0, w - 3));
      const a = prog(t, Math.max(t0, l.words[wi]!.start - 0.1), Math.max(t0, l.words[wi]!.start) + 0.3, ease.outBack);
      if (a <= 0) continue;
      const p = trackAt(s), q = w2s(v, p.x, p.y);
      c.save(); c.translate(q.x, q.y - 40); c.globalAlpha = clamp(a);
      c.strokeStyle = rgba('ember', 1); c.fillStyle = rgba('ember', 1); c.lineWidth = 2.2;
      const L = 46 * a;
      c.beginPath(); c.moveTo(-L / 2, 0); c.lineTo(L / 2, 0); c.stroke();
      c.beginPath(); c.moveTo(L / 2 + 8, 0); c.lineTo(L / 2 - 4, -7); c.lineTo(L / 2 - 4, 7); c.closePath(); c.fill();
      mono(c, 'E', L / 2 + 22, 5, { size: 12, color: rgba('ember', 1), track: 1, weight: 600 });
      c.restore();
    }
    // the compass card, swinging to east on "east"
    const eastW = l.words[l.words.length - 1]!;
    const sw = prog(t, eastW.start - 0.1, eastW.start + 0.6, (x) => ease.outBack(x, 1.6));
    compassStar(c, 1600, 300, 120, { col: rgba('bone', 0.8), fill: rgba('bone', 0.35), lw: 1.1 });
    // the needle: wandering, then east
    const na = lerp(-2.0 + 0.5 * Math.sin(t * 2.1) + 0.3 * Math.sin(t * 5.3), 0, sw);
    c.save(); c.translate(1600, 300); c.rotate(na);
    c.fillStyle = rgba('signal', 1); c.beginPath(); c.moveTo(104, 0); c.lineTo(0, -7); c.lineTo(0, 7); c.closePath(); c.fill();
    c.fillStyle = rgba('bone', 0.7); c.beginPath(); c.moveTo(-70, 0); c.lineTo(0, -7); c.lineTo(0, 7); c.closePath(); c.fill();
    c.restore();
    mono(c, 'HEADING', 1600, 490, { size: 12, color: rgba('ash', 0.9), track: 4, align: 'center' });
    const head = trackAt(s1).angle;
    const deg = ((90 + (head * 180) / Math.PI) % 360 + 360) % 360;
    mono(c, `${sw > 0.5 ? '090' : deg.toFixed(0).padStart(3, '0')}°  ${sw > 0.5 ? 'EAST' : ''}`, 1600, 518, { size: 20, color: rgba('signal', 1), track: 2, align: 'center', weight: 500 });
    void track;
    return { bloom: 0.5, vignette: 0.4, ca: 0.45, halation: 0.2 };
  }

  outRT: THREE.WebGLRenderTarget | null = null;
}
