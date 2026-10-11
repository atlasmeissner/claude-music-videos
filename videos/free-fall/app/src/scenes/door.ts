// door — pre-chorus 2: "The door says no or the door swings wide / Either way I'm on the other side".
// A blueprint on bone paper, in plan: a wall in section with a door opening, the leaf and its swing arc. "says no":
// a prohibition sign slams onto the closed leaf. "swings wide": the leaf swings open 90°, its arc drawn dashed (the
// plan symbol). Line 2: a decision tree — ASK → NO / WIDE — whose two branches both end in the same box, OTHER SIDE
// (P = 1.00); the spark walks through to it. On the held "side" the camera pushes in and the spark floods the sheet
// with signal orange, handing over to hook 2's signal field.
import type * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { Layer2D, clearRT, W, H } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { LIN, rgba } from '../engine/palette';
import { F } from '../engine/type';
import type { Line } from '../engine/lyrics';
import { clamp, ease, frameIdx, hash, lerp, prog, pulse } from '../engine/util';
import { drawKaraoke, drawNo, mono, sparkHead, sparkParticles } from './_ff';
import { stamp } from './ledger-kit';

const WY = 610, WT = 34; // wall centreline y, thickness
const D0 = 830, DW = 260; // door opening x (hinge at D0), width
type P2 = { x: number; y: number };

export default class Door extends Scene {
  L = new Layer2D();
  lb = new LineBatch(2000);
  fl = new LineBatch(4, { blend: 'normal' });
  l15!: Line; l16!: Line;
  tNo = 0; tWide = 0; tSide = 0;

  override init() {
    const ly = this.ctx.lyrics;
    this.l15 = ly.lines[15]!; this.l16 = ly.lines[16]!;
    this.tNo = this.l15.words[3]!.start; this.tWide = this.l15.words[8]!.start; this.tSide = this.l16.words[6]!.start;
  }

  /** The spark: waits on this side, walks through on line 2, sits in the OTHER SIDE box. */
  spark(tb: number): P2 {
    const w = this.l16.words;
    const a = { x: 960, y: 930 }, b = { x: D0 + DW / 2, y: WY + 70 }, c = { x: D0 + DW / 2, y: WY - 90 }, d = { x: 1500, y: 300 };
    if (tb < w[0]!.start) return { x: a.x + Math.sin(tb * 3) * 3, y: a.y };
    if (tb < w[2]!.start) { const k = prog(tb, w[0]!.start, w[2]!.start, ease.inOutCubic); return { x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k) }; }
    if (tb < w[4]!.start) { const k = prog(tb, w[2]!.start, w[4]!.start, ease.inOutCubic); return { x: lerp(b.x, c.x, k), y: lerp(b.y, c.y, k) }; }
    const k = prog(tb, w[4]!.start, this.tSide, ease.inOutCubic);
    return { x: lerp(c.x, d.x, k), y: lerp(c.y, d.y, k) };
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const { renderer, comp } = this.ctx;
    const t = f.t, end = this.ctx.end;
    clearRT(renderer, out, LIN.bone);
    const L = this.L, c = L.ctx; L.clear();
    const lb = this.lb; lb.clear();
    const ink = rgba('ink', 1), dim = rgba('graphite', 0.9), faint = rgba('ink', 0.08);
    // camera: push in toward the OTHER SIDE box on the held "side"
    const push = prog(t, this.tSide + 0.3, end, ease.inCubic);
    const z = 1 + 0.35 * push, fx = lerp(W / 2, 1500, push), fy = lerp(H / 2, 300, push);
    c.save();
    c.translate(W / 2, H / 2); c.scale(z, z); c.translate(-fx, -fy);
    // blueprint grid
    c.strokeStyle = faint; c.lineWidth = 1;
    for (let x = 0; x <= W; x += 40) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke(); }
    for (let y = 0; y <= H; y += 40) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
    // the wall in section (hatched), with the opening
    const k0 = prog(t, this.ctx.start, this.ctx.start + 0.5, ease.outCubic);
    const wallSeg = (x0: number, x1: number) => {
      c.save(); c.beginPath(); c.rect(x0, WY - WT / 2, (x1 - x0), WT); c.clip();
      c.strokeStyle = rgba('ink', 0.55); c.lineWidth = 1;
      for (let x = x0 - 40; x < x1 + 40; x += 9) { c.beginPath(); c.moveTo(x, WY + WT / 2); c.lineTo(x + WT, WY - WT / 2); c.stroke(); }
      c.restore();
      c.strokeStyle = ink; c.lineWidth = 2.4; c.strokeRect(x0, WY - WT / 2, x1 - x0, WT);
    };
    wallSeg(60 + (1 - k0) * 700, D0); wallSeg(D0 + DW, W - 60 - (1 - k0) * 700);
    // the leaf: closed along the opening, swings open 90° (into the far side) on "wide"
    const open = prog(t, this.tWide - 0.05, this.tWide + 0.45, ease.outBack);
    const ang = -open * Math.PI / 2;
    const lx = D0 + Math.cos(ang) * DW, lyy = WY + Math.sin(ang) * DW;
    c.strokeStyle = ink; c.lineWidth = 7; c.lineCap = 'butt';
    c.beginPath(); c.moveTo(D0, WY); c.lineTo(lx, lyy); c.stroke();
    // swing arc (dashed) as it opens
    if (open > 0.02) {
      c.save(); c.setLineDash([8, 7]); c.strokeStyle = dim; c.lineWidth = 1.4;
      c.beginPath(); c.arc(D0, WY, DW, 0, ang, true); c.stroke(); c.restore();
      mono(c, '90°', D0 + 40, WY - 40, { size: 14, color: dim, track: 2 });
    }
    mono(c, 'D-01  ·  900 × 2100', D0, WY + 56, { size: 13, color: dim, track: 2 });
    // NO: a prohibition sign slams on the closed leaf, flies off as it opens
    if (t > this.tNo - 0.02) {
      const k = clamp((t - this.tNo) / 0.12);
      const off = open * 600;
      c.save();
      c.translate(D0 + DW / 2 + off * 0.3, WY - off);
      c.rotate(open * 1.4);
      const sc = 1 + 0.5 * (1 - ease.outBack(k, 2));
      c.scale(sc, sc);
      c.globalAlpha = clamp(k * 3) * (1 - prog(open, 0.6, 1));
      drawNo(c, 0, 0, 70, 1, { disc: rgba('bone', 1) });
      c.restore();
    }
    // the decision tree, on line 2: ASK → NO / WIDE → OTHER SIDE
    const w = this.l16.words;
    const tr = prog(t, w[0]!.start - 0.1, w[1]!.start + 0.3, ease.outCubic);
    if (tr > 0) {
      const ask = { x: 960, y: 930 }, no = { x: 420, y: 800 }, wide = { x: D0 + DW / 2, y: WY + 70 }, box = { x: 1500, y: 300 };
      const dash = (p: P2, q: P2, k: number, col: string, via?: P2) => {
        if (k <= 0) return;
        c.save(); c.setLineDash([10, 8]); c.strokeStyle = col; c.lineWidth = 2;
        c.beginPath(); c.moveTo(p.x, p.y);
        if (via) {
          const m = k < 0.5 ? k * 2 : 1;
          c.lineTo(lerp(p.x, via.x, m), lerp(p.y, via.y, m));
          if (k > 0.5) c.lineTo(lerp(via.x, q.x, (k - 0.5) * 2), lerp(via.y, q.y, (k - 0.5) * 2));
        } else c.lineTo(lerp(p.x, q.x, k), lerp(p.y, q.y, k));
        c.stroke(); c.restore();
      };
      // NO goes round the wall's end; WIDE goes through the door; both end at the box
      dash(ask, no, tr, ink);
      dash(no, box, prog(t, w[1]!.start, w[3]!.start, ease.inOutCubic), ink, { x: 120, y: 300 });
      dash(ask, wide, tr, ink);
      dash(wide, box, prog(t, w[2]!.start, w[4]!.start + 0.4, ease.inOutCubic), ink, { x: D0 + DW / 2, y: 300 });
      const node = (p: P2, label: string, k: number) => {
        if (k <= 0) return;
        c.save(); c.globalAlpha = k;
        c.fillStyle = rgba('bone', 1); c.strokeStyle = ink; c.lineWidth = 2;
        c.beginPath(); c.roundRect(p.x - 70, p.y - 24, 140, 48, 8); c.fill(); c.stroke();
        mono(c, label, p.x, p.y + 6, { size: 16, color: ink, track: 3, align: 'center', weight: 600 });
        c.restore();
      };
      node(ask, 'ASK', tr);
      node(no, 'NO', tr);
      node(wide, 'WIDE', tr);
      const bk = prog(t, w[4]!.start, w[5]!.start, ease.outBack);
      if (bk > 0.01) {
        c.save(); c.globalAlpha = clamp(bk);
        c.fillStyle = rgba('ink', 1);
        c.beginPath(); c.roundRect(box.x - 170, box.y - 44, 340, 88, 10); c.fill();
        mono(c, 'OTHER SIDE', box.x, box.y + 9, { size: 26, color: rgba('bone', 1), track: 6, align: 'center', weight: 600 });
        c.restore();
        mono(c, 'P(other side | no) = 1.00', box.x - 170, box.y + 80, { size: 14, color: ink, track: 2 });
        mono(c, 'P(other side | wide) = 1.00', box.x - 170, box.y + 104, { size: 14, color: ink, track: 2 });
      }
      mono(c, 'THIS SIDE', 960, 1010, { size: 13, color: dim, track: 5, align: 'center' });
    }
    // the spark's body on paper (the additive head alone vanishes on bone)
    const sp0 = this.spark(t);
    c.fillStyle = rgba('signal', 1); c.beginPath(); c.arc(sp0.x, sp0.y, 9, 0, Math.PI * 2); c.fill();
    c.restore();
    // the lyric: line 1 then line 2 in its place (top left), ink on paper
    const st = { family: F.archivo(112.5, 900), size: 76, tracking: -2, sung: rgba('ink', 1), unsung: rgba('ink', 0.16), active: rgba('signal', 1), lead: 0.4 } as const;
    const sw = prog(t, this.l16.start - 0.15, this.l16.start + 0.05);
    if (sw < 1) { c.save(); c.globalAlpha = 1 - sw; drawKaraoke(c, this.l15, 104, 190, t, st); c.restore(); }
    if (sw > 0) { c.save(); c.globalAlpha = sw * (1 - push); drawKaraoke(c, this.l16, 104, 190, t, st); c.restore(); }
    mono(c, 'PLAN · LEVEL 0 · DOOR D-01', 104, 96, { size: 13, color: dim, track: 4 });
    stamp(c, 560, 470, ['EITHER WAY'], t, this.tSide, { size: 28, rot: -0.1 });
    comp.draw(renderer, L.upload(), out);
    // the spark, and the flood of signal from it at the end
    const map = (q: P2) => ({ x: (q.x - fx) * z + W / 2, y: (q.y - fy) * z + H / 2 });
    const p = map(this.spark(t));
    sparkParticles(lb, t, (tb) => map(this.spark(tb)), { rate: 60, intensity: 0.9 });
    sparkHead(lb, p.x, p.y, t, 1 + push, 1 + push);
    const flood = prog(t, end - 0.55, end, ease.inQuad);
    if (flood > 0) {
      // a growing disc of signal (many thick segments as a filled circle)
      const R = flood * 2300;
      this.fl.clear();
      this.fl.seg2(p.x, p.y, p.x + 0.01, p.y, R * 2, LIN.signal, 1);
    }
    lb.render(renderer, out);
    if (flood > 0) this.fl.render(renderer, out);
    const hit = pulse(t, this.tNo, 0.08) + pulse(t, this.tWide, 0.1) * 0.8 + pulse(t, this.tSide, 0.08) * 0.6;
    const sh = hit * 7;
    return { paper: 1, bloom: 0.25, vignette: 0.18, halation: 0.1, shake: [(hash(frameIdx(t), 1) - 0.5) * sh, (hash(frameIdx(t), 2) - 0.5) * sh] as [number, number] };
  }
}
