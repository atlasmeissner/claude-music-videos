// Shared kit for Maps & Territory (see docs/TREATMENT.md):
//  - VIEW: a camera over the world (centre in km, px per km, rotation) and world <-> screen transforms;
//  - TERRAIN: one fullscreen shader that draws the world either as the MAP (bone paper, contour lines, water
//    lines along the coast) or as the TERRITORY (shaded, engraved relief; night or golden light), with masks that
//    show one through the other (a split line, a lens, a misregistered map);
//  - the TRACK (the life as walked: a gold line with a lamp at its head) and the PLAN (ruled ink road, year ticks,
//    named places), drawn with LineBatch / Canvas2D in screen space;
//  - map furniture (neatline, graticule ticks, scale bar, compass star) and the karaoke typography helpers.
import * as THREE from 'three';
import type { Lyrics, Line, Word } from '../engine/lyrics';
import { Lyrics as LyricsC } from '../engine/lyrics';
import { FSPass } from '../engine/gl';
import type { LineBatch } from '../engine/lines';
import { glyphX, font, F, measure, layout, type TextLayout } from '../engine/type';
import { LIN, rgba } from '../engine/palette';
import { clamp, ease, TAU, hash } from '../engine/util';
import { heightTexture, track, trackAt, PLAN, PLAN_PTS, WORLD, HM_UV } from './_world';

export type RGB = [number, number, number];
export const sc = (c: RGB, k: number): RGB => [c[0] * k, c[1] * k, c[2] * k];
export const mixRGB = (a: RGB, b: RGB, k: number): RGB => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];

// ------------------------------------------------------------------ the view
export interface View { cx: number; cy: number; s: number; rot: number }
/** World km -> screen px. */
export function w2s(v: View, x: number, y: number) {
  const dx = (x - v.cx) * v.s, dy = (y - v.cy) * v.s;
  const c = Math.cos(v.rot), s = Math.sin(v.rot);
  return { x: 960 + dx * c - dy * s, y: 540 + dx * s + dy * c };
}
/** Screen px -> world km. */
export function s2w(v: View, sx: number, sy: number) {
  const dx = sx - 960, dy = sy - 540;
  const c = Math.cos(-v.rot), s = Math.sin(-v.rot);
  return { x: v.cx + (dx * c - dy * s) / v.s, y: v.cy + (dx * s + dy * c) / v.s };
}
/** Interpolate views (log-scale zoom). */
export function lerpView(a: View, b: View, k: number): View {
  return { cx: a.cx + (b.cx - a.cx) * k, cy: a.cy + (b.cy - a.cy) * k, s: a.s * Math.pow(b.s / a.s, k), rot: a.rot + (b.rot - a.rot) * k };
}
/** Fit the whole sheet (WORLD km) into a box of `px` px. */
export const sheetView = (px = 980, cx = WORLD / 2, cy = WORLD / 2, rot = 0): View => ({ cx, cy, s: px / WORLD, rot });

// ------------------------------------------------------------------ cheap noise (a tiling texture)
let nzTex: THREE.DataTexture | null = null;
/** 256² RGBA8 tiling value noise (32 cells per side, smoothstep-interpolated), 4 independent channels. */
export function noiseTexture(): THREE.DataTexture {
  if (nzTex) return nzTex;
  const N = 256, G = 32, cell = N / G;
  const px = new Uint8Array(N * N * 4);
  for (let ch = 0; ch < 4; ch++) {
    const g = new Float32Array(G * G);
    for (let i = 0; i < G * G; i++) g[i] = hash(i, 101 + ch * 7);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const fx = x / cell, fy = y / cell, ix = Math.floor(fx), iy = Math.floor(fy);
      let u = fx - ix, v = fy - iy; u = u * u * (3 - 2 * u); v = v * v * (3 - 2 * v);
      const a = g[(iy % G) * G + (ix % G)]!, b = g[(iy % G) * G + ((ix + 1) % G)]!;
      const c = g[((iy + 1) % G) * G + (ix % G)]!, d = g[((iy + 1) % G) * G + ((ix + 1) % G)]!;
      px[(y * N + x) * 4 + ch] = Math.round(255 * (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v));
    }
  }
  const t = new THREE.DataTexture(px, N, N, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.minFilter = THREE.LinearFilter; t.magFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  nzTex = t;
  return t;
}
/** GLSL: vnoise(p) in -1..1 with ~1 unit features (channel 0), vnoise4(p) all four channels. Needs uniform sampler2D nz. */
export const VNOISE_GLSL = /* glsl */ `
float vnoise(vec2 p) { return texture(nz, p / 32.0).r * 2.0 - 1.0; }
vec4 vnoise4(vec2 p) { return texture(nz, p / 32.0) * 2.0 - 1.0; }`;

// ------------------------------------------------------------------ the trail field
let trTex: THREE.DataTexture | null = null;
let snapTex: THREE.DataTexture | null = null;
const TN = 256;
/** 256² over the sheet: R = distance (km) to the whole trail, G = arc length (km) of its nearest point. */
export function trailTexture(): THREE.DataTexture {
  if (!trTex) buildTrailFields();
  return trTex!;
}
/**
 * Snapshot atlas, 256 × (256·5), RGBA: snapshot k (0..19; row k >> 2, channel k & 3) is the distance (km) to the
 * trail walked up to waypoint k. The shader reveals exactly what was walked up to the last waypoint passed, and the
 * current leg from the nearest-point field, so crossings and loops leave no holes.
 */
export function trailSnapTexture(): THREE.DataTexture {
  if (!snapTex) buildTrailFields();
  return snapTex!;
}
function buildTrailFields() {
  const T = track(), P = T.pts;
  const H = THREE.DataUtils.toHalfFloat;
  const px = new Uint16Array(TN * TN * 4);
  const snap = new Uint16Array(TN * TN * 5 * 4);
  const best = new Float32Array(TN * TN).fill(1e9), bs = new Float32Array(TN * TN);
  const cur = new Float32Array(TN * TN).fill(1e9); // walked-so-far distance (squared)
  const store = (k: number) => {
    const row = k >> 2, ch = k & 3;
    for (let j = 0; j < TN; j++) for (let i = 0; i < TN; i++) snap[(((row * TN) + j) * TN + i) * 4 + ch] = H(Math.min(60000, Math.sqrt(cur[j * TN + i]!)));
  };
  // snapshot 0: the start point alone
  for (let j = 0; j < TN; j++) for (let i = 0; i < TN; i++) {
    const x = ((i + 0.5) / TN) * WORLD, y = ((j + 0.5) / TN) * WORLD;
    cur[j * TN + i] = (x - P[0]!.x) ** 2 + (y - P[0]!.y) ** 2;
  }
  store(0);
  let w = 1;
  for (let k = 1; k < P.length; k++) {
    const a = P[k - 1]!, b = P[k]!;
    const vx = b.x - a.x, vy = b.y - a.y, L2 = vx * vx + vy * vy || 1e-9;
    // only texels near the segment can change (bounding box + 70 km covers everything we reveal)
    for (let j = 0; j < TN; j++) {
      const y = ((j + 0.5) / TN) * WORLD;
      for (let i = 0; i < TN; i++) {
        const x = ((i + 0.5) / TN) * WORLD;
        const u = Math.max(0, Math.min(1, ((x - a.x) * vx + (y - a.y) * vy) / L2));
        const dx = a.x + vx * u - x, dy = a.y + vy * u - y, d = dx * dx + dy * dy;
        const o = j * TN + i;
        if (d < cur[o]!) cur[o] = d;
        if (d < best[o]!) { best[o] = d; bs[o] = T.len[k - 1]! + (T.len[k]! - T.len[k - 1]!) * u; }
      }
    }
    while (w < T.wayAt.length && T.wayAt[w] === k) { store(w); w++; }
  }
  for (; w < 20; w++) store(w);
  for (let o = 0; o < TN * TN; o++) { px[o * 4] = H(Math.sqrt(best[o]!)); px[o * 4 + 1] = H(bs[o]!); px[o * 4 + 2] = H(0); px[o * 4 + 3] = H(1); }
  const mk = (data: Uint16Array, h: number) => {
    const t = new THREE.DataTexture(data, TN, h, THREE.RGBAFormat, THREE.HalfFloatType);
    t.minFilter = THREE.LinearFilter; t.magFilter = THREE.LinearFilter; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    t.needsUpdate = true;
    return t;
  };
  trTex = mk(px, TN);
  snapTex = mk(snap, TN * 5);
}

// ------------------------------------------------------------------ the terrain shader
const TERRAIN_FRAG = /* glsl */ `
uniform sampler2D hm;
uniform sampler2D nz;
uniform sampler2D trailTex; // R: distance to the walked trail (km), G: arc length of the nearest trail point (km)
uniform vec4 reveal;  // sNow (km walked), radius (km), global (0..1), on
uniform sampler2D trailSnap; // snapshot atlas (see trailSnapTexture)
uniform vec2 revealK;  // snapshot index of the last waypoint passed, its arc length (km)
uniform vec2 leg[32];  // the current leg (from the last waypoint passed to the lamp), as a polyline (km)
uniform float legN;    // its point count
uniform vec4 legBox;   // its bounding box, grown by the reveal radius (x0, y0, x1, y1)
${VNOISE_GLSL}
uniform vec4 view;      // cx, cy (km), px per km, rotation
uniform float mapMix;   // 0 territory .. 1 map (where no mask applies)
uniform vec4 split;     // nx, ny, d (px), soft (px): map where dot(px, n) > d; soft = 0 disables
uniform vec4 lens;      // x, y, r (px), on: inside the lens the other mode shows
uniform vec3 misreg;    // map layer offset dx, dy (km), warp (km)
uniform vec3 sun;       // light direction (x, y on the sheet, z up)
uniform float warmth;   // 0 moonlit night .. 1 golden day
uniform float relief;   // vertical exaggeration of the shading
uniform float seaAcid;  // sea teal (the shore's accent) 0..1
uniform float contour;  // contour interval (km)
uniform float paperInk; // ink strength on the map (coast, water lines)
uniform float contourInk; // contour lines on the map (0: a planner's map shows no relief)
uniform float terrInk;  // engraving strength in the territory
uniform float ghost;    // ghost contour lines over the territory (bone hairlines) 0..1
uniform float t;
uniform float fadeOut;  // 0..1 toward ink (vignette of the whole plate)
uniform vec3 paperCol;  // map paper colour (linear)
uniform float sheet;    // 0..1: the sheet (world 0..100) shows as map, the rest as territory
uniform vec4 beam;      // the lighthouse: x, y (km), swept angle A (rad, accumulated since it started), light 0..1
uniform vec4 beamR;     // radius growth (km per rad of sweep), start radius (km), max radius (km), reveal on

vec4 hmS(vec2 w) { return texture(hm, ${HM_UV}); }
float detail(vec2 w) { float k = smoothstep(6.0, 14.0, view.z / 1.9); return k > 0.0 ? 0.006 * vnoise(w * 1.9) * k : 0.0; }

vec3 mapCol(vec2 w) {
  vec2 q = w + misreg.xy + (misreg.z != 0.0 ? misreg.z * vnoise4(w * 0.05 + 3.0).yz : vec2(0.0));
  vec4 s = hmS(q);
  float h = s.r + detail(q) * smoothstep(0.0, 0.02, s.r);
  vec3 col = paperCol;
  // faint relief tint (higher = a touch darker), the land a hair warmer than the sea
  col *= 1.0 - 0.05 * smoothstep(0.0, 1.6, h);
  float c = h / contour;
  float fw = fwidth(c);
  float idx = step(4.5, mod(floor(c + 0.5) + 0.5, 5.0)); // every fifth contour is an index contour
  float lineC = pxLine(abs(fract(c + 0.5) - 0.5) / max(fw, 1e-5), 0.2, idx > 0.5 ? 1.5 : 1.0);
  float land = step(0.0, h);
  col = mix(col, C_INK, lineC * contourInk * (idx > 0.5 ? 0.42 : 0.22) * land);
  // the coast: a firm line; offshore, water lines that follow it and fade out to sea
  float coastD = abs(h) / max(fwidth(h), 1e-6);
  col = mix(col, C_INK, pxLine(coastD, 0.6, 1.8) * paperInk * 0.85);
  if (h < 0.0) {
    float k = -h / 0.0035;
    float wl = pxLine(abs(fract(k) - 0.5) / max(fwidth(k), 1e-5), 0.1, 0.9) * (1.0 - smoothstep(1.0, 7.0, k)) * step(0.5, k);
    col = mix(col, C_INK, wl * 0.28 * paperInk);
    col = mix(col, col * vec3(0.93, 0.97, 0.98), 0.6 * paperInk); // sea: a cooler paper
  }
  // paper fibre (cheap: a hash, the post grain does the rest)
  col *= 1.0 - 0.02 * hash12(floor(FRAG_PX * 0.5));
  return col;
}

vec3 terrCol(vec2 w) {
  vec4 s = hmS(w);
  float h = s.r;
  // fine relief the baked grid cannot hold: three octaves of detail, differentiated on screen
  // (each octave fades out before its wavelength drops under ~10 px, so zoomed-out views do not alias)
  float pxk = view.z;
  float k1 = smoothstep(16.0, 40.0, pxk / 1.3), k2 = smoothstep(16.0, 40.0, pxk / 3.6);
  
  float hd = 0.0;
  if (k1 > 0.0) hd += 0.013 * vnoise(w * 1.3) * k1;
  if (k2 > 0.0) hd += 0.006 * vnoise4(w * 3.6 + 2.7).w * k2;
  float k3 = smoothstep(16.0, 40.0, pxk / 9.0);
  if (k3 > 0.0) hd += 0.0028 * vnoise4(w * 9.0 - 5.1).z * k3;
  hd *= smoothstep(-0.005, 0.03, h);
  vec2 gd = vec2(dFdx(hd), -dFdy(hd)) * view.z / PX_SCALE; // km per km (screen y is up in gl_FragCoord)
  float cr = cos(view.w), sr = sin(view.w);
  gd = vec2(gd.x * cr - gd.y * sr, gd.x * sr + gd.y * cr);
  vec2 g = s.gb + gd * 1.6;
  vec3 n = normalize(vec3(-g * relief, 1.0));
  vec3 L = normalize(sun);
  float lam = max(0.0, dot(n, L));
  float sh = lam;
  vec3 col;
  if (h >= 0.0) {
    vec3 nightLo = C_INK * 0.85, nightHi = C_ASH * 0.55;
    vec3 dayLo = mix(C_INK2 * 1.1, C_ACID * 0.12, 0.35), dayHi = mix(C_BONE * 0.7, C_EMBER * 0.78, 0.6);
    vec3 lo = mix(nightLo, dayLo, warmth), hi = mix(nightHi, dayHi, warmth);
    float elev = smoothstep(0.0, 1.7, h);
    float lit = pow(sh, mix(2.0, 2.4, warmth));
    col = mix(lo * 0.8, mix(lo, hi, mix(0.5, 0.8, warmth)), lit);
    // engraving: lines across the slope that thicken where the light falls (bright lines on the dark plate)
    vec2 r = FRAG_PX;
    float hat = hatch((rot2(0.62) * r).y / 4.0, lit * 1.15 - 0.12);
    col = mix(col, hi * 1.2, hat * terrInk);
    col *= 0.88 + 0.24 * elev;
    // the shoreline: a thin lit edge
    col = mix(col, mix(C_ASH * 0.6, C_EMBER * 0.6, warmth), pxLine(h / max(fwidth(h), 1e-6), 0.4, 1.4) * 0.6);
    if (ghost > 0.0) {
      float cg = h / contour;
      float lg = pxLine(abs(fract(cg + 0.5) - 0.5) / max(fwidth(cg), 1e-5), 0.2, 1.0);
      col = mix(col, mix(C_BONE * 0.75, C_BONE * 0.95, warmth), lg * ghost * 0.55);
    }
  } else {
    // water: dark, a faint swell, moonlight (or sunlight) glints; teal at the shore when seaAcid is on
    float depth = smoothstep(0.0, 0.06, -h);
    vec3 deep = mix(C_INK * 0.75, mix(C_INK2, C_ACID * 0.1, 0.4), warmth * 0.6);
    vec3 shallow = mix(C_INK2 * 1.3, mix(C_ACID * 0.18, C_ACID * 0.32, warmth), seaAcid);
    col = mix(shallow, deep, depth);
    vec2 r = rot2(0.25) * w;
    float sw = vnoise(vec2(r.x * 0.6, r.y * 3.0 - t * 0.35)) * 0.5 + 0.5;
    col *= 0.92 + 0.16 * sw; // a slow swell, no glitter
    // foam lines at the shore
    float k = -h / 0.004;
    float foam = pxLine(abs(fract(k - t * 0.15) - 0.5) / max(fwidth(k), 1e-5), 0.1, 0.8) * (1.0 - smoothstep(0.3, 2.5, k));
    col = mix(col, mix(C_ASH * 0.5, C_ACID * 0.7, seaAcid), foam * 0.35);
  }
  return col;
}

void main() {
  vec2 px = vec2(FRAG_PX.x, 1080.0 - FRAG_PX.y); // y down, like the canvas
  float c = cos(-view.w), s = sin(-view.w);
  vec2 d = px - vec2(960.0, 540.0);
  vec2 w = view.xy + vec2(d.x * c - d.y * s, d.x * s + d.y * c) / view.z;
  float m = mapMix;
  if (split.w > 0.0) m = smoothstep(-split.w, split.w, dot(px, split.xy) - split.z);
  if (sheet > 0.0) { vec2 ins = step(vec2(0.0), w) * step(w, vec2(${WORLD.toFixed(1)})); m = max(m, sheet * ins.x * ins.y); }
  // the territory shows through the paper along the trail walked so far (and everywhere, as global goes to 1)
  float cutShadow = 0.0;
  if (reveal.w > 0.0) {
    vec2 tu = w / ${WORLD.toFixed(1)};
    float r = 0.0;
    if (tu.x >= 0.0 && tu.y >= 0.0 && tu.x <= 1.0 && tu.y <= 1.0) {
      // everything up to the last waypoint passed: its exact distance snapshot
      int k = int(revealK.x + 0.5);
      vec2 su = vec2(tu.x, (clamp(tu.y, 0.5 / 256.0, 1.0 - 0.5 / 256.0) + float(k / 4)) / 5.0);
      vec4 sv = texture(trailSnap, su);
      int ch = k - (k / 4) * 4;
      float dSnap = ch == 0 ? sv.r : ch == 1 ? sv.g : ch == 2 ? sv.b : sv.a;
      // the current leg: exact distance to its polyline (a round cap at the lamp)
      float dCur = 1e4;
      if (legN > 0.5 && w.x > legBox.x && w.y > legBox.y && w.x < legBox.z && w.y < legBox.w) {
        dCur = length(w - leg[0]);
        for (int i = 0; i < 31; i++) {
          if (float(i) + 1.5 > legN) break;
          vec2 a = leg[i], ab = leg[i + 1] - leg[i];
          float u = clamp(dot(w - a, ab) / max(dot(ab, ab), 1e-6), 0.0, 1.0);
          dCur = min(dCur, length(w - a - ab * u));
        }
      }
      float d = min(dSnap, dCur);
      float R = reveal.y + (0.5 * vnoise(w * 0.8) + 0.22 * vnoise(w * 2.6 + 3.3)) * min(1.0, reveal.y);
      float fw = max(fwidth(d), 1e-4);
      r = 1.0 - smoothstep(R - fw * 1.5, R + fw * 1.5, d);
      cutShadow = (1.0 - smoothstep(R, R + 0.9, d)) * (1.0 - r);
    }
    // the lighthouse: each sweep of the beam cuts the paper away a little further out (a spiral)
    if (beamR.w > 0.0) {
      vec2 bd = w - beam.xy;
      float th = mod(atan(bd.y, bd.x), 6.2831853);
      float passed = step(th, beam.z);
      float aLast = th + 6.2831853 * floor(max(0.0, beam.z - th) / 6.2831853);
      float BR = min(beamR.z, beamR.y + aLast * beamR.x);
      BR += (0.6 * vnoise(w * 0.7 + 9.1) + 0.25 * vnoise(w * 2.3)) * 1.4;
      float dB = length(bd);
      float fb = max(fwidth(dB), 1e-4);
      float rb = passed * (1.0 - smoothstep(BR - fb * 1.5, BR + fb * 1.5, dB));
      cutShadow = max(cutShadow * (1.0 - rb), passed * (1.0 - smoothstep(BR, BR + 0.9, dB)) * (1.0 - rb));
      r = max(r, rb);
    }
    // reveal.z: the country beyond the sheet's edge
    if (tu.x < 0.0 || tu.y < 0.0 || tu.x > 1.0 || tu.y > 1.0) r = max(r, reveal.z);
    m *= 1.0 - r;
  }
  if (lens.w > 0.0) { float inL = 1.0 - smoothstep(lens.z - 1.5, lens.z + 1.5, length(px - lens.xy)); m = mix(m, 1.0 - m, inL * lens.w); }
  vec3 col;
  if (m <= 0.001) col = terrCol(w);
  else if (m >= 0.999) col = mapCol(w);
  else col = mix(terrCol(w), mapCol(w), m);
  // outside the sheet the map stops (a dark desk); the territory goes on
  vec2 ow = step(vec2(0.0), w) * step(w, vec2(${WORLD.toFixed(1)}));
  col = mix(col, mix(col, C_INK2 * 1.15, m), 1.0 - ow.x * ow.y);
  col *= 1.0 - 0.28 * cutShadow; // the paper's cut edge casts a little shadow
  col = mix(col, C_INK, fadeOut);
  if (beam.w > 0.0) {
    // two beams turning, and the light they leave behind them as they pass
    vec2 bd = w - beam.xy;
    float dB = length(bd);
    float th = mod(atan(bd.y, bd.x), 6.2831853);
    float d1 = mod(beam.z - th, 6.2831853), d2 = mod(beam.z + 3.14159265 - th, 6.2831853);
    float wid = 0.045 + 0.35 / (1.0 + dB);
    float e1 = min(d1, 6.2831853 - d1), e2 = min(d2, 6.2831853 - d2);
    float lb = exp(-e1 * e1 / (wid * wid)) + exp(-e2 * e2 / (wid * wid)) + 0.10 * (exp(-d1 / 0.5) + exp(-d2 / 0.5));
    lb *= smoothstep(0.15, 1.2, dB) / (1.0 + dB * 0.035);
    col += C_EMBER * lb * beam.w * 0.42;
    col += C_EMBER * beam.w * 0.6 * exp(-dB * dB / 0.25);
  }
  fragColor = vec4(col, 1.0);
}`;

export interface TerrainOpts {
  view: View; mapMix?: number;
  split?: [number, number, number, number]; lens?: [number, number, number, number];
  misreg?: [number, number, number]; sun?: [number, number, number]; warmth?: number; relief?: number;
  seaAcid?: number; contour?: number; paperInk?: number; contourInk?: number; ghost?: number; terrInk?: number; t?: number; fadeOut?: number; sheet?: number;
  paper?: RGB;
  /** The lighthouse: [x, y, swept angle, light] and [km per rad, start radius, max radius, reveal on]. */
  beam?: [number, number, number, number]; beamR?: [number, number, number, number];
  /** [km walked, radius km, global 0..1]: the territory through the paper along the trail. */
  reveal?: [number, number, number];
}
/** The world as map or territory. One per scene; set options each frame with draw(). */
export class Terrain {
  pass = new FSPass(TERRAIN_FRAG, {
    hm: { value: null }, nz: { value: null }, trailTex: { value: null }, trailSnap: { value: null }, revealK: { value: new THREE.Vector2() }, leg: { value: Array.from({ length: 32 }, () => new THREE.Vector2()) }, legN: { value: 0 }, legBox: { value: new THREE.Vector4() }, reveal: { value: new THREE.Vector4() }, view: { value: new THREE.Vector4() }, mapMix: { value: 0 }, split: { value: new THREE.Vector4() },
    lens: { value: new THREE.Vector4() }, misreg: { value: new THREE.Vector3() }, sun: { value: new THREE.Vector3(-0.6, -0.5, 0.6) },
    warmth: { value: 0 }, relief: { value: 6 }, seaAcid: { value: 0 }, contour: { value: 0.05 }, paperInk: { value: 1 },
    contourInk: { value: 1 }, ghost: { value: 0 }, terrInk: { value: 0.6 }, t: { value: 0 }, fadeOut: { value: 0 }, sheet: { value: 0 }, beam: { value: new THREE.Vector4() }, beamR: { value: new THREE.Vector4() }, paperCol: { value: new THREE.Vector3(...LIN.bone) },
  });
  constructor() { this.pass.u.hm!.value = heightTexture(); this.pass.u.nz!.value = noiseTexture(); this.pass.u.trailTex!.value = trailTexture(); this.pass.u.trailSnap!.value = trailSnapTexture(); }
  draw(renderer: THREE.WebGLRenderer, out: THREE.WebGLRenderTarget, o: TerrainOpts) {
    const u = this.pass.u;
    (u.view!.value as THREE.Vector4).set(o.view.cx, o.view.cy, o.view.s, o.view.rot);
    u.mapMix!.value = o.mapMix ?? 0;
    (u.split!.value as THREE.Vector4).set(...(o.split ?? [0, 0, 0, 0]));
    (u.lens!.value as THREE.Vector4).set(...(o.lens ?? [0, 0, 0, 0]));
    (u.misreg!.value as THREE.Vector3).set(...(o.misreg ?? [0, 0, 0]));
    (u.sun!.value as THREE.Vector3).set(...(o.sun ?? [-0.6, -0.5, 0.6]));
    u.warmth!.value = o.warmth ?? 0;
    u.relief!.value = o.relief ?? 6;
    u.seaAcid!.value = o.seaAcid ?? 0;
    u.contour!.value = o.contour ?? 0.05;
    u.paperInk!.value = o.paperInk ?? 1;
    u.contourInk!.value = o.contourInk ?? 1;
    u.ghost!.value = o.ghost ?? 0;
    u.terrInk!.value = o.terrInk ?? 0.6;
    u.t!.value = o.t ?? 0;
    u.fadeOut!.value = o.fadeOut ?? 0;
    u.sheet!.value = o.sheet ?? 0;
    (u.beam!.value as THREE.Vector4).set(...(o.beam ?? [0, 0, 0, 0]));
    (u.beamR!.value as THREE.Vector4).set(...(o.beamR ?? [0, 0, 0, 0]));
    (u.reveal!.value as THREE.Vector4).set(o.reveal?.[0] ?? 0, o.reveal?.[1] ?? 0, o.reveal?.[2] ?? 0, o.reveal ? 1 : 0);
    if (o.reveal) {
      // the last waypoint passed
      const T = track(), sNow = o.reveal[0];
      let k = 0;
      for (let w = 0; w < T.wayAt.length; w++) if (T.len[T.wayAt[w]!]! <= sNow) k = w;
      const s0 = T.len[T.wayAt[k]!]!;
      (u.revealK!.value as THREE.Vector2).set(Math.min(19, k), s0);
      const s1 = Math.min(T.total, sNow);
      const n = s1 > s0 + 1e-3 ? Math.min(32, Math.max(2, Math.ceil((s1 - s0) / 0.35) + 1)) : 1;
      const L = u.leg!.value as THREE.Vector2[];
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (let i = 0; i < n; i++) {
        const p = trackAt(n > 1 ? s0 + ((s1 - s0) * i) / (n - 1) : s1);
        L[i]!.set(p.x, p.y);
        x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y);
      }
      const g = o.reveal[1] + 2.5;
      u.legN!.value = n;
      (u.legBox!.value as THREE.Vector4).set(x0 - g, y0 - g, x1 + g, y1 + g);
    }
    (u.paperCol!.value as THREE.Vector3).set(...(o.paper ?? LIN.bone));
    this.pass.render(renderer, out);
  }
}

// ------------------------------------------------------------------ the track (life as walked)
/** The lamp at the track's head (draw into an additive LineBatch). */
export function lamp(lb: LineBatch, x: number, y: number, t: number, scale = 1, I = 1) {
  const fl = 0.9 + 0.1 * Math.sin(t * 31.7) * Math.sin(t * 19.3);
  const k = I * fl;
  lb.seg2(x, y, x + 0.01, y, 46 * scale, sc(LIN.signal, 0.22 * k), 0.22);
  lb.seg2(x, y, x + 0.01, y, 16 * scale, sc(LIN.ember, 1.6 * k), 0.8);
  lb.seg2(x, y, x + 0.01, y, 5.5 * scale, [4.5 * k, 3.9 * k, 3.0 * k], 1);
}
/**
 * Draw the walked track from arc length s0 to s1 (km) in view v into an additive batch: a gold line, a hotter
 * last stretch, the lamp at the head. Returns the head's screen position.
 */
export function drawTrack(lb: LineBatch, v: View, s1: number, t: number, o: { s0?: number; width?: number; I?: number; head?: number; glow?: number } = {}) {
  const T = track();
  const s0 = o.s0 ?? 0;
  const w = o.width ?? 2.4, I = o.I ?? 1;
  let prev: { x: number; y: number } | null = null;
  const end = Math.min(s1, T.total);
  const hotLen = 3.5; // km that glow behind the head
  for (let i = 0; i < T.pts.length; i++) {
    const L = T.len[i]!;
    if (L < s0) continue;
    const p = L > end ? trackAt(end) : T.pts[i]!;
    const q = w2s(v, p.x, p.y);
    if (prev) {
      const hot = clamp(1 - (end - L) / hotLen);
      const col = sc(LIN.signal, (0.9 + 1.1 * hot * (o.glow ?? 1)) * I);
      lb.seg2(prev.x, prev.y, q.x, q.y, w + hot * 1.2, col, 0.95);
    }
    prev = q;
    if (L > end) break;
  }
  const h = trackAt(end);
  const hp = w2s(v, h.x, h.y);
  if ((o.head ?? 1) > 0 && end > s0) lamp(lb, hp.x, hp.y, t, 1, (o.head ?? 1) * I);
  return { ...hp, angle: h.angle + v.rot };
}

// ------------------------------------------------------------------ the plan (life as drawn)
/** Ruled road of the plan from the first place, drawn up to fraction k (0..1 of its length), in screen space. */
export function drawPlan(lb: LineBatch, v: View, k: number, col: RGB, o: { width?: number; alpha?: number; dash?: number; ticks?: number } = {}) {
  const P = PLAN_PTS.map((p) => w2s(v, p.x, p.y));
  const segL = P.slice(1).map((p, i) => Math.hypot(p.x - P[i]!.x, p.y - P[i]!.y));
  const tot = segL.reduce((a, b) => a + b, 0);
  let left = k * tot;
  const w = o.width ?? 1.6, al = o.alpha ?? 0.9;
  for (let i = 0; i < segL.length && left > 0; i++) {
    const a = P[i]!, b = P[i + 1]!;
    const u = Math.min(1, left / segL[i]!);
    const bx = a.x + (b.x - a.x) * u, by = a.y + (b.y - a.y) * u;
    if (o.dash) {
      const n = Math.max(1, Math.floor((segL[i]! * u) / o.dash));
      for (let d = 0; d < n; d += 2) {
        const u0 = d / n, u1 = Math.min(1, (d + 1) / n);
        lb.seg2(a.x + (bx - a.x) * u0, a.y + (by - a.y) * u0, a.x + (bx - a.x) * u1, a.y + (by - a.y) * u1, w, col, al);
      }
    } else lb.seg2(a.x, a.y, bx, by, w, col, al);
    // the road's year ticks: perpendicular marks every `ticks` px
    if (o.ticks) {
      const nx = -(b.y - a.y) / segL[i]!, ny = (b.x - a.x) / segL[i]!;
      for (let d = o.ticks; d < segL[i]! * u; d += o.ticks) {
        const x = a.x + ((b.x - a.x) * d) / segL[i]!, y = a.y + ((b.y - a.y) * d) / segL[i]!;
        lb.seg2(x - nx * 5, y - ny * 5, x + nx * 5, y + ny * 5, 1, col, al * 0.8);
      }
    }
    left -= segL[i]!;
  }
  return P;
}
/** A plan place marker: a ring with a dot (Canvas2D). */
export function placeMark(c: CanvasRenderingContext2D, x: number, y: number, r: number, col: string, k = 1) {
  if (k <= 0) return;
  c.save();
  c.strokeStyle = col; c.fillStyle = col; c.lineWidth = 1.4;
  c.beginPath(); c.arc(x, y, r * ease.outBack(clamp(k)), 0, TAU); c.stroke();
  c.beginPath(); c.arc(x, y, r * 0.35, 0, TAU); c.fill();
  c.restore();
}
export { PLAN };

// ------------------------------------------------------------------ map furniture
/** The compass star of the album cover: a four-point star with a ring (Canvas2D). */
export function compassStar(c: CanvasRenderingContext2D, x: number, y: number, R: number, o: { col?: string; fill?: string; rot?: number; ring?: boolean; minor?: boolean; alpha?: number; lw?: number } = {}) {
  c.save();
  c.globalAlpha *= o.alpha ?? 1;
  c.translate(x, y); c.rotate(o.rot ?? 0);
  const col = o.col ?? rgba('bone', 0.9);
  c.strokeStyle = col; c.lineWidth = o.lw ?? 1.2;
  const pt = (n: number, len: number, wid: number, fillHalf: boolean) => {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + (n === 4 ? 0 : Math.PI / 4);
      const ca = Math.cos(a), sa = Math.sin(a);
      const tip = { x: ca * len, y: sa * len };
      const l = { x: -sa * wid, y: ca * wid }, r = { x: sa * wid, y: -ca * wid };
      c.beginPath(); c.moveTo(l.x, l.y); c.lineTo(tip.x, tip.y); c.lineTo(r.x, r.y); c.closePath(); c.stroke();
      if (fillHalf) { c.fillStyle = o.fill ?? col; c.beginPath(); c.moveTo(0, 0); c.lineTo(tip.x, tip.y); c.lineTo(r.x, r.y); c.closePath(); c.fill(); }
    }
  };
  if (o.minor !== false) pt(4, R * 0.55, R * 0.09, false);
  pt(4, R, R * 0.13, true);
  if (o.ring !== false) { c.beginPath(); c.arc(0, 0, R * 0.62, 0, TAU); c.stroke(); c.beginPath(); c.arc(0, 0, R * 0.66, 0, TAU); c.stroke(); }
  c.font = font(F.mono(500), Math.max(9, R * 0.16)); c.fillStyle = col; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText('N', 0, -R - R * 0.16);
  c.restore();
}
/** Scale bar: `km` long in view v, at (x, y) (Canvas2D). */
export function scaleBar(c: CanvasRenderingContext2D, v: View, x: number, y: number, km: number, col: string, label?: string) {
  const L = km * v.s;
  c.save();
  c.strokeStyle = col; c.fillStyle = col; c.lineWidth = 1;
  c.strokeRect(x, y, L, 6);
  for (let i = 0; i < 4; i += 2) c.fillRect(x + (L / 4) * i, y, L / 4, 6);
  c.font = font(F.mono(400), 11); c.letterSpacing = '1.5px'; c.textBaseline = 'alphabetic';
  c.textAlign = 'left'; c.fillText('0', x - 3, y - 6);
  c.textAlign = 'right'; c.fillText(label ?? `${km} KM`, x + L + 8, y - 6);
  c.restore();
}
/** Neatline: the double frame of a map sheet with graticule ticks every `step` km (Canvas2D). k: 0..1 draws it. */
export function neatline(c: CanvasRenderingContext2D, v: View, col: string, o: { step?: number; k?: number; labels?: boolean } = {}) {
  const k = o.k ?? 1;
  if (k <= 0) return;
  const corners = [w2s(v, 0, 0), w2s(v, WORLD, 0), w2s(v, WORLD, WORLD), w2s(v, 0, WORLD)];
  c.save();
  c.strokeStyle = col; c.fillStyle = col;
  // the inner frame runs clockwise as k goes 0 -> 0.8; the outer hairline and ticks come in after
  const kk = clamp(k / 0.8);
  c.lineWidth = 1.6;
  c.beginPath(); c.moveTo(corners[0]!.x, corners[0]!.y);
  for (let i = 1; i <= 4; i++) {
    const p = corners[i - 1]!, q = corners[i % 4]!;
    const u = clamp(kk * 4 - (i - 1));
    if (u <= 0) break;
    c.lineTo(p.x + (q.x - p.x) * u, p.y + (q.y - p.y) * u);
  }
  c.stroke();
  const k2 = clamp((k - 0.8) / 0.2);
  if (k2 > 0) {
    c.globalAlpha *= k2;
    // outer hairline: the frame pushed out 7 px
    const cx = (corners[0]!.x + corners[2]!.x) / 2, cy = (corners[0]!.y + corners[2]!.y) / 2;
    const out = corners.map((p) => { const dx = p.x - cx, dy = p.y - cy, L = Math.hypot(dx, dy); return { x: p.x + (dx / L) * 9.9, y: p.y + (dy / L) * 9.9 }; });
    c.lineWidth = 0.8;
    c.beginPath(); out.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y))); c.closePath(); c.stroke();
    const step = o.step ?? 10;
    c.font = font(F.mono(400), 10); c.letterSpacing = '1px'; c.textBaseline = 'alphabetic';
    for (let km = step; km < WORLD; km += step) {
      const top = w2s(v, km, 0), bot = w2s(v, km, WORLD), lef = w2s(v, 0, km), rig = w2s(v, WORLD, km);
      const nT = w2s(v, km, -0.9), nB = w2s(v, km, WORLD + 0.9), nL = w2s(v, -0.9, km), nR = w2s(v, WORLD + 0.9, km);
      c.beginPath();
      c.moveTo(top.x, top.y); c.lineTo(nT.x, nT.y); c.moveTo(bot.x, bot.y); c.lineTo(nB.x, nB.y);
      c.moveTo(lef.x, lef.y); c.lineTo(nL.x, nL.y); c.moveTo(rig.x, rig.y); c.lineTo(nR.x, nR.y);
      c.stroke();
      if (o.labels !== false && Math.abs(v.rot) < 0.01) {
        c.textAlign = 'center'; c.fillText(String(km), top.x, top.y - 16);
        c.textAlign = 'right'; c.fillText(String(km), lef.x - 16, lef.y + 3);
      }
    }
  }
  c.restore();
}

// ------------------------------------------------------------------ typography
export interface WordBox { w: Word; i0: number; i1: number; x0: number; x1: number }
/** Kerned x extents of each word of a line set as one string (relative to the line's origin). */
export function wordBoxes(line: Line, family: string, size: number, tracking = 0, text = line.text): WordBox[] {
  const out: WordBox[] = [];
  let from = 0;
  for (const w of line.words) {
    const i0 = text.indexOf(w.w, from);
    const i1 = i0 + w.w.length;
    from = i1;
    out.push({ w, i0, i1, x0: glyphX(text, i0, family, size, tracking), x1: glyphX(text, i0, family, size, tracking) + measure(w.w, family, size, tracking) });
  }
  return out;
}

export interface KaraokeStyle {
  family: string;
  size: number;
  tracking?: number;
  /** colour of sung text */
  sung: string;
  /** colour of not-yet-sung text (shown from `lead` seconds before the line) — '' = hidden until sung */
  unsung: string;
  /** colour of the word being sung (blends to `sung` after it ends) */
  active?: string;
  /** anticipation: unsung words show this long before the line starts */
  lead?: number;
  /** 'wipe': per-word left-to-right wipe; 'reveal': each word fades/rises in at its start */
  mode?: 'wipe' | 'reveal';
  align?: 'left' | 'center' | 'right';
  /** override the displayed text (must contain the words in order) */
  text?: string;
}

/** Draw a lyric line at (x, baseline y) with karaoke progress at t. Returns the line's width. */
export function drawKaraoke(c: CanvasRenderingContext2D, line: Line, x: number, y: number, t: number, s: KaraokeStyle): number {
  const text = s.text ?? line.text;
  const tr = s.tracking ?? 0;
  const wTot = measure(text, s.family, s.size, tr);
  const ox = s.align === 'center' ? x - wTot / 2 : s.align === 'right' ? x - wTot : x;
  const boxes = wordBoxes(line, s.family, s.size, tr, text);
  c.save();
  c.font = font(s.family, s.size);
  c.letterSpacing = `${tr}px`;
  c.textBaseline = 'alphabetic';
  c.textAlign = 'left';
  const lead = s.lead ?? 0.35;
  const mode = s.mode ?? 'wipe';
  const showUnsung = !!s.unsung && t > line.start - lead;
  const ua = showUnsung ? clamp((t - (line.start - lead)) / 0.25) : 0;
  const top = y - s.size * 1.3, hgt = s.size * 1.9, pad = s.size * 0.14;
  const clipDraw = (x0: number, x1: number, col: string, alpha = 1, dy = 0) => {
    if (x1 <= x0 || alpha <= 0) return;
    c.save();
    c.globalAlpha *= alpha;
    c.beginPath(); c.rect(ox + x0, top, x1 - x0, hgt); c.clip();
    c.fillStyle = col;
    c.fillText(text, ox, y + dy);
    c.restore();
  };
  for (let i = 0; i < boxes.length; i++) {
    const b = boxes[i]!;
    // each word owns [its x0 - pad, next word's x0 - pad): spaces go with the word before them
    const xa = b.x0 - pad, xb = i + 1 < boxes.length ? boxes[i + 1]!.x0 - pad : b.x1 + pad * 2;
    const p = LyricsC.wordProgress(b.w, t);
    const col = s.active && t < b.w.end + 0.3 ? mixCss(s.active, s.sung, clamp((t - b.w.end) / 0.3)) : s.sung;
    if (t < b.w.start) { if (showUnsung) clipDraw(xa, xb, s.unsung, ua); continue; }
    if (mode === 'wipe') {
      const xw = p >= 1 ? xb : b.x0 + (b.x1 - b.x0) * Math.min(1, p * 1.1);
      clipDraw(xa, xw, col);
      if (showUnsung) clipDraw(xw, xb, s.unsung, ua);
    } else {
      const k = ease.outCubic(clamp((t - b.w.start) / 0.14));
      if (showUnsung && k < 1) clipDraw(xa, xb, s.unsung, ua * (1 - k));
      clipDraw(xa, xb, col, k, (1 - k) * s.size * 0.12);
    }
  }
  c.restore();
  return wTot;
}

/** Linear blend of two CSS rgba()/hex colours (sRGB space; fine for short highlight fades). */
export function mixCss(a: string, b: string, k: number): string {
  const pa = parseCss(a), pb = parseCss(b);
  const m = (i: number) => pa[i]! + (pb[i]! - pa[i]!) * k;
  return `rgba(${m(0).toFixed(0)},${m(1).toFixed(0)},${m(2).toFixed(0)},${m(3).toFixed(3)})`;
}
function parseCss(s: string): number[] {
  if (s.startsWith('#')) { const n = parseInt(s.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1]; }
  const m = s.match(/[\d.]+/g)!.map(Number);
  return [m[0]!, m[1]!, m[2]!, m[3] ?? 1];
}

/** Mono annotation (IBM Plex Mono, tracked caps). */
export function mono(c: CanvasRenderingContext2D, text: string, x: number, y: number, o: { size?: number; color?: string; align?: CanvasTextAlign; track?: number; weight?: number } = {}) {
  c.save();
  c.font = font(F.mono(o.weight ?? 400), o.size ?? 13);
  c.letterSpacing = `${o.track ?? 2}px`;
  c.textAlign = o.align ?? 'left';
  c.textBaseline = 'alphabetic';
  c.fillStyle = o.color ?? rgba('ash', 0.85);
  c.fillText(text, x, y);
  c.restore();
}

/** Deterministic small jitter for hand-made marks. */
export const jit = (i: number, seed: number, amp: number) => (hash(i, seed) - 0.5) * 2 * amp;

/** Degrees -> radians. */
export const rad = (d: number) => (d * Math.PI) / 180;

// ------------------------------------------------------------------ text on an arc
const layoutCache = new Map<string, TextLayout>();
export function cachedLayout(text: string, family: string, size: number, tracking = 0): TextLayout {
  const key = `${text}|${family}|${size}|${tracking}`;
  let l = layoutCache.get(key);
  if (!l) { l = layout(text, family, size, tracking); layoutCache.set(key, l); }
  return l;
}
/**
 * A lyric line along a circular arc: centre (cx, cy), baseline radius r, centred on angle a0 (radians, screen,
 * clockwise). Glyphs stand upright outward (or inward with `inside`). Per-glyph karaoke: a glyph turns sung when
 * its word's progress passes it; the word being sung is `active`.
 */
export function drawArcKaraoke(c: CanvasRenderingContext2D, line: Line, cx: number, cy: number, r: number, a0: number, t: number, s: KaraokeStyle & { inside?: boolean; alpha?: number }) {
  const text = s.text ?? line.text;
  const tr = s.tracking ?? 0;
  const L = cachedLayout(text, s.family, s.size, tr);
  const boxes = wordBoxes(line, s.family, s.size, tr, text);
  const dir = s.inside ? -1 : 1;
  const span = L.width / r;
  const lead = s.lead ?? 0.35;
  const ua = s.unsung && t > line.start - lead ? clamp((t - (line.start - lead)) / 0.25) : 0;
  c.save();
  c.font = font(s.family, s.size);
  c.letterSpacing = '0px';
  c.textBaseline = 'alphabetic';
  c.textAlign = 'left';
  for (const g of L.glyphs) {
    if (g.ch === ' ') continue;
    const b = boxes.find((x) => g.i >= x.i0 && g.i < x.i1);
    let col = s.unsung, al = ua;
    if (b) {
      const p = LyricsC.wordProgress(b.w, t);
      const fr = (g.i - b.i0 + 0.5) / (b.i1 - b.i0);
      if (t >= b.w.start && p >= fr * 0.9) {
        col = s.active && t < b.w.end + 0.3 ? mixCss(s.active, s.sung, clamp((t - b.w.end) / 0.3)) : s.sung;
        al = 1;
      }
    }
    if (!col || al <= 0) continue;
    const a = a0 + dir * (-span / 2 + (g.x + g.w / 2) / r);
    c.save();
    c.globalAlpha *= al * (s.alpha ?? 1);
    c.fillStyle = col;
    c.translate(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    c.rotate(a + dir * Math.PI / 2);
    c.fillText(g.ch, -g.w / 2, 0);
    c.restore();
  }
  c.restore();
}


/** Lyric line drawn by a pen in a single-stroke font, each char written while its word is sung. */
export function charTimes(line: Line, text: string): [number, number][] {
  const out: [number, number][] = Array.from(text, () => [Infinity, Infinity] as [number, number]);
  let from = 0;
  for (const w of line.words) {
    const i0 = text.indexOf(w.w, from);
    if (i0 < 0) continue;
    const n = w.w.length, dur = Math.max(0.12, Math.min(w.end - w.start, 0.12 * n + 0.25));
    for (let k = 0; k < n; k++) out[i0 + k] = [w.start + (dur * k) / n, w.start + (dur * (k + 1)) / n];
    // the space after the word goes with it
    if (i0 + n < text.length) out[i0 + n] = [w.start + dur, w.start + dur];
    from = i0 + n;
  }
  // unmatched chars (punctuation) inherit the previous char's end
  let last: [number, number] = [line.start, line.start];
  for (let i = 0; i < out.length; i++) { if (out[i]![0] === Infinity) out[i] = [last[1], last[1]]; last = out[i]!; }
  return out;
}

/** Find the n-th line (0-based occurrence) whose text starts with `prefix`. */
export function lineBy(ly: Lyrics, prefix: string, n = 0): Line {
  const p = prefix.toLowerCase();
  const m = ly.lines.filter((l) => l.text.toLowerCase().replace(/[’']/g, "'").startsWith(p.replace(/[’']/g, "'")));
  const l = m[n];
  if (!l) throw new Error(`lyric line not found: ${prefix} #${n}`);
  return l;
}
