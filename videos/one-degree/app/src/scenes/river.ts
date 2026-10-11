// river — "But the river doesn't know" / "It's carving through the stone".
// An engraved cross-section of strata; the orange river at the bottom of a canyon that deepens as the line is
// sung. The words of "It's carving through the stone" are the strata's labels: each appears as the river cuts
// down into its layer, exactly on the word.
import * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { FSPass, Layer2D, W, H } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { F, font } from '../engine/type';
import { LIN, rgba } from '../engine/palette';
import type { Line } from '../engine/lyrics';
import { clamp, ease, lerp, prog } from '../engine/util';
import { drawKaraoke, mono, needleTip } from './_od';

const SURF = 360;
// layer tops (y at the canyon), thickness to the next; slope = canyon wall run per px of depth (soft = wide)
const TOPS = [360, 440, 540, 610, 720, 800, 905, 1000];
const SLOPE = [0.55, 0.12, 0.7, 0.18, 0.62, 0.15, 0.5, 0.2];
const DARK = [0.18, 0.42, 0.26, 0.55, 0.3, 0.6, 0.36, 0.7];
const ANG = [0.35, -0.6, 0.9, 0.2, -0.3, 1.2, 0.55, -0.9];
const NAMES = ['SANDSTONE', 'LIMESTONE', 'SHALE', 'SCHIST', 'GRANITE'];
const CX = 1180;

const FRAG = /* glsl */ `
uniform float yb; uniform float tops[8]; uniform float slope[8]; uniform float dark[8]; uniform float ang[8];
uniform float w0; uniform float cx;
float boundary(int i, float x) { return tops[i] + (i == 0 ? 0.0 : 7.0 * sin(x * 0.004 + float(i) * 1.7) + 4.0 * sin(x * 0.011 + float(i) * 4.1)); }
float halfw(float y) {
  // canyon half-width at depth y: the walls step out layer by layer (hard layers make cliffs)
  float hw = w0;
  for (int i = 0; i < 8; i++) {
    float a = max(y, tops[i]);
    float b = min(yb, i < 7 ? tops[i + 1] : 1e5);
    hw += max(0.0, b - a) * slope[i];
  }
  return hw;
}
void main() {
  vec2 p = vec2(FRAG_PX.x, 1080.0 - FRAG_PX.y); // y down, like the canvas
  vec3 col = C_INK;
  if (p.y > ${SURF.toFixed(1)}) {
    int L = 0;
    for (int i = 1; i < 8; i++) if (p.y > boundary(i, p.x)) L = i;
    float d = dark[L];
    vec2 q = rot2(ang[L]) * p;
    // engraving: parallel hatch, closer for darker layers, with a slow wobble like a burin's line
    float per = 11.0 - d * 6.0;
    float u = q.y / per + 0.35 * sin(q.x * 0.009 + float(L) * 2.0);
    float line = pxLine(abs(fract(u) - 0.5) * per, 0.0, 0.5 + d * 0.8);
    // every other layer gets a sparse cross-hatch
    if (L % 2 == 1) { vec2 r = rot2(1.2) * p; float u2 = r.y / (per * 1.7); line = max(line, 0.6 * pxLine(abs(fract(u2) - 0.5) * per * 1.7, 0.0, 0.6)); }
    col = mix(C_INK, C_BONE * 0.5, line * (0.22 + d * 0.38));
    // boundaries: a firmer hairline
    for (int i = 1; i < 8; i++) col = mix(col, C_BONE * 0.8, pxLine(abs(p.y - boundary(i, p.x)), 0.4, 1.2));
    // the canyon: carved out
    if (p.y < yb) {
      float hw = halfw(p.y);
      float dx = abs(p.x - cx) - hw;
      if (dx < 0.0) col = C_INK * 0.6;
      col = mix(col, C_BONE * 0.9, pxLine(abs(dx), 0.5, 1.5) * step(${SURF.toFixed(1)}, p.y));
    }
  }
  // the ground surface
  col = mix(col, C_BONE * 0.9, pxLine(abs(p.y - ${SURF.toFixed(1)}), 0.6, 1.6) * step(halfw(${SURF.toFixed(1)} + 0.5), abs(p.x - cx)));
  fragColor = vec4(col, 1.0);
}`;

export default class River extends Scene {
  bg = new FSPass(FRAG, {
    yb: { value: SURF }, tops: { value: TOPS }, slope: { value: SLOPE }, dark: { value: DARK }, ang: { value: ANG },
    w0: { value: 6 }, cx: { value: CX },
  });
  lb = new LineBatch(3000);
  text = new Layer2D();
  l4!: Line; l5!: Line;
  keys: [number, number][] = [];

  override init() {
    const ly = this.ctx.lyrics;
    this.l4 = ly.lines[4]!; this.l5 = ly.lines[5]!;
    // depth keys: slow through line 4, then each word of line 5 lands the river in the middle of its layer
    const k: [number, number][] = [[this.ctx.start, SURF + 2], [this.l4.words[0]!.start, SURF + 14], [this.l4.end, TOPS[0]! + 52]];
    this.l5.words.forEach((w, i) => k.push([w.start, (TOPS[i]! + TOPS[i + 1]!) / 2]));
    k.push([this.ctx.end, TOPS[5]! + 30]);
    this.keys = k;
  }
  depth(t: number) {
    const k = this.keys;
    if (t <= k[0]![0]) return k[0]![1];
    for (let i = 1; i < k.length; i++) if (t <= k[i]![0]) {
      const [t0, a] = k[i - 1]!, [t1, b] = k[i]!;
      // each cut lands quickly then grinds slowly (the word lands it, the years finish it)
      return lerp(a, b, ease.outCubic((t - t0) / (t1 - t0)));
    }
    return k[k.length - 1]![1];
  }

  render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer, comp } = this.ctx;
    const t = f.t;
    const yb = this.depth(t);
    this.bg.u.yb!.value = yb;
    this.bg.render(renderer, out);

    const lb = this.lb; lb.clear();
    // the river: a bright pool at the bottom of the cut, with a few glints flowing
    const hw = 6;
    lb.seg2(CX - hw - 3, yb - 2, CX + hw + 3, yb - 2, 3, [LIN.signal[0] * 2, LIN.signal[1] * 2, LIN.signal[2] * 2], 1);
    needleTip(lb, CX, yb - 3, t, 0.9, 1 + f.a.vocal * 0.4);
    lb.render(renderer, out);

    const L = this.text, c = L.ctx; L.clear();
    // line 4 in the sky
    drawKaraoke(c, this.l4, 120, 250, t, { family: F.archivo(100, 700), size: 104, tracking: -2, sung: rgba('bone', 1), unsung: rgba('bone', 0.16), active: rgba('signal', 1), lead: 0.4 });
    // line 5: the strata labels, each on its word
    this.l5.words.forEach((w, i) => {
      const k = prog(t, w.start - 0.02, w.start + 0.22, ease.outCubic);
      if (k <= 0) return;
      const y = (TOPS[i]! + TOPS[i + 1]!) / 2;
      const xl = 140;
      c.save();
      c.globalAlpha = k;
      // leader from the label to the canyon wall
      c.strokeStyle = rgba('bone', 0.55); c.lineWidth = 1;
      const wx = CX - 60 - (i < 2 ? 40 : 0);
      c.beginPath(); c.moveTo(xl + 470, y - 18); c.lineTo(lerp(xl + 470, wx, k), y - 18); c.stroke();
      c.beginPath(); c.arc(wx, y - 18, 3, 0, Math.PI * 2); c.fillStyle = rgba('bone', 0.8); c.fill();
      // ink band so the word reads over the hatching
      c.fillStyle = rgba('ink', 0.86);
      c.font = font(F.archivo(100, 800), 62); c.letterSpacing = '-1px';
      const ww = c.measureText(w.w).width;
      c.fillRect(xl - 14, y - 70, ww + 28, 74);
      const hot = t < w.end + 0.3 ? clamp((t - w.end) / 0.3) : 1;
      c.fillStyle = hot < 1 ? `rgba(255,${(106 + (235 - 106) * hot).toFixed(0)},${(31 + (224 - 31) * hot).toFixed(0)},1)` : rgba('bone', 1);
      c.fillText(w.w, xl, y - 14 + (1 - k) * 10);
      mono(c, NAMES[i]!, xl + ww + 30, y - 22, { size: 12, color: rgba('ash', 0.9), track: 3 });
      c.restore();
    });
    // elapsed years: the river works in geological time
    const yrs = Math.round(5e6 * Math.pow(clamp((yb - SURF) / (TOPS[5]! + 30 - SURF)), 1.6));
    mono(c, 'ELAPSED', W - 120, 150, { size: 12, color: rgba('ash', 0.75), track: 3, align: 'right' });
    mono(c, `${yrs.toLocaleString('en-US')} YEARS`, W - 120, 178, { size: 20, color: rgba('signal', 1), track: 2, align: 'right', weight: 500 });
    mono(c, `CUT ${((yb - SURF) / 1000).toFixed(3)} KM`, W - 120, 202, { size: 12, color: rgba('bone', 0.7), track: 2, align: 'right' });
    comp.draw(renderer, L.upload(), out);
    void H;
    return { bloom: 0.6, ca: 0.5, vignette: 0.45 };
  }
}
