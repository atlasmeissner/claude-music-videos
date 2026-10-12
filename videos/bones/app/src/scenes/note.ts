// note — intro: the lone piano. Black. The title, then every piano note places a point (height = pitch) and
// rings out, joined by one hairline, the first line drawn. On the last bar the points are surveyed into one:
// sight lines run from each to a single station, and everything collapses into THE POINT, which the next plate
// stands its building on.
import * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { Layer2D, clearRT, W } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { F, font } from '../engine/type';
import { LIN, rgba } from '../engine/palette';
import { clamp, ease, lerp, prog } from '../engine/util';
import { mono, point, POINT0, ring, scaleRGB, titleBlock } from './_bones';

export default class Note extends Scene {
  lb = new LineBatch(4000);
  text = new Layer2D();
  notes: { t: number; s: number; m: number; x: number; y: number }[] = [];
  tc = 0;

  override init() {
    const { audio, start, end } = this.ctx;
    const raw = (audio.onsets.piano ?? []) as unknown as [number, number, number][];
    const ns = raw.filter((o) => o[0] >= start && o[0] < end - 0.05);
    const t0 = ns[0]?.[0] ?? 3.5, t1 = end;
    this.notes = ns.map(([t, s, m]) => ({ t, s, m, x: lerp(220, 1700, (t - t0) / (t1 - t0)), y: 520 - (m - 74) * 17 }));
    // the collapse starts on the last beat before the cut
    this.tc = audio.timeOfBeat(Math.floor(audio.beatAt(end - 0.02)) - 1);
  }

  render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer, comp } = this.ctx;
    const t = f.t, end = this.ctx.end;
    clearRT(renderer, out, LIN.ink);
    const lb = this.lb; lb.clear();
    const col = prog(t, this.tc, end, ease.inOutCubic); // collapse
    const P = POINT0;
    const pos = (n: { x: number; y: number }, i: number) => {
      const k = clamp(col * 1.25 - (i / Math.max(1, this.notes.length)) * 0.25);
      const e = ease.inOutCubic(k);
      return { x: lerp(n.x, P.x, e), y: lerp(n.y, P.y, e) };
    };
    const sung = this.notes.filter((n) => n.t <= t);
    // the hairline through the notes, drawn note to note
    for (let i = 1; i < sung.length; i++) {
      const a = pos(sung[i - 1]!, i - 1), b = pos(sung[i]!, i);
      const k = prog(t, sung[i]!.t, sung[i]!.t + 0.12, ease.outCubic);
      lb.seg2(a.x, a.y, lerp(a.x, b.x, k), lerp(a.y, b.y, k), 1, LIN.bone, 0.35 * (1 - col * 0.8));
    }
    // sight lines to the station during the collapse
    if (col > 0) {
      for (let i = 0; i < sung.length; i++) {
        const a = pos(sung[i]!, i);
        const k = prog(t, this.tc + i * 0.01, this.tc + 0.25 + i * 0.01, ease.outCubic);
        lb.seg2(a.x, a.y, lerp(a.x, P.x, k), lerp(a.y, P.y, k), 0.8, LIN.signal, 0.35 * (1 - col));
      }
    }
    // the notes: dots that ring out; the newest is the point
    sung.forEach((n, i) => {
      const p = pos(n, i);
      const age = t - n.t;
      const fresh = clamp(1 - age / 0.5);
      lb.seg2(p.x, p.y, p.x + 0.01, p.y, 5 + 4 * fresh, scaleRGB(LIN.bone, 0.75 + fresh * 0.6), (0.55 + 0.45 * fresh) * (1 - col * 0.9));
      if (col < 0.2) ring(lb, p.x, p.y, t, n.t, { r0: 6, speed: 70 + n.s * 90, life: 2.2, alpha: 0.35 + n.s * 0.4, w: 1 });
    });
    const last = sung[sung.length - 1];
    if (last && col < 1) { const p = pos(last, sung.length - 1); point(lb, p.x, p.y, t, 0.8, (1 - col) * clamp(1 - (t - last.t) / 1.2) * 0.9); }
    // the station
    const pk = prog(t, this.tc, this.tc + 0.3, ease.outCubic);
    if (pk > 0) {
      point(lb, P.x, P.y, t, 1 + col * 0.2, pk);
      ring(lb, P.x, P.y, t, end - 0.12, { r0: 10, speed: 220, life: 1.2, rgb: LIN.signal, alpha: 0.8 });
    }
    lb.render(renderer, out);

    // type: the title, then the sheet
    const T = this.text, c = T.ctx; T.clear();
    const ti = prog(t, 0.6, 1.8, ease.outCubic) * (1 - prog(t, 3.0, 3.8, ease.inCubic));
    if (ti > 0) {
      c.save(); c.globalAlpha = ti;
      c.font = font(F.archivo(125, 300), 150); c.letterSpacing = '38px'; c.textAlign = 'center'; c.fillStyle = rgba('bone', 1);
      c.fillText('BONES', W / 2 + 19, 560);
      c.restore();
      mono(c, 'JOBURGALEX', W / 2, 624, { size: 15, weight: 500, color: rgba('bone', 0.85 * ti), track: 9, align: 'center' });
      mono(c, 'MAPS & TERRITORY · TRACK 01', W / 2, 652, { size: 11, color: rgba('ash', 0.75 * ti), track: 5, align: 'center' });
    }
    const sheet = prog(t, 3.6, 4.4, ease.outCubic) * (1 - col);
    if (sheet > 0) {
      titleBlock(c, 'D-000', 'A SINGLE NOTE', [['INSTRUMENT', 'PIANO, ALONE'], ['NOTES', String(sung.length).padStart(3, '0')]], { alpha: sheet });
    }
    comp.draw(renderer, T.upload(), out);
    return { bloom: 0.7, ca: 0.4, vignette: 0.5, fade: 1 - prog(t, 0, 0.6) };
  }
}
