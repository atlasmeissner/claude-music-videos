// asbuilt — the choir, still swelling. Bone paper: the record drawing of what was built. A longitudinal
// section of the nave, a cross-section through the middle bay and a plan draw themselves on; in the corner the
// old gilded façade as it was, small, struck through. On a downbeat the sheet is stamped AS BUILT; the drawing
// counts what it is made of — and what it is not.
import * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { Layer2D, clearRT } from '../engine/gl';
import { F, font } from '../engine/type';
import { LIN, rgba } from '../engine/palette';
import { clamp, ease, lerp, prog } from '../engine/util';
import { drawLedger, mono, pointPaper, titleBlock } from './_bones';
import { FACADE } from './_facade';
import { NAVE, NAVE_GROUPS, type Seg3 } from './_frame3d';

const LONG = { ox: 300, oy: 720, s: 17 };   // side: screen x = ox - z*s, y = oy - y*s
const CROSS = { ox: 1500, oy: 720, s: 16 }; // section through z = -20: screen x = ox + x*s

export default class AsBuilt extends Scene {
  text = new Layer2D();
  side: Seg3[] = []; cross: Seg3[] = [];
  stamp = 0;

  override init() {
    const { audio, start, end } = this.ctx;
    this.side = NAVE.filter((s) => s.a[0] <= 0.4 && s.b[0] <= 0.4 && s.stage >= 0);
    this.cross = NAVE.filter((s) => Math.abs((s.a[2] + s.b[2]) / 2 + 20) < 0.6 && Math.abs(s.a[2] - s.b[2]) < 0.6);
    this.stamp = audio.downbeats.find((d) => d > start + 5.5 && d < end) ?? start + 6;
  }

  render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer, comp, lyrics, audio } = this.ctx;
    const t = f.t, s0 = this.ctx.start, e = this.ctx.end;
    clearRT(renderer, out, LIN.bone);
    const T = this.text, c = T.ctx; T.clear();
    const zoom = lerp(1, 1.06, prog(t, s0, e, ease.inOutQuad));
    c.save(); c.translate(960, 540); c.scale(zoom, zoom); c.translate(-960, -540);
    // faint grid
    c.strokeStyle = rgba('ink', 0.045); c.lineWidth = 1;
    for (let x = 0; x < 1920; x += 40) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, 1080); c.stroke(); }
    for (let y = 0; y < 1080; y += 40) { c.beginPath(); c.moveTo(0, y); c.lineTo(1920, y); c.stroke(); }
    const draw = (segs: Seg3[], map: (p: [number, number, number]) => [number, number], k: number, w = 1) => {
      const n = Math.floor(segs.length * k);
      c.strokeStyle = rgba('ink', 0.85); c.lineWidth = w;
      c.beginPath();
      for (let i = 0; i < n; i++) { const s = segs[i]!; const [ax, ay] = map(s.a), [bx, by] = map(s.b); c.moveTo(ax, ay); c.lineTo(bx, by); }
      c.stroke();
    };
    const k1 = prog(t, s0 + 0.1, s0 + 2.6, ease.inOutCubic), k2 = prog(t, s0 + 1.2, s0 + 3.4, ease.inOutCubic), k3 = prog(t, s0 + 2.2, s0 + 4.2, ease.inOutCubic);
    draw(this.side, (p) => [LONG.ox - p[2] * LONG.s, LONG.oy - p[1] * LONG.s], k1, 0.9);
    draw(this.cross, (p) => [CROSS.ox + p[0] * CROSS.s, CROSS.oy - p[1] * CROSS.s], k2, 1.1);
    void k3;
    // ground lines and the point in each view
    c.strokeStyle = rgba('ink', 0.9); c.lineWidth = 1.4;
    c.beginPath(); c.moveTo(LONG.ox - 160, LONG.oy); c.lineTo(LONG.ox + 46 * LONG.s, LONG.oy); c.stroke();
    c.beginPath(); c.moveTo(CROSS.ox - 300, CROSS.oy); c.lineTo(CROSS.ox + 300, CROSS.oy); c.stroke();
    pointPaper(c, LONG.ox, LONG.oy, t, 0.8, k1);
    pointPaper(c, CROSS.ox - 5 * CROSS.s, CROSS.oy, t, 0.7, k2);
    mono(c, 'LONGITUDINAL SECTION', LONG.ox - 150, LONG.oy + 34, { size: 12, color: rgba('ink', 0.85 * k1), track: 3, weight: 500 });
    mono(c, 'CROSS-SECTION, BAY 4', CROSS.ox - 290, CROSS.oy + 34, { size: 12, color: rgba('ink', 0.85 * k2), track: 3, weight: 500 });
    // the old façade, small, struck through
    const ko = prog(t, s0 + 3.0, s0 + 3.6, ease.outCubic);
    if (ko > 0) {
      c.save(); c.globalAlpha = ko;
      const ox = 300, oy = 960, s = 0.13;
      for (const m of FACADE) {
        if (m.layer === 'frame') continue;
        c.strokeStyle = m.layer === 'gold' ? rgba('gold', 0.9) : rgba('ink', 0.55); c.lineWidth = 0.6;
        c.beginPath(); m.pts.forEach(([x, y], i) => (i ? c.lineTo(ox + x * s, oy + y * s) : c.moveTo(ox + x * s, oy + y * s))); c.stroke();
      }
      const sk = prog(t, s0 + 3.6, s0 + 3.9, ease.outCubic);
      c.strokeStyle = rgba('signal', 1); c.lineWidth = 2;
      c.beginPath(); c.moveTo(ox - 110, oy + 4); c.lineTo(ox - 110 + 220 * sk, oy - 140 * sk); c.stroke();
      c.restore();
      mono(c, 'BEFORE: AS INHERITED', 410, 900, { size: 11, color: rgba('ink', 0.8 * ko), track: 3 });
      mono(c, 'GOLD 100% · FOUNDATION NONE', 410, 920, { size: 11, color: rgba('gold', 0.95 * ko), track: 2 });
    }
    // schedule of what it is made of
    const ks = prog(t, s0 + 4.0, s0 + 4.6);
    const rows: [string, string][] = [['POINTS SET OUT', '1'], ['MEMBER GROUPS', String(NAVE_GROUPS.length)], ['SEGMENTS', String(NAVE.length)], ['GOLD', '0'], ['ASSUMPTIONS', '0']];
    rows.forEach(([a, b], i) => {
      const kk = prog(t, s0 + 4.0 + i * 0.15, s0 + 4.4 + i * 0.15);
      mono(c, a, 1190, 860 + i * 22, { size: 11, color: rgba('graphite', kk), track: 3 });
      mono(c, b, 1420, 860 + i * 22, { size: 12, color: rgba(b === '0' ? 'signal' : 'ink', kk), track: 2, weight: 600 });
    });
    void ks;
    // the stamp
    const st = prog(t, this.stamp, this.stamp + 0.14, ease.outCubic);
    if (st > 0) {
      c.save(); c.translate(880, 890); c.rotate(-0.07); const sc = 1 + (1 - st) * 0.5; c.scale(sc, sc); c.globalAlpha = st;
      c.strokeStyle = rgba('signal', 1); c.lineWidth = 3; c.strokeRect(-230, -52, 460, 92); c.lineWidth = 1.2; c.strokeRect(-220, -42, 440, 72);
      c.font = font(F.archivo(125, 900), 46); c.letterSpacing = '6px'; c.fillStyle = rgba('signal', 1); c.textAlign = 'center'; c.fillText('AS BUILT', 0, 6);
      c.font = font(F.mono(600), 12); c.letterSpacing = '3px'; c.fillText('FROM FIRST PRINCIPLES', 0, 26);
      c.restore();
    }
    c.restore();
    c.save(); c.font = font(F.serif(400, true), 64); c.fillStyle = rgba('ink', prog(t, s0 + 0.5, s0 + 1.5)); c.fillText('Record drawing.', 110, 160); c.restore();
    mono(c, 'WHAT WAS BUILT, DRAWN AFTER IT WAS BUILT, FROM WHAT IS THERE', 112, 196, { size: 12, color: rgba('graphite', prog(t, s0 + 0.9, s0 + 1.8)), track: 3 });
    drawLedger(c, lyrics, audio, 120, 1012, t, { paper: true, alpha: 1 - prog(t, e - 0.8, e) });
    titleBlock(c, 'S-999', 'AS BUILT', [['SCALE', '1:250'], ['DRAWN', 'JOBURGALEX']], { paper: true });
    comp.draw(renderer, T.upload(), out);
    void clamp;
    return { bloom: 0.4, ca: 0.3 + f.a.kick * 0.4, vignette: 0.25, paper: 1, grain: 0.045 };
  }
}
