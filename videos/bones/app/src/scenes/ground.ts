// ground — pre-chorus 2, "What if all I really needed" / "Was the ground beneath my feet".
// A section through the ground under the benchmark. The point goes down a stratum per word (topsoil, fill,
// clay, gravel, sandstone…) with the camera following, each layer labelled as it is passed; on "ground" it
// lands on bedrock. A spirit level set on the rock swings and, on "feet", settles exactly true. PROVEN: 1.
import * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { FSPass, Layer2D } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { F, font } from '../engine/type';
import { LIN, rgba } from '../engine/palette';
import type { Line } from '../engine/lyrics';
import { clamp, ease, lerp, prog, springStep } from '../engine/util';
import { drawFlow, drawLedger, mono, point, ring, titleBlock } from './_bones';

const TOPS = [0, 130, 300, 500, 720, 980];
const NAMES = ['TOPSOIL', 'FILL (SOMEONE ELSE’S)', 'CLAY', 'GRAVEL', 'SANDSTONE', 'BEDROCK'];
const PX = 1240;

const FRAG = /* glsl */ `
uniform float cam; uniform float tops[6]; uniform float px;
void main() {
  vec2 p = vec2(FRAG_PX.x, 1080.0 - FRAG_PX.y + cam); // world: y down from the surface
  vec3 col = C_INK;
  if (p.y > 0.0) {
    int L = 0;
    for (int i = 1; i < 6; i++) if (p.y > tops[i] + 8.0 * sin(p.x * 0.006 + float(i) * 2.1) + 5.0 * sin(p.x * 0.017 + float(i))) L = i;
    float d = 0.15 + 0.12 * float(L);
    vec2 q = rot2(0.5 + float(L) * 0.7) * p;
    float per = 24.0 - float(L) * 2.0;
    float u = q.y / per + 0.3 * sin(q.x * 0.01 + float(L));
    float line = pxLine(abs(fract(u) - 0.5) * per, 0.0, 0.45 + d);
    if (L == 2 || L == 5) { vec2 r = rot2(-0.6) * p; float u2 = r.y / (per * 1.4); line = max(line, 0.7 * pxLine(abs(fract(u2) - 0.5) * per * 1.4, 0.0, 0.6)); }
    if (L == 3) { // gravel: pebbles
      vec2 g = p / 26.0; vec2 c = floor(g); vec2 f = fract(g) - 0.5 + 0.25 * (vec2(hash12(c), hash12(c + 7.0)) - 0.5);
      line = max(line, pxLine(abs(length(f) * 26.0 - 6.0 - 4.0 * hash12(c + 3.0)), 0.0, 0.8));
    }
    float fadeL = 0.3 + 0.7 * smoothstep(650.0, 1150.0, p.x);
    col = mix(C_INK, C_BONE * 0.5, line * (0.14 + d * 0.32) * fadeL);
    if (L == 5) col = mix(col, C_BONE, 0.035);
    for (int i = 1; i < 6; i++) {
      float b = tops[i] + 8.0 * sin(p.x * 0.006 + float(i) * 2.1) + 5.0 * sin(p.x * 0.017 + float(i));
      col = mix(col, C_BONE * (i == 5 ? 1.0 : 0.6), pxLine(abs(p.y - b), 0.4, i == 5 ? 1.8 : 1.0) * (i == 5 ? 1.0 : fadeL));
    }
    // the bore: a narrow cleared shaft under the point
    float shaft = step(abs(p.x - px), 9.0) * step(p.y, cam + 1080.0);
    col = mix(col, C_INK * 0.7, shaft);
  }
  col = mix(col, C_BONE * 0.9, pxLine(abs(p.y), 0.6, 1.6));
  fragColor = vec4(col, 1.0);
}`;

export default class Ground extends Scene {
  bg = new FSPass(FRAG, { cam: { value: 0 }, tops: { value: TOPS }, px: { value: PX } });
  lb = new LineBatch(1000);
  text = new Layer2D();
  l14!: Line; l15!: Line;
  keys: [number, number][] = [];

  override init() {
    const { lyrics } = this.ctx;
    this.l14 = lyrics.lines[14]!; this.l15 = lyrics.lines[15]!;
    const k: [number, number][] = [[this.ctx.start, -4]];
    this.l14.words.forEach((w, i) => k.push([w.start, i === 0 ? 40 : (TOPS[Math.min(i - 1, 4)]! + TOPS[Math.min(i, 5)]!) / 2 + 30]));
    const g = this.l15.words.find((w) => w.w.toLowerCase() === 'ground')!;
    k.push([g.start, TOPS[5]! - 2]);
    this.keys = k;
  }
  depth(t: number) {
    const k = this.keys;
    if (t <= k[0]![0]) return k[0]![1];
    for (let i = 1; i < k.length; i++) if (t <= k[i]![0]) { const [t0, a] = k[i - 1]!, [t1, b] = k[i]!; return lerp(a, b, ease.inOutCubic(clamp((t - t0) / Math.min(0.35, t1 - t0)))); }
    return k[k.length - 1]![1];
  }

  render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer, comp, lyrics, audio } = this.ctx;
    const t = f.t;
    const d = this.depth(t);
    // camera keeps the point at ~60% height, never above the surface line at 300
    const cam = Math.max(-300, d - 650);
    this.bg.u.cam!.value = cam;
    this.bg.render(renderer, out);
    const sy = (y: number) => y - cam;
    const lb = this.lb; lb.clear();
    const g = this.l15.words.find((w) => w.w.toLowerCase() === 'ground')!;
    const feet = this.l15.words[this.l15.words.length - 1]!;
    point(lb, PX, sy(d) - 6, t, 1.1);
    ring(lb, PX, sy(d) - 6, t, g.start, { rgb: LIN.signal, speed: 300, life: 1.2, alpha: 0.7 });
    ring(lb, PX, sy(d) - 6, t, feet.start, { rgb: LIN.bone, speed: 380, life: 1.6, alpha: 0.6 });
    lb.render(renderer, out);
    const T = this.text, c = T.ctx; T.clear();
    // stratum labels, each as the point passes into it
    NAMES.forEach((n, i) => {
      const y = sy(i < 5 ? (TOPS[i]! + TOPS[i + 1]!) / 2 : TOPS[5]! + 60);
      if (y < -40 || y > 1120) return;
      const passed = d > TOPS[i]! + 4 || (i === 0 && t > this.l14.start);
      const k = passed ? 1 : 0.35;
      c.save(); c.strokeStyle = rgba('bone', 0.4 * k); c.lineWidth = 1;
      c.beginPath(); c.moveTo(PX + 24, y); c.lineTo(PX + 120, y); c.stroke(); c.restore();
      mono(c, n, PX + 132, y + 4, { size: 13, color: rgba(i === 5 ? 'bone' : 'ash', (i === 5 ? 1 : 0.85) * k), track: 3, weight: i === 5 ? 600 : 400 });
      mono(c, i === 5 ? 'MEASURED · NOT MOVED' : 'ASSUMED SOLID', PX + 132, y + 24, { size: 10, color: rgba(i === 5 ? 'signal' : 'graphite', k), track: 2 });
    });
    // the spirit level on the bedrock
    const lk = prog(t, g.start + 0.1, g.start + 0.5, ease.outCubic);
    if (lk > 0) {
      const ly = sy(TOPS[5]!) - 30, lx = PX - 260;
      const swing = (1 - springStep(t - feet.start, 1.2, 0.35)) * (t < feet.start ? 1 : 1) * 60 * Math.sin((t - g.start) * 5.3) * Math.exp(-Math.max(0, t - g.start) * 0.2);
      const bub = t >= feet.start ? swing * Math.exp(-(t - feet.start) * 3) : swing;
      c.save(); c.globalAlpha = lk;
      c.strokeStyle = rgba('bone', 0.95); c.lineWidth = 1.4;
      c.strokeRect(lx - 170, ly - 24, 340, 30);
      c.beginPath(); c.roundRect(lx - 90, ly - 18, 180, 18, 9); c.stroke();
      c.beginPath(); c.moveTo(lx - 18, ly - 20); c.lineTo(lx - 18, ly + 2); c.moveTo(lx + 18, ly - 20); c.lineTo(lx + 18, ly + 2); c.stroke();
      const tru = t > feet.start + 0.3;
      c.fillStyle = rgba(tru ? 'signal' : 'bone', 0.9);
      c.beginPath(); c.ellipse(lx + bub, ly - 9, 15, 6, 0, 0, Math.PI * 2); c.fill();
      c.restore();
      mono(c, `LEVEL ${(Math.abs(bub) * 0.012).toFixed(3)}°`, lx - 170, ly + 32, { size: 12, color: rgba('bone', 0.9 * lk), track: 3 });
      if (tru) {
        c.save(); c.font = font(F.mono(700), 18); c.letterSpacing = '6px'; c.fillStyle = rgba('signal', prog(t, feet.start + 0.3, feet.start + 0.5)); c.fillText('TRUE', lx + 60, ly + 34); c.restore();
      }
    }
    // lyric
    const st = { family: F.archivo(100, 800), size: 88, tracking: -2, sung: rgba('bone', 1), unsung: rgba('bone', 0.16), active: rgba('signal', 1), lead: 0.5 };
    const row = (l: Line, a: number, b: number, y: number) => drawFlow(c, { ...l, words: l.words.slice(a, b), start: l.words[a]!.start } as Line, 110, y, t, st);
    row(this.l14, 0, 4, 210); row(this.l14, 4, 6, 316);
    row(this.l15, 0, 3, 470); row(this.l15, 3, 6, 576);
    mono(c, `DEPTH ${(Math.max(0, d) / 100).toFixed(2)} M`, 112, 640, { size: 12, color: rgba('ash', 0.9), track: 3 });
    drawLedger(c, lyrics, audio, 120, 1012, t);
    titleBlock(c, 'S-002', 'SECTION: THE GROUND', [['SCALE', '1:100 (MEASURED)'], ['FOUND AT', 'THE BOTTOM']]);
    comp.draw(renderer, T.upload(), out);
    return { bloom: 0.75, ca: 0.5, vignette: 0.45 };
  }
}
