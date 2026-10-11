// horn — intro, the French horn alone (0 → the bass entry).
// Darkness, and one gold point: the traveller's lamp at HOME. The horn's call travels out from it across open
// country at a fixed speed, and the land answers: wherever the sound is passing, the contour lines light up as
// bright as the horn was loud when that wavefront left the lamp (an echo map of the solo's own loudness).
// Deadpan sounding readouts in the corner; the call reaches the coast just before the cut.
import * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { FSPass, Layer2D } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { LIN, rgba } from '../engine/palette';
import { clamp, ease, prog } from '../engine/util';
import { heightTexture, PLAN, HM_UV } from './_world';
import { lamp, mono, w2s, type View } from './_mt';

const N = 160; // envelope samples handed to the shader
const SPAN = 14; // seconds of history they cover
const C = 4.2; // km per second: the speed of the call (slowed down, so it can be seen)

const FRAG = /* glsl */ `
uniform sampler2D hm; uniform vec4 view; uniform vec2 src; uniform float env[${N}]; uniform float t; uniform float fade;
float envAt(float dt) { // loudness dt seconds ago
  float x = clamp(dt / ${SPAN.toFixed(1)}, 0.0, 1.0) * ${(N - 1).toFixed(1)};
  int i = int(floor(x)); int j = min(i + 1, ${N - 1});
  return mix(env[i], env[j], fract(x));
}
void main() {
  vec2 px = vec2(FRAG_PX.x, 1080.0 - FRAG_PX.y);
  vec2 w = view.xy + (px - vec2(960.0, 540.0)) / view.z;
  vec4 s = texture(hm, ${HM_UV});
  float h = s.r + 0.0018 * snoise(w * 2.1);
  float d = length(w - src);
  float dt = d / ${C.toFixed(2)};
  float since = t - dt; // seconds since the wavefront passed here
  float a = since > 0.0 ? 0.25 + 0.75 * smoothstep(0.12, 0.85, envAt(dt)) : 0.0;
  a += since > 0.0 ? 1.4 * exp(-since * 2.2) : 0.0; // the wavefront flares as it passes
  a *= exp(-d * 0.016) * smoothstep(-0.05, 0.0, since);
  float c = h / 0.04;
  float idx = step(4.5, mod(floor(c + 0.5) + 0.5, 5.0));
  float line = pxLine(abs(fract(c + 0.5) - 0.5) / max(fwidth(c), 1e-5), 0.15, idx > 0.5 ? 1.4 : 0.9);
  float coast = pxLine(abs(h) / max(fwidth(h), 1e-6), 0.5, 1.6);
  vec3 col = C_INK * 0.55;
  vec3 n = normalize(vec3(-s.gb * 5.0, 1.0));
  float lam = max(0.0, dot(n, normalize(vec3(-0.5, -0.6, 0.6))));
  col += C_ASH * 0.05 * lam * a * step(0.0, h);
  float ink = h >= 0.0 ? line * (idx > 0.5 ? 0.85 : 0.5) : 0.0;
  col += C_BONE * 0.55 * (ink + coast * 0.9) * a;
  // a whisper of warmth close to the lamp
  col += C_SIGNAL * 0.05 * exp(-d * 0.6);
  col *= 1.0 - fade;
  fragColor = vec4(col, 1.0);
}`;

export default class Horn extends Scene {
  bg = new FSPass(FRAG, {
    hm: { value: null }, view: { value: new THREE.Vector4() }, src: { value: new THREE.Vector2() },
    env: { value: new Array(N).fill(0) }, t: { value: 0 }, fade: { value: 0 },
  });
  lb = new LineBatch(400);
  text = new Layer2D();
  home = PLAN[0]!;

  override init() { this.bg.u.hm!.value = heightTexture(); }

  render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer, comp, audio } = this.ctx;
    const t = f.t;
    // the view drifts very slowly east and pulls back a little over the solo
    const v: View = { cx: this.home.x + 14 + t * 0.35, cy: this.home.y - 3, s: 34 - t * 0.5, rot: 0 };
    const u = this.bg.u;
    (u.view!.value as THREE.Vector4).set(v.cx, v.cy, v.s, 0);
    (u.src!.value as THREE.Vector2).set(this.home.x, this.home.y);
    const env = u.env!.value as number[];
    for (let i = 0; i < N; i++) {
      const tau = t - (i / (N - 1)) * SPAN;
      // the horn: the 'other' stem (the band has not come in yet), lightly compressed so quiet notes still read
      env[i] = tau < 0 ? 0 : Math.pow(clamp(audio.env('other', tau) * 1.6), 0.7);
    }
    u.t!.value = t;
    const fadeIn = prog(t, 0.0, 2.5, ease.inOutQuad);
    u.fade!.value = 1 - fadeIn;
    this.bg.render(renderer, out);

    // the lamp breathes with the horn
    const lb = this.lb; lb.clear();
    const p = w2s(v, this.home.x, this.home.y);
    const now = audio.env('other', t);
    lamp(lb, p.x, p.y, t, 0.8 + 0.5 * now, fadeIn * (0.55 + 0.7 * Math.pow(now, 0.6)));
    lb.render(renderer, out);

    const L = this.text, c = L.ctx; L.clear();
    const a = prog(t, 3, 5, ease.outCubic) * (1 - prog(t, 14.4, 15.2));
    c.globalAlpha = a;
    const range = Math.max(0, t * C);
    mono(c, 'SOUNDING', 120, 150, { size: 12, color: rgba('ash', 0.8), track: 4 });
    mono(c, `RANGE ${range.toFixed(1).padStart(5, '0')} KM`, 120, 176, { size: 16, color: rgba('signal', 1), track: 2, weight: 500 });
    mono(c, `SOURCE  HOME  ${this.home.x.toFixed(1)} E  ${this.home.y.toFixed(1)} S`, 120, 200, { size: 12, color: rgba('bone', 0.6), track: 2 });
    mono(c, 'ONE HORN, OPEN COUNTRY', 1800, 990, { size: 12, color: rgba('bone', 0.55), track: 4, align: 'right' });
    c.globalAlpha = 1;
    comp.draw(renderer, L.upload(), out);
    return { bloom: 0.7, vignette: 0.55, ca: 0.6, halation: 0.3, grain: 0.06 };
  }
}
