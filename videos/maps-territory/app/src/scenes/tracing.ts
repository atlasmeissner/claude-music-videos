// tracing — chorus 1, second half: "I was tracing someone else's story / Now I'm standing somewhere off the shore",
// then the break.
// Night, the coast. A sheet of tracing paper lies askew over the land with somebody else's route on it, dotted, and
// notes in somebody else's hand. The lamp follows it exactly while the line is sung. On "Now" it leaves the dots,
// crosses the beach and walks into the sea, to the islet that no map shows; on "shore" the tracing paper slides off
// and the sea turns teal. The break holds on the islet: waves, and a position that is on no sheet.
import * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { Layer2D } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { F } from '../engine/type';
import { LIN, rgba } from '../engine/palette';
import type { Line } from '../engine/lyrics';
import { clamp, ease, lerp, prog } from '../engine/util';
import { strokeText, drawStrokeText, type StrokeText } from '../engine/stroke';
import { ISLET, track, trackAt, waySAt } from './_world';
import { drawKaraoke, lamp, lerpView, mono, sc, Terrain, w2s, type View } from './_mt';
import { lineProg } from './drew';

// somebody else's route (km): up the coast road to the north, never to the sea
const THEIRS = [{ x: 49, y: 69 }, { x: 52.5, y: 65.5 }, { x: 55, y: 63.5 }, { x: 58, y: 61.2 }, { x: 60, y: 59 }, { x: 61.5, y: 55 }, { x: 62.2, y: 50.5 }, { x: 64.5, y: 46 }, { x: 66, y: 41 }];
const NOTES: [string, number, number][] = [['stay on the road', 50.5, 63.2], ['turn left here', 62.8, 56.5], ['not past the coast', 59.0, 47.5]];

function along(pts: { x: number; y: number }[], k: number) {
  const L = [0]; for (let i = 1; i < pts.length; i++) L.push(L[i - 1]! + Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.y - pts[i - 1]!.y));
  const s = clamp(k) * L[L.length - 1]!;
  let i = 1; while (i < L.length - 1 && L[i]! < s) i++;
  const u = (s - L[i - 1]!) / (L[i]! - L[i - 1]!);
  return { x: pts[i - 1]!.x + (pts[i]!.x - pts[i - 1]!.x) * u, y: pts[i - 1]!.y + (pts[i]!.y - pts[i - 1]!.y) * u, i };
}

export default class Tracing extends Scene {
  terrain = new Terrain();
  lb = new LineBatch(3000);
  paper = new Layer2D();
  text = new Layer2D();
  l8!: Line; l9!: Line;
  notes: StrokeText[] = [];
  kDiv = 0.5; // where on their route the lamp leaves it

  override init() {
    this.l8 = this.ctx.lyrics.lines[8]!; this.l9 = this.ctx.lyrics.lines[9]!;
    this.notes = NOTES.map(([s]) => strokeText(s, 'hscript', 30, 0));
    // their route passes (60, 59): the lamp leaves there
    const L = [0]; for (let i = 1; i < THEIRS.length; i++) L.push(L[i - 1]! + Math.hypot(THEIRS[i]!.x - THEIRS[i - 1]!.x, THEIRS[i]!.y - THEIRS[i - 1]!.y));
    this.kDiv = L[4]! / L[L.length - 1]!;
  }

  render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer, comp } = this.ctx;
    const t = f.t, t0 = this.ctx.start, t1 = this.ctx.end;
    const l8 = this.l8, l9 = this.l9;
    const shore = l9.words[l9.words.length - 1]!;
    // camera: over the coast, easing out to the islet for the break
    const v = lerpView({ cx: 58.5, cy: 58.5, s: 26, rot: 0.04 }, { cx: ISLET.x - 1.2, cy: ISLET.y - 0.3, s: 64, rot: -0.04 }, prog(t, shore.start - 0.5, t1, ease.inOutCubic));
    const sea = prog(t, shore.start, shore.start + 1.2, ease.inOutSine);
    this.terrain.draw(renderer, out, { view: v, mapMix: 0, seaAcid: sea, terrInk: 0.55, relief: 3.2, t, sun: [-0.5, -0.6, 0.5] });

    // the lamp: along their route during line 8, then off it along the walked track to the islet during line 9
    const kA = lineProg(l8, t) * this.kDiv;
    const s6 = waySAt(6), sEnd = track().total;
    const kB = prog(t, l9.words[0]!.start, shore.end - 0.1, ease.inOutSine);
    const lb = this.lb; lb.clear();
    // trail along their route
    let head = along(THEIRS, Math.max(0.0001, kA));
    const trailA: { x: number; y: number }[] = [];
    for (let i = 0; i <= 40; i++) trailA.push(along(THEIRS, (kA * i) / 40));
    for (let i = 1; i < trailA.length; i++) { const a = w2s(v, trailA[i - 1]!.x, trailA[i - 1]!.y), b = w2s(v, trailA[i]!.x, trailA[i]!.y); lb.seg2(a.x, a.y, b.x, b.y, 2.2, sc(LIN.signal, 1.1), 0.9); }
    let hp = w2s(v, head.x, head.y);
    if (kB > 0) {
      const s1 = lerp(s6, sEnd, kB);
      let prev = w2s(v, trailA[trailA.length - 1]!.x, trailA[trailA.length - 1]!.y);
      for (let s = s6; s <= s1; s += 0.15) {
        const p = trackAt(Math.min(s, s1)); const q = w2s(v, p.x, p.y);
        const hot = clamp(1 - (s1 - s) / 3);
        lb.seg2(prev.x, prev.y, q.x, q.y, 2.2 + hot, sc(LIN.signal, 1 + 1.2 * hot), 0.95);
        prev = q;
      }
      const p = trackAt(s1); hp = w2s(v, p.x, p.y); head = { ...p, i: 0 };
    }
    if (t >= l8.words[0]!.start - 0.3) lamp(lb, hp.x, hp.y, t, 1, prog(t, l8.words[0]!.start - 0.3, l8.words[0]!.start));

    // the tracing paper: translucent, askew, their route dotted; it slides off on "shore"
    const P = this.paper, c = P.ctx; P.clear();
    const off = prog(t, shore.start - 0.1, shore.start + 0.9, ease.inCubic);
    const pin = prog(t, t0, t0 + 0.5, ease.outCubic);
    if (off < 1 && pin > 0) {
      c.save();
      c.translate(960 - off * 1500, 540 + off * 120); c.rotate(-0.035 - off * 0.25); c.translate(-960, -540);
      c.globalAlpha = pin;
      c.fillStyle = rgba('bone', 0.2); c.fillRect(-200, -200, 2320, 1480);
      c.strokeStyle = rgba('bone', 0.35); c.lineWidth = 1; c.strokeRect(-200, -200, 2320, 1480);
      // their dotted route
      c.fillStyle = rgba('bone', 0.9);
      for (let k = 0; k <= 1.0001; k += 0.006) { const p = along(THEIRS, k); const q = w2s(v, p.x, p.y); c.beginPath(); c.arc(q.x, q.y, 1.9, 0, Math.PI * 2); c.fill(); }
      // their notes, in their hand
      c.strokeStyle = rgba('bone', 0.85); c.lineWidth = 1.5; c.lineCap = 'round'; c.lineJoin = 'round';
      NOTES.forEach(([, x, y], i) => { const q = w2s(v, x, y); c.save(); c.translate(q.x, q.y); c.rotate(-0.06); drawStrokeText(c, this.notes[i]!, this.notes[i]!.total); c.restore(); });
      mono(c, 'TRACED FROM: SOMEONE ELSE', 140, 150, { size: 12, color: rgba('bone', 0.75), track: 4 });
      c.restore();
    }
    lb.render(renderer, out);
    comp.draw(renderer, P.upload(), out);

    const T = this.text, d = T.ctx; T.clear();
    const st = { family: F.archivo(100, 800), size: 84, tracking: -2, sung: rgba('bone', 1), unsung: rgba('bone', 0.16), active: rgba('signal', 1), lead: 0.5 };
    const swap = prog(t, l9.words[0]!.start - 0.6, l9.words[0]!.start - 0.2, ease.inOutCubic);
    if (swap < 1) { d.save(); d.globalAlpha = 1 - swap; drawKaraoke(d, l8, 120, 900, t, st); d.restore(); }
    if (swap > 0) {
      const fadeEnd = 1 - prog(t, t1 - 2.2, t1 - 0.6);
      d.save(); d.globalAlpha = swap * fadeEnd; drawKaraoke(d, l9, 120, 900, t, { ...st, sung: sea > 0.5 ? rgba('bone', 1) : rgba('bone', 1) }); d.restore();
    }
    // the break: a position that is on no sheet
    const pk = prog(t, shore.end, shore.end + 0.6);
    if (pk > 0) {
      d.globalAlpha = pk;
      mono(d, 'POSITION', 1800, 150, { size: 12, color: rgba('ash', 0.85), track: 4, align: 'right' });
      mono(d, `${head.x.toFixed(3)} E  ${head.y.toFixed(3)} S`, 1800, 178, { size: 18, color: rgba('acid', 1), track: 2, align: 'right', weight: 500 });
      mono(d, 'OFF THE SHORE  ·  ON NO SHEET', 1800, 204, { size: 12, color: rgba('bone', 0.7), track: 3, align: 'right' });
      d.globalAlpha = 1;
    }
    comp.draw(renderer, T.upload(), out);
    return { bloom: 0.55, vignette: 0.45, ca: 0.5, halation: 0.25 };
  }
}
