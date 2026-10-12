// burn — verse 2, "So I'm burning all the blueprints" / "Starting from what's left".
// The blueprint of the whole building (a dark sheet, bone lines: the plan, the grid, the notes) catches at a
// corner on "burning", then at another corner on each word, and the burn fronts eat the sheet: an ember edge,
// a band of char, then bare black ground. What survives the fire is the survey: a handful of benchmarks on the
// ground, measured, not inherited. On "left" the point lights on the first of them.
import * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { FSPass, Layer2D, clearRT } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { F } from '../engine/type';
import { LIN, rgba } from '../engine/palette';
import type { Line } from '../engine/lyrics';
import { ease, prog } from '../engine/util';
import { drawFlow, drawLedger, drawPlan, mono, point, ring, titleBlock } from './_bones';

const FRAG = /* glsl */ `
uniform sampler2D sheet; uniform vec4 ig[4]; uniform float t; uniform float speed;
void main() {
  vec2 p = FRAG_PX; p.y = 1080.0 - p.y;
  float f = 1e5;
  for (int i = 0; i < 4; i++) {
    if (t < ig[i].z) continue;
    float r = speed * pow(t - ig[i].z, 1.15) * ig[i].w;
    f = min(f, length(p - ig[i].xy) - r);
  }
  f += 70.0 * fbm(p * 0.006, 4) + 18.0 * snoise(p * 0.05);
  vec3 paper = toLinear(texture(sheet, vUv).rgb);
  vec3 ground = C_INK * (0.75 + 0.5 * smoothstep(0.55, 0.9, snoise(p * 0.08)));
  vec3 col = paper;
  if (f < 70.0) {
    // char band: browning, then black
    float ch = smoothstep(70.0, 12.0, f);
    col = mix(col, C_BLOOD * 0.12 + paper * 0.15, ch);
    float ember = smoothstep(16.0, 4.0, f) * smoothstep(-10.0, 2.0, f);
    col += heat(0.55 + 0.45 * ember) * ember * (2.2 + 0.8 * snoise(p * 0.09 + t * 3.0));
    if (f < -6.0) col = ground;
    // glowing specks in the ash just behind the front
    float sp = smoothstep(0.82, 0.95, snoise(p * 0.11 + vec2(t * 0.7, 0.0))) * smoothstep(-80.0, -8.0, f) * step(f, -6.0);
    col += C_EMBER * sp * 1.6;
  }
  fragColor = vec4(col, 1.0);
}`;

// survey benchmarks (plan units, see _facade): what is left
const BM: [number, number, string][] = [[0, 360, 'BM 1'], [-770, 0, 'BM 2'], [770, 0, 'BM 3'], [-440, 600, 'BM 4'], [440, 600, 'BM 5'], [-375, 54, 'BM 6'], [375, 54, 'BM 7']];
const PS = 0.6, POX = 1330, POY = 330;

export default class Burn extends Scene {
  sheet = new Layer2D();
  pass = new FSPass(FRAG, { sheet: { value: null }, ig: { value: [new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4()] }, t: { value: 0 }, speed: { value: 560 } });
  lb = new LineBatch(800);
  text = new Layer2D();
  l12!: Line; l13!: Line;
  drawn = false;

  override init() {
    const { lyrics } = this.ctx;
    this.l12 = lyrics.lines[12]!; this.l13 = lyrics.lines[13]!;
    const w = this.l12.words; // So I'm burning all the blueprints
    const ig = this.pass.u.ig!.value as THREE.Vector4[];
    ig[0]!.set(60, 1040, w[2]!.start, 1.0);
    ig[1]!.set(1880, 60, w[3]!.start, 1.05);
    ig[2]!.set(1880, 1040, w[4]!.start, 0.95);
    ig[3]!.set(60, 40, w[5]!.start, 1.1);
    // the blueprint sheet (static: drawn once)
    const c = this.sheet.ctx;
    this.sheet.clear('#2A2622');
    c.strokeStyle = rgba('bone', 0.09); c.lineWidth = 1;
    for (let x = 0; x < 1920; x += 24) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, 1080); c.stroke(); }
    for (let y = 0; y < 1080; y += 24) { c.beginPath(); c.moveTo(0, y); c.lineTo(1920, y); c.stroke(); }
    c.strokeStyle = rgba('bone', 0.5); c.lineWidth = 1.2; c.strokeRect(40, 40, 1840, 1000); c.strokeRect(48, 48, 1824, 984);
    drawPlan(c, { ox: POX, oy: POY, s: PS, ink: rgba('bone', 1), gridInk: rgba('bone', 0.6) });
    // dimension strings along the bottom
    c.strokeStyle = rgba('bone', 0.5); c.lineWidth = 1;
    const dy = POY + 690 * PS;
    c.beginPath(); c.moveTo(POX - 770 * PS, dy); c.lineTo(POX + 770 * PS, dy); c.stroke();
    for (const x of [-770, -440, 0, 440, 770]) { c.beginPath(); c.moveTo(POX + x * PS - 6, dy + 6); c.lineTo(POX + x * PS + 6, dy - 6); c.stroke(); }
    mono(c, '15 400', POX, dy - 10, { size: 11, color: rgba('bone', 0.6), align: 'center', track: 2 });
    mono(c, 'BLUEPRINT · THE WAY IT IS DONE · SHEET 1 OF 1', 560, 1010, { size: 12, color: rgba('bone', 0.8), track: 3 });
    mono(c, 'DO NOT DEVIATE', 1440, 1010, { size: 12, color: rgba('bone', 0.8), track: 3, align: 'right' });
    for (let i = 0; i < 9; i++) mono(c, `${i + 1}. ${['ALL WALLS ARE LOAD-BEARING', 'GOLD TO BE APPLIED AS SHOWN', 'DO NOT ASK WHY', 'DIMENSIONS INHERITED', 'SEE PREVIOUS GENERATION', 'NO SUBSTITUTIONS', 'CORNERS NOT TO BE PULLED', 'THIS IS JUST THE SHAPE OF THINGS', 'APPROVED: THEM'][i]}`, 80, 620 + i * 22, { size: 11, color: rgba('bone', 0.8), track: 2 });
    this.sheet.upload();
    this.pass.u.sheet!.value = this.sheet.texture;
  }

  render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer, comp, lyrics, audio } = this.ctx;
    const t = f.t;
    clearRT(renderer, out, LIN.ink);
    this.pass.u.t!.value = t;
    this.pass.render(renderer, out);
    // survivors: the benchmarks appear as the fire passes them
    const lb = this.lb; lb.clear();
    const T = this.text, c = T.ctx; T.clear();
    const w13 = this.l13.words;
    const left = w13[w13.length - 1]!;
    const burnT = this.l12.words[2]!.start;
    BM.forEach(([x, y, lab], i) => {
      const X = POX + x * PS, Y = POY + y * PS;
      const k = prog(t, burnT + 1.2 + i * 0.25, burnT + 1.6 + i * 0.25, ease.outCubic);
      if (k <= 0) return;
      const r = 9;
      lb.seg2(X - r, Y, X + r, Y, 1.4, LIN.bone, k); lb.seg2(X, Y - r, X, Y + r, 1.4, LIN.bone, k);
      ring(lb, X, Y, t, burnT + 1.4 + i * 0.25, { r0: 6, speed: 60, life: 1.4, alpha: 0.5 });
      mono(c, lab, X + 14, Y - 8, { size: 11, color: rgba('bone', 0.9 * k), track: 2, weight: 500 });
      mono(c, '+0.000', X + 14, Y + 8, { size: 10, color: rgba('ash', 0.85 * k), track: 2 });
    });
    const lk = prog(t, left.start, left.start + 0.3, ease.outCubic);
    if (lk > 0) { point(lb, POX + BM[0]![0] * PS, POY + BM[0]![1] * PS, t, 1.1, lk); ring(lb, POX, POY + 360 * PS, t, left.start, { rgb: LIN.signal, speed: 260, life: 1.4, alpha: 0.7 }); }
    lb.render(renderer, out);
    // lyrics
    const st = { family: F.archivo(100, 800), size: 88, tracking: -2, sung: rgba('bone', 1), unsung: rgba('bone', 0.18), active: rgba('signal', 1), lead: 0.5 };
    const w12 = this.l12.words;
    const row = (l: Line, a: number, b: number, y: number) => drawFlow(c, { ...l, words: l.words.slice(a, b), start: l.words[a]!.start } as Line, 110, y, t, st,
      (w) => (w === w12[2] ? { color: t >= w.start ? rgba('signal', 1) : undefined } : {}));
    row(this.l12, 0, 3, 210); row(this.l12, 3, 6, 316);
    row(this.l13, 0, 2, 470); row(this.l13, 2, 4, 576);
    const sv = prog(t, left.end, left.end + 0.5);
    mono(c, `SURVIVED THE FIRE  ${BM.length} BENCHMARKS`, 112, 640, { size: 12, color: rgba('signal', sv), track: 3, weight: 500 });
    drawLedger(c, lyrics, audio, 120, 1012, t);
    titleBlock(c, 'D-601', 'BLUEPRINT (BURNING)', [['SCALE', 'NO LONGER APPLIES'], ['STATUS', t > w12[5]!.end ? 'ASH' : 'ON FIRE']]);
    comp.draw(renderer, T.upload(), out);
    return { bloom: 0.9, bloomThreshold: 0.9, ca: 0.6, vignette: 0.45, halation: 0.4 };
  }
}
