// dawn — intro. Black; a protractor draws itself on the downbeats around one upright needle.
// The plate ends by pushing into the single degree between 90° and 91°.
import * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { Layer2D, clearRT, W, H } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { F, font } from '../engine/type';
import { LIN, rgba } from '../engine/palette';
import { clamp, ease, lerp, prog, TAU } from '../engine/util';
import { mono, needle, pivot, rad } from './_od';

const PX = W / 2, PY = 790; // pivot
const R = 560; // protractor radius

export default class Dawn extends Scene {
  lb = new LineBatch(6000);
  text = new Layer2D();
  db: number[] = [];

  override init() {
    const { audio, start, end } = this.ctx;
    this.db = audio.downbeats.filter((d) => d >= start - 0.01 && d < end);
  }

  render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer, comp } = this.ctx;
    const t = f.t;
    const d = (i: number) => this.db[Math.min(i, this.db.length - 1)] ?? 0;
    clearRT(renderer, out, LIN.ink);

    // camera: still, then a push into the degree between the needle and the 91° tick
    const zt = prog(t, d(5), this.ctx.end, ease.inOutCubic);
    const zoom = lerp(1, 1, 0) * Math.pow(46, zt);
    // focus: the needle's tip region (90°..91° at radius ~R)
    const fx = lerp(PX, PX + Math.cos(rad(-89.5)) * (R - 8), ease.inOutCubic(zt));
    const fy = lerp(H / 2 + 40, PY + Math.sin(rad(-89.5)) * (R - 8), ease.inOutCubic(zt));
    const S = (x: number, y: number) => ({ x: (x - fx) * zoom + W / 2, y: (y - fy) * zoom + H / 2 });

    const lb = this.lb;
    lb.clear();
    const bone = LIN.bone, gr = LIN.graphite;

    // pivot + needle (grows from the first downbeat)
    const grow = prog(t, d(0) - 0.2, d(0) + 1.6, ease.outExpo);
    const pv = S(PX, PY);
    if (t > 0.3) pivot(lb, pv.x, pv.y, 7 * Math.min(zoom, 3), bone, clamp((t - 0.3) / 0.6));
    if (grow > 0) needle(lb, pv.x, pv.y, rad(-90), (R - 40) * grow * zoom, t, { width: 1.5, tip: grow, tail: 30 * zoom * grow });

    // outer arc sweeps left -> right from downbeat 1
    const sweep = prog(t, d(1), d(1) + 1.8, ease.inOutCubic);
    const arcPts = (r: number, a0: number, a1: number, w: number, rgb: [number, number, number], al: number) => {
      const n = 180;
      let p = S(PX + Math.cos(a0) * r, PY + Math.sin(a0) * r);
      for (let i = 1; i <= n; i++) {
        const a = a0 + ((a1 - a0) * i) / n;
        const q = S(PX + Math.cos(a) * r, PY + Math.sin(a) * r);
        lb.seg2(p.x, p.y, q.x, q.y, w, rgb, al);
        p = q;
      }
    };
    if (sweep > 0) {
      arcPts(R, rad(180), rad(180 + 180 * sweep), 1.3, bone, 0.8);
      // baseline
      const b0 = S(PX - R - 40, PY), b1 = S(PX + R + 40, PY);
      lb.seg2(b0.x, b0.y, lerp(b0.x, b1.x, sweep), b0.y, 1.1, bone, 0.55);
    }
    // inner construction arcs (downbeat 4)
    const inner = prog(t, d(4), d(4) + 1.4, ease.inOutCubic);
    if (inner > 0) {
      arcPts(R * 0.62, rad(180), rad(180 + 180 * inner), 1, gr, 0.9);
      arcPts(R * 0.3, rad(360), rad(360 - 180 * inner), 1, gr, 0.9);
    }
    // degree ticks fill in from the left (downbeat 2), every degree
    const tk = prog(t, d(2), d(2) + 1.6, ease.outCubic);
    if (tk > 0) {
      const n = Math.floor(tk * 181);
      for (let i = 0; i < n; i++) {
        const a = rad(180 + i);
        const L = i % 10 === 0 ? 30 : i % 5 === 0 ? 19 : 10;
        const p = S(PX + Math.cos(a) * R, PY + Math.sin(a) * R);
        const q = S(PX + Math.cos(a) * (R - L), PY + Math.sin(a) * (R - L));
        const hot = i === 90 || i === 91;
        lb.seg2(p.x, p.y, q.x, q.y, i % 10 === 0 ? 1.4 : 1, hot && t > d(4) ? LIN.signal : bone, i % 5 === 0 ? 0.9 : 0.6);
      }
    }
    // the one degree: two radii (90°, 91°) and a small arc between them (downbeat 4)
    const one = prog(t, d(4) + 0.5, d(4) + 1.7, ease.inOutCubic);
    if (one > 0) {
      for (const deg of [-90, -89]) {
        const a = rad(deg);
        const p = S(PX + Math.cos(a) * R * 0.3, PY + Math.sin(a) * R * 0.3);
        const q = S(PX + Math.cos(a) * lerp(R * 0.3, R + 26, one), PY + Math.sin(a) * lerp(R * 0.3, R + 26, one));
        lb.seg2(p.x, p.y, q.x, q.y, 1, deg === -89 ? LIN.signal : bone, deg === -89 ? 0.95 : 0.4);
      }
      // the wedge's arc, just outside the scale
      const r = R + 18;
      const n = 12;
      for (let i = 0; i < n; i++) {
        const a0 = rad(-90 + i / n), a1 = rad(-90 + (i + 1) / n);
        const p = S(PX + Math.cos(a0) * r, PY + Math.sin(a0) * r), q = S(PX + Math.cos(a1) * r, PY + Math.sin(a1) * r);
        lb.seg2(p.x, p.y, q.x, q.y, 1.6, [LIN.signal[0] * 1.4, LIN.signal[1] * 1.4, LIN.signal[2] * 1.4], one);
      }
    }
    lb.render(renderer, out);

    // ----- type
    const L = this.text, c = L.ctx;
    L.clear();
    c.save();
    c.setTransform(zoom, 0, 0, zoom, W / 2 - fx * zoom, H / 2 - fy * zoom);
    // degree labels every 10° (downbeat 3)
    const lab = prog(t, d(3), d(3) + 1.2, ease.linear);
    if (lab > 0) {
      c.font = font(F.mono(400), 13);
      c.letterSpacing = '1px';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      const n = Math.floor(lab * 19);
      for (let i = 0; i < n; i++) {
        const deg = i * 10;
        const a = rad(180 + deg);
        const r = R + 26;
        c.fillStyle = rgba('ash', 0.9);
        c.save();
        c.translate(PX + Math.cos(a) * r, PY + Math.sin(a) * r);
        c.rotate(a + Math.PI / 2);
        c.fillText(String(deg), 0, -4);
        c.restore();
      }
    }
    // the degree's annotation
    if (one > 0) {
      c.globalAlpha = one;
      c.textAlign = 'left';
      c.textBaseline = 'alphabetic';
      c.font = font(F.serif(400, true), 30);
      c.fillStyle = rgba('bone', 0.92);
      const ax = PX + 44, ay = PY - R - 70;
      c.fillText('1°', ax, ay);
      c.font = font(F.mono(400), 12);
      c.letterSpacing = '2px';
      c.fillStyle = rgba('ash', 0.85);
      c.fillText('= 1/360 OF A TURN', ax + 40, ay - 2);
      c.strokeStyle = rgba('ash', 0.6);
      c.lineWidth = 1;
      c.beginPath(); c.moveTo(ax - 6, ay - 8); c.lineTo(PX + 6, PY - R - 22); c.stroke();
      c.globalAlpha = 1;
    }
    c.restore();
    // plate header (screen space): fades as the push begins
    const hdr = prog(t, d(1) + 0.4, d(1) + 1.4) * (1 - prog(t, d(5), d(5) + 0.8));
    if (hdr > 0) {
      c.globalAlpha = hdr;
      mono(c, 'ONE DEGREE', 120, 128, { size: 15, color: rgba('bone', 0.9), track: 5, weight: 500 });
      mono(c, 'JOBURGALEX', 120, 154, { size: 12, color: rgba('ash', 0.8), track: 4 });
      mono(c, 'FIG. 0 — A TURN, IN 360 PARTS', W - 120, 128, { size: 12, color: rgba('ash', 0.75), track: 3, align: 'right' });
      c.globalAlpha = 1;
    }
    comp.draw(renderer, L.upload(), out);
    return { bloom: 0.6, vignette: 0.4, roll: 0 };
  }
}
