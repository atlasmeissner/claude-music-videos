// compass — chorus 2, second half: "I was tracing someone else's story / Now I'm lost but I'm not looking anymore".
// The plan, as a paper sheet laid over the night country, a compass on it hunting for north. On "lost" the needle
// spins free. On "looking" the sheet folds itself up like a road map, panel by panel, and is put away; the compass
// goes with it. What is left is the country and the gold line through it.
import * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { Layer2D } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { F, font } from '../engine/type';
import { rgba } from '../engine/palette';
import type { Line } from '../engine/lyrics';
import { clamp, ease, lerp, prog, TAU } from '../engine/util';
import { coastX, LAKE, PLAN, waySAt } from './_world';
import { compassStar, drawKaraoke, drawTrack, lerpView, mixCss, Terrain } from './_mt';

const SW = 1440, SH = 860; // the sheet (px)

export default class Compass extends Scene {
  terrain = new Terrain();
  lb = new LineBatch(4000);
  text = new Layer2D();
  sheet!: HTMLCanvasElement;
  l18!: Line; l19!: Line;

  override init() {
    this.l18 = this.ctx.lyrics.lines[18]!; this.l19 = this.ctx.lyrics.lines[19]!;
    // the plan, drawn once onto an offscreen sheet (2x for crispness)
    const cv = document.createElement('canvas'); cv.width = SW * 2; cv.height = SH * 2;
    const c = cv.getContext('2d')!; c.scale(2, 2);
    c.fillStyle = rgba('bone', 1); c.fillRect(0, 0, SW, SH);
    const s = SH / 72, ox = 60, oy = 40; // 1 km = s px; world (x, y) -> sheet
    const P = (x: number, y: number) => ({ x: ox + (x - 2) * s, y: oy + (y - 4) * s });
    c.strokeStyle = rgba('ink', 0.18); c.lineWidth = 1;
    for (let k = 0; k <= 100; k += 10) { const a = P(k, 0), b = P(k, 100), d = P(0, k), e = P(100, k); c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.moveTo(d.x, d.y); c.lineTo(e.x, e.y); c.stroke(); }
    c.strokeStyle = rgba('ink', 0.85); c.lineWidth = 1.6; c.beginPath();
    for (let y = 0; y <= 100; y += 0.5) { const p = P(coastX(y), y); if (y) c.lineTo(p.x, p.y); else c.moveTo(p.x, p.y); }
    c.stroke();
    const lk = P(LAKE.x, LAKE.y); c.beginPath(); c.ellipse(lk.x, lk.y, LAKE.r * 1.35 * s, LAKE.r * s, 0, 0, TAU); c.stroke();
    c.lineWidth = 2.4; c.beginPath();
    PLAN.forEach((p, i) => { const q = P(p.x, p.y); if (i) c.lineTo(q.x, q.y); else c.moveTo(q.x, q.y); });
    c.stroke();
    c.font = font(F.mono(600), 13); c.letterSpacing = '3px'; c.fillStyle = rgba('ink', 0.9);
    PLAN.forEach((p) => { const q = P(p.x, p.y); c.beginPath(); c.arc(q.x, q.y, 8, 0, TAU); c.stroke(); c.fillText(p.name, q.x + 14, q.y - 10); });
    c.font = font(F.mono(600), 14); c.fillText('SHEET 1 · THE PLAN', 30, SH - 30);
    c.strokeStyle = rgba('ink', 0.8); c.lineWidth = 1; c.strokeRect(14, 14, SW - 28, SH - 28);
    // fold creases (faint)
    c.strokeStyle = rgba('ink', 0.07);
    for (let i = 1; i < 6; i++) { c.beginPath(); c.moveTo((SW * i) / 6, 0); c.lineTo((SW * i) / 6, SH); c.stroke(); }
    this.sheet = cv;
  }

  render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer, comp } = this.ctx;
    const t = f.t, t0 = this.ctx.start, t1 = this.ctx.end;
    const l18 = this.l18, l19 = this.l19;
    const lost = l19.words[2]!, looking = l19.words[6]!;
    const v = lerpView({ cx: 44, cy: 64, s: 17, rot: 0.05 }, { cx: 50, cy: 62, s: 22, rot: -0.03 }, prog(t, t0, t1, ease.inOutSine));
    this.terrain.draw(renderer, out, { view: v, terrInk: 0.5, relief: 3.2, t, warmth: 0.15 * prog(t, looking.start, t1), sun: [-0.5, -0.6, 0.5] });
    const lb = this.lb; lb.clear();
    drawTrack(lb, v, waySAt(7), t, { width: 2.4 });
    lb.render(renderer, out);

    const T = this.text, c = T.ctx; T.clear();
    // the fold: accordion, 6 panels, then the folded strip is taken away
    const fold = prog(t, looking.start - 0.05, looking.start + 1.0, ease.inOutCubic);
    const away = prog(t, looking.start + 0.9, looking.start + 1.7, ease.inCubic);
    const enter = prog(t, t0, t0 + 0.5, ease.outCubic);
    const sx = 960 - SW / 2, sy = 540 - SH / 2 - 30 + (1 - enter) * 60 + away * 900;
    if (away < 1) {
      c.save();
      c.translate(960, 540); c.rotate(-0.03 + away * 0.3); c.translate(-960, -540);
      const th = fold * Math.PI / 2 * 0.94;
      const pw = SW / 6, dw = pw * Math.cos(th);
      const total = dw * 6, x0 = 960 - total / 2;
      for (let i = 0; i < 6; i++) {
        const x = x0 + i * dw;
        c.drawImage(this.sheet, (i * pw) * 2, 0, pw * 2, SH * 2, x, sy, dw, SH);
        // light falls differently on the two faces of each fold
        const shade = Math.sin(th) * (i % 2 ? 0.32 : 0.08);
        if (shade > 0.001) { c.fillStyle = `rgba(10,16,19,${shade})`; c.fillRect(x, sy, dw + 0.5, SH); }
      }
      // the compass, sitting on the sheet
      const ccx = x0 + total - Math.min(total * 0.18, 150), ccy = sy + SH - 170;
      const spin = prog(t, lost.start, looking.start, ease.inQuad);
      const na = lerp(-Math.PI / 2 + 0.35 * Math.sin(t * 1.7) + 0.2 * Math.sin(t * 4.1), -Math.PI / 2 + 40 * spin * spin, spin) + (t > looking.start ? (t - looking.start) * 14 : 0);
      compassStar(c, ccx, ccy, 92, { col: rgba('ink', 0.85), fill: rgba('ink', 0.25), lw: 1.1 });
      c.save(); c.translate(ccx, ccy); c.rotate(na);
      c.fillStyle = rgba('blood', 1); c.beginPath(); c.moveTo(80, 0); c.lineTo(0, -6); c.lineTo(0, 6); c.closePath(); c.fill();
      c.fillStyle = rgba('ink', 0.6); c.beginPath(); c.moveTo(-56, 0); c.lineTo(0, -6); c.lineTo(0, 6); c.closePath(); c.fill();
      c.restore();
      c.restore();
    }
    // the lyric: ink on the sheet, bone once it has gone
    const onSheet = 1 - Math.max(fold, away);
    const st = { family: F.archivo(100, 800), size: 82, tracking: -2, lead: 0.5 };
    const col = (k: number) => ({ sung: mixCss(rgba('ink', 1), rgba('bone', 1), k), unsung: mixCss(rgba('ink', 0.13), rgba('bone', 0.16), k), active: mixCss(rgba('blood', 1), rgba('signal', 1), k) });
    const swap = prog(t, l19.words[0]!.start - 0.6, l19.words[0]!.start - 0.2, ease.inOutCubic);
    if (swap < 1) { c.save(); c.globalAlpha = 1 - swap; drawKaraoke(c, l18, 960, 900, t, { ...st, ...col(clamp(1 - onSheet)), align: 'center' }); c.restore(); }
    if (swap > 0) { c.save(); c.globalAlpha = swap; drawKaraoke(c, l19, 960, 900, t, { ...st, ...col(clamp(1 - onSheet)), align: 'center' }); c.restore(); }
    comp.draw(renderer, T.upload(), out);
    return { bloom: 0.45, vignette: 0.4, ca: 0.45, halation: 0.2 };
  }
}
